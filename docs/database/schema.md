# Esquema de Base de Datos

## Tablas

### `document_chunks`
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | Integer (PK, auto) | | Primary key |
| filename | String | NOT NULL | Nombre del documento/nota |
| content | Text | NOT NULL | Texto del chunk |
| embedding | Vector(768) | NOT NULL | Embedding de nomic-embed-text |
| type | String | "note" | "note" o "document" |
| tags | ARRAY(String) | {} | Etiquetas |
| rag_enabled | Boolean | true | Si está en results de búsqueda |
| created_at | DateTime | now() | Timestamp de creación |
| updated_at | DateTime | now() | Timestamp de actualización |
| search_vector | TSVECTOR | NULL | Para búsqueda full-text en español |

### `chat_history`
| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | Integer (PK, auto) | | Primary key |
| session_id | String | NOT NULL | Identificador de sesión |
| role | String | NOT NULL | "user" o "assistant" |
| content | Text | NOT NULL | Mensaje |
| created_at | DateTime | now() | Timestamp |

## Índices

| Índice | Tabla | Columna | Tipo |
|--------|-------|---------|------|
| ix_document_chunks_filename | document_chunks | filename | B-tree |
| ix_document_chunks_search_vector | document_chunks | search_vector | GIN |
| ix_chat_history_session_id | chat_history | session_id | B-tree |

## Trigger
`tsvectorupdate`: BEFORE INSERT OR UPDATE ON document_chunks — auto-actualiza `search_vector` usando `tsvector_update_trigger(search_vector, 'pg_catalog.spanish', content)`.

## Extensión
`vector` (pgvector) — creada automáticamente via `@event.listens_for(engine, "connect")`.
