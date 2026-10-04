import { z } from 'zod';

export const PageSchema = z.object({
  folderPath: z.string(),
  markdown: z.string(),
  title: z.string().optional(),
});

export function extractTitle(markdown) {
  return /^#[ \t]+(.+?)[ \t#]*$/m.exec(markdown)?.[1];
}

export const parsePage = ({ folderPath, markdown }) =>
  PageSchema.parse({ folderPath, markdown, title: extractTitle(markdown) });
