# API Endpoints

All endpoints prefixed with `/api` require an authenticated session (HttpOnly cookies). Authentication endpoints live under `/auth`. CORS only allows the local Vite origins (`http://localhost:5173` and `http://127.0.0.1:5173`).

## Autenticación

Las cookies son `HttpOnly` + `SameSite=Lax`. El access token dura 15 minutos y el refresh token 7 días por defecto.

### POST `/auth/register`
Crea una cuenta. Email y username son únicos (sin distinguir mayúsculas).

**Body** (JSON):
```json
{
  "email": "usuario@ejemplo.com",
  "username": "usuario",
  "password": "contraseña-de-8-o-más",
  "full_name": "Nombre opcional"
}
```

**Response**: `{"message": "Usuario registrado exitosamente", "user_id": 1}`
**Error 400**: email/username duplicado o contraseña de menos de 8 caracteres.

### POST `/auth/login`
Valida credenciales y adjunta `access_token` y `refresh_token` como cookies.

**Body** (JSON): `{"email": "...", "password": "..."}`
**Response**: `{"message": "Autenticación exitosa"}`
**Error 401**: credenciales inválidas o usuario inactivo.

### POST `/auth/refresh`
Renueva el access token usando la cookie `refresh_token` (path `/auth/refresh`).

**Response**: `{"message": "Token renovado"}`

### POST `/auth/logout`
Elimina ambas cookies de autenticación.

### GET `/auth/me`
Devuelve el usuario autenticado: `id`, `email`, `username`, `full_name`, `is_admin`, `role_name`.

### GET `/admin/users` · `/admin/roles` · `/admin/permissions`
Requieren `is_admin=true`. Un usuario normal recibe **403**.

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

## Compartir documentos (ACL)

Un documento pertenece a quien lo creó. El propietario puede compartirlo con otros usuarios con nivel `read`, `write` o `admin`.

### GET `/api/documents/{filename}/shares`
Lista los shares del documento. Solo propietario o admin global.

### POST `/api/documents/{filename}/shares`
**Body**: `{"user_id": 2, "permission_level": "read"}`
Crea o actualiza un share. Solo propietario o admin global.

### DELETE `/api/documents/{filename}/shares/{user_id}`
Elimina un share. Solo propietario o admin global.

### Reglas de autorización
- Sin sesión: **401**.
- Documento ajeno sin share: **403**.
- Share `read`: puede ver listado, contenido y descargar.
- Share `write`: además puede alternar RAG y editar tags.
- Solo propietario, admin global o share `admin` puede eliminar o gestionar shares.

