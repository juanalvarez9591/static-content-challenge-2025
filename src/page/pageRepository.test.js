import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentReadError } from '../shared/errors.js';
import { makePageRepository } from './pageRepository.js';

let dir, repo;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-'));
  repo = makePageRepository(path.join(dir, 'content'));
  await fs.mkdir(path.join(dir, 'content'));
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));
const write = async (rel, text) => {
  await fs.mkdir(path.dirname(path.join(dir, 'content', rel)), { recursive: true });
  await fs.writeFile(path.join(dir, 'content', rel), text);
};

describe('pageRepository', () => {
  it('lists folders that have an index.md, nested, plus the home page', async () => {
    await write('index.md', '# Home');
    await write('a/index.md', '# A');
    await write('b/c/index.md', '# C');
    await write('no-page/readme.txt', 'x');
    expect((await repo.listFolders()).sort()).toEqual(['', 'a', 'b/c']);
  });
  it('returns a parsed Page entity, or undefined', async () => {
    await write('a/index.md', '# Title\n\nbody');
    expect(await repo.getPageByPath('a')).toEqual({ folderPath: 'a', markdown: '# Title\n\nbody', title: 'Title' });
    expect(await repo.getPageByPath('missing')).toBeUndefined();
    expect(await repo.getPageByPath('../../etc')).toBeUndefined();
  });
  it('creates, updates and deletes (pruning empty folders)', async () => {
    expect(await repo.createPage({ folderPath: 'x/y', markdown: '# 1' })).toBe(true);
    expect((await repo.getPageByPath('x/y')).markdown).toBe('# 1');
    expect(await repo.updatePage({ folderPath: 'x/y', markdown: '# 2' })).toBe(true);
    expect((await repo.getPageByPath('x/y')).markdown).toBe('# 2');
    expect(await repo.deletePage('x/y')).toBe(true);
    await expect(fs.access(path.join(dir, 'content', 'x'))).rejects.toThrow();
  });
  it('refuses writes and reads that escape the root, including through symlinks', async () => {
    expect(await repo.createPage({ folderPath: '../evil', markdown: 'x' })).toBe(false);
    const outside = path.join(dir, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'index.md'), '# secret');
    await fs.symlink(outside, path.join(dir, 'content', 'link'));
    expect(await repo.getPageByPath('link')).toBeUndefined();
    expect(await repo.createPage({ folderPath: 'link/page', markdown: 'x' })).toBe(false);
    expect(await fs.readdir(outside)).toEqual(['index.md']);
  });
  it('wraps unexpected I/O failures in ContentReadError', async () => {
    const broken = makePageRepository(path.join(dir, 'does-not-exist'));
    await expect(broken.listFolders()).rejects.toBeInstanceOf(ContentReadError);
  });
});
