# Visión General de la Arquitectura

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | FastAPI | 0.162 |
| Backend | SQLAlchemy + pgvector | 2.1.6 / 0.5.1 |
| Backend | PostgreSQL | 16 (pgvector/pg16 Docker image) |
| Backend | Ollama | Local (embeddings + LLM) |
| Backend | pypdf | 6.21.4 (PDF extraction) |
| Backend | pytesseract + Pillow | OCR for images |
| Frontend | React | 19.3.1 |
| Frontend | Vite | 8.3.4 |
| Frontend | TypeScript | 6.0 |
| Frontend | Tailwind CSS | 3.4 |
| Testing | pytest | 9.2 |
| Testing | Playwright | 1.64 |
| Infra | Alembic | 1.20.1 |
| Infra | Docker Compose | PostgreSQL + pgvector |

## Componentes

```
┌────────────────────────────────────────────────────────────┐
│                    Frontend (Vite + React)                   │
│                                                              │
│  Dashboard | Repository | Editor | DocDetail | Chat(SSE)     │
│                    ↓                                         │
│                    ┌─────────────────────────────────────┐    │
│                    │       Backend (FastAPI)              │    │
│                    │                                      │    │
│                    │  /api/ingest          [POST JSON]   │    │
│                    │  /api/ingest-file      [POST Multipart] │
│                    │  /api/search           [POST]       │    │
│                    │  /api/query           [POST SSE]    │    │
│                    │  /api/documents        [GET/DELETE/PATCH]│
│                    │  /api/documents/{f}    [GET]        │    │
│                    │  /api/documents/{f}/download [GET]  │    │
│                    │  /api/documents/{f}/content [GET]   │    │
│                    │  /api/tags             [GET]        │    │
│                    │  /api/items            [GET]        │    │
│                    │  /api/health           [GET]        │    │
│                    │         ↓                              │    │
│                    │  PostgreSQL + pgvector                   │
│                    │  documents | document_chunks | chat_history│
│                    │         ↓                              │    │
│                    │  Filesystem (Hybrid Storage)             │
│                    │  vault/ab/cd/hash.md    (Notes)        │
│                    │  uploads/ab/cd/hash.pdf (Documents)    │
│                    │         ↓                              │    │
│                    │  Ollama (localhost:11434)               │    │
│                    │  Embeddings: nomic-embed-text          │    │
│                    │  LLM: llama3.1:8b                      │    │
│                    └─────────────────────────────────────┘    │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

## Principios de Diseño

- **Un solo archivo frontend** (`App.tsx`, ~1160 líneas): todos los views y state en un componente
- **Un solo archivo backend** (`main.py`, ~500 líneas): todos los endpoints y lógica RAG
- **Tags como único mecanismo de relación** entre notas y documentos (no hay linking)
- **Streaming SSE**: el endpoint `/api/query` envía eventos `condensed_query`, `token`, `sources`, `evaluation_done`
- **Sin estado entre requests**: DB es el único almacenamiento persistente
- **Almacenamiento híbrido**: archivos originales en filesystem (`vault/` para notas, `uploads/` para docs) con hash SHA-256, metadata en PostgreSQL
- **Documentos ≠ Chunks**: la tabla `documents` representa cada documento; `document_chunks` contiene fragmentos para RAG vinculados por `document_id`
