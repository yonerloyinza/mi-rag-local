import { test, expect } from '@playwright/test';

test.describe('Cerebro RAG Lab - Web Tests', () => {

  test('should load the homepage with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cerebro RAG/i);
    await expect(page.locator('text=Cerebro de Notas AI')).toBeVisible();
  });

  test('should display navigation sections and DB status', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button', { hasText: 'Panel de Control' });
    await expect(page.locator('button', { hasText: 'Panel de Control' })).toBeVisible();
     await expect(page.locator('button', { hasText: 'Nueva Data' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Activos de Información' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Invocar Copiloto AI' })).toBeVisible();
    await expect(page.locator('text=Base de datos')).toBeVisible();
  });

  test('should show validation error when ingesting empty text (via API)', async ({ request }) => {
    const response = await request.post('http://127.0.0.1:8000/api/ingest', {
      data: { filename: 'test.txt', text: '   ', type: 'note', tags: [] },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain('vacío');
  });

  test('should list knowledge items from backend', async ({ request }) => {
    const response = await request.fetch('http://127.0.0.1:8000/api/items');
    expect(response.status()).toBe(200);
    const items = await response.json();
    expect(Array.isArray(items)).toBe(true);
  });

  test('should list documents from backend', async ({ request }) => {
    const response = await request.fetch('http://127.0.0.1:8000/api/documents');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('documents');
    expect(Array.isArray(data.documents)).toBe(true);
  });

  test('should toggle AI Copiloto panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button', { hasText: 'Invocar Copiloto AI' });

    await page.locator('button', { hasText: 'Invocar Copiloto AI' }).click();

    await expect(page.locator('text=Copiloto Inteligente (SSE)')).toBeVisible({ timeout: 10000 });

    await page.locator('button', { hasText: 'Cerrar Copiloto' }).click();
    await expect(page.locator('text=Copiloto Inteligente (SSE)')).not.toBeVisible();
  });

  test('should navigate between views', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button', { hasText: 'Panel de Control' });

    await page.locator('button', { hasText: 'Nueva Data' }).click();
    await expect(page.locator('button', { hasText: 'Nota' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Archivo' })).toBeVisible();
    await page.locator('button', { hasText: 'Cancelar' }).click();
    await expect(page.locator('button', { hasText: 'Nota' })).not.toBeVisible();

    await page.locator('button', { hasText: 'Activos de Información' }).click();
    await expect(page.getByRole('heading', { name: 'Activos de Información' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar notas, documentos o tags...')).toBeVisible();

    await page.locator('button', { hasText: 'Panel de Control' }).click();
    await expect(page.getByRole('heading', { name: 'Panel de Control Global' })).toBeVisible();
    await expect(page.locator('text=Total Documentos')).toBeVisible();
  });

  test('should show tag management in editor', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button', { hasText: 'Panel de Control' });

    await page.locator('button', { hasText: 'Nueva Data' }).click();
    await expect(page.locator('button', { hasText: 'Nota' })).toBeVisible();

    await page.locator('input[placeholder="Título"]').fill('Test Tag Note');
    const tagInput = page.locator('input[placeholder="+ Agregar tag..."]');
    await tagInput.fill('test-tag');
    await tagInput.press('Enter');

    await expect(page.locator('text=#test-tag')).toBeVisible({ timeout: 5000 });
  });
});
