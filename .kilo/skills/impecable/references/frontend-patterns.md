# Frontend Patterns

## Component Architecture

- Main component: `App.tsx` — single-file React component with all views
- Views: `dashboard`, `repository`, `editor`, `doc_detail`
- UI library: Shadcn components (`Button`, `Input`, `Textarea`, `Card`, `Badge`, `Switch`)
- Icons: `lucide-react`
- State: `useState` and `useEffect` (no external state management)

## State Conventions

- `messages`: array of `Message` (user/assistant roles)
- `documents`: array of document metadata from `/api/documents`
- `dataModalOpen`: boolean for the "Nueva Data" modal
- `dataMode`: `'note' | 'document'` for modal mode selection

## Message Interface

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceInfo[];
  evaluation?: Evaluation;
  condensedQuery?: string;
  thinking?: boolean;
}
```

## SSE Event Handling

Parse SSE stream line-by-line:
1. Extract `event:` line for event type
2. Extract `data:` line for payload
3. Handle events: `sources`, `condensed_query`, `token`, `evaluation`, `error`

Always update the assistant message at index `messages.length + 1`
(the index after the user message in the updated array).

## Testing

- E2e tests in `frontend/e2e/app.spec.ts` using Playwright
- Selectors: `page.locator('button', { hasText: '...' })`, `page.getByPlaceholder('...')`
- Backend API tests use `page.request.fetch('http://127.0.0.1:8000/...')`
- Run: `npx playwright test --reporter=list`

## Modal Pattern

The "Nueva Data" modal is a custom overlay (no Shadcn Dialog):
- Full-screen overlay with `fixed inset-0 bg-black/60`
- Centered container with `bg-slate-900 border border-slate-800`
- `onClick` on overlay to close on outside click
- `e.stopPropagation()` on content to prevent closing when clicking inside
