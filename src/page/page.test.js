import { describe, expect, it } from 'vitest';
import { PageSchema, extractTitle, parsePage } from './page.js';

describe('Page entity', () => {
  it('derives the title from the first level-1 heading', () => {
    expect(extractTitle('intro\n\n# Hello world\n\n# Other')).toBe('Hello world');
    expect(extractTitle('## not a title')).toBeUndefined();
    expect(extractTitle('no heading')).toBeUndefined();
  });
  it('parses a page', () => {
    expect(parsePage({ folderPath: 'a', markdown: '# T' })).toEqual({ folderPath: 'a', markdown: '# T', title: 'T' });
  });
  it('rejects malformed data at the boundary', () => {
    expect(() => parsePage({ folderPath: 1, markdown: '' })).toThrow();
    expect(PageSchema.safeParse({ folderPath: 'a' }).success).toBe(false);
  });
});
