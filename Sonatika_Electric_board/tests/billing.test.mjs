import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { insertBill } from '../web/billing.mjs';

test('every generated bill is persisted and returned to the ledger', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE Bill (
      B_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      C_ID INTEGER NOT NULL,
      Bill_Month TEXT NOT NULL,
      Previous_Reading REAL NOT NULL,
      Current_Reading REAL NOT NULL,
      Units_Consumed REAL NOT NULL,
      Rate_Per_Unit REAL NOT NULL,
      Total_Amt REAL NOT NULL,
      Status TEXT NOT NULL
    )
  `);

  const created = await Promise.all([0, 1, 2].map(index => insertBill(db, {
    consumerId: 2,
    month: '2026-09',
    previous: 1000 + index * 100,
    current: 1100 + index * 100,
    units: 100,
    rate: 2.5,
    total: 315,
    status: 'Due',
  })));


  assert.deepEqual(created.map(bill => bill.B_ID), [1, 2, 3]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM Bill').get().count, 3);
  assert.deepEqual(
    db.prepare('SELECT B_ID FROM Bill ORDER BY B_ID DESC').all().map(row => row.B_ID),
    [3, 2, 1],
  );
});
