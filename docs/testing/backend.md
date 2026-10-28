# Testing — Backend (Pytest)

## Configuración
- Framework: pytest 9.2.0
- Test client: `fastapi.testclient.TestClient`
- Mocking: `pytest-mock` (mocker.patch)
- DB: usa `database.py` SessionLocal (conexión real a PostgreSQL)

## Tests existentes (7)

| Test | Qué valida | Mocks |
|------|-----------|-------|
| `test_chunk_text_logic` | Chunking 400/80 | — |
| `test_ingest_endpoint_success` | POST /api/ingest 200 | `get_ollama_embedding` |
| `test_ingest_endpoint_empty_text` | POST /api/ingest 400 | — |
| `test_query_endpoint_success` | POST /api/query SSE | `get_ollama_embedding`, `condense_query`, `evaluate_rag`, `requests.post` |
| `test_list_documents` | GET /api/documents structure | — |
| `test_list_tags` | GET /api/tags returns list | — |
| `test_ingest_file_endpoint_txt` | POST /api/ingest-file TXT 200 | `get_ollama_embedding` |

## Mocking pattern

```python
# Mock Ollama embeddings
mocker.patch("main.get_ollama_embedding", return_value=[0.1] * 768)

# Mock query condensation
mocker.patch("main.condense_query", side_effect=lambda h, q: q)

# Mock RAG evaluation
mocker.patch("main.evaluate_rag", return_value={
    "faithfulness": 4, "relevance": 5, "reasoning": "OK"
})

# Mock SSE streaming
mock_resp = mocker.Mock()
mock_resp.status_code = 200
mock_resp.iter_lines.return_value = iter([
    b'{"response": "Hola ", "done": false}',
    b'{"response": "mundo", "done": true}',
])
mocker.patch("requests.post", return_value=mock_resp)
```

## Ejecutar

```bash
source venv/bin/activate
cd backend
pytest -v
```
