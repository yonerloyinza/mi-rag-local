# Componentes

## Backend (`backend/main.py`)

### Dependencias internas
| Función | Uso | Línea |
|---------|-----|-------|
| `chunk_text()` | Split texto en chunks (400 chars, 80 overlap) | 73 |
| `get_ollama_embedding()` | Embeddings via Ollama `nomic-embed-text` | 82 |
| `condense_query()` | Reescribe query con contexto LLM para resolver pronombres | 90 |
| `evaluate_rag()` | Scorne faithfulness/relevance con LLM | 108 |

### Models (`backend/database.py`)
- `DocumentChunk`: filename, content, embedding(768), type, tags[], rag_enabled, search_vector
- `ChatHistory`: session_id, role, content, created_at

## Frontend (`frontend/src/App.tsx`)

### Estado principal (useState)
```typescript
View = 'dashboard' | 'repository' | 'editor' | 'doc_detail'
apiOpen: boolean          // panel de chat lateral
dataModalOpen: boolean     // popup "Nueva Data"
dataMode: 'note' | 'document'
messages: Message[]        // chat messages
documents: DocumentDetail[]   // from /api/documents
items: KnowledgeItem[]     // from /api/items
tags: string[]             // from /api/tags
```

### Message interface
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceInfo[];   // only shown for assistant when relevant
  evaluation?: Evaluation;
  condensedQuery?: string;
  thinking?: boolean;       // shows "pensando..." with spinner
}
```

## Vistas del Frontend
| Vista | Componentes clave | Estados relevantes |
|-------|-------------------|-------------------|
| Dashboard | Cards de métricas, tags, documentos recientes | documents, tags, dbConnected |
| Repository | Card grid, search bar, mode selector, filters | searchQuery, searchResults, activeTypes, activeTags |
| Editor | Textarea, tag input, save button | noteTitle, noteContent, noteTags |
| Doc Detail | Content view, RAG toggle, tags | activeDoc, docTagsInput |
| Chat (sidebar) | Message list, input textarea, send button | aiOpen, messages, question |
