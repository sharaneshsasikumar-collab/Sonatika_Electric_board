import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { importRecords, recordTables } from '../web/import-records.mjs';

const source = process.argv[2];
if (!source || !process.env.DATABASE_URL) {
  console.error('Usage: set DATABASE_URL privately, then node scripts/import-postgres.mjs /path/to/backup.json-or.db');
  process.exit(1);
}
let data;
if (source.endsWith('.json')) data = JSON.parse(readFileSync(source, 'utf8'));
else {
  const sqlite = new DatabaseSync(source, { readOnly: true });
  try { data = Object.fromEntries(recordTables.map(([key, table]) => [key, sqlite.prepare(`SELECT * FROM ${table}`).all()])); }
  finally { sqlite.close(); }
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
  await client.query(readFileSync(new URL('../data/postgres.sql', import.meta.url), 'utf8'));
  await importRecords(client, data);
  console.log('Imported records:', Object.fromEntries(recordTables.map(([key]) => [key, data[key].length])));
} finally { client.release(); await pool.end(); }
