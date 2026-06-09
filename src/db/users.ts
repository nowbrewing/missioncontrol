import type { Client } from "@libsql/client";

const USERS_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`,
];

async function migrateUsersPreferences(turso: Client) {
  const info = await turso.execute({ sql: "PRAGMA table_info('users');" });
  if (info.rows.length === 0) return;

  const cols = new Set(
    ((info.rows as Record<string, unknown>[]) ?? []).map((r) => String(r.name))
  );
  if (cols.has("preferences")) return;

  await turso.execute(`ALTER TABLE users ADD COLUMN preferences TEXT;`);
}

export async function ensureUsersSchema(turso: Client) {
  for (const sql of USERS_SCHEMA_STATEMENTS) {
    await turso.execute(sql);
  }
  await migrateUsersPreferences(turso);
}

export type UserRow = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};
