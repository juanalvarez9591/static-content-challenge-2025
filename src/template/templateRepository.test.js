import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TemplateInvalidError, TemplateMissingError } from '../shared/errors.js';
import { makeTemplateRepository } from './templateRepository.js';

describe('templateRepository', () => {
  it('reads and parses the template, and fails with typed errors otherwise', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tpl-'));
    const file = path.join(dir, 't.html');
    await fs.writeFile(file, '<p>{{content}}</p>');
    expect((await makeTemplateRepository(file).get()).source).toBe('<p>{{content}}</p>');
    await fs.writeFile(file, '<p>no placeholder</p>');
    await expect(makeTemplateRepository(file).get()).rejects.toBeInstanceOf(TemplateInvalidError);
    await expect(makeTemplateRepository(path.join(dir, 'missing.html')).get()).rejects.toBeInstanceOf(TemplateMissingError);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
