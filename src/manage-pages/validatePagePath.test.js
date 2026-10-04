import { describe, expect, it } from 'vitest';
import { validatePagePath } from './validatePagePath.js';

describe('validatePagePath', () => {
  it('accepts and normalizes valid paths', () => {
    expect(validatePagePath('blog/july/news')).toEqual({ ok: true, folderPath: 'blog/july/news' });
    expect(validatePagePath('/about_us/')).toEqual({ ok: true, folderPath: 'about_us' });
  });
  it.each([
    ['', 'empty'], ['  ', 'empty'], ['../x', 'invalid_segment'], ['a/../b', 'invalid_segment'], ['a//b', 'invalid_segment'],
    ['a\\b', 'invalid_segment'], ['a\0b', 'invalid_segment'], ['A', 'invalid_segment'], ['a b', 'invalid_segment'],
    ['.hidden', 'invalid_segment'], ['a/./b', 'invalid_segment'], ['%2e%2e', 'invalid_segment'], ['a/b.md', 'invalid_segment'],
    ['-x', 'invalid_segment'], [undefined, 'not_a_string'], [Array(20).fill('a').join('/'), 'too_deep'],
    ['a'.repeat(201), 'too_long'],
  ])('rejects %j (%s)', (p, reason) => {
    expect(validatePagePath(p)).toEqual({ ok: false, reason });
  });
});
