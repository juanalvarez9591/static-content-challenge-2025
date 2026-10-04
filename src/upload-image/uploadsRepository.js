import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function makeUploadsRepository(uploadsDir) {
  const dir = path.resolve(uploadsDir);
  return {
    dir,
    async save(buffer, ext) {
      const name = `${createHash('sha256').update(buffer).digest('hex').slice(0, 32)}.${ext}`;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), buffer, { flag: 'w' });
      return name;
    },
  };
}
