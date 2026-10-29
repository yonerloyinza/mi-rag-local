# API Endpoints

All endpoints prefixed with `/api`. CORS allows all origins.

## Ingesta

### POST `/api/ingest`
Ingest plain text as a note or document. Notes are saved as `.md` files in `vault/` with hash-based storage.

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
Upload files with automatic type detection. Original files saved in `uploads/` with hash-based naming.

**Body** (multipart):
| Field | Type | Default | Descripción |
|-------|------|---------|-------------|
| file | UploadFile | required | File content |
| filename | string | required | Original filename |
| item_type | string | "document" | note or document |
| tags | string | "" | Comma-separated |

**Supported formats**: PDF (pypdf), PNG/JPG/etc (Tesseract OCR), TXT/MD/HTML/CSV/JSON

### GET `/api/documents/{filename}`
Get document metadata and content. Content is read from the original file on disk.

**Response**:
```json
{
  "filename": "my-note.md",
  "type": "note",
  "file_path": "/abs/path/vault/ab/cd/hash.md",
  "file_hash": "abcdef...",
  "original_filename": "my-note.md",
  "content": "...",
  "tags": ["tag1"],
  "rag_enabled": true,
  "chunks_count": 3,
  "created_at": "2026-10-29T...",
  "updated_at": "2026-10-29T..."
}
```

### GET `/api/documents/{filename}/download`
Download the original file. Uses `Content-Disposition: attachment` with `original_filename`.

### GET `/api/documents/{filename}/content`
Get just the text content of a document.

**Response**: `{"filename": "...", "content": "..."}`

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
4. `evaluation_done` — `{"status": "queued"}` (async evaluation, saved to chat_history.eval_score)

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
List all documents (one per document, not per chunk). Returns `id`, `filename`, `type`, `file_path`, `file_hash`, `original_filename`, `chunks_count`, `tags`, `rag_enabled`, timestamps. Query params: `search`, `type_filter`, `tag_filter`.

### GET `/api/items`
List all knowledge items (filename, type, tags, rag_enabled). No duplicates.

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
