import json
import os
import re
import hashlib
import requests
from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, func, select

from database import (
    get_db, DocumentChunk, Document, ChatHistory, SessionLocal,
    UPLOAD_DIR, VAULT_DIR, get_file_paths, generate_file_hash,
    User, UserRole, Permission, DocumentShare, DocumentPermissionLevel,
)
from auth import (
    verify_token, require_auth, get_current_user_from_cookie,
    set_auth_cookies, set_access_cookie,
)
from fastapi.responses import Response
import bcrypt

app = FastAPI(title="Cerebro RAG - Gestión Unificada de Conocimiento")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    full_name: str = ""


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    is_admin: bool
    role_name: Optional[str] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class DocumentShareOut(BaseModel):
    id: int
    user_id: int
    username: str
    permission_level: str

    class Config:
        from_attributes = True


class DocumentShareCreate(BaseModel):
    user_id: int
    permission_level: DocumentPermissionLevel = DocumentPermissionLevel.READ


class UserRoleOut(BaseModel):
    id: int
    name: str
    description: str = ""

    class Config:
        from_attributes = True


class PermissionOut(BaseModel):
    id: int
    name: str
    description: str = ""

    class Config:
        from_attributes = True

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

def _assert_can_replace_document(db: Session, filename: str, user: User) -> None:
    """Evita que un usuario sobrescriba el documento de otro con el mismo nombre."""
    existing = db.query(Document).filter(Document.filename == filename).first()
    if existing and not user.is_admin and existing.owner_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Ya existe un documento con ese nombre y no tienes permisos para modificarlo",
        )


def _process_text(db: Session, filename: str, text_content: str, doc_type: str = "note", tags: list[str] = None, save_original: bool = True, owner_id: int = None, is_admin: bool = False) -> int:
    if tags is None:
        tags = []
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")

    existing = db.query(Document).filter(Document.filename == filename).first()
    if existing:
        if not is_admin and existing.owner_id != owner_id:
            raise HTTPException(
                status_code=403,
                detail="Ya existe un documento con ese nombre y no tienes permisos para modificarlo",
            )
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
        rag_enabled=True,
        owner_id=owner_id,
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


# --- Authentication ---

@app.post("/auth/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    email = user_data.email.strip().lower()
    username = user_data.username.strip()
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if db.query(User).filter(func.lower(User.username) == username.lower()).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")

    hashed = bcrypt.hashpw(user_data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_role = db.query(UserRole).filter(UserRole.name == "user").first()
    user = User(
        email=email,
        username=username,
        password_hash=hashed,
        full_name=user_data.full_name,
        role_id=user_role.id if user_role else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Usuario registrado exitosamente", "user_id": user.id}


@app.post("/auth/login")
def login(user_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    email = user_data.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user or not bcrypt.checkpw(user_data.password.encode("utf-8"), user.password_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inactivo")

    set_auth_cookies(response, user.id)
    return {"message": "Autenticación exitosa"}


@app.post("/auth/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Falta el token de refresco")

    try:
        payload = verify_token(token, expected_type="refresh")
    except HTTPException:
        raise HTTPException(status_code=401, detail="Token de refresco no válido")

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    set_access_cookie(response, user.id)
    return {"message": "Token renovado"}


@app.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token", path="/auth/refresh")
    return {"message": "Sesión cerrada"}


@app.get("/auth/me", response_model=UserOut)
def me(request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    role_name = user.role.name if user.role else None
    return UserOut(
        id=user.id, email=user.email, username=user.username,
        full_name=user.full_name, is_admin=user.is_admin,
        role_name=role_name,
    )


# --- User Management (Admin) ---

@app.get("/admin/users", response_model=list[UserOut])
def list_users(request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Se requieren privilegios de administrador")
    users = db.query(User).all()
    return [
        UserOut(
            id=u.id, email=u.email, username=u.username,
            full_name=u.full_name, is_admin=u.is_admin,
            role_name=u.role.name if u.role else None,
        )
        for u in users
    ]


@app.get("/admin/roles", response_model=list[UserRoleOut])
def list_roles(request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Se requieren privilegios de administrador")
    return db.query(UserRole).all()


@app.get("/admin/permissions", response_model=list[PermissionOut])
def list_permissions(request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Se requieren privilegios de administrador")
    return db.query(Permission).all()


def get_accessible_documents(db: Session, user: User):
    """Retorna documentos a los que el usuario tiene acceso (propietario, compartido, o admin)."""
    if user.is_admin:
        return db.query(Document)
    shared_doc_ids = select(DocumentShare.document_id).where(
        DocumentShare.user_id == user.id
    )
    return db.query(Document).filter(
        (Document.owner_id == user.id) |
        (Document.id.in_(shared_doc_ids))
    )


def check_document_access(db: Session, doc: Document, user: User, require_write: bool = False):
    """Verifica que el usuario tenga acceso al documento. Si require_write, necesita WRITE o ADMIN."""
    if user.is_admin:
        return True
    if doc.owner_id == user.id:
        return True  # owner has full access
    share = db_query_document_share(db, doc.id, user.id)
    if share:
        if not require_write:
            return True
        if share.permission_level not in (DocumentPermissionLevel.WRITE.value, DocumentPermissionLevel.ADMIN.value):
            raise HTTPException(status_code=403, detail="No tienes permisos de escritura en este documento")
        return True
    raise HTTPException(status_code=403, detail="No tienes acceso a este documento")


def check_document_owner(db: Session, doc: Document, user: User):
    """Solo el propietario, un admin o un share ADMIN pueden borrar/gestionar."""
    if user.is_admin or doc.owner_id == user.id:
        return True
    share = db_query_document_share(db, doc.id, user.id)
    if share and share.permission_level == DocumentPermissionLevel.ADMIN.value:
        return True
    raise HTTPException(status_code=403, detail="Solo el propietario puede realizar esta acción")


def db_query_document_share(db: Session, document_id: int, user_id: int):
    return db.query(DocumentShare).filter(
        DocumentShare.document_id == document_id,
        DocumentShare.user_id == user_id,
    ).first()


# --- Document Sharing (ACL) ---

@app.get("/api/documents/{filename}/shares", response_model=list[DocumentShareOut])
def list_document_shares(filename: str, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not user.is_admin and doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="No eres el propietario de este documento")
    return [
        DocumentShareOut(
            id=s.id, user_id=s.user_id,
            username=s.user.username if s.user else "",
            permission_level=s.permission_level,
        )
        for s in doc.shares
    ]


@app.post("/api/documents/{filename}/shares")
def share_document(
    filename: str, share_data: DocumentShareCreate,
    request: Request, db: Session = Depends(get_db),
):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not user.is_admin and doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="No eres el propietario de este documento")

    target_user = db.query(User).filter(User.id == share_data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario objetivo no encontrado")

    existing = db.query(DocumentShare).filter(
        DocumentShare.document_id == doc.id,
        DocumentShare.user_id == share_data.user_id,
    ).first()
    if existing:
        existing.permission_level = share_data.permission_level.value
        db.commit()
        db.refresh(existing)
        return {"message": "Permiso actualizado"}

    share = DocumentShare(
        document_id=doc.id,
        user_id=share_data.user_id,
        permission_level=share_data.permission_level.value,
        shared_by_id=user.id,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return {"message": "Documento compartido", "share_id": share.id}


@app.delete("/api/documents/{filename}/shares/{user_id}")
def remove_document_share(
    filename: str, user_id: int,
    request: Request, db: Session = Depends(get_db),
):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not user.is_admin and doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="No eres el propietario de este documento")

    share = db.query(DocumentShare).filter(
        DocumentShare.document_id == doc.id,
        DocumentShare.user_id == user_id,
    ).first()
    if not share:
        raise HTTPException(status_code=404, detail="Compartimiento no encontrado")
    db.delete(share)
    db.commit()
    return {"message": "Compartimiento eliminado"}

@app.get("/api/documents")
def list_documents(
    search: Optional[str] = None,
    type_filter: Optional[str] = None,
    tag_filter: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    user = require_auth(request)
    q = get_accessible_documents(db, user)
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
def list_knowledge_items(request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    docs = get_accessible_documents(db, user).order_by(Document.created_at.desc()).all()
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
def ingest_item(payload: IngestRequest, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    filename = payload.filename
    if payload.type == "note" and not filename.endswith('.md'):
        if filename.endswith('.txt'):
            filename = filename[:-4] + '.md'
        elif '.' in filename:
            filename = filename.rsplit('.', 1)[0] + '.md'
        else:
            filename = filename + '.md'
    chunk_count = _process_text(db, filename, payload.text, payload.type, payload.tags, owner_id=user.id, is_admin=user.is_admin)
    return {"status": "success", "message": f"'{filename}' guardado e indexado.", "chunks": chunk_count}

@app.delete("/api/documents/{filename}")
def delete_document(filename: str, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    check_document_owner(db, doc, user)
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"status": "success", "message": f"'{filename}' eliminado."}

@app.patch("/api/documents/{filename}/toggle-rag")
def toggle_rag(filename: str, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    check_document_access(db, doc, user, require_write=True)
    doc.rag_enabled = not doc.rag_enabled
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).update({"rag_enabled": doc.rag_enabled})
    db.commit()
    return {"status": "success", "message": "Estado RAG alternado.", "rag_enabled": doc.rag_enabled}

@app.patch("/api/documents/{filename}/tags")
def update_tags(filename: str, tags: list[str], request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    check_document_access(db, doc, user, require_write=True)
    doc.tags = tags
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).update({"tags": tags})
    db.commit()
    return {"status": "success", "message": "Tags actualizados.", "tags": tags}

@app.get("/api/documents/{filename}")
def get_document(filename: str, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    check_document_access(db, doc, user)
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
def download_document(filename: str, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    check_document_access(db, doc, user)
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Archivo original no encontrado.")
    from fastapi.responses import FileResponse
    return FileResponse(doc.file_path, filename=doc.original_filename or doc.filename)

@app.get("/api/documents/{filename}/content")
def get_document_content(filename: str, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    check_document_access(db, doc, user)
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
    request: Request = None,
    db: Session = Depends(get_db)
):
    user = require_auth(request)
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

    _assert_can_replace_document(db, filename, user)

    hashed_path, file_hash, saved_ext = get_file_paths(filename, contents, is_note=False)

    chunk_count = _process_text(db, filename, text_content, item_type, tag_list, save_original=False, owner_id=user.id, is_admin=user.is_admin)
    doc = db.query(Document).filter(Document.filename == filename).first()
    if doc:
        with open(hashed_path, 'wb') as f:
            f.write(contents)
        doc.file_path = hashed_path
        doc.owner_id = user.id
        doc.file_hash = file_hash
        doc.original_filename = filename
        db.commit()
    return {"status": "success", "message": f"'{filename}' guardado e indexado.", "chunks": chunk_count}

@app.get("/api/tags")
def list_tags(request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    accessible_docs = get_accessible_documents(db, user).all()
    accessible_ids = [d.id for d in accessible_docs]
    if not accessible_ids:
        return {"tags": []}
    rows = db.query(DocumentChunk.tags).filter(DocumentChunk.document_id.in_(accessible_ids)).distinct().all()
    all_tags = set()
    for r in rows:
        if r[0]:
            all_tags.update(r[0])
    return {"tags": sorted(all_tags)}

@app.post("/api/search")
def hybrid_search(payload: SearchRequest, request: Request, db: Session = Depends(get_db)):
    """
    Búsqueda híbrida con filtros.
    search_mode: 'hybrid' (vector + FTS), 'semantic' (vector only), 'exact' (FTS only)
    """
    user = require_auth(request)
    accessible_docs = get_accessible_documents(db, user).all()
    accessible_ids = [d.id for d in accessible_docs]
    if not accessible_ids:
        return {"results": [], "sources": []}

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
            DocumentChunk.rag_enabled == True,
            DocumentChunk.document_id.in_(accessible_ids)
        ).order_by(
            DocumentChunk.embedding.cosine_distance(question_vector)
        ).limit(10).all()

    if search_mode in ("hybrid", "exact"):
        words = [w for w in query_text_clean.replace("?", "").split() if len(w) > 2]
        fts_query = " & ".join(words) if words else query_text_clean
        if fts_query:
            text_results = db.query(DocumentChunk).filter(
                text("search_vector @@ to_tsquery('pg_catalog.spanish', :query)")
                .bindparams(query=fts_query),
                DocumentChunk.rag_enabled == True,
                DocumentChunk.document_id.in_(accessible_ids)
            ).limit(10).all()

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
def query_rag(payload: QueryRequest, request: Request, db: Session = Depends(get_db)):
    user = require_auth(request)
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta está vacía.")

    past_messages = db.query(ChatHistory).filter(ChatHistory.session_id == payload.session_id).order_by(ChatHistory.created_at.desc()).limit(4).all()
    past_messages.reverse()

    history_context = ""
    for msg in past_messages:
        history_context += f"{'Usuario' if msg.role == 'user' else 'Asistente'}: {msg.content}\n"

    search_query = condense_query(history_context, payload.question)

    accessible_docs = get_accessible_documents(db, user).all()
    accessible_ids = [d.id for d in accessible_docs]
    if not accessible_ids:
        return StreamingResponse(
            iter([f"event: token\ndata: {json.dumps({'token': 'No tienes documentos accesibles para hacer consultas.'})}\n\n"]),
            media_type="text/event-stream"
        )

    question_vector = get_ollama_embedding(search_query)
    vector_results = db.query(DocumentChunk).filter(
        DocumentChunk.rag_enabled == True,
        DocumentChunk.document_id.in_(accessible_ids)
    ).order_by(
        DocumentChunk.embedding.cosine_distance(question_vector)
    ).limit(8).all()

    words = [w for w in search_query.replace("?", "").split() if len(w) > 2]
    fts_query = " & ".join(words) if words else search_query
    text_results = db.query(DocumentChunk).filter(
        text("search_vector @@ to_tsquery('pg_catalog.spanish', :query)").bindparams(query=fts_query),
        DocumentChunk.rag_enabled == True,
        DocumentChunk.document_id.in_(accessible_ids)
    ).limit(8).all() if fts_query else []

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
