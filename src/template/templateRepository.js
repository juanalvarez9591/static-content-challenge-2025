import fs from 'node:fs/promises';
import { TemplateMissingError } from '../shared/errors.js';
import { parseTemplate } from './template.js';

export function makeTemplateRepository(templatePath) {
  return {
    async get() {
      let source;
      try {
        source = await fs.readFile(templatePath, 'utf8');
      } catch (cause) {
        throw new TemplateMissingError(`cannot read template ${templatePath}`, { cause });
      }
      return parseTemplate(source);
    },
  };
}
