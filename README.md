# Cerebro RAG Lab

A local RAG (Retrieval-Augmented Generation) lab for knowledge management with unified notes and documents, powered by FastAPI, React, PostgreSQL/pgvector, and Ollama.

## Features

- **Unified knowledge hub**: Create notes and upload documents (PDF, MD, TXT, images with OCR) from a single "Nueva Data" modal
- **Hybrid search**: RRF (Reciprocal Rank Fusion) combining vector similarity + full-text search
- **Conversational memory**: Chat history with query condensation for pronoun resolution
- **Streaming responses**: SSE-based token streaming with "Thinking..." state
- **Tag-based relationships**: Tags are the sole mechanism for connecting notes and documents
- **Source citations**: Clickable source badges in chat responses
- **RAG evaluation**: Faithfulness and relevance scoring
- **Responsive UI**: Shadcn components with dark theme

## Architecture

```
mi-rag-local/
├── backend/                  # FastAPI application
│   ├── main.py              # API endpoints, RAG logic, SSE streaming
│   ├── database.py          # SQLAlchemy models
│   ├── test_main.py         # Pytest tests
│   ├── requirements.txt
│   ├── venv/
│   └── alembic/             # Database migrations
├── frontend/                # React + Vite application
│   ├── src/App.tsx          # Single-file component with all views
│   ├── src/components/ui/   # Shadcn components
│   ├── e2e/app.spec.ts      # Playwright tests
│   ├── playwright.config.ts
│   └── package.json
└── .kilo/skills/impecable/  # Kilo skill for this project
```

## Prerequisites

- Python 3.12+
- PostgreSQL with pgvector extension
- Ollama running with `nomic-embed-text` and `llama3.1:8b` models
- Node.js 20+ with pnpm

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

Create `.env` in the project root:
```env
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_db
DB_HOST=localhost
DB_PORT=5432
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev --port 5173
```

## Usage

1. Start both backend (`localhost:8000`) and frontend (`localhost:5173`)
2. Use "Nueva Data" to create notes (Markdown) or upload files (PDF, TXT, MD, images)
3. Ask questions in the chat — the system retrieves relevant context and generates responses with citations
4. View all notes and documents in "Invernadero de Datos"
5. Toggle RAG on/off per document, manage tags

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Ingest text as note/document |
| POST | `/api/ingest-file` | Upload file (PDF, MD, TXT, image OCR) |
| POST | `/api/query` | Streamed RAG response (SSE) |
| POST | `/api/search` | Hybrid/semantic/exact search |
| GET | `/api/documents` | List all documents |
| GET | `/api/items` | List all knowledge items |
| GET | `/api/tags` | List all unique tags |
| PATCH | `/api/documents/{filename}/tags` | Update tags |
| PATCH | `/api/documents/{filename}/toggle-rag` | Toggle RAG for a document |
| DELETE | `/api/documents/{filename}` | Delete a document |

## Testing

```bash
# Backend (from backend/)
pytest -v

# Frontend typecheck
npx tsc --noEmit

# E2e tests (requires both servers running)
npx playwright test --reporter=list
```

## License

MIT
