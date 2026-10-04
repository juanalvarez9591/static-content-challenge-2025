import { describe, expect, it } from 'vitest';
import { HttpStatus } from '../shared/http/status.js';
import { makeManagePagesController } from './managePagesController.js';

function fakeRepo(initial = {}, { refuse = false } = {}) {
  const pages = { ...initial };
  return {
    pages,
    listFolders: async () => Object.keys(pages),
    getPageByPath: async (f) => (f in pages ? { folderPath: f, markdown: pages[f] } : undefined),
    createPage: async (p) => { if (refuse) return false; pages[p.folderPath] = p.markdown; return true; },
    updatePage: async (p) => { if (refuse) return false; pages[p.folderPath] = p.markdown; return true; },
    deletePage: async (f) => { if (refuse) return false; delete pages[f]; return true; },
  };
}
const fakeRes = () => ({
  locals: { event: {} },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
});
async function call(repo, method, req) {
  const res = fakeRes();
  await makeManagePagesController({ repo })[method]({ query: {}, body: {}, ...req }, res);
  return res;
}

describe('managePagesController', () => {
  it('create: 201 and stores the page', async () => {
    const repo = fakeRepo();
    const res = await call(repo, 'create', { body: { path: 'blog/new', markdown: '# New' } });
    expect(res.code).toBe(HttpStatus.CREATED);
    expect(repo.pages['blog/new']).toBe('# New');
    expect(res.locals.event).toMatchObject({ admin_action: 'page_created', content_folder: 'blog/new' });
  });
  it('create: 409 when it exists, 400 when the path is invalid, nothing is written', async () => {
    const repo = fakeRepo({ a: 'x' });
    expect((await call(repo, 'create', { body: { path: 'a', markdown: 'y' } })).code).toBe(HttpStatus.CONFLICT);
    const bad = await call(repo, 'create', { body: { path: '../evil', markdown: 'y' } });
    expect(bad.code).toBe(HttpStatus.BAD_REQUEST);
    expect(bad.body).toEqual({ error: 'invalid_path' });
    expect(Object.keys(repo.pages)).toEqual(['a']);
  });
  it('update and delete: 200/204 when present, 404 when missing', async () => {
    const repo = fakeRepo({ a: 'x' });
    expect((await call(repo, 'update', { body: { path: 'a', markdown: 'z' } })).code).toBe(HttpStatus.OK);
    expect(repo.pages.a).toBe('z');
    expect((await call(repo, 'update', { body: { path: 'nope', markdown: 'z' } })).code).toBe(HttpStatus.NOT_FOUND);
    expect((await call(repo, 'remove', { query: { path: 'a' } })).code).toBe(HttpStatus.NO_CONTENT);
    expect((await call(repo, 'remove', { query: { path: 'a' } })).code).toBe(HttpStatus.NOT_FOUND);
  });
  it('read: returns the markdown, 404 otherwise', async () => {
    const repo = fakeRepo({ a: '# A' });
    expect((await call(repo, 'read', { query: { path: 'a' } })).body).toEqual({ path: 'a', markdown: '# A' });
    expect((await call(repo, 'read', { query: { path: 'b' } })).code).toBe(HttpStatus.NOT_FOUND);
  });
  it('a repository that refuses (its own path check) is mapped by the deriver, not the controller', async () => {
    const repo = fakeRepo({ a: 'x' }, { refuse: true });
    const created = await call(repo, 'create', { body: { path: 'new', markdown: 'y' } });
    expect(created.code).toBe(HttpStatus.BAD_REQUEST);
    expect(created.locals.event.rejected_by).toBe('repository_refused');
    expect((await call(repo, 'update', { body: { path: 'a', markdown: 'y' } })).code).toBe(HttpStatus.NOT_FOUND);
  });
  it('list: sorted pages without the home page', async () => {
    const res = await call(fakeRepo({ '': 'home', b: '', a: '' }), 'list', {});
    expect(res.body).toEqual({ pages: ['a', 'b'] });
  });
});
