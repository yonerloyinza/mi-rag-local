# Migraciones

## Historia (orden de aplicación)

| Rev | Descripción | Campos afectados |
|-----|-------------|-----------------|
| `45acf0e21b69` | Initial | Crea `document_chunks`, `chat_history`, extensión vector |
| `854c2187c2e5` | Chat history para memoria | `chat_history` table |
| `5b5a84dd02e0` | Agrega type a chunks | `document_chunks.type` |
| `2a1e5bf9a137` | Search vector híbrida | `search_vector`, GIN idx, trigger |
| `add_gin_idx_002` | Índice GIN explícito | `ix_document_chunks_search_vector` |
| `ceb7a10927d3` | Tags, rag_enabled, updated_at | `tags`, `rag_enabled`, `updated_at` |

## Comandos

```bash
# Activar venv
cd backend && source venv/bin/activate

# Ver estado
alembic current

# Aplicar todas
alembic upgrade head

# Nueva migración
alembic revision --autogenerate -m "descripcion"

# Revertir
alembic downgrade -1
```

## Notas
- `alembic.ini` tiene URL placeholder (`driver://user:pass@localhost/dbname`) — `env.py` sobreescribe con `DATABASE_URL`
- La migración `document_links` fue eliminada (feature removed — tags are sole relationship)
- `init_db.py` existe como alternativa pero está deprecated — usar Alembic
