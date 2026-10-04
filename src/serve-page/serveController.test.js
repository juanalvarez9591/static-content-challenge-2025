import { describe, expect, it } from 'vitest';
import { HttpStatus } from '../shared/http/status.js';
import { renderPage } from './renderPage.js';
import { renderShell } from './renderShell.js';
import { makeLoadPage, makeServeContentApi, makeServePage } from './serveController.js';

const fakeRepo = (pages) => ({
  listFolders: async () => Object.keys(pages),
  getPageByPath: async (f) => (f in pages ? { folderPath: f, markdown: pages[f], title: pages[f] } : undefined),
});
const fakeRes = () => ({
  locals: { event: {} },
  status(code) { this.code = code; return this; },
  type() { return this; },
  send(body) { this.body = body; return this; },
  json(body) { this.body = body; return this; },
});
const loadPageFor = (repo) => makeLoadPage({ repo, renderMarkdown: (m) => `<p>${m}</p>` });
const templates = { get: async () => ({ source: '<b>{{content}}</b>' }) };
async function html(repo, path) {
  const res = fakeRes();
  await makeServePage({ loadPage: loadPageFor(repo), templates, renderPage, renderShell })({ path }, res);
  return res;
}
async function api(repo, path) {
  const res = fakeRes();
  await makeServeContentApi({ loadPage: loadPageFor(repo) })({ query: { path } }, res);
  return res;
}

describe('serve page (HTML)', () => {
  it('PAGE_FOUND -> 200, rendered page and initial data for the client', async () => {
    const res = await html(fakeRepo({ about: 'hi' }), '/about');
    expect(res.code).toBe(HttpStatus.OK);
    expect(res.body).toContain('<article><p>hi</p></article>');
    expect(res.body).toContain('id="initial-data"');
    expect(res.locals.event).toMatchObject({ outcome: 'PAGE_FOUND', content_folder: 'about' });
  });
  it('SITEMAP -> 200 listing the pages', async () => {
    const res = await html(fakeRepo({ about: 'hi' }), '/sitemap');
    expect(res.code).toBe(HttpStatus.OK);
    expect(res.body).toContain('<a href="/about">about</a>');
    expect(res.locals.event.outcome).toBe('SITEMAP');
  });
  it('NOT_FOUND -> 404', async () => {
    const res = await html(fakeRepo({}), '/nope');
    expect(res.code).toBe(HttpStatus.NOT_FOUND);
    expect(res.locals.event.outcome).toBe('NOT_FOUND');
  });
  it('INVALID_PATH -> 404 and records why', async () => {
    const res = await html(fakeRepo({}), '/a/%2e%2e/b');
    expect(res.code).toBe(HttpStatus.NOT_FOUND);
    expect(res.locals.event).toMatchObject({ outcome: 'INVALID_PATH', rejected_by: 'path_escapes_content_root' });
  });
  it('a folder that disappears between list and read -> 404', async () => {
    const repo = { listFolders: async () => ['gone'], getPageByPath: async () => undefined };
    const res = await html(repo, '/gone');
    expect(res.code).toBe(HttpStatus.NOT_FOUND);
    expect(res.locals.event).toMatchObject({ outcome: 'NOT_FOUND', rejected_by: 'page_unreadable' });
  });
  it('a throwing repository -> generic 500 and err on the event', async () => {
    const repo = { listFolders: async () => { throw Object.assign(new Error('EACCES: secret/path'), { code: 'EACCES' }); } };
    const res = await html(repo, '/x');
    expect(res.code).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body).not.toContain('secret');
    expect(res.locals.event.err).toMatchObject({ code: 'EACCES' });
  });
});

describe('serve content (JSON API)', () => {
  it('returns the page HTML and title with the right status', async () => {
    const found = await api(fakeRepo({ about: '# Hi' }), '/about');
    expect(found.code).toBe(HttpStatus.OK);
    expect(found.body).toEqual({ html: '<p># Hi</p>', title: '# Hi' });
    expect((await api(fakeRepo({}), '/nope')).code).toBe(HttpStatus.NOT_FOUND);
    expect((await api(fakeRepo({}), '/../x')).code).toBe(HttpStatus.NOT_FOUND);
  });
  it('a throwing repository -> generic JSON 500', async () => {
    const repo = { listFolders: async () => { throw new Error('boom'); } };
    const res = await api(repo, '/x');
    expect(res.code).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body).toEqual({ error: 'internal_error' });
  });
});
