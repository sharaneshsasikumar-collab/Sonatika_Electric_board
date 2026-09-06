import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { openPostgres } from './postgres.mjs';

export async function openDatabase(root, env = process.env) {
  if (env.DATABASE_URL) return openPostgres(root, env.DATABASE_URL);
  const production = env.NODE_ENV === 'production' || env.RENDER === 'true';
  const configured = env.SONATIKA_DB;
  if (production && (!configured || !isAbsolute(configured))) {
    throw new Error('Set DATABASE_URL to your hosted PostgreSQL connection string. Production cannot store bills on Render ephemeral storage. Alternatively set SONATIKA_DB on a persistent disk.');
  }
  const file = resolve(root, configured || 'data/sonatika.db');
  const location = relative(root, file);
  if (production && !location.startsWith(`..${sep}`) && !isAbsolute(location)) {
    throw new Error('Production SONATIKA_DB must be outside the application directory, on persistent storage.');
  }
  if (production && !existsSync(file)) {
    throw new Error('The production database is missing. Restore or initialize it with scripts/setup-database.py; refusing to replace missing records with sample data.');
  }
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    db.exec('BEGIN IMMEDIATE');
    const initialized = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Consumers'").get();
    if (production && !initialized) throw new Error('The production database has no consumer schema. Initialize or restore it first.');
    db.exec(readFileSync(resolve(root, 'data/schema.sql'), 'utf8'));
    if (!initialized && !production) db.exec(readFileSync(resolve(root, 'data/seed.sql'), 'utf8'));
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
