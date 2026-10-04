import { describe, expect, it } from 'vitest';
import { PageAction, WriteOutcome, derivePageWriteOutcome, deriveRepositoryResult } from './derivePageWriteOutcome.js';

const existingFolders = ['about', 'blog/june'];
const derive = (action, path) => derivePageWriteOutcome({ action, path, existingFolders });

describe('derivePageWriteOutcome', () => {
  it('create: allowed for a new valid path', () => {
    expect(derive('create', 'blog/july')).toEqual({ type: WriteOutcome.ALLOWED, action: 'create', folderPath: 'blog/july' });
  });
  it('create: ALREADY_EXISTS when the folder exists', () => {
    expect(derive('create', '/about/').type).toBe(WriteOutcome.ALREADY_EXISTS);
  });
  it('create: INVALID_PATH with the reason for a bad path', () => {
    expect(derive('create', '../evil')).toEqual({ type: WriteOutcome.INVALID_PATH, reason: 'invalid_segment' });
  });
  it.each([PageAction.READ, PageAction.UPDATE, PageAction.DELETE])('%s: allowed when the page exists', (action) => {
    expect(derive(action, 'about')).toEqual({ type: WriteOutcome.ALLOWED, action, folderPath: 'about' });
  });
  it.each([PageAction.READ, PageAction.UPDATE, PageAction.DELETE])('%s: NOT_FOUND when missing or invalid', (action) => {
    expect(derive(action, 'missing').type).toBe(WriteOutcome.NOT_FOUND);
    expect(derive(action, '../etc').type).toBe(WriteOutcome.NOT_FOUND);
  });
});

describe('deriveRepositoryResult', () => {
  const allowed = (action) => ({ type: WriteOutcome.ALLOWED, action, folderPath: 'x' });
  it('keeps the outcome when the repository accepted', () => {
    expect(deriveRepositoryResult(allowed('create'), true).type).toBe(WriteOutcome.ALLOWED);
  });
  it('a refusing repository means INVALID_PATH on create and NOT_FOUND otherwise', () => {
    expect(deriveRepositoryResult(allowed('create'), false).type).toBe(WriteOutcome.INVALID_PATH);
    expect(deriveRepositoryResult(allowed('update'), false).type).toBe(WriteOutcome.NOT_FOUND);
  });
});
