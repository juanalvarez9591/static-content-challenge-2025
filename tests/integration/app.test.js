import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpStatus } from '../../src/shared/http/status.js';
import { makeTestApp } from './helpers.js';

let t;
beforeEach(async () => {
  t = await makeTestApp();
  await t.write('about/index.md', '# Hello\n\nSome **bold** text.');
});
afterEach(() => t.cleanup());

describe('GET pages (integration)', () => {
  it('returns 200 for a valid URL', async () => {
    const res = await request(t.app).get('/about');
    expect(res.status).toBe(HttpStatus.OK);
  });
  it('returns HTML generated from index.md inside the template', async () => {
    const res = await request(t.app).get('/about');
    expect(res.text).toContain('<h1>Hello</h1>');
    expect(res.text).toContain('<strong>bold</strong>');
    expect(res.text).toMatch(/^<html><body>/);
  });
  it('embeds initial data for the client app and still works without JavaScript', async () => {
    const res = await request(t.app).get('/about');
    expect(res.text).toContain('<div id="root"><main class="page">');
    expect(res.text).toContain('href="/admin/login"');
    const json = /<script type="application\/json" id="initial-data">(.*?)<\/script>/s.exec(res.text)[1];
    expect(JSON.parse(json)).toMatchObject({ path: '/about', status: 200 });
  });
  it('serves page content as JSON for client-side navigation', async () => {
    const ok = await request(t.app).get('/api/content?path=/about');
    expect(ok.status).toBe(HttpStatus.OK);
    expect(ok.body.html).toContain('<h1>Hello</h1>');
    expect((await request(t.app).get('/api/content?path=/nope')).status).toBe(HttpStatus.NOT_FOUND);
    expect((await request(t.app).get('/api/content?path=/../etc')).status).toBe(HttpStatus.NOT_FOUND);
  });
  it('serves a sitemap listing every page, and it updates when folders are added', async () => {
    await t.write('blog/june/post/index.md', '# P');
    const res = await request(t.app).get('/sitemap');
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.text).toContain('<a href="/about">about</a>');
    expect(res.text).toContain('<a href="/blog/june/post">post</a>');
    await t.write('later/index.md', '# L');
    expect((await request(t.app).get('/api/content?path=/sitemap')).body.html).toContain('href="/later"');
    expect(res.text).toContain('href="/sitemap"');
  });
  it('returns 404 for unknown URLs', async () => {
    expect((await request(t.app).get('/nope')).status).toBe(HttpStatus.NOT_FOUND);
  });
  it('serves folders added at runtime, nested', async () => {
    await t.write('blog/june/post/index.md', '# New post');
    const res = await request(t.app).get('/blog/june/post');
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.text).toContain('New post');
  });
  it('serves the root page only if the content root has an index.md', async () => {
    expect((await request(t.app).get('/')).status).toBe(HttpStatus.NOT_FOUND);
    await t.write('index.md', '# Home');
    const res = await request(t.app).get('/');
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.text).toContain('Home');
  });
  it.each(['/..%2f..%2fetc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/about%00'])(
    'rejects traversal %s with 404', async (p) => {
      expect((await request(t.app).get(p)).status).toBe(HttpStatus.NOT_FOUND);
    });
  it('rejects malformed percent-encoding with 400 (handled by Express)', async () => {
    expect((await request(t.app).get('/%E0%A4%A')).status).toBe(HttpStatus.BAD_REQUEST);
  });
  it('rejects a symlink pointing outside content', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-'));
    await fs.writeFile(path.join(outside, 'index.md'), '# secret');
    await fs.symlink(outside, path.join(t.contentDir, 'leak'));
    const res = await request(t.app).get('/leak');
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.text).not.toContain('secret');
    await fs.rm(outside, { recursive: true, force: true });
  });
});

describe('errors and observability (integration)', () => {
  it('answers /healthz', async () => {
    const res = await request(t.app).get('/healthz');
    expect(res.status).toBe(HttpStatus.OK);
  });
  it('returns a generic 500 when the template is missing, and logs the error', async () => {
    const broken = await makeTestApp({ template: null });
    await broken.write('about/index.md', '# Hi');
    const res = await request(broken.app).get('/about');
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.text).not.toContain(broken.dir);
    const event = broken.logs.find((l) => l.url === '/about');
    expect(event).toMatchObject({ level: 50, msg: 'request_failed', err: { type: 'TemplateMissingError', code: 'TEMPLATE_MISSING' } });
    await broken.cleanup();
  });
  it('returns a generic 500 when the template has no {{content}} placeholder', async () => {
    const broken = await makeTestApp({ template: '<html></html>' });
    await broken.write('about/index.md', '# Hi');
    const res = await request(broken.app).get('/about');
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(broken.logs.find((l) => l.url === '/about').err).toMatchObject({ code: 'TEMPLATE_INVALID' });
    await broken.cleanup();
  });
  it('sets the page title from the first heading (initial data and API)', async () => {
    const res = await request(t.app).get('/about');
    expect(JSON.parse(/id="initial-data">(.*?)<\/script>/s.exec(res.text)[1]).title).toBe('Hello');
    expect((await request(t.app).get('/api/content?path=/about')).body.title).toBe('Hello');
  });
  it('returns 500 for an unreadable index.md without leaking details', async () => {
    const file = path.join(t.contentDir, 'about', 'index.md');
    await fs.chmod(file, 0o000);
    const res = await request(t.app).get('/about');
    await fs.chmod(file, 0o644);
    if (process.getuid?.() === 0) return;
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.text).not.toContain('EACCES');
  });
  it('emits one wide event per request with an X-Request-Id', async () => {
    const res = await request(t.app).get('/about');
    const events = t.logs.filter((l) => l.url === '/about');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      msg: 'request_completed', outcome: 'PAGE_FOUND', status: 200, content_folder: 'about', method: 'GET',
      request_id: res.headers['x-request-id'],
    });
    expect(events[0].duration_ms).toBeGreaterThan(0);
  });
  it('logs path traversal as a warning with the rejection reason', async () => {
    await request(t.app).get('/..%2f..%2fetc/passwd');
    const event = t.logs.find((l) => l.outcome === 'INVALID_PATH');
    expect(event).toMatchObject({ level: 40, rejected_by: 'path_escapes_content_root', status: 404 });
  });
  it('sends security headers including a strict CSP', async () => {
    const res = await request(t.app).get('/about');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  it('serves the PWA manifest and service worker', async () => {
    expect((await request(t.app).get('/manifest.json')).body.display).toBe('standalone');
    expect((await request(t.app).get('/sw.js')).status).toBe(HttpStatus.OK);
  });
});
