import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const names = `C_ID Customer_Name Address Phone Meter_ID Connection_Type R_ID R_Date Previous_Reading Current_Reading Units_Consumed SLAB_ID Min_Units Max_Units Rate_Per_Unit Fixed_Charge Tax_Percent B_ID Bill_Month Total_Amt Status Paid_At Payment_Method Transaction_ID`.split(' ');
const keys = new Map(names.map(name => [name.toLowerCase(), name]));
const normalize = row => row && Object.fromEntries(Object.entries(row).map(([key, value]) => [keys.get(key) || key, value]));

export function postgresAdapter(pool) {
  function prepare(sql) {
    let index = 0;
    const query = sql.replace(/('(?:''|[^'])*')|\?/g, (match, literal) => literal || `$${++index}`);
    return {
      async all(...values) { return (await pool.query(query, values)).rows.map(normalize); },
      async get(...values) { return normalize((await pool.query(query, values)).rows[0]); },
      async run(...values) { const result = await pool.query(query, values); return { changes: result.rowCount }; },
    };
  }
  return {
    prepare,
    async batch(statements) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = postgresAdapter(client);
        for (const [sql, values] of statements) await tx.prepare(sql).run(...values);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

export async function openPostgres(root, connectionString) {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 15000 });
  pool.on('error', () => console.error('The database connection was interrupted.'));
  try {
    await pool.query(readFileSync(resolve(root, 'data/postgres.sql'), 'utf8'));
    return { db: postgresAdapter(pool), file: 'PostgreSQL (DATABASE_URL)' };
  } catch (error) { await pool.end(); throw error; }
}
