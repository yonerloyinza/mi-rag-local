---
name: impecable
description: >-
  Specialized skill for the Mi-RAG Local project: a local RAG (Retrieval-Augmented
  Generation) lab with FastAPI backend, React/Vite frontend, PostgreSQL/pgvector,
  Alembic migrations, and Playwright e2e tests. Use whenever working on this
  project's backend, frontend, database migrations, testing, or deployment.
license: MIT
metadata:
  category: development
  author: Kilo
  suggest_for:
    filepath:
      - 'backend/**/*.py'
      - 'frontend/src/**/*.tsx'
      - 'frontend/src/**/*.ts'
      - 'alembic/versions/*.py'
      - 'frontend/e2e/*.spec.ts'
      - 'backend/test_main.py'
source:
  repository: 'https://github.com/Kilo-Org/skills'
  path: skills/impecable
  license_path: LICENSE
---

# Impecable RAG Lab Skill

This skill provides specialized guidance for the Mi-RAG Local project — a local
RAG (Retrieval-Augmented Generation) lab featuring a FastAPI backend, React/Vite
frontend with Shadcn components, PostgreSQL/pgvector for vector storage, Alembic
for migrations, and Playwright for end-to-end testing.

## Project Layout

```
mi-rag-local/
├── backend/
│   ├── main.py              # FastAPI application + RAG endpoints
│   ├── database.py          # SQLAlchemy models (DocumentChunk, ChatHistory)
│   ├── test_main.py         # Pytest tests (7 tests)
│   ├── requirements.txt     # Python dependencies
│   ├── venv/                # Virtual environment
│   └── alembic/             # Alembic migrations
│       ├── env.py
│       └── versions/
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React component (full RAG UI)
│   │   ├── components/ui/   # Shadcn UI components
│   │   └── index.css
│   ├── e2e/
│   │   └── app.spec.ts      # Playwright tests (8 tests)
│   ├── vite.config.ts
│   ├── playwright.config.ts
│   └── package.json
├── AGENTS.md
└── .kilo/skills/impecable/
```

## Key Conventions

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.x, pgvector
- **Frontend**: React 19, Vite 8, TypeScript, Tailwind CSS, Shadcn components, Lucide icons
- **Testing**: pytest for backend, Playwright Chromium for frontend e2e
- **DB**: PostgreSQL running on localhost (DB connection string in `.env`)
- **RAG**: Ollama for embeddings (`nomic-embed-text`) and generation (`llama3.1:8b`)

## When to use this skill

- Modifying RAG search, ingestion, chat streaming, or query endpoints
- Adding new API endpoints or database models
- Creating or modifying Alembic migrations
- Updating frontend components or views (dashboard, repository, editor, doc_detail)
- Writing or updating backend (pytest) or e2e (Playwright) tests
- Improving the LLM prompt or response quality

## Workflow

1. **Before making changes**: Read the relevant section of `references/backend-patterns.md`
   and `references/frontend-patterns.md` to understand existing conventions.

2. **Backend changes**: After modifying `main.py` or `database.py`:
   - Run `pytest -v` from the `backend/` directory
   - Verify the server starts: `curl http://127.0.0.1:8000/api/documents`

3. **Frontend changes**: After modifying `App.tsx` or other `.tsx` files:
   - Run `npx tsc --noEmit` for type checking
   - Run `npx playwright test --reporter=list` for e2e tests

4. **Database migrations**: Use Alembic:
   - Generate: `alembic revision --autogenerate -m "description"`
   - Apply: `alembic upgrade head`
   - Check: `alembic current`

5. **Both test suites must pass** before considering work complete.

## Commands

### Backend
```bash
# Activate venv
source backend/venv/bin/activate

# Run tests
cd backend && pytest -v

# Start server
cd backend && uvicorn main:app --reload --port 8000

# Alembic migrations
cd backend/venv/bin && alembic revision --autogenerate -m "msg"
cd backend/venv/bin && alembic upgrade head
```

### Frontend
```bash
# Type check
cd frontend && npx tsc --noEmit

# Start dev server
cd frontend && npx vite --host --port 5173

# E2e tests (requires both backend and frontend running)
cd frontend && npx playwright test --reporter=list
```

## Architecture Notes

### RAG Flow (`/api/query` endpoint)
1. Retrieve recent chat history (last 4 messages per session)
2. Condense query using LLM to resolve pronouns/references
3. Hybrid search: vector similarity (top 10) + full-text search (top 10)
4. RRF (Reciprocal Rank Fusion) with k=60 to merge results
5. Take top 3 chunks as context
6. Stream response via SSE with events: `sources`, `condensed_query`, `token`, `evaluation`
7. Strip apology/hedging prefixes from saved answer before persisting to `ChatHistory`

### Ingestion (`/api/ingest` and `/api/ingest-file`)
- Text is chunked (400 chars, 80 overlap) and embedded via Ollama
- PDF extraction uses PyPDF2
- Image OCR uses pytesseract + Pillow with Tesseract CLI
- Tags are the sole relationship mechanism between documents

### Search Modes (`/api/search`)
- `hybrid`: vector + full-text (default)
- `semantic`: vector only
- `exact`: full-text with phrase matching (auto-detected with quotes)

## Reference Map
- `references/backend-patterns.md`: FastAPI endpoint conventions, database patterns, prompt engineering
- `references/frontend-patterns.md`: React component patterns, state management, Shadcn usage
