# AGENTS.md — Mi-RAG Local

## Qué es este proyecto

Un laboratorio local de RAG (Retrieval-Augmented Generation) con FastAPI backend, React/Vite frontend, PostgreSQL/pgvector, Ollama y Alembic.

## Arquitectura

- **Backend**: `backend/main.py` (~500 líneas) — 8 endpoints REST + 1 SSE endpoint
- **Frontend**: `frontend/src/App.tsx` (~1160 líneas) — React 19 + Vite 8 + Tailwind + Shadcn
- **DB**: PostgreSQL + pgvector, SQLAlchemy 2.x, Alembic migrations
- **RAG**: Ollama `nomic-embed-text` (embeddings) + `llama3.1:8b` (LLM)

## Comandos esenciales

```bash
# Backend
cd backend && source venv/bin/activate
pytest -v
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npx tsc --noEmit
npx playwright test --reporter=list

# DB migrations
cd backend/venv/bin && alembic upgrade head
```

## Reglas de desarrollo

1. Si modificas `main.py` → ejecuta `pytest -v`
2. Si modificas App.tsx → ejecuta `npx tsc --noEmit` y `npx playwright test`
3. Si cambias DB schema → crea migración Alembic antes de tocar models
4. Tags = única relación entre notas y documentos (no usar linking)

## Documentación

- `/docs/README.md` — Índice completo
- `/docs/architecture/` — Arquitectura, componentes, flujos
- `/docs/api/` — Endpoints, eventos SSE
- `/docs/rag/` — Búsqueda híbrida, prompt
- `/docs/database/` — Esquema, migraciones
- `/docs/testing/` — Pytest y Playwright
- `/docs/deployment/` — Setup local

## Gestión de contexto AI

- `/ai_context/plans/` — Planes y sub-planes
- `/ai_context/tasks/` — Tasks completadas/en_progreso/pendientes
- `/ai_context/context/` — Contexto a largo y corto plazo
