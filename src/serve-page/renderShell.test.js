import { describe, expect, it } from 'vitest';
import { escapeJson, renderAdminShell, renderShell } from './renderShell.js';

describe('escapeJson', () => {
  it('cannot close the surrounding script tag', () => {
    expect(escapeJson({ html: '</script><script>alert(1)</script>' })).not.toContain('<');
    expect(JSON.parse(escapeJson({ html: '</script>' }))).toEqual({ html: '</script>' });
  });
});

describe('renderShell', () => {
  it('wraps the page in the nav + article and embeds the initial data', () => {
    const html = renderShell({ html: '<p>x</p>', initial: { path: '/a' } });
    expect(html).toContain('<article><p>x</p></article>');
    expect(html).toContain('href="/sitemap"');
    expect(html).toContain('href="/admin/login"');
    expect(html).toContain('id="initial-data"');
  });
  it('the admin shell is an empty root', () => expect(renderAdminShell()).toBe('<div id="root"></div>'));
});
