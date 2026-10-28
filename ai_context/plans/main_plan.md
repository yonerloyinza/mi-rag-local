# Plan Principal: Mi-RAG Local

## Objetivo
Laboratorio local de RAG funcional y listo para producción mínima.

## Estado: COMPLETADO
- [x] Backend API con ingestión, búsqueda híbrida, chat SSE
- [x] Frontend React con 5 vistas + chat con streaming
- [x] Base de datos PostgreSQL + pgvector con migraciones Alembic
- [x] Sistema de tags como única relación entre datos
- [x] Tests: 7 pytest + 8 playwright (todos pass)
- [x] Prompt optimizado (sin disculpas, detección no-info)
- [x] OCR de imágenes, extracción PDF
- [x] Documentación completa en /docs/
- [x] Subido a GitHub (yonerloyinza/mi-rag-local)

## Fases completadas
1. Consolidación UI (Nueva Data modal, tags como única relación)
2. Corrección prompt + post-procesamiento (import re, no-info detection, RRF threshold)
3. Documentación + AGENTS.md (minimalista, indexado)
4. Preparación GitHub (.gitignore, .env.example, README, LICENSE, limpieza)

## Sub-planes
- /ai_context/plans/sub_plans/frontend_optimization.md
- /ai_context/plans/sub_plans/backend_optimization.md
