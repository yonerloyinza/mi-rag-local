# Task: Consolidación UI
Status: COMPLETADA
Fecha: 2026-10-28

## Logros
- Unificado "Nueva Nota" + "Subir Documento" → "Nueva Data" modal
- Removido document linking (modelo, endpoints, tabla DB)
- Tags como única relación entre datos
- Extensiones .md para notas, preservación de extensiones para archivos

## Archivos modificados
- frontend/src/App.tsx (sidebar, modal, state management)
- backend/main.py (document_link endpoints removed)
- backend/database.py (DocumentLink model removed)
- backend/test_main.py (linked_docs_count removed)
