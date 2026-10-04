import { describe, expect, it } from 'vitest';
import { renderSitemapHtml } from './renderSitemap.js';

describe('renderSitemapHtml', () => {
  it('renders a nested tree; folders without an index.md are labels, not links', () => {
    const html = renderSitemapHtml(['', 'about-page', 'blog/june/company-update']);
    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<a href="/about-page">about-page</a>');
    expect(html).toContain('<span>blog</span>');
    expect(html).toContain('<li><span>june</span><ul><li><a href="/blog/june/company-update">company-update</a>');
  });
  it('links a parent that has its own page and keeps its children nested', () => {
    expect(renderSitemapHtml(['blog', 'blog/june'])).toContain('<a href="/blog">blog</a><ul><li><a href="/blog/june">');
  });
  it('escapes folder names', () => {
    const html = renderSitemapHtml(['a<b>"x']);
    expect(html).not.toContain('<b>');
    expect(html).toContain('a&lt;b&gt;&quot;x');
  });
  it('handles an empty site', () => expect(renderSitemapHtml([])).toContain('No pages yet'));
});
