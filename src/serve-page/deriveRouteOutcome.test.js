import { describe, expect, it } from 'vitest';
import { deriveResponseOutcome, deriveRouteOutcome } from './deriveRouteOutcome.js';

const folders = ['about-page', 'blog/june/company-update'];

describe('deriveRouteOutcome', () => {
  it('finds known folders, with or without trailing slash', () => {
    expect(deriveRouteOutcome('/about-page', folders)).toEqual({ type: 'PAGE_FOUND', folderPath: 'about-page' });
    expect(deriveRouteOutcome('/blog/june/company-update/', folders).type).toBe('PAGE_FOUND');
  });
  it('returns NOT_FOUND for unknown paths and for the root without an index.md', () => {
    expect(deriveRouteOutcome('/nope', folders).type).toBe('NOT_FOUND');
    expect(deriveRouteOutcome('/', folders).type).toBe('NOT_FOUND');
    expect(deriveRouteOutcome('/blog', folders).type).toBe('NOT_FOUND');
  });
  it('serves the root only when the content root has an index.md', () => {
    expect(deriveRouteOutcome('/', ['', ...folders])).toEqual({ type: 'PAGE_FOUND', folderPath: '' });
  });
  it('/sitemap is its own outcome and wins over a folder with that name', () => {
    expect(deriveRouteOutcome('/sitemap', folders)).toEqual({ type: 'SITEMAP' });
    expect(deriveRouteOutcome('/sitemap/', folders)).toEqual({ type: 'SITEMAP' });
    expect(deriveRouteOutcome('/sitemap', [...folders, 'sitemap']).type).toBe('SITEMAP');
  });
  it.each([
    ['/../../etc/passwd', 'path_escapes_content_root'],
    ['/a/../b', 'path_escapes_content_root'],
    ['/./about-page', 'path_escapes_content_root'],
    ['/a\0b', 'null_byte'],
    ['/a\\b', 'backslash'],
    ['//about-page', 'empty_segment'],
    ['/about-page//x', 'empty_segment'],
    ['about-page', 'not_absolute'],
  ])('rejects %j because of %s', (p, reason) => {
    expect(deriveRouteOutcome(p, folders)).toEqual({ type: 'INVALID_PATH', reason });
  });
});

describe('deriveResponseOutcome', () => {
  it('keeps the route outcome when the page was read', () => {
    const found = { type: 'PAGE_FOUND', folderPath: 'a' };
    expect(deriveResponseOutcome(found, { folderPath: 'a', markdown: '' })).toBe(found);
  });
  it('turns an unreadable page into NOT_FOUND', () => {
    expect(deriveResponseOutcome({ type: 'PAGE_FOUND', folderPath: 'a' }, undefined).type).toBe('NOT_FOUND');
  });
  it('leaves other outcomes alone', () => {
    const sitemap = { type: 'SITEMAP' };
    expect(deriveResponseOutcome(sitemap, undefined)).toBe(sitemap);
  });
});
