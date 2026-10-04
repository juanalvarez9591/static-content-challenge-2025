import { makeUserRepository, openDb } from '../src/auth/db.js';
import { passwordHasher } from '../src/auth/security.js';

const MIN_PASSWORD_LENGTH = 12;
const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = process.env;
if (!username || !password) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD.');
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}
const users = makeUserRepository(openDb(process.env.DB_PATH ?? 'data/app.sqlite'));
const hash = await passwordHasher.hash(password);
if (users.findByUsername(username)) {
  users.updatePassword(username, hash);
  console.log(`Password updated for ${username}`);
} else {
  users.create(username, hash);
  console.log(`Admin ${username} created`);
}
