# Sub-plan: Optimización Backend

## Estado: PENDIENTE

## Tareas futuras
1. Cachear embeddings de queries (evita llamada doble a Ollama)
2. Hacer evaluate_rag asíncrono (no bloquea stream)
3. Consolidar /api/ingest y /api/ingest-file en un solo endpoint
4. Añadir rate limiting para Ollama requests
5. Implementar circuit breaker para Ollama (falla gracefully si ollama down)

## Prioridad: Media
Triple llamada a Ollama por query (embeddings + condense + evaluate) añade ~3-5s latency.
