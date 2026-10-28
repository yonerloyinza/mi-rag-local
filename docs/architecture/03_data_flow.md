# Flujo de Datos

## 1. Ingesta de Conocimiento

```
Usuario → "Nueva Data" modal → selecciona Nota/Archivo
    ↓
Notas: POST /api/ingest {filename, text, type, tags}
Archivos: POST /api/ingest-file (multipart)
    ↓
chunk_text(text, 400, 80) → lista de chunks
    ↓
get_ollama_embedding(chunk) → vector 768-dim
    ↓
INSERT INTO document_chunks (filename, content, embedding, type, tags, rag_enabled)
UPDATE search_vector = to_tsvector('spanish', content)
```

## 2. Query RAG (Chat)

```
Usuario → POST /api/query {question, session_id}
    ↓
1. Retrieve ChatHistory (last 4 msgs, ordered ASC)
2. condense_query(history, question) → search_query
3. get_ollama_embedding(search_query) → vector
4. Vector search: ORDER BY embedding.cosine_distance LIMIT 8
5. Full-text search: search_vector @@ to_tsquery LIMIT 8
6. RRF(k=60) merge → top 3 chunks (score >= 1/(k+3))
7. Build prompt_completo with [CONOCIMIENTO RECUERDO]
8. Stream Ollama generate → SSE events:
   - condensed_query
   - token (each chunk)
   - sources (after response complete, empty if no-info detected)
   - evaluation (faithfulness/relevance)
9. Save to ChatHistory (cleaned of apology prefixes)
```

## 3. Búsqueda Receptiva

```
Usuario → /api/search {query, search_mode, types[], tags[], limit}
    ↓
Vector search (semantic/hybrid) → top 10 by cosine distance
Full-text search (hybrid/exact/phrase) → top 10 by ts_rank
    ↓
RRF(k=60) merge → top {limit} chunks
    ↓
Return {results, context}
```

## Key Thresholds

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| chunk_size | 400 | Balance between context and precision |
| chunk_overlap | 80 | 20% overlap for continuity |
| embedding_dim | 768 | nomic-embed-text output |
| vector_search_limit | 8-10 | Top-K retrieval |
| rrf_k | 60 | Standard RRF constant |
| rrf_score_threshold | 1/(k+3) ≈ 0.0159 | Exclude low-ranked single-source chunks |
| context_chunks | 3 | Optimal for 8K token context |
| history_depth | 4 | Context window management |
| no_info_answer_threshold | 50 chars | Don't show sources if response is too short |
