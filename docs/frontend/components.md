# Componentes UI

## Shadcn Components

Todos los componentes están en `frontend/src/components/ui/`:

| Archivo | Dependencia | Notas |
|---------|-------------|-------|
| `badge.tsx` | - | Para tags y etiquetas |
| `button.tsx` | - | Botones primarios/secundarios |
| `card.tsx` | - | Cards de dashboard |
| `input.tsx` | `@radix-ui/react-slot` | Inputs de texto |
| `textarea.tsx` | - | Contenido de notas |
| `switch.tsx` | `@radix-ui/react-switch` | Toggle RAG |
| `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Menu contextual en repository |

## Librerías externas

| Paquete | Uso |
|---------|-----|
| `lucide-react` | Íconos (Folder, FileText, Bot, User, Loader2, etc.) |
| `class-variance-authority` | Variantes de componentes |
| `clsx` | Conditional classes |
| `tailwind-merge` | Conflict resolution para Tailwind |

## Componentes custom

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| DataModal | App.tsx (línea ~950) | Popup "Nueva Data" — notas/archivos/file upload |
| SourceBadge | App.tsx render | Clickable source citations in chat |
| TagList | App.tsx render | Badge display for tags |
| SearchFilters | App.tsx render | Mode selector, type/tags filters |
