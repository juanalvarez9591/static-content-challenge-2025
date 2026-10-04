import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
}
it('src has no bare numeric status codes', () => {
  const offenders = files('src').filter((f) =>
    f !== path.join('src', 'shared', 'http', 'status.js')
    && /status(Code)?\(\s*[1-5]\d\d\b|statusCode\s*=\s*[1-5]\d\d\b|redirect\(\s*[1-5]\d\d\b/.test(fs.readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});
