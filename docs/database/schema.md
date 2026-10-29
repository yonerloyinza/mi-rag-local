# Esquema de Base de Datos

## Arquitectura Híbrida: Base de Datos + Sistema de Archivos

La aplicación implementa una estrategia híbrida donde:
- **Base de datos (PostgreSQL)**: Almacena metadatos, etiquetas, tags, estado RAG y referencias a archivos
- **Sistema de archivos**: Almacena archivos originales (.md, .pdf, imágenes) con nombres basados en hash SHA-256

### Estrategia de Hash para Archivos

Los archivos se almacenan usando un hash único del contenido:
1. Se genera SHA-256 del contenido del archivo
2. Se crea una estructura de subcarpetas `/ab/cd/` usando los primeros 4 caracteres del hash
3. El archivo se guarda con el nombre `{hash}.{extension}`

**Ventajas:**
- Cero colisiones de nombres
- Sanitización automática (sin caracteres raros en paths)
- Deduplicación: archivos idénticos comparten el mismo hash
- Organización técnica invisible al usuario

## Tablas

### `documents`
Tabla principal que representa cada documento/nota como una entidad única.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | Integer (PK, auto) | | Primary key |
| filename | String | NOT NULL, único | Nombre de archivo (nombre de display) |
| type | String | "note" | "note" o "document" |
| file_path | String | NULL | Ruta física del archivo hasheado |
| file_hash | String | NULL | Hash SHA-256 del contenido |
| original_filename | String | NULL | Nombre original del archivo (para Content-Disposition) |
| tags | ARRAY(String) | {} | Etiquetas del documento |
| rag_enabled | Boolean | true | Si el documento participa en búsquedas RAG |
| created_at | DateTime | now() | Timestamp de creación |
| updated_at | DateTime | now() | Timestamp de actualización |

### `document_chunks`
Tabla de fragmentos para búsqueda vectorial (RAG). Cada documento puede tener múltiples chunks.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | Integer (PK, auto) | | Primary key |
| document_id | Integer (FK) | NOT NULL | FK → documents.id (ON DELETE CASCADE) |
| filename | String | NOT NULL | Nombre del documento (denormalizado) |
| content | Text | NOT NULL | Texto del chunk |
| embedding | Vector(768) | NOT NULL | Embedding de nomic-embed-text |
| type | String | "note" | "note" o "document" (denormalizado) |
| tags | ARRAY(String) | {} | Etiquetas (denormalizado) |
| rag_enabled | Boolean | true | Si está en results de búsqueda (denormalizado) |
| created_at | DateTime | now() | Timestamp de creación |
| updated_at | DateTime | now() | Timestamp de actualización |
| search_vector | TSVECTOR | NULL | Para búsqueda full-text en español |

### `chat_history`
Historial de conversaciones.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| id | Integer (PK, auto) | | Primary key |
| session_id | String | NOT NULL | Identificador de sesión |
| role | String | NOT NULL | "user" o "assistant" |
| content | Text | NOT NULL | Mensaje |
| eval_score | JSON | NULL | Score de evaluación RAG |
| created_at | DateTime | now() | Timestamp |

## Índices

| Índice | Tabla | Columna | Tipo |
|--------|-------|---------|------|
| ix_documents_filename | documents | filename | B-tree (unique) |
| ix_documents_file_hash | documents | file_hash | B-tree |
| ix_document_chunks_document_id | document_chunks | document_id | B-tree |
| ix_document_chunks_filename | document_chunks | filename | B-tree |
| ix_document_chunks_search_vector | document_chunks | search_vector | GIN |
| ix_chat_history_session_id | chat_history | session_id | B-tree |

## Estructura de Archivos

### `vault/`
Almacena notas (.md, .txt) con estructura hash:
```
vault/
└── ab/
    └── cd/
        └── abcdef123456....md
```

### `uploads/`
Almacena documentos e imágenes originales:
```
uploads/
└── ab/
    └── cd/
        └── abcdef123456....pdf
```

## Trigger
`tsvectorupdate`: BEFORE INSERT OR UPDATE ON document_chunks — auto-actualiza `search_vector` usando `tsvector_update_trigger(search_vector, 'pg_catalog.spanish', content)`.

## Extensión
`vector` (pgvector) — creada automáticamente via `@event.listens_for(engine, "connect")`.
