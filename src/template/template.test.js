import { describe, expect, it } from 'vitest';
import { TemplateInvalidError } from '../shared/errors.js';
import { parseTemplate } from './template.js';

describe('Template entity', () => {
  it('accepts a template with the placeholder', () => {
    expect(parseTemplate('<body>{{content}}</body>').source).toContain('{{content}}');
  });
  it('rejects a template without it', () => {
    expect(() => parseTemplate('<body></body>')).toThrow(TemplateInvalidError);
  });
});
