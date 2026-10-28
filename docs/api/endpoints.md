# API Endpoints

All endpoints prefixed with `/api`. CORS allows all origins.

## Ingesta

### POST `/api/ingest`
Ingest plain text as a note or document.

**Body** (JSON):
```json
{
  "filename": "my-note.md",
  "text": "Content to index...",
  "type": "note",
  "tags": ["tag1", "tag2"]
}
```

**Response**: `{"status": "success", "message": "...", "chunks": N}`
**Error 400**: `{"detail": "El texto no puede estar vacío."}`

### POST `/api/ingest-file`
Upload files with automatic type detection.

**Body** (multipart):
| Field | Type | Default | Descripción |
|-------|------|---------|-------------|
| file | UploadFile | required | File content |
| filename | string | required | Original filename |
| item_type | string | "document" | note or document |
| tags | string | "" | Comma-separated |

**Supported formats**: PDF (PyPDF2), PNG/JPG/etc (Tesseract OCR), TXT/MD/HTML/CSV/JSON

## Query & Search

### POST `/api/query`
Streamed RAG response via SSE.

**Body** (JSON):
```json
{
  "question": "¿Qué hora es la liga de fútbol?",
  "session_id": "default_session"
}
```

**SSE Events** (in order):
1. `condensed_query` — rewritten search query
2. `token` — streaming LLM tokens
3. `sources` — relevant chunks (empty array if no-info detected)
4. `evaluation` — `{faithfulness, relevance, reasoning}`

### POST `/api/search`
Hybrid/semantic/exact search.

**Body** (JSON):
```json
{
  "query": "fútbol",
  "search_mode": "hybrid",
  "types": ["note"],
  "tags": ["tag1"],
  "limit": 12
}
```

**Response**: `{"results": [...], "context": "..."}`

## Document Management

### GET `/api/documents`
List all documents with filters. Query params: `search`, `type_filter`, `tag_filter`.

### GET `/api/items`
List all knowledge items (filename, type, tags, rag_enabled).

### GET `/api/tags`
Return `{"tags": ["tag1", "tag2", ...]}`.

### GET `/api/health`
Health check: `{"status": "ok", "connection": "Postgres + pgvector conectado"}`.

### DELETE `/api/documents/{filename}`
Delete document and all its chunks.

### PATCH `/api/documents/{filename}/tags`
Update tags: `["tag1", "tag2"]`.

### PATCH `/api/documents/{filename}/toggle-rag`
Toggle `rag_enabled` boolean.
