import { z } from 'zod';
import { TemplateInvalidError } from '../shared/errors.js';

export const PLACEHOLDER = '{{content}}';

export const TemplateSchema = z.object({ source: z.string().includes(PLACEHOLDER) });

export function parseTemplate(source) {
  const result = TemplateSchema.safeParse({ source });
  if (!result.success) throw new TemplateInvalidError(`template must contain ${PLACEHOLDER}`, { cause: result.error });
  return result.data;
}
