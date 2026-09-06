import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../web/postgres.mjs';
import { insertBill } from '../web/billing.mjs';
import { importRecords } from '../web/import-records.mjs';
const schema = readFileSync(new URL('../data/postgres.sql', import.meta.url), 'utf8');

test('PostgreSQL migration, generated records, paid/unpaid views and restart persistence', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sonatika-postgres-'));
  let pg = new PGlite(directory);
  try {
    await pg.exec(schema);
    await importRecords(pg, {
      consumers: [{ C_ID: '12.0', Customer_Name: 'Persistence Test', Address: 'Test', Phone: '1234567890', Meter_ID: 'TEST12', Connection_Type: 'Residential' }],
      tariffs: [{ SLAB_ID: 1, Connection_Type: 'Residential', Min_Units: 0, Max_Units: 100, Rate_Per_Unit: 2.5, Fixed_Charge: 50, Tax_Percent: 5 }],
      readings: [], bills: [],
    });
    let db = postgresAdapter(pg);
    const created = [];
    for (let i=0; i<5; i++) created.push(await insertBill(db, { consumerId:12, month:'2026-09', previous:i*100, current:(i+1)*100, units:100, rate:2.5, total:315, status:'Unpaid' }));
    assert.equal((await db.prepare('SELECT * FROM Unpaid_Bills').all()).length,5);
    const nextConsumer = await db.prepare('INSERT INTO Consumers (Customer_Name, Address, Phone, Meter_ID, Connection_Type) VALUES (?, ?, ?, ?, ?) RETURNING C_ID').get('Next', 'Test', '1234567890', 'TEST13', 'Residential');
    assert.equal(nextConsumer.C_ID, 13, 'import advances ID sequences');
    await db.prepare("UPDATE Bill SET Status = 'Paid', Paid_At = ?, Payment_Method = ?, Transaction_ID = ? WHERE B_ID = ?").run('2026-09-06T00:00:00Z','upi','TEST-TXN',created[0].B_ID);
    await pg.close();
    pg = new PGlite(directory);
    await pg.exec(schema);
    db = postgresAdapter(pg);
    assert.equal((await db.prepare('SELECT * FROM Bill').all()).length,5);
    assert.equal((await db.prepare('SELECT * FROM Paid_Bills').all()).length,1);
    assert.equal((await db.prepare('SELECT * FROM Unpaid_Bills').all()).length,4);
    const paid = await db.prepare('SELECT * FROM Bill WHERE B_ID = ?').get(created[0].B_ID);
    assert.equal(paid.Transaction_ID,'TEST-TXN');
    assert.equal(paid.Paid_At,'2026-09-06T00:00:00Z');
    await assert.rejects(importRecords(pg,{consumers:[],tariffs:[],readings:[],bills:[]}),/already contains/);
    assert.equal((await db.prepare('SELECT * FROM Bill').all()).length,5);
  } finally { await pg.close(); rmSync(directory, { recursive:true, force:true }); }
});
