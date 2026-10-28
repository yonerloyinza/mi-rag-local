# Setup Local

## Prerequisitos

- **Python** 3.12+
- **PostgreSQL** 16 con extensión `pgvector`
- **Ollama** con models:
  ```bash
  ollama pull nomic-embed-text      # embeddings
  ollama pull llama3.1:8b           # LLM generation
  ```
- **Tesseract OCR** (solo para imágenes):
  ```bash
  # Ubuntu/Debian
  apt install tesseract-ocr tesseract-ocr-spa

  # macOS
  brew install tesseract-lang
  ```
- **Node.js** 20+ con pnpm

## Instalación

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copiar .env
cp ../.env.example ../.env
# Editar .env con credenciales de PostgreSQL

# Inicializar BD
alembic upgrade head

# O reset completo
python init_db.py reset

# Levantar servidor
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev --port 5173
```

## Docker (PostgreSQL + pgvector)

```bash
# Usar el docker-compose incluido
docker compose up -d postgres
```

El compose crea un contenedor `pgvector/pg16` con extensión `vector` preinstalada.

## Verificación

```bash
# Backend health
curl http://localhost:8000/api/health
# {"status":"ok","connection":"Postgres + pgvector conectado"}

# Frontend
# Navegar a http://localhost:5173
```

## .env template

```env
DB_USER=mi_usuario
DB_PASSWORD=mi_password
DB_NAME=db_rag
DB_HOST=localhost
DB_PORT=5432
```
