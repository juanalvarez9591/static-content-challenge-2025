import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      username TEXT PRIMARY KEY,
      failed INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}

export function makeUserRepository(db) {
  return {
    findByUsername: (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username),
    create: (username, passwordHash) =>
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash)
        .lastInsertRowid,
    updatePassword: (username, passwordHash) =>
      db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, username).changes > 0,
  };
}

export function makeSessionRepository(db) {
  return {
    create: ({ idHash, userId, csrfToken, expiresAt }) =>
      db.prepare('INSERT INTO sessions (id_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(idHash, userId, csrfToken, expiresAt),
    findValid: (idHash, now) =>
      db.prepare('SELECT * FROM sessions WHERE id_hash = ? AND expires_at > ?').get(idHash, now),
    delete: (idHash) => db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash),
    deleteExpired: (now) => db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now),
  };
}

export function makeLoginAttemptRepository(db) {
  return {
    lockedUntil: (username) =>
      db.prepare('SELECT locked_until FROM login_attempts WHERE username = ?').get(username)?.locked_until ?? 0,
    recordFailure: (username, { now, maxAttempts, lockMs }) => {
      db.prepare(`INSERT INTO login_attempts (username, failed) VALUES (?, 1)
                  ON CONFLICT(username) DO UPDATE SET failed = failed + 1`).run(username);
      db.prepare('UPDATE login_attempts SET locked_until = ?, failed = 0 WHERE username = ? AND failed >= ?')
        .run(now + lockMs, username, maxAttempts);
    },
    clear: (username) => db.prepare('DELETE FROM login_attempts WHERE username = ?').run(username),
  };
}
