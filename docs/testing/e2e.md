# Testing — E2E (Playwright)

## Configuración
- Framework: @playwright/test 1.64
- Browser: Chromium (1 worker)
- Base URL: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8000`

## Tests existentes (8)

| Test | Qué valida | Tipo |
|------|-----------|------|
| `should load the homepage` | Title + header | Page |
| `should display navigation` | Sidebar buttons + DB status | Page |
| `should show validation error (API)` | Empty text 400 | API |
| `should list knowledge items (API)` | /api/items 200 | API |
| `should list documents (API)` | /api/documents 200 | API |
| `should toggle AI Copiloto panel` | Chat sidebar open/close | Page |
| `should navigate between views` | Modal + 3 views nav | Page |
| `should show tag management` | Tag input + Enter key | Page |

## Selector patterns

```typescript
// Botones
page.locator('button', { hasText: 'Nueva Data' })

// Placeholders
page.getByPlaceholder('Título')
page.getByPlaceholder('+ Agregar tag...')

// Headings (role-based)
page.getByRole('heading', { name: 'Invernadero de Datos' })

// Text content
page.locator('text=Total Documentos')

// Inputs
page.locator('input[placeholder="Título"]')
```

## Ejecutar

```bash
# Requiere: backend corriendo en :8000 + frontend en :5173
cd frontend
npx tsc --noEmit  # typecheck primero
npx playwright test --reporter=list
```

## Configuración del servidor (webServer)

```typescript
// frontend/playwright.config.ts
webServer: {
  command: 'npx vite --port 5173',
  url: 'http://localhost:5173',
  timeout: 120000,
  reuseExistingServer: !process.env.CI,
}
```
