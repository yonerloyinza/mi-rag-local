# Documentación del Proyecto — Índice

## Arquitectura
- [Visión General](architecture/01_overview.md) — High-level architecture, stack, component interaction
- [Componentes](architecture/02_components.md) — Backend modules, frontend views, state management
- [Flujo de Datos](architecture/03_data_flow.md) — Ingestion → embedding → storage → search → response

## API
- [Endpoints](api/endpoints.md) — All REST endpoints with parameters and examples
- [Eventos SSE](api/sse_events.md) — Streaming events for `/api/query`

## Base de Datos
- [Esquema](database/schema.md) — Table definitions, column types, relationships
- [Migraciones](database/migrations.md) — Migration history and order

## RAG
- [Búsqueda Híbrida](rag/search.md) — RRF, vector similarity, full-text search
- [Prompt del Asistente](rag/prompt.md) — System prompt, context formatting, cleanup rules

## Frontend
- [Componentes UI](frontend/components.md) — Shadcn components, icon usage
- [Vistas](frontend/views.md) — Dashboard, repository, editor, doc_detail

## Testing
- [Backend](testing/backend.md) — Pytest conventions, mocking patterns
- [E2E](testing/e2e.md) — Playwright selectors, test setup

## Deployment
- [Setup Local](deployment/setup.md) — Prerequisites, install, run, .env template
