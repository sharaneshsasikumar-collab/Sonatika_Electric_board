import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { openPostgres } from './postgres.mjs';

export async function openDatabase(root, env = process.env) {
  if (env.DATABASE_URL) return openPostgres(root, env.DATABASE_URL);
  const production = env.NODE_ENV === 'production' || env.RENDER === 'true';
  const configured = env.SONATIKA_DB;
  const file = resolve(root, configured || 'data/sonatika.db');
  if (production && !configured) {
    console.warn("DATABASE_URL is not configured. Starting with bundled SQLite so the website remains available; Render may reset new records after a restart.");
  }
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    db.exec('BEGIN IMMEDIATE');
    const initialized = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Consumers'").get();
    db.exec(readFileSync(resolve(root, 'data/schema.sql'), 'utf8'));
    if (!initialized) db.exec(readFileSync(resolve(root, 'data/seed.sql'), 'utf8'));
    const columns = new Set(db.prepare('PRAGMA table_info(Bill)').all().map(column => column.name));
    for (const name of ['Paid_At', 'Payment_Method', 'Transaction_ID']) {
      if (!columns.has(name)) db.exec(`ALTER TABLE Bill ADD COLUMN ${name} TEXT`);
    }
    db.exec('COMMIT');
    // Preserve existing legacy rows; enforce consumer references for new writes.
    db.exec('PRAGMA foreign_keys = ON');
    return { db: {
      prepare: sql => db.prepare(sql),
      batch(statements) {
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const [sql, values] of statements) db.prepare(sql).run(...values);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      close: () => db.close(),
    }, file };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
    throw error;
  }
}
