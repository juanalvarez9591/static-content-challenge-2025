import fs from 'node:fs/promises';
import path from 'node:path';
import { ContentReadError } from '../shared/errors.js';
import { parsePage } from './page.js';

export function makePageRepository(contentDir) {
  const root = path.resolve(contentDir);

  async function listFolders() {
    const nested = await listNested(root, '');
    return (await exists(path.join(root, 'index.md'))) ? ['', ...nested] : nested;
  }

  async function listNested(dir, prefix) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (cause) {
      throw new ContentReadError(`cannot list ${dir}`, { cause });
    }
    const folders = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (await exists(path.join(abs, 'index.md'))) folders.push(rel);
      folders.push(...(await listNested(abs, rel)));
    }
    return folders;
  }

  async function indexPathInsideRoot(folderPath, { mustExist }) {
    const file = path.resolve(root, folderPath, 'index.md');
    if (!file.startsWith(root + path.sep)) return undefined;
    const realRoot = await fs.realpath(root);
    let probe = mustExist ? file : path.dirname(file);
    for (;;) {
      try {
        const real = await fs.realpath(probe);
        return real === realRoot || real.startsWith(realRoot + path.sep) ? file : undefined;
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        if (mustExist) return undefined;
        probe = path.dirname(probe);
      }
    }
  }

  async function getPageByPath(folderPath) {
    try {
      const file = await indexPathInsideRoot(folderPath, { mustExist: true });
      if (file === undefined) return undefined;
      return parsePage({ folderPath, markdown: await fs.readFile(file, 'utf8') });
    } catch (cause) {
      throw new ContentReadError(`cannot read page ${folderPath}`, { cause });
    }
  }

  async function writePage(page) {
    const file = await indexPathInsideRoot(page.folderPath, { mustExist: false });
    if (file === undefined) return false;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, page.markdown, 'utf8');
    return true;
  }

  async function deletePage(folderPath) {
    const file = await indexPathInsideRoot(folderPath, { mustExist: true });
    if (file === undefined) return false;
    await fs.rm(file);
    for (let dir = path.dirname(file); dir !== root; dir = path.dirname(dir)) {
      if ((await fs.readdir(dir)).length > 0) break;
      await fs.rmdir(dir);
    }
    return true;
  }

  return { listFolders, getPageByPath, createPage: writePage, updatePage: writePage, deletePage };
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
