// Sauti Gang Studios - backend (Express + SQLite)
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const VAT_RATE = 0.16;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'sauti.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS docs(no TEXT PRIMARY KEY, type TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
`);

// first run: starter equipment (edit prices in the app)
if (db.prepare('SELECT COUNT(*) c FROM items').get().c === 0) {
  const ins = db.prepare('INSERT INTO items(name,price) VALUES(?,?)');
  [['Speaker (each)', 3000], ['Mixer', 2500], ['Drum kit', 4000], ['Keyboard 1', 3500],
   ['Keyboard 2', 3000], ['Keyboard 3', 2500], ['Bass guitar amp', 2000]].forEach(r => ins.run(...r));
}
const DEFAULTS = { name: 'Sauti Gang Studios', line: 'Sound equipment hire for events', contact: 'Tel: add your number  |  Email: add your email' };

const app = express();
app.use(express.json({ limit: '200kb' }));

// optional password protection: set APP_USER and APP_PASS before starting
if (process.env.APP_USER && process.env.APP_PASS) {
  app.use((req, res, next) => {
    const [u, p] = Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString().split(':');
    if (u === process.env.APP_USER && p === process.env.APP_PASS) return next();
    res.set('WWW-Authenticate', 'Basic realm="Sauti Gang Studios"').status(401).send('Login required');
  });
}
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res, f) => { if (/sw\.js$|\.html$/.test(f)) res.set('Cache-Control', 'no-cache'); } }));

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const num = (v) => Math.max(0, Number(v) || 0);

function nextNo(type) {
  const prefix = type === 'Quotation' ? 'QT' : 'INV', year = new Date().getFullYear();
  const rows = db.prepare('SELECT no FROM docs WHERE no LIKE ?').all(`${prefix}-${year}-%`);
  const max = Math.max(0, ...rows.map(r => parseInt(r.no.split('-')[2], 10)));
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

// prices always come from the database, never from the browser
function build(b, type) {
  if (!['Quotation', 'Invoice'].includes(type)) throw bad('Invalid document type');
  if (!String(b.client || '').trim()) throw bad('Client name is required');
  const items = db.prepare('SELECT * FROM items').all();
  const days = Math.max(1, parseInt(b.days, 10) || 1), qty = b.qty || {};
  const lines = items.filter(i => qty[i.id] > 0).map(i => {
    const q = Math.floor(qty[i.id]);
    return { name: i.name, qty: q, price: i.price, days, amt: q * i.price * days };
  });
  if (!lines.length) throw bad('Add at least one piece of equipment');
  const sub = lines.reduce((a, l) => a + l.amt, 0), transport = num(b.transport), discount = num(b.discount);
  const net = Math.max(sub + transport - discount, 0), vat = b.vat ? net * VAT_RATE : 0;
  return {
    type, client: String(b.client).trim(), phone: b.phone || '', email: b.email || '', event: b.event || 'Other',
    date: b.date || new Date().toISOString().slice(0, 10), venue: b.venue || '', days, transport, discount,
    vat: !!b.vat, lines, sub, vatAmt: vat, total: net + vat
  };
}
const save = (doc) => { doc.no = nextNo(doc.type); db.prepare('INSERT INTO docs(no,type,data) VALUES(?,?,?)').run(doc.no, doc.type, JSON.stringify(doc)); return doc; };

// ---- equipment ----
app.get('/api/items', (q, r) => r.json(db.prepare('SELECT * FROM items ORDER BY id').all()));
app.post('/api/items', (q, r) => {
  const name = String(q.body.name || '').trim(); if (!name) throw bad('Name is required');
  const id = db.prepare('INSERT INTO items(name,price) VALUES(?,?)').run(name, num(q.body.price)).lastInsertRowid;
  r.status(201).json(db.prepare('SELECT * FROM items WHERE id=?').get(id));
});
app.put('/api/items/:id', (q, r) => {
  const name = String(q.body.name || '').trim(); if (!name) throw bad('Name is required');
  db.prepare('UPDATE items SET name=?, price=? WHERE id=?').run(name, num(q.body.price), q.params.id);
  r.json(db.prepare('SELECT * FROM items WHERE id=?').get(q.params.id));
});
app.delete('/api/items/:id', (q, r) => { db.prepare('DELETE FROM items WHERE id=?').run(q.params.id); r.json({ ok: true }); });

// ---- quotes & invoices ----
app.get('/api/docs', (q, r) => r.json(db.prepare('SELECT data FROM docs ORDER BY created DESC, rowid DESC').all().map(x => JSON.parse(x.data))));
app.post('/api/docs', (q, r) => r.status(201).json(save(build(q.body, q.body.type))));
app.post('/api/docs/:no/invoice', (q, r) => {
  const row = db.prepare('SELECT data FROM docs WHERE no=?').get(q.params.no); if (!row) throw Object.assign(new Error('Not found'), { status: 404 });
  const src = JSON.parse(row.data);
  r.status(201).json(save({ ...src, type: 'Invoice', from: src.no }));
});
app.delete('/api/docs/:no', (q, r) => { db.prepare('DELETE FROM docs WHERE no=?').run(q.params.no); r.json({ ok: true }); });

// ---- business details ----
app.get('/api/settings', (q, r) => {
  const out = { ...DEFAULTS };
  db.prepare('SELECT k,v FROM settings').all().forEach(x => out[x.k] = x.v);
  r.json(out);
});
app.put('/api/settings', (q, r) => {
  const up = db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
  Object.keys(DEFAULTS).forEach(k => { if (typeof q.body[k] === 'string') up.run(k, q.body[k].slice(0, 200)); });
  r.json({ ok: true });
});

app.use((e, q, r, n) => r.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' }));
app.listen(PORT, () => console.log(`Sauti Gang Studios running on http://localhost:${PORT}`));
