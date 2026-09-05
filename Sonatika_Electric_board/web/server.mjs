import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');
const DB_FILE = process.env.SONATIKA_DB || resolve(ROOT, 'data/sonatika.db');
const PORT = Number(process.env.PORT || 3000);
const UNPAID = 'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

mkdirSync(dirname(DB_FILE), { recursive: true });
const freshDatabase = !existsSync(DB_FILE);
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = OFF;');
if (freshDatabase) {
  db.exec(readFileSync(resolve(ROOT, 'data/schema.sql'), 'utf8'));
  db.exec(readFileSync(resolve(ROOT, 'data/seed.sql'), 'utf8'));
}

function send(res, status, payload, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': contentType.startsWith('image/') ? 'public, max-age=86400' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  res.end(contentType.startsWith('application/json') ? JSON.stringify(payload) : payload);
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function text(value, label, max = 100) {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) fail(`${label} is required.`);
  return result;
}

function number(value, label) {
  const result = Number(value);
  if (value === '' || value == null || !Number.isFinite(result) || result < 0) fail(`${label} must be a valid non-negative number.`);
  return result;
}

function getConsumer(id) {
  const consumer = db.prepare('SELECT * FROM Consumers WHERE C_ID = ?').get(Number(id));
  if (!consumer) fail('Consumer not found.', 404);
  return consumer;
}

function quote(connectionType, units) {
  const tariff = db.prepare('SELECT * FROM Tariff WHERE Connection_Type = ? AND ? BETWEEN Min_Units AND Max_Units LIMIT 1').get(connectionType, units);
  if (!tariff) fail('No tariff is available for this usage. Use a whole-unit reading.');
  const energy = units * tariff.Rate_Per_Unit;
  const subtotal = energy + tariff.Fixed_Charge;
  const tax = subtotal * tariff.Tax_Percent / 100;
  return {
    units,
    rate: tariff.Rate_Per_Unit,
    energy: Math.round(energy * 100) / 100,
    fixed: tariff.Fixed_Charge,
    tax: Math.round(tax * 100) / 100,
    taxPercent: tariff.Tax_Percent,
    total: Math.round((subtotal + tax) * 100) / 100,
  };
}

async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('Expected JSON.', 415);
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) fail('Request is too large.', 413);
  }
  try { return JSON.parse(raw || '{}'); } catch { fail('Invalid JSON.'); }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = resolve(PUBLIC, relative);
      if (!file.startsWith(PUBLIC) || !existsSync(file)) return send(res, 404, { error: 'Page not found.' });
      return send(res, 200, readFileSync(file), MIME[extname(file)] || 'application/octet-stream');
    }

    if (req.method === 'GET' && url.pathname === '/api/data') {
      return send(res, 200, {
        consumers: db.prepare('SELECT * FROM Consumers ORDER BY C_ID').all(),
        bills: db.prepare('SELECT * FROM Bill ORDER BY B_ID DESC').all(),
        tariffs: db.prepare('SELECT * FROM Tariff ORDER BY Connection_Type, Min_Units').all(),
        readings: db.prepare('SELECT * FROM Meter_Readings ORDER BY R_Date DESC, R_ID DESC').all(),
      });
    }

    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return send(res, 404, { error: 'Endpoint not found.' });
    const body = req.method === 'DELETE' ? {} : await readJson(req);

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const role = text(body.role, 'Account type', 20);
      const identity = text(body.identity, role === 'administrator' ? 'Administrator ID' : 'Consumer ID', 40);
      if (role === 'administrator') {
        const password = text(body.password, 'Password', 50);
        if (identity !== 'ADMIN001' || password !== 'SEB2026') fail('Invalid administrator ID or password.', 401);
        return send(res, 200, { role: 'administrator', name: 'SEB Authority' });
      }
      if (role !== 'consumer') fail('Choose Consumer or Administrator.');
      const normalized = identity.replace(/^SEB-/i, '');
      const consumer = /^\d+$/.test(normalized)
        ? db.prepare('SELECT * FROM Consumers WHERE C_ID = ?').get(Number(normalized))
        : db.prepare('SELECT * FROM Consumers WHERE LOWER(Meter_ID) = LOWER(?)').get(identity);
      if (!consumer) fail('Consumer not found. Check your consumer ID or meter ID.', 401);
      return send(res, 200, { role: 'consumer', consumer });
    }

    if (req.method === 'POST' && url.pathname === '/api/quote') {
      const units = number(body.units, 'Units');
      return send(res, 200, quote(text(body.connection_type, 'Connection type'), units));
    }

    if (req.method === 'POST' && url.pathname === '/api/consumers') {
      const name = text(body.name, 'Name');
      const address = text(body.address, 'Address');
      const phone = text(body.phone, 'Phone', 10);
      const meter = text(body.meter_id, 'Meter ID', 7);
      const type = text(body.connection_type, 'Connection type');
      if (!/^\d{10}$/.test(phone)) fail('Phone must contain exactly 10 digits.');
      try {
        const result = db.prepare('INSERT INTO Consumers (Customer_Name, Address, Phone, Meter_ID, Connection_Type) VALUES (?, ?, ?, ?, ?)').run(name, address, phone, meter, type);
        return send(res, 201, { message: 'Connection registered successfully.', id: Number(result.lastInsertRowid) });
      } catch (error) {
        if (error.message.includes('UNIQUE')) fail('That meter ID is already registered.');
        throw error;
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/bills') {
      const consumer = getConsumer(body.consumer_id);
      const previous = number(body.previous_reading, 'Previous reading');
      const current = number(body.current_reading, 'Current reading');
      if (current < previous) fail('Current reading cannot be less than the previous reading.');
      const units = Math.round((current - previous) * 100) / 100;
      const calculation = quote(consumer.Connection_Type, units);
      const month = text(body.bill_month, 'Bill month', 30);
      const result = db.prepare('INSERT INTO Bill (C_ID, Bill_Month, Previous_Reading, Current_Reading, Units_Consumed, Rate_Per_Unit, Total_Amt, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(consumer.C_ID, month, previous, current, units, calculation.rate, calculation.total, UNPAID);
      return send(res, 201, { message: 'Bill generated successfully.', billId: Number(result.lastInsertRowid), ...calculation });
    }

    const paidMatch = url.pathname.match(/^\/api\/bills\/(\d+)\/paid$/);
    if (req.method === 'POST' && paidMatch) {
      const billId = Number(paidMatch[1]);
      const bill = db.prepare('SELECT * FROM Bill WHERE B_ID = ?').get(billId);
      if (!bill) fail('Bill not found.', 404);
      if (body.consumer_id != null && Number(body.consumer_id) !== Number(bill.C_ID)) fail('This bill does not belong to the signed-in consumer.', 403);
      const method = body.method == null ? 'authority' : text(body.method, 'Payment method', 20);
      if (!['upi', 'card', 'bank', 'authority'].includes(method)) fail('Choose a valid payment method.');
      if (method !== 'authority') text(body.reference, 'Payment reference', 40);
      db.prepare("UPDATE Bill SET Status = 'Paid' WHERE B_ID = ?").run(billId);
      const paidAt = new Date().toISOString();
      return send(res, 200, {
        message: 'Bill payment recorded successfully.',
        billId,
        amount: Number(bill.Total_Amt),
        transactionId: `SEB-${billId}-${Date.now().toString(36).toUpperCase()}`,
        paidAt,
      });
    }

    const nameMatch = url.pathname.match(/^\/api\/consumers\/(\d+)\/name$/);
    if (req.method === 'PUT' && nameMatch) {
      const consumer = getConsumer(nameMatch[1]);
      const meter = text(body.meter_id, 'Meter ID', 20);
      if (meter.toLowerCase() !== String(consumer.Meter_ID).toLowerCase()) fail('Meter verification failed.', 403);
      const name = text(body.name, 'Consumer name');
      if (name.length < 2) fail('Consumer name must contain at least 2 characters.');
      db.prepare('UPDATE Consumers SET Customer_Name = ? WHERE C_ID = ?').run(name, consumer.C_ID);
      return send(res, 200, { message: 'Display name updated successfully.', name });
    }

    const consumerMatch = url.pathname.match(/^\/api\/consumers\/(\d+)$/);
    if (req.method === 'DELETE' && consumerMatch) {
      const consumer = getConsumer(consumerMatch[1]);
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM Bill WHERE C_ID = ?').run(consumer.C_ID);
        db.prepare('DELETE FROM Meter_Readings WHERE C_ID = ?').run(consumer.C_ID);
        db.prepare('DELETE FROM Consumers WHERE C_ID = ?').run(consumer.C_ID);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return send(res, 200, { message: 'Consumer record deleted.' });
    }

    return send(res, 404, { error: 'Endpoint not found.' });
  } catch (error) {
    if (!error.status) console.error(error);
    return send(res, error.status || 500, { error: error.status ? error.message : 'Unable to complete the request.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sonatika Class XII web project: http://localhost:${PORT}`);
  console.log('Original Python interface: python3 src/server.py');
});
