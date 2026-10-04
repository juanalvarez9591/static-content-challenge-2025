import { expect, it } from 'vitest';
import { renderPage } from './renderPage.js';

it('replaces {{content}}', () => {
  expect(renderPage('<body>{{content}}</body>', '<p>hi</p>')).toBe('<body><p>hi</p></body>');
});
it('does not interpret $ patterns in content', () => {
  expect(renderPage('{{content}}', "$& $1")).toBe('$& $1');
});
