# Contexto Largo Plazo

## Visión del proyecto
Laboratorio local de RAG para gestión unificada de conocimiento. Objetivo: sistema funcional de ingestión, indexación y consulta con LLM local (Ollama).

## Decisiones arquitectónicas clave
1. Un solo archivo backend (main.py) para simplicidad
2. Un solo archivo frontend (App.tsx) para coherencia
3. Tags como única relación entre documentos (no document linking)
4. SSE streaming para UX de chat en tiempo real
5. pgvector + pgvector extension para embeddings
6. Ollama local (nomic-embed-text + llama3.1:8b)

## Tecnologías adoptadas
- Backend: FastAPI + SQLAlchemy + pgvector
- Frontend: React 19 + Vite 8 + TypeScript + Tailwind + Shadcn
- DB: PostgreSQL 16 con vector extension
- Testing: pytest + Playwright
- Infra: Alembic, Docker Compose (PostgreSQL + pgvector)

## No aceptado (pruning decisions)
- Multi-agent architecture (un solo proceso backend)
- Redis/cache layer (PostgreSQL vector store directo)
- Celery workers (sincrónico)
- Microservicios (monolito)
- Authentication (local lab, no auth needed)
