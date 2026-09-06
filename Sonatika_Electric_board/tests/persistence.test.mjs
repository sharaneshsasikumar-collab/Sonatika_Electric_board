import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openDatabase } from '../web/database.mjs';

const root = resolve(import.meta.dirname, '..');
async function start(file) {
  const child = spawn(process.execPath, ['web/server.mjs'], {
    cwd: root, env: { ...process.env, DATABASE_URL: '', SONATIKA_DB: file, NODE_ENV: 'test', RENDER: '', HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error(output || 'Server start timed out')); }, 15000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}/api/`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  return {
    async request(path, body) {
      const response = await fetch(url + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      assert.ok(response.ok, JSON.stringify(result));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return result;
    },
    async stop() { if (child.exitCode !== null) return; const stopped = once(child, 'exit'); child.kill(); await stopped; },
  };
}

test('five bills and payment receipts survive a restart and independent client logins', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sonatika-persistence-'));
  const file = resolve(directory, 'records.db');
  let server;
  try {
    server = await start(file);
    const before = await server.request('data');
    const consumer = before.consumers.find(c => c.Meter_ID === 'RES1001');
    const bills = [];
    for (let i = 0; i < 5; i++) bills.push(await server.request('bills', { consumer_id: consumer.C_ID, bill_month: `2026-${String(i+1).padStart(2,'0')}`, previous_reading: i*100, current_reading: (i+1)*100 }));
    await server.request('login', { role: 'consumer', identity: consumer.Meter_ID });
    assert.equal((await server.request('data')).bills.length, before.bills.length+5);
    const receipt = await server.request(`bills/${bills[0].billId}/paid`, { consumer_id: consumer.C_ID, method: 'upi', reference: 'TEST-REFERENCE' });
    const retry = await server.request(`bills/${bills[0].billId}/paid`, {});
    assert.equal(retry.transactionId, receipt.transactionId);
    assert.equal(retry.paidAt, receipt.paidAt);
    await server.stop();
    server = await start(file);
    await server.request('login', { role: 'administrator', identity: 'ADMIN001', password: 'SEB2026' });
    const after = await server.request('data');
    assert.equal(after.bills.length, before.bills.length+5);
    const saved = after.bills.find(b => b.B_ID === bills[0].billId);
    assert.equal(saved.Status, 'Paid');
    assert.equal(saved.Transaction_ID, receipt.transactionId);
    assert.equal(saved.Paid_At, receipt.paidAt);
    const { db } = await openDatabase(root, { SONATIKA_DB: file });
    assert.ok(db.prepare('SELECT * FROM Paid_Bills WHERE B_ID = ?').get(saved.B_ID));
    assert.equal(db.prepare('SELECT * FROM Unpaid_Bills WHERE B_ID = ?').get(saved.B_ID), undefined);
    db.close();
  } finally { if (server) await server.stop(); rmSync(directory, { recursive: true, force: true }); }
});

test('Render starts with bundled SQLite when DATABASE_URL is not configured', async () => {
  const { db, file } = await openDatabase(root, { RENDER: 'true' });
  try {
    assert.equal(file, resolve(root, 'data/sonatika.db'));
    assert.ok(db.prepare('SELECT COUNT(*) AS count FROM Consumers').get().count > 0);
  } finally { db.close(); }
});

test('empty existing databases are not repopulated with demo customers on restart', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sonatika-empty-'));
  const env = { SONATIKA_DB: resolve(directory, 'records.db') };
  try {
    let { db } = await openDatabase(root, env);
    db.batch([['DELETE FROM Bill', []], ['DELETE FROM Meter_Readings', []], ['DELETE FROM Consumers', []]]);
    db.close();
    ({ db } = await openDatabase(root, env));
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM Consumers').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM Bill').get().count, 0);
    db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
