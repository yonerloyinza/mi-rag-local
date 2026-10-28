import pytest
from fastapi.testclient import TestClient
from main import app, chunk_text

client = TestClient(app)


def test_chunk_text_logic():
    texto_prueba = "abcdefghijklmnopqrstuvwxyz"
    resultado = chunk_text(text_str=texto_prueba, chunk_size=10, overlap=2)

    assert len(resultado) > 0
    assert resultado[0] == "abcdefghij"
    assert resultado[1] == "ijklmnopqr"


def test_ingest_endpoint_success(mocker):
    mock_vector = [0.1] * 768
    mocker.patch("main.get_ollama_embedding", return_value=mock_vector)

    payload = {
        "filename": "test_documento.txt",
        "text": "Este es un texto corto de prueba para validar que el endpoint de ingesta guarda los vectores.",
        "type": "note",
        "tags": ["test", "pytest"]
    }

    response = client.post("/api/ingest", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "chunks" in body


def test_ingest_endpoint_empty_text():
    payload = {
        "filename": "vacio.txt",
        "text": "   ",
        "type": "note",
        "tags": []
    }
    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 400
    assert "vacío" in response.json()["detail"]


def test_query_endpoint_success(mocker):
    mocker.patch("main.get_ollama_embedding", return_value=[0.1] * 768)
    mocker.patch("main.condense_query", side_effect=lambda h, q: q)
    mocker.patch("main.evaluate_rag", return_value={"faithfulness": 4, "relevance": 5, "reasoning": "OK"})

    mock_response_ollama = mocker.Mock()
    mock_response_ollama.status_code = 200
    mock_response_ollama.iter_lines.return_value = iter([
        b'{"response": "Hola ", "done": false}',
        b'{"response": "mundo", "done": true}',
    ])
    mock_response_ollama.raise_for_status = mocker.Mock()
    mocker.patch("requests.post", return_value=mock_response_ollama)

    payload = {
        "question": "¿Para qué sirve el testeo?",
        "session_id": "test_session"
    }

    response = client.post("/api/query", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")


def test_list_documents(mocker):
    """Document listing endpoint returns correct structure."""
    response = client.get("/api/documents")
    assert response.status_code == 200
    body = response.json()
    assert "documents" in body
    assert isinstance(body["documents"], list)
    for doc in body["documents"]:
        assert "filename" in doc
        assert "type" in doc
        assert "chunks_count" in doc
        assert "tags" in doc
        assert "rag_enabled" in doc


def test_list_tags(mocker):
    """Tags endpoint returns list of tags from DB."""
    response = client.get("/api/tags")
    assert response.status_code == 200
    body = response.json()
    assert "tags" in body
    assert isinstance(body["tags"], list)


def test_ingest_file_endpoint_txt(mocker):
    """File upload endpoint accepts TXT files and ingests text."""
    mock_vector = [0.1] * 768
    mocker.patch("main.get_ollama_embedding", return_value=mock_vector)

    file_content = b"Este es un texto de prueba para validar el endpoint de carga de archivos."

    response = client.post(
        "/api/ingest-file",
        files={"file": ("test.txt", file_content, "text/plain")},
        data={"filename": "test_upload.txt", "item_type": "document", "tags": "test,upload"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "chunks" in body
