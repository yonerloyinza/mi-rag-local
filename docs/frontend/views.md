# Vistas del Frontend

## Navegación (Sidebar)

```
Sidebar
├── Logo + título: "Cerebro de Notas AI"
├── Nav buttons:
│   ├── Panel de Control (dashboard)
│   └── Invernadero de Datos (repository)
├── "Nueva Data" button → abre modal
├── Tags del Sistema (badges dinámicos)
└── Base de datos status (verde/rojo)
```

## Vistas

### 1. Dashboard
- **Widgets**: Total Documentos, Chunks Vectoriales, DB Status, Tags populares
- **Recent**: Carousel de documentos recientes
- **Health**: Estado del sistema RAG

### 2. Repository ("Invernadero de Datos")
- **Card grid**: Todas las notas/documentos
- **Search bar**: Filtra por filename
- **Mode selector**: hybrid / semantic / exact
- **Type filter**: note / document
- **Tag filter**: Click tags para filtrar
- **RAG toggle**: Switch per documento
- **Actions menu**: Dropdown (ver detalle, eliminar)

### 3. Editor
- **Title input** + **tag input**
- **Textarea** para contenido
- **Ingest button**: POST /api/ingest → chunked + embedded

### 4. Doc Detail
- **Header**: filename + type icon
- **Actions**: toggle RAG, edit tags, view chunks
- **Content**: chunk previews with pagination
- **Delete button**

### 5. DataModal ("Nueva Data")
- **Mode selector**: Nota (textarea) / Archivo (file upload)
- **Title input**
- **Tag input**: Enter to add, X to remove
- **Content/Upload**: Textarea or file picker (PDF, MD, TXT, images)
- **Buttons**: Cancelar / Guardar (indexa en background)

## Chat (lateral derecho)
- **Hotkeys**: Ctrl+/ abrir, Esc cerrar
- **Auto-scroll**: Al final cuando llegan nuevos mensajes
- **Message bubbles**:
  - User: fondo gris, ícono User, etiqueta "Tú"
  - Assistant: fondo oscuro, ícono Bot, etiqueta "Llama 3 RAG"
- **Thinking state**: Spinner + "pensando..." mientras no llegue primer token
- **Sources**: Badges debajo del mensaje (clickable → abre doc_detail)
- **Evaluation**: Badges faithfulness/relevance (5-point scale)
- **Condensed query**: Texto itálico debajo del mensaje
