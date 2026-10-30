import pytest
import uuid
from fastapi.testclient import TestClient
from main import app, chunk_text

client = TestClient(app)


def get_auth_cookies():
    """Registra y autentica, devuelve dict de cookies."""
    client.cookies.clear()
    client.post("/auth/register", json={
        "email": "test@test.com",
        "username": "testuser",
        "password": "testpass123",
        "full_name": "Test User"
    })
    login = client.post("/auth/login", json={
        "email": "test@test.com",
        "password": "testpass123"
    })
    assert login.status_code == 200, f"Login falló: {login.status_code}"
    cookies = {}
    for key, value in login.cookies.items():
        cookies[key] = value
    return cookies


def test_chunk_text_logic():
    texto_prueba = "abcdefghijklmnopqrstuvwxyz"
    resultado = chunk_text(text_str=texto_prueba, chunk_size=10, overlap=2)

    assert len(resultado) > 0
    assert resultado[0] == "abcdefghij"
    assert resultado[1] == "ijklmnopqr"


def test_auth_register_and_login():
    client.cookies.clear()
    reg = client.post("/auth/register", json={
        "email": "auth_test@test.com",
        "username": "auth_test_user",
        "password": "authpass123",
        "full_name": "Auth Test User"
    })
    assert reg.status_code in (200, 400), f"Registro: {reg.status_code}"

    login = client.post("/auth/login", json={
        "email": "auth_test@test.com",
        "password": "authpass123"
    })
    assert login.status_code == 200
    assert login.cookies.get("access_token") is not None
    assert login.cookies.get("refresh_token") is not None

    me_cookies = {k: v for k, v in login.cookies.items()}
    me = client.get("/auth/me", cookies=me_cookies)
    assert me.status_code == 200
    assert me.json()["username"] == "auth_test_user"

    logout = client.post("/auth/logout", cookies=me_cookies)
    assert logout.status_code == 200

    me_after = client.get("/auth/me")
    assert me_after.status_code == 401


def test_auth_login_invalid_credentials():
    login = client.post("/auth/login", json={
        "email": "nonexistent@test.com",
        "password": "wrongpass"
    })
    assert login.status_code == 401


def test_ingest_endpoint_success(mocker):
    cookies = get_auth_cookies()
    mock_vector = [0.1] * 768
    mocker.patch("main.get_ollama_embedding", return_value=mock_vector)

    payload = {
        "filename": "test_documento.md",
        "text": "Este es un texto corto de prueba para validar que el endpoint de ingesta guarda los vectores.",
        "type": "note",
        "tags": ["test", "pytest"]
    }

    response = client.post("/api/ingest", json=payload, cookies=cookies)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "chunks" in body


def test_ingest_endpoint_empty_text():
    cookies = get_auth_cookies()
    payload = {
        "filename": "vacio.txt",
        "text": "   ",
        "type": "note",
        "tags": []
    }
    response = client.post("/api/ingest", json=payload, cookies=cookies)
    assert response.status_code == 400
    assert "vacío" in response.json()["detail"]


def test_query_endpoint_success(mocker):
    cookies = get_auth_cookies()
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

    response = client.post("/api/query", json=payload, cookies=cookies)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")


def test_list_documents(mocker):
    """Document listing endpoint returns correct structure without duplicates."""
    cookies = get_auth_cookies()
    response = client.get("/api/documents", cookies=cookies)
    assert response.status_code == 200
    body = response.json()
    assert "documents" in body
    assert isinstance(body["documents"], list)

    filenames = [doc["filename"] for doc in body["documents"]]
    assert len(filenames) == len(set(filenames)), "Duplicate filenames detected in /api/documents"

    for doc in body["documents"]:
        assert "filename" in doc
        assert "type" in doc
        assert "chunks_count" in doc
        assert "tags" in doc
        assert "rag_enabled" in doc


def test_list_knowledge_items_no_duplicates():
    """Items endpoint returns unique (filename, type) pairs."""
    cookies = get_auth_cookies()
    response = client.get("/api/items", cookies=cookies)
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)

    seen = set()
    for item in items:
        key = (item["filename"], item["type"])
        assert key not in seen, f"Duplicate item: {key}"
        seen.add(key)


def test_list_tags(mocker):
    """Tags endpoint returns list of tags from DB."""
    cookies = get_auth_cookies()
    response = client.get("/api/tags", cookies=cookies)
    assert response.status_code == 200
    body = response.json()
    assert "tags" in body
    assert isinstance(body["tags"], list)


def test_ingest_file_endpoint_txt(mocker):
    """File upload endpoint accepts TXT files and ingests text."""
    cookies = get_auth_cookies()
    mock_vector = [0.1] * 768
    mocker.patch("main.get_ollama_embedding", return_value=mock_vector)

    file_content = b"Este es un texto de prueba para validar el endpoint de carga de archivos."

    response = client.post(
        "/api/ingest-file",
        files={"file": ("test.txt", file_content, "text/plain")},
        data={"filename": "test_upload.txt", "item_type": "document", "tags": "test,upload"},
        cookies=cookies,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "chunks" in body


def test_document_sharing_acl(mocker):
    """Test document sharing with permission levels."""
    mock_vector = [0.1] * 768
    mocker.patch("main.get_ollama_embedding", return_value=mock_vector)

    def auth_as_testuser():
        client.cookies.clear()
        client.post("/auth/register", json={
            "email": "test@test.com",
            "username": "testuser",
            "password": "testpass123",
            "full_name": "Test User"
        })
        login = client.post("/auth/login", json={
            "email": "test@test.com",
            "password": "testpass123",
        })
        assert login.status_code == 200
        return {k: v for k, v in login.cookies.items()}

    suffix = uuid.uuid4().hex[:8]
    user2_email = f"user2_{suffix}@test.com"
    user2_username = f"user2_{suffix}"

    def auth_as_user2():
        client.cookies.clear()
        client.post("/auth/register", json={
            "email": user2_email,
            "username": user2_username,
            "password": "pass12345",
        })
        login = client.post("/auth/login", json={
            "email": user2_email,
            "password": "pass12345",
        })
        assert login.status_code == 200
        return {k: v for k, v in login.cookies.items()}

    cookies_testuser = auth_as_testuser()

    ingest = client.post("/api/ingest", json={
        "filename": "shared_doc.md",
        "text": "Documento para probar compartir",
        "type": "note",
        "tags": ["shared"]
    }, cookies=cookies_testuser)
    assert ingest.status_code == 200

    me_testuser = client.get("/auth/me", cookies=cookies_testuser)
    owner_id = me_testuser.json()["id"]

    cookies_user2 = auth_as_user2()
    me_user2 = client.get("/auth/me", cookies=cookies_user2)
    user2_id = me_user2.json()["id"]

    resp = client.get("/api/documents", cookies=cookies_user2)
    assert resp.status_code == 200
    docs = resp.json()["documents"]
    shared_names = [d["filename"] for d in docs if d["filename"] == "shared_doc.md"]
    assert len(shared_names) == 0

    cookies_testuser = auth_as_testuser()

    share = client.post("/api/documents/shared_doc.md/shares", json={
        "user_id": user2_id,
        "permission_level": "read"
    }, cookies=cookies_testuser)
    assert share.status_code == 200, f"Share failed: {share.status_code} {share.text}"

    cookies_user2 = auth_as_user2()

    resp = client.get("/api/documents", cookies=cookies_user2)
    assert resp.status_code == 200
    docs = resp.json()["documents"]
    shared_names = [d["filename"] for d in docs if d["filename"] == "shared_doc.md"]
    assert len(shared_names) == 1

    toggle = client.patch("/api/documents/shared_doc.md/toggle-rag", cookies=cookies_user2)
    assert toggle.status_code == 403, f"Toggle status: {toggle.status_code}"

    tags = client.patch("/api/documents/shared_doc.md/tags", json=["hacked"], cookies=cookies_user2)
    assert tags.status_code == 403, f"Tags status: {tags.status_code}"

    delete = client.delete("/api/documents/shared_doc.md", cookies=cookies_user2)
    assert delete.status_code == 403, f"Delete status: {delete.status_code}"


def test_refresh_token_flow():
    cookies = get_auth_cookies()
    refresh_cookie = cookies.get("refresh_token")
    assert refresh_cookie

    # Sin access token, el refresh debe emitir uno nuevo.
    refreshed = client.post("/auth/refresh", cookies={"refresh_token": refresh_cookie})
    assert refreshed.status_code == 200
    assert refreshed.cookies.get("access_token")

    me = client.get("/auth/me", cookies={"access_token": refreshed.cookies["access_token"]})
    assert me.status_code == 200
    assert me.json()["email"] == "test@test.com"


def test_refresh_token_rejects_access_token():
    cookies = get_auth_cookies()
    response = client.post("/auth/refresh", cookies={"refresh_token": cookies["access_token"]})
    assert response.status_code == 401


def test_register_requires_minimum_password_length():
    client.cookies.clear()
    response = client.post("/auth/register", json={
        "email": "short_password@test.com",
        "username": "short_password_user",
        "password": "1234567",
    })
    assert response.status_code == 400


def test_register_duplicate_email_is_rejected():
    client.cookies.clear()
    payload = {
        "email": "duplicate@test.com",
        "username": "duplicate_user",
        "password": "password123",
    }
    first = client.post("/auth/register", json=payload)
    assert first.status_code in (200, 400)
    second = client.post("/auth/register", json={
        **payload,
        "username": "duplicate_user_2",
    })
    assert second.status_code == 400


def test_non_admin_cannot_access_admin_endpoints():
    cookies = get_auth_cookies()
    assert client.get("/admin/users", cookies=cookies).status_code == 403
    assert client.get("/admin/roles", cookies=cookies).status_code == 403
    assert client.get("/admin/permissions", cookies=cookies).status_code == 403


def test_user_cannot_overwrite_another_users_document(mocker):
    mocker.patch("main.get_ollama_embedding", return_value=[0.1] * 768)

    client.cookies.clear()
    owner_login = client.post("/auth/login", json={
        "email": "test@test.com",
        "password": "testpass123",
    })
    assert owner_login.status_code == 200
    owner_cookies = {k: v for k, v in owner_login.cookies.items()}

    filename = "owner_only_document.md"
    created = client.post("/api/ingest", json={
        "filename": filename,
        "text": "Contenido del propietario",
        "type": "note",
        "tags": [],
    }, cookies=owner_cookies)
    assert created.status_code == 200

    client.cookies.clear()
    suffix = uuid.uuid4().hex[:8]
    other_email = f"other_{suffix}@test.com"
    other_username = f"other_{suffix}"
    client.post("/auth/register", json={
        "email": other_email,
        "username": other_username,
        "password": "pass12345",
    })
    other = client.post("/auth/login", json={
        "email": other_email,
        "password": "pass12345",
    })
    assert other.status_code == 200
    other_cookies = {k: v for k, v in other.cookies.items()}

    overwrite = client.post("/api/ingest", json={
        "filename": filename,
        "text": "Contenido secuestrado",
        "type": "note",
        "tags": [],
    }, cookies=other_cookies)
    assert overwrite.status_code == 403
