# Backend Patterns

## FastAPI Endpoint Conventions

- Use `Depends(get_db)` for database access
- Return `{"status": "success", "message": "...", ...}` for success responses
- Use `HTTPException(status_code, detail=...)` for errors
- For streaming events (SSE), use `StreamingResponse` with `media_type="text/event-stream"`
- Event format: `yield f"event: event_name\ndata: {json.dumps(payload)}\n\n"`

## Database Access

- `DocumentChunk` model: has `filename`, `content`, `embedding`, `type`, `tags`, `rag_enabled`, `created_at`, `updated_at`, `search_vector`
- `ChatHistory` model: has `session_id`, `role`, `content`, `created_at`
- Always commit after writes: `db.commit()`

## RAG Prompt Engineering

The prompt in `/api/query` uses structured sections:
- `[HISTORIAL DE CHAT RECIENTE]` - last 4 messages per session
- `[NUEVA PREGUNTA]` - current question
- `[CONOCIMIENTO RECUERDO DEL RAG]` - retrieved context chunks

After streaming, strip apology/hedging prefixes before saving to `ChatHistory`:
```python
clean_answer = re.sub(r"^(?:Lo siento|Lo lamento|Perdón|...)[^.\n]*?\.\s*", "", full_answer)
```

## Testing

- Tests are in `test_main.py` using `pytest` and `fastapi.testclient.TestClient`
- Mock external services: `mocker.patch("main.get_ollama_embedding", ...)`
- For SSE endpoints, mock `requests.post` with a mock response that has `iter_lines()`
- Run tests: `pytest -v` from the `backend/` directory
