import { expect, test } from '@playwright/test';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function signIn(page) {
  await page.goto('/hello');
  await page.click('nav >> text=Admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.fill('input[name=username]', 'e2e-admin');
  await page.fill('input[name=password]', 'e2e-password-123');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('h1')).toHaveText('Pages');
}

test('renders a content page mobile-first with no horizontal scroll', async ({ page }) => {
  await page.goto('/hello');
  await expect(page.locator('h1')).toHaveText('Hello from the fixture');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('system-ui');
});

test('navigates between pages on the client without a full reload', async ({ page }) => {
  await page.goto('/hello');
  await page.evaluate(() => { window.__marker = 'same-document'; });
  await page.click('nav >> text=Acme');
  await expect(page.locator('h1')).toHaveText('Fixture home');
  expect(await page.evaluate(() => window.__marker)).toBe('same-document');
  await page.click('article >> text=hello page');
  await expect(page.locator('h1')).toHaveText('Hello from the fixture');
  expect(await page.evaluate(() => window.__marker)).toBe('same-document');
});

test('the sitemap lists the page tree and links navigate', async ({ page }) => {
  await page.goto('/hello');
  await page.click('nav >> text=Sitemap');
  await expect(page).toHaveURL(/\/sitemap$/);
  await expect(page.locator('h1')).toHaveText('Sitemap');
  await page.click('article >> a[href="/hello"]');
  await expect(page.locator('h1')).toHaveText('Hello from the fixture');
});

test('exposes an installable manifest', async ({ page, request }) => {
  await page.goto('/hello');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(href)).json();
  expect(manifest).toMatchObject({ display: 'standalone', name: 'Acme Co' });
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test('a visited page still works offline through the service worker', async ({ page, context }) => {
  await page.goto('/hello');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Hello from the fixture');
});

test('unknown pages show 404', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page not found');
});

test('the admin link leads to login, and protected pages redirect there', async ({ page }) => {
  await page.goto('/admin/pages/new');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.fill('input[name=username]', 'e2e-admin');
  await page.fill('input[name=password]', 'wrong-password');
  await page.click('button[type=submit]');
  await expect(page.locator('[role=alert]')).toHaveText('Invalid username or password.');
});

test('admin signs in from the public site, creates a page with a pasted image, and signs out', async ({ page }) => {
  await signIn(page);

  await page.click('text=New page');
  await page.fill('input[name=path]', 'made-by-e2e');
  await page.fill('textarea[name=markdown]', '# Created in the browser\n\n');
  await page.locator('textarea[name=markdown]').click();
  await page.keyboard.press('End');

  await page.locator('textarea[name=markdown]').evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, PNG_BASE64);

  await expect(page.locator('textarea[name=markdown]')).toHaveValue(/!\[image\]\(\/uploads\/[0-9a-f]{32}\.png\)/);
  await expect(page.locator('.preview img')).toHaveCount(1);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/made-by-e2e');
  await expect(page.locator('h1')).toHaveText('Created in the browser');
  const img = page.locator('article img');
  await expect(img).toHaveCount(1);
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

  await page.goto('/admin');
  await page.click('text=Sign out');
  await expect(page).toHaveURL(/\/admin\/login/);
});
