import { test, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const BACKEND_URL = 'http://127.0.0.1:8000';
const PASSWORD = 'ContraseñaSegura123';

interface TestUser {
  email: string;
  username: string;
  password: string;
  fullName: string;
}

function uniqueUser(prefix: string): TestUser {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `${prefix}_${suffix}@ejemplo.com`,
    username: `${prefix}_${suffix}`,
    password: PASSWORD,
    fullName: `Usuario ${prefix}`,
  };
}

async function registerViaAPI(request: APIRequestContext, user: TestUser) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: {
      email: user.email,
      username: user.username,
      password: user.password,
      full_name: user.fullName,
    },
  });
  expect(res.status(), await res.text()).toBe(200);
}

function cookieHeaderFromResponse(response: APIResponse): string {
  return response
    .headersArray()
    .filter(header => header.name.toLowerCase() === 'set-cookie')
    .map(header => header.value.match(/^([^=]+)=([^;]+)/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => `${match[1]}=${match[2]}`)
    .join('; ');
}

async function loginViaAPI(request: APIRequestContext, user: TestUser): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  expect(res.status(), await res.text()).toBe(200);
  const cookieHeader = cookieHeaderFromResponse(res);
  expect(cookieHeader).toContain('access_token=');
  return cookieHeader;
}

async function loginViaUI(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByTestId('login-form').getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

async function createNoteViaAPI(request: APIRequestContext, cookieHeader: string, filename: string, text: string) {
  const res = await request.post(`${BACKEND_URL}/api/ingest`, {
    data: { filename, text, type: 'note', tags: ['e2e'] },
    headers: { Cookie: cookieHeader },
  });
  expect(res.status(), await res.text()).toBe(200);
}

test.describe('Autenticación en la interfaz', () => {
  test('sin sesión muestra el login y protege las rutas internas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/repository');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
  });

  test('el registro por UI crea la cuenta, inicia sesión y sobrevive una recarga', async ({ page }) => {
    const user = uniqueUser('registro');

    await page.goto('/register');
    await expect(page.getByTestId('register-form')).toBeVisible();

    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="username"]').fill(user.username);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('input[name="fullName"]').fill(user.fullName);
    await page.getByTestId('register-form').getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('dashboard-view')).toBeVisible();
    await expect(page.getByText(user.username, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-view')).toBeVisible();
  });

  test('al recargar una vista interna no muestra el login durante la comprobación de sesión', async ({ page, request }) => {
    const user = uniqueUser('recarga');
    await registerViaAPI(request, user);
    await loginViaUI(page, user);

    await page.getByRole('button', { name: 'Activos de Información' }).click();
    await expect(page).toHaveURL(/\/repository$/);
    await expect(page.getByTestId('repository-view')).toBeVisible();

    // Retrasa /auth/me para que el estado de carga sea observable y se pueda
    // detectar cualquier parpadeo del formulario de login.
    await page.route('**/auth/me', async route => {
      await new Promise(resolve => setTimeout(resolve, 700));
      await route.continue();
    });

    await page.reload();
    await expect(page.getByTestId('auth-loading')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);

    await expect(page.getByTestId('repository-view')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);
    await expect(page).toHaveURL(/\/repository$/);
  });

  test('renueva el access token expirado al recargar sin pedir login', async ({ page, request }) => {
    const user = uniqueUser('refresh');
    await registerViaAPI(request, user);
    await loginViaUI(page, user);

    let meCalls = 0;
    let refreshCalls = 0;
    page.on('request', req => {
      if (req.url().includes('/auth/refresh')) refreshCalls += 1;
    });
    await page.route('**/auth/me', async route => {
      meCalls += 1;
      if (meCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'El token ha expirado' }),
        });
        return;
      }
      await route.continue();
    });

    await page.reload();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);
    expect(meCalls).toBeGreaterThanOrEqual(2);
    expect(refreshCalls).toBe(1);
  });

  test('la navegación interna conserva la URL y funciona con atrás/adelante', async ({ page, request }) => {
    const user = uniqueUser('historial');
    await registerViaAPI(request, user);
    await loginViaUI(page, user);

    await page.getByRole('button', { name: 'Activos de Información' }).click();
    await expect(page).toHaveURL(/\/repository$/);
    await expect(page.getByTestId('repository-view')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('repository-view')).toBeVisible();
    await expect(page).toHaveURL(/\/repository$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('dashboard-view')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/repository$/);
    await expect(page.getByTestId('repository-view')).toBeVisible();
  });

  test('el detalle de un documento sobrevive una recarga', async ({ page, request }) => {
    const user = uniqueUser('detalle');
    const filename = `detalle_${Date.now()}.md`;
    await registerViaAPI(request, user);
    await loginViaUI(page, user);

    const ingest = await page.request.post('/api/ingest', {
      data: { filename, text: 'Contenido del documento de prueba E2E.', type: 'note', tags: ['e2e'] },
    });
    expect(ingest.status(), await ingest.text()).toBe(200);

    await page.goto('/repository');
    const card = page.getByTestId(`doc-card-${filename}`);
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/document/${encodeURIComponent(filename)}$`));
    const title = page.locator('input[placeholder="Título del documento..."]');
    await expect(title).toHaveValue(filename);

    await page.reload();
    await expect(page.getByTestId('login-form')).toHaveCount(0);
    await expect(page.locator('input[placeholder="Título del documento..."]')).toHaveValue(filename);
    await expect(page).toHaveURL(new RegExp(`/document/${encodeURIComponent(filename)}$`));
  });

  test('cerrar sesión limpia el estado y vuelve a proteger las rutas', async ({ page, request }) => {
    const user = uniqueUser('logout');
    await registerViaAPI(request, user);
    await loginViaUI(page, user);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/repository');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
  });
});

test.describe('Autorización de la API', () => {
  test('rechaza peticiones sin sesión', async ({ request }) => {
    const docs = await request.get(`${BACKEND_URL}/api/documents`);
    expect(docs.status()).toBe(401);

    const ingest = await request.post(`${BACKEND_URL}/api/ingest`, {
      data: { filename: 'sin_sesion.md', text: 'test', type: 'note', tags: [] },
    });
    expect(ingest.status()).toBe(401);

    const admin = await request.get(`${BACKEND_URL}/admin/users`);
    expect(admin.status()).toBe(401);
  });

  test('propietario comparte lectura y el viewer no puede escribir hasta tener permiso', async ({ request }) => {
    const owner = uniqueUser('owner');
    const viewer = uniqueUser('viewer');
    const filename = `acl_${Date.now()}.md`;

    await registerViaAPI(request, owner);
    const ownerCookies = await loginViaAPI(request, owner);
    await registerViaAPI(request, viewer);
    const viewerCookies = await loginViaAPI(request, viewer);

    await createNoteViaAPI(request, ownerCookies, filename, 'Documento para probar ACL.');

    const meOwner = await request.get(`${BACKEND_URL}/auth/me`, { headers: { Cookie: ownerCookies } });
    const ownerId = (await meOwner.json()).id;
    const meViewer = await request.get(`${BACKEND_URL}/auth/me`, { headers: { Cookie: viewerCookies } });
    const viewerId = (await meViewer.json()).id;

    const before = await request.get(`${BACKEND_URL}/api/documents`, { headers: { Cookie: viewerCookies } });
    const beforeDocs = (await before.json()).documents || [];
    expect(beforeDocs.some((d: any) => d.filename === filename)).toBe(false);

    const forbiddenShare = await request.get(`${BACKEND_URL}/api/documents/${filename}/shares`, {
      headers: { Cookie: viewerCookies },
    });
    expect(forbiddenShare.status()).toBe(403);

    const share = await request.post(`${BACKEND_URL}/api/documents/${filename}/shares`, {
      data: { user_id: viewerId, permission_level: 'read' },
      headers: { Cookie: ownerCookies },
    });
    expect(share.status()).toBe(200);

    const after = await request.get(`${BACKEND_URL}/api/documents`, { headers: { Cookie: viewerCookies } });
    const afterDocs = (await after.json()).documents || [];
    expect(afterDocs.some((d: any) => d.filename === filename)).toBe(true);

    const readContent = await request.get(`${BACKEND_URL}/api/documents/${filename}/content`, {
      headers: { Cookie: viewerCookies },
    });
    expect(readContent.status()).toBe(200);

    const toggleReadOnly = await request.patch(`${BACKEND_URL}/api/documents/${filename}/toggle-rag`, {
      headers: { Cookie: viewerCookies },
    });
    expect(toggleReadOnly.status()).toBe(403);

    const tagsReadOnly = await request.patch(`${BACKEND_URL}/api/documents/${filename}/tags`, {
      data: ['hacked'],
      headers: { Cookie: viewerCookies },
    });
    expect(tagsReadOnly.status()).toBe(403);

    const deleteReadOnly = await request.delete(`${BACKEND_URL}/api/documents/${filename}`, {
      headers: { Cookie: viewerCookies },
    });
    expect(deleteReadOnly.status()).toBe(403);

    const upgrade = await request.post(`${BACKEND_URL}/api/documents/${filename}/shares`, {
      data: { user_id: viewerId, permission_level: 'write' },
      headers: { Cookie: ownerCookies },
    });
    expect(upgrade.status()).toBe(200);

    const toggleWrite = await request.patch(`${BACKEND_URL}/api/documents/${filename}/toggle-rag`, {
      headers: { Cookie: viewerCookies },
    });
    expect(toggleWrite.status()).toBe(200);

    const deleteAsWriter = await request.delete(`${BACKEND_URL}/api/documents/${filename}`, {
      headers: { Cookie: viewerCookies },
    });
    expect(deleteAsWriter.status()).toBe(403);

    const adminAsViewer = await request.get(`${BACKEND_URL}/admin/users`, {
      headers: { Cookie: viewerCookies },
    });
    expect(adminAsViewer.status()).toBe(403);

    // El propietario sí puede consultar los shares; el viewer no administra ACL.
    const sharesAsOwner = await request.get(`${BACKEND_URL}/api/documents/${filename}/shares`, {
      headers: { Cookie: ownerCookies },
    });
    expect(sharesAsOwner.status()).toBe(200);
    expect(ownerId).not.toBe(viewerId);
  });

  test('un usuario no puede sobrescribir el documento de otro', async ({ request }) => {
    const owner = uniqueUser('owner_ow');
    const intruder = uniqueUser('intruder');
    const filename = `owner_only_${Date.now()}.md`;

    await registerViaAPI(request, owner);
    const ownerCookies = await loginViaAPI(request, owner);
    await createNoteViaAPI(request, ownerCookies, filename, 'Contenido original.');

    await registerViaAPI(request, intruder);
    const intruderCookies = await loginViaAPI(request, intruder);

    const overwrite = await request.post(`${BACKEND_URL}/api/ingest`, {
      data: { filename, text: 'Contenido secuestrado.', type: 'note', tags: [] },
      headers: { Cookie: intruderCookies },
    });
    expect(overwrite.status()).toBe(403);
  });
});
