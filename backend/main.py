import json
import os
import re
import hashlib
import requests
from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, func, select

from database import get_db, DocumentChunk, Document, ChatHistory, SessionLocal, UPLOAD_DIR, VAULT_DIR, get_file_paths, generate_file_hash

app = FastAPI(title="Cerebro RAG - Gestión Unificada de Conocimiento")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    filename: str
    text: str
    type: str = "note"
    tags: list[str] = Field(default_factory=list)

class QueryRequest(BaseModel):
    question: str
    session_id: str = "default_session"

class SearchRequest(BaseModel):
    query: str
    search_mode: str = "hybrid"
    types: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    limit: int = 12

OLLAMA_URL = "http://localhost:11434/api/embeddings"
OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate"

_embedding_cache: dict = {}

def get_ollama_embedding(text_chunk: str) -> list[float]:
    cache_key = hashlib.md5(text_chunk.encode()).hexdigest()
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]
    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": "nomic-embed-text", "prompt": text_chunk}
        )
        response.raise_for_status()
        embedding = response.json()["embedding"]
        _embedding_cache[cache_key] = embedding
        return embedding
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error en Ollama Embeddings: {str(e)}")

def chunk_text(text_str: str, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    chunks = []
    start = 0
    if not text_str: return chunks
    while start < len(text_str):
        end = start + chunk_size
        chunks.append(text_str[start:end])
        start += (chunk_size - overlap)
    return chunks

def condense_query(history_context: str, current_question: str) -> str:
    if not history_context:
        return current_question
    condense_prompt = (
        "Dada la siguiente conversación reciente y una nueva pregunta del usuario, "
        "genera una única consulta de búsqueda optimizada en español. Tu objetivo es resolver pronombres o referencias "
        "ambiguas (ej: si el usuario pregunta '¿quién lo creó?' basándose en un tema anterior, reescribe la pregunta especificando el tema).\n"
        "REGLA: Devuelve ÚNICAMENTE la consulta reescrita, sin introducciones ni comentarios.\n\n"
        f"[HISTORIAL DE CONVERSACIÓN]:\n{history_context}\n"
        f"[NUEVA PREGUNTA]: {current_question}\n\n"
        "CONSULTA OPTIMIZADA:"
    )
    try:
        response = requests.post(
            OLLAMA_GENERATE_URL,
            json={"model": "llama3.1:8b", "prompt": condense_prompt, "stream": False}
        )
        response.raise_for_status()
        query_condensada = response.json()["response"].strip().replace('"', '')
        return query_condensada if query_condensada else current_question
    except Exception:
        return current_question

def _process_text(db: Session, filename: str, text_content: str, doc_type: str = "note", tags: list[str] = None, save_original: bool = True) -> int:
    if tags is None:
        tags = []
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")

    existing = db.query(Document).filter(Document.filename == filename).first()
    if existing:
        if existing.file_path and os.path.exists(existing.file_path):
            os.remove(existing.file_path)
        db.delete(existing)
        db.commit()

    file_path = None
    file_hash = None
    original_filename = filename
    if save_original:
        is_note = doc_type == "note"
        file_path, file_hash, _ = get_file_paths(filename, text_content.encode('utf-8'), is_note=is_note)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text_content)

    doc = Document(
        filename=filename,
        type=doc_type,
        file_path=file_path,
        file_hash=file_hash,
        original_filename=original_filename,
        tags=tags,
        rag_enabled=True
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    chunks = chunk_text(text_content)
    for chunk in chunks:
        vector = get_ollama_embedding(chunk)
        db_chunk = DocumentChunk(
            document_id=doc.id,
            filename=filename,
            content=chunk,
            embedding=vector,
            type=doc_type,
            tags=tags,
            rag_enabled=True
        )
        db.add(db_chunk)
    db.commit()

    db.execute(text(
        "UPDATE document_chunks SET search_vector = to_tsvector('pg_catalog.spanish', content) WHERE document_id = :d"
    ).params(d=doc.id))
    db.execute(text(
        "UPDATE document_chunks SET tags = :tags, rag_enabled = :rag WHERE document_id = :d"
    ).params(tags=tags, rag=True, d=doc.id))
    db.commit()
    return len(chunks)

def _run_eval_async(db, question, context, answer, session_id):
    import threading
    def _run():
        score = evaluate_rag(context, question, answer)
        db_session = SessionLocal()
        try:
            hist = db_session.query(ChatHistory).filter(ChatHistory.session_id == session_id).order_by(ChatHistory.id.desc()).first()
            if hist:
                hist.eval_score = score
                db_session.commit()
        finally:
            db_session.close()
    threading.Thread(target=_run, daemon=True).start()

def evaluate_rag(context: str, question: str, answer: str) -> dict:
    eval_prompt = (
        "Actúa como un auditor experto en sistemas RAG e Inteligencia Artificial.\n"
        "Califica la calidad de la respuesta basándote EXCLUSIVAMENTE en el contexto proveído.\n\n"
        f"CONTEXTO RECUPERADO:\n{context}\n\n"
        f"PREGUNTA DEL USUARIO:\n{question}\n\n"
        f"RESPUESTA GENERADA:\n{answer}\n\n"
        "Devuelve un JSON plano estrictamente con estas tres claves, sin markdown ni texto extra:\n"
        '{"faithfulness": int_de_1_a_5, "relevance": int_de_1_a_5, "reasoning": "justificación"}'
    )
    try:
        response = requests.post(
            OLLAMA_GENERATE_URL,
            json={"model": "llama3.1:8b", "prompt": eval_prompt, "stream": False, "format": "json"}
        )
        return json.loads(response.json()["response"])
    except Exception:
        return {"faithfulness": 0, "relevance": 0, "reasoning": "Error al procesar la métrica."}

# --- HEALTH & DOCUMENTS ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "connection": "Postgres + pgvector conectado"}

@app.get("/api/documents")
def list_documents(
    search: Optional[str] = None,
    type_filter: Optional[str] = None,
    tag_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Document)
    if search:
        q = q.filter(Document.filename.like(f"%{search}%"))
    if type_filter:
        q = q.filter(Document.type == type_filter)
    if tag_filter:
        q = q.filter(func.array_position(Document.tags, tag_filter) > 0)
    docs = q.order_by(Document.created_at.desc()).all()

    documents = []
    for doc in docs:
        chunks_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).count()
        documents.append({
            "id": doc.id,
            "filename": doc.filename,
            "type": doc.type,
            "file_path": doc.file_path,
            "file_hash": doc.file_hash,
            "original_filename": doc.original_filename,
            "chunks_count": chunks_count,
            "tags": doc.tags or [],
            "rag_enabled": doc.rag_enabled,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        })
    return {"documents": documents}

@app.get("/api/items")
def list_knowledge_items(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    items = []
    for doc in docs:
        items.append({
            "filename": doc.filename,
            "type": doc.type,
            "tags": doc.tags or [],
            "rag_enabled": doc.rag_enabled,
        })
    return items

@app.post("/api/ingest")
def ingest_item(payload: IngestRequest, db: Session = Depends(get_db)):
    filename = payload.filename
    if payload.type == "note" and not filename.endswith('.md'):
        if filename.endswith('.txt'):
            filename = filename[:-4] + '.md'
        elif '.' in filename:
            filename = filename.rsplit('.', 1)[0] + '.md'
        else:
            filename = filename + '.md'
    chunk_count = _process_text(db, filename, payload.text, payload.type, payload.tags)
    return {"status": "success", "message": f"'{filename}' guardado e indexado.", "chunks": chunk_count}

@app.delete("/api/documents/{filename}")
def delete_document(filename: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"status": "success", "message": f"'{filename}' eliminado."}

@app.patch("/api/documents/{filename}/toggle-rag")
def toggle_rag(filename: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    doc.rag_enabled = not doc.rag_enabled
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).update({"rag_enabled": doc.rag_enabled})
    db.commit()
    return {"status": "success", "message": "Estado RAG alternado.", "rag_enabled": doc.rag_enabled}

@app.patch("/api/documents/{filename}/tags")
def update_tags(filename: str, tags: list[str], db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    doc.tags = tags
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).update({"tags": tags})
    db.commit()
    return {"status": "success", "message": "Tags actualizados.", "tags": tags}

@app.get("/api/documents/{filename}")
def get_document(filename: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    content = ""
    if doc.file_path and os.path.exists(doc.file_path):
        with open(doc.file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    return {
        "filename": doc.filename,
        "type": doc.type,
        "file_path": doc.file_path,
        "file_hash": doc.file_hash,
        "original_filename": doc.original_filename,
        "content": content,
        "tags": doc.tags or [],
        "rag_enabled": doc.rag_enabled,
        "chunks_count": db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).count(),
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }

@app.get("/api/documents/{filename}/download")
def download_document(filename: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Archivo original no encontrado.")
    from fastapi.responses import FileResponse
    return FileResponse(doc.file_path, filename=doc.original_filename or doc.filename)

@app.get("/api/documents/{filename}/content")
def get_document_content(filename: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    content = ""
    if doc.file_path and os.path.exists(doc.file_path):
        with open(doc.file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    return {"filename": doc.filename, "content": content}

@app.post("/api/ingest-file")
def ingest_file(
    file: UploadFile = File(...),
    filename: str = Form(...),
    item_type: str = Form("document"),
    tags: str = Form(""),
    db: Session = Depends(get_db)
):
    import pypdf
    import io
    import pytesseract
    from PIL import Image

    contents = file.file.read()
    text_content = ""

    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''

    image_extensions = ('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff')

    if ext == 'pdf':
        try:
            reader = pypdf.PdfReader(io.BytesIO(contents))
            text_parts = [page.extract_text() or '' for page in reader.pages]
            text_content = '\n'.join(text_parts)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al procesar PDF: {str(e)}")
    elif ext in image_extensions:
        try:
            img = Image.open(io.BytesIO(contents))
            text_content = pytesseract.image_to_string(img, lang='spa+eng')
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al procesar imagen: {str(e)}")
    elif ext in ('txt', 'md', 'html', 'csv', 'json'):
        text_content = contents.decode('utf-8', errors='replace')
    else:
        text_content = contents.decode('utf-8', errors='replace')

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="El archivo no contiene texto legible.")

    if not filename.endswith(f'.{ext}'):
        filename = f"{filename}.{ext}" if ext else f"{filename}.txt"

    tag_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else []

    hashed_path, file_hash, saved_ext = get_file_paths(filename, contents, is_note=False)
    with open(hashed_path, 'wb') as f:
        f.write(contents)

    chunk_count = _process_text(db, filename, text_content, item_type, tag_list, save_original=False)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if doc:
        doc.file_path = hashed_path
        doc.file_hash = file_hash
        doc.original_filename = filename
        db.commit()
    return {"status": "success", "message": f"'{filename}' guardado e indexado.", "chunks": chunk_count}

@app.get("/api/tags")
def list_tags(db: Session = Depends(get_db)):
    rows = db.query(DocumentChunk.tags).distinct().all()
    all_tags = set()
    for r in rows:
        if r[0]:
            all_tags.update(r[0])
    return {"tags": sorted(all_tags)}

@app.post("/api/search")
def hybrid_search(payload: SearchRequest, db: Session = Depends(get_db)):
    """
    Búsqueda híbrida con filtros.
    search_mode: 'hybrid' (vector + FTS), 'semantic' (vector only), 'exact' (FTS only)
    """
    query_text = payload.query.strip()
    if not query_text:
        return {"results": [], "sources": []}

    is_exact = '"' in query_text
    search_mode = "exact" if is_exact else payload.search_mode

    query_text_clean = query_text.replace('"', '').strip()

    query_text_for_search = query_text_clean

    vector_results = []
    text_results = []

    if search_mode in ("hybrid", "semantic"):
        question_vector = get_ollama_embedding(query_text_for_search)
        vector_results = db.query(DocumentChunk).filter(
            DocumentChunk.rag_enabled == True
        ).order_by(
            DocumentChunk.embedding.cosine_distance(question_vector)
        ).limit(10).all()

    if search_mode in ("hybrid", "exact"):
        words = [w for w in query_text_clean.replace("?", "").split() if len(w) > 2]
        fts_query = " & ".join(words) if words else query_text_clean
        if fts_query:
            text_results = db.query(DocumentChunk).filter(
                text("search_vector @@ to_tsquery('pg_catalog.spanish', :query)")
                .bindparams(query=fts_query)
            ).filter(DocumentChunk.rag_enabled == True).limit(10).all()

    if payload.types:
        type_filter = payload.types
        vector_results = [r for r in vector_results if r.type in type_filter]
        text_results = [r for r in text_results if r.type in type_filter]

    if payload.tags:
        for tag in payload.tags:
            vector_results = [r for r in vector_results if tag in (r.tags or [])]
            text_results = [r for r in text_results if tag in (r.tags or [])]

    rrf_scores = {}
    k = 60
    for rank, chunk in enumerate(vector_results):
        if chunk.id not in rrf_scores: rrf_scores[chunk.id] = {"chunk": chunk, "score": 0.0}
        rrf_scores[chunk.id]["score"] += 1.0 / (k + rank + 1)
    for rank, chunk in enumerate(text_results):
        if chunk.id not in rrf_scores: rrf_scores[chunk.id] = {"chunk": chunk, "score": 0.0}
        rrf_scores[chunk.id]["score"] += 1.0 / (k + rank + 1)

    sorted_results = sorted(rrf_scores.values(), key=lambda x: x["score"], reverse=True)
    relevant_chunks = [item["chunk"] for item in sorted_results[:payload.limit]]

    context_text = "\n---\n".join([chunk.content for chunk in relevant_chunks])
    results = [{"id": chunk.id, "filename": chunk.filename, "type": chunk.type, "tags": chunk.tags, "preview": chunk.content[:120] + "...", "rag_enabled": chunk.rag_enabled} for chunk in relevant_chunks]

    return {"results": results, "context": context_text}

# --- CHAT & RAG QUERY ---

@app.post("/api/query")
def query_rag(payload: QueryRequest, db: Session = Depends(get_db)):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta está vacía.")

    past_messages = db.query(ChatHistory).filter(ChatHistory.session_id == payload.session_id).order_by(ChatHistory.created_at.desc()).limit(4).all()
    past_messages.reverse()

    history_context = ""
    for msg in past_messages:
        history_context += f"{'Usuario' if msg.role == 'user' else 'Asistente'}: {msg.content}\n"

    search_query = condense_query(history_context, payload.question)

    question_vector = get_ollama_embedding(search_query)
    vector_results = db.query(DocumentChunk).filter(
        DocumentChunk.rag_enabled == True
    ).order_by(
        DocumentChunk.embedding.cosine_distance(question_vector)
    ).limit(8).all()

    words = [w for w in search_query.replace("?", "").split() if len(w) > 2]
    fts_query = " & ".join(words) if words else search_query
    text_results = db.query(DocumentChunk).filter(
        text("search_vector @@ to_tsquery('pg_catalog.spanish', :query)").bindparams(query=fts_query)
    ).filter(DocumentChunk.rag_enabled == True).limit(8).all() if fts_query else []

    rrf_scores = {}
    k = 60
    for rank, chunk in enumerate(vector_results):
        if chunk.id not in rrf_scores: rrf_scores[chunk.id] = {"chunk": chunk, "score": 0.0}
        rrf_scores[chunk.id]["score"] += 1.0 / (k + rank + 1)
    for rank, chunk in enumerate(text_results):
        if chunk.id not in rrf_scores: rrf_scores[chunk.id] = {"chunk": chunk, "score": 0.0}
        rrf_scores[chunk.id]["score"] += 1.0 / (k + rank + 1)

    sorted_results = sorted(rrf_scores.values(), key=lambda x: x["score"], reverse=True)
    min_rrf_score = 1.0 / (k + 3)
    relevant_chunks = [item["chunk"] for item in sorted_results if item["score"] >= min_rrf_score][:3]

    all_context_chunks = relevant_chunks
    context_text = "\n---\n".join([chunk.content for chunk in all_context_chunks])
    sources_data = [{"id": chunk.id, "filename": chunk.filename, "type": chunk.type, "tags": chunk.tags, "preview": chunk.content[:60] + "..."} for chunk in all_context_chunks]

    prompt_completo = (
        "Eres un asistente de IA. Responde usando ÚNICAMENTE la información en "
        "[CONOCIMIENTO RECUERDO]. No pidas disculpas, NO empieces diciendo "
        "'No tengo información' si el contexto contiene datos relevantes.\n"
        "Si [CONOCIMIENTO RECUERDO] está vacío o no contiene información para "
        "responder, di exactamente: 'No tengo información sobre eso.'\n\n"
        f"[HISTORIAL DE CHAT RECIENTE]\n{history_context if history_context else 'No hay conversación previa.'}\n\n"
        f"[NUEVA PREGUNTA]\n{payload.question}\n\n"
        f"[CONOCIMIENTO RECUERDO]\n{context_text if context_text else 'VACÍO - No se encontró información relevante.'}\n\n"
        "RESPUESTA:"
    )

    def sse_generator():
        full_answer = ""
        try:
            response = requests.post(
                OLLAMA_GENERATE_URL,
                json={"model": "llama3.1:8b", "prompt": prompt_completo, "stream": True, "temperature": 0.3, "top_p": 0.9},
                stream=True
            )
            response.raise_for_status()

            yield f"event: condensed_query\ndata: {json.dumps({'query': search_query})}\n\n"

            for line in response.iter_lines():
                if line:
                    chunk_data = json.loads(line.decode('utf-8'))
                    token = chunk_data.get("response", "")
                    full_answer += token
                    yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
                    if chunk_data.get("done", False): break

            no_info_patterns = [
                r"no (?:tengo|dispongo|poseo|cuento|tengo)",
                r"no\s+(?:informaci[oó]n|datos|registros?)",
                r"no\s+(?:he\s+)?encontr[eé]|no\s+existe|no\s+esta\s+disponible",
            ]
            stripped_answer = re.sub(
                r"^(?:Lo siento|Lo lamento|Perd[oó]n|Disculpa|Disculpe|Perd[oó]neme)[^.\n]*?\.\s*",
                "",
                full_answer.strip()
            ).strip()
            stripped_answer = re.sub(
                r"^(?:sin embargo|no obstante),\s*",
                "",
                stripped_answer,
                flags=re.IGNORECASE
            ).strip()
            is_no_info = (
                any(re.search(p, full_answer.strip(), re.IGNORECASE) for p in no_info_patterns)
                and len(stripped_answer) < 50
            )

            final_sources = [] if is_no_info else sources_data
            yield f"event: sources\ndata: {json.dumps(final_sources)}\n\n"

            db_session = SessionLocal()
            try:
                clean_answer = re.sub(
                    r"^(?:Lo siento|Lo lamento|Perd[óó]n|Disculpa|Disculpe|Perd[oó]neme)[^.\n]*?\.\s*",
                    "",
                    full_answer.strip()
                ).strip()
                clean_answer = re.sub(
                    r"^(?:sin embargo|no obstante),\s*",
                    "",
                    clean_answer,
                    flags=re.IGNORECASE
                ).strip()
                clean_answer = re.sub(
                    r"^.*?(?:la verdad es que|en realidad,?)\s*",
                    "",
                    clean_answer,
                    flags=re.IGNORECASE
                ).strip()
                saved_answer = clean_answer if clean_answer else full_answer
                db_session.add(ChatHistory(session_id=payload.session_id, role="user", content=payload.question))
                db_session.add(ChatHistory(session_id=payload.session_id, role="assistant", content=saved_answer))
                db_session.commit()
            finally:
                db_session.close()

            _run_eval_async(db, payload.question, context_text, saved_answer, payload.session_id)
            yield f"event: evaluation_done\ndata: {{\"status\": \"queued\"}}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
