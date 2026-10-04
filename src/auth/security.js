import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

const TOKEN_BYTES = 32;

export const newToken = () => randomBytes(TOKEN_BYTES).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const passwordHasher = {
  hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
  verify: async (hash, password) => {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  },
};
