import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { getDb, assertService, getDbPath } from '../../../shared/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4100);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-jwt-secret-min-32-chars-long!!';
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../data/uploads'));

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const db = getDb();

function authRequired(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function signUser(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

app.post('/auth/signup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES (?,?, 'applicant')`).run(
      String(email).toLowerCase().trim(),
      hash
    );
    const user = db.prepare(`SELECT id, email, role FROM users WHERE id = ?`).get(info.lastInsertRowid);
    res.json({ token: signUser(user), user });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare(`SELECT id, email, role, password_hash FROM users WHERE email = ?`).get(
    String(email || '').toLowerCase().trim()
  );
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { password_hash, ...pub } = user;
  res.json({ token: signUser(pub), user: pub });
});

app.get('/auth/me', authRequired, (req, res) => {
  const user = db.prepare(`SELECT id, email, role FROM users WHERE id = ?`).get(req.user.sub);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json(user);
});

app.post('/applications', authRequired, (req, res) => {
  const info = db
    .prepare(
      `INSERT INTO applications (user_id, status) VALUES (?, 'draft')`
    )
    .run(req.user.sub);
  res.json({ id: info.lastInsertRowid });
});

app.get('/applications', authRequired, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM applications WHERE user_id = ? ORDER BY id DESC`)
    .all(req.user.sub);
  res.json(rows);
});

app.get('/applications/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ?`).get(id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const docs = db.prepare(`SELECT id, doc_type, original_name, created_at FROM documents WHERE application_id = ?`).all(id);
  const income = db.prepare(`SELECT * FROM income_details WHERE application_id = ?`).get(id);
  const gpay = db.prepare(`SELECT * FROM gpay_history WHERE application_id = ?`).get(id);
  res.json({ ...row, documents: docs, income_details: income, gpay_history: gpay });
});

app.patch('/applications/:id/insurance', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const appRow = db.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`).get(id, req.user.sub);
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  db.prepare(
    `UPDATE applications SET
      coverage_type = COALESCE(?, coverage_type),
      sum_assured = COALESCE(?, sum_assured),
      tenure_months = COALESCE(?, tenure_months),
      monthly_income = COALESCE(?, monthly_income),
      income_type = COALESCE(?, income_type),
      health_declaration = COALESCE(?, health_declaration),
      existing_loans = COALESCE(?, existing_loans),
      occupation_risk = COALESCE(?, occupation_risk),
      address_line = COALESCE(?, address_line),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      pincode = COALESCE(?, pincode),
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    b.coverage_type ?? null,
    b.sum_assured ?? null,
    b.tenure_months ?? null,
    b.monthly_income ?? null,
    b.income_type ?? null,
    b.health_declaration != null ? (b.health_declaration ? 1 : 0) : null,
    b.existing_loans ?? null,
    b.occupation_risk ?? null,
    b.address_line ?? null,
    b.city ?? null,
    b.state ?? null,
    b.pincode ?? null,
    id
  );
  res.json({ ok: true });
});

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
const upload = multer({ dest: UPLOAD_ROOT });

app.post('/applications/:id/documents/:docType', authRequired, upload.single('file'), (req, res) => {
  const id = Number(req.params.id);
  const docType = req.params.docType;
  if (!['utility', 'gpay', 'income'].includes(docType)) return res.status(400).json({ error: 'Invalid doc type' });
  const appRow = db.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`).get(id, req.user.sub);
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'File required' });
  db.prepare(
    `INSERT INTO documents (application_id, doc_type, original_name, stored_path) VALUES (?,?,?,?)`
  ).run(id, docType, req.file.originalname || 'upload', req.file.path);
  res.json({ ok: true, path: req.file.path });
});

app.post('/applications/:id/income-details', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const appRow = db.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`).get(id, req.user.sub);
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const existing = db.prepare(`SELECT id FROM income_details WHERE application_id = ?`).get(id);
  if (existing) {
    db.prepare(
      `UPDATE income_details SET employer_name=?, job_title=?, annual_income=?, notes=? WHERE application_id=?`
    ).run(b.employer_name || '', b.job_title || '', Number(b.annual_income) || 0, b.notes || '', id);
  } else {
    db.prepare(
      `INSERT INTO income_details (application_id, employer_name, job_title, annual_income, notes) VALUES (?,?,?,?,?)`
    ).run(id, b.employer_name || '', b.job_title || '', Number(b.annual_income) || 0, b.notes || '');
  }
  res.json({ ok: true });
});

app.post('/applications/:id/gpay-history', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const appRow = db.prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`).get(id, req.user.sub);
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const existing = db.prepare(`SELECT id FROM gpay_history WHERE application_id = ?`).get(id);
  if (existing) {
    db.prepare(`UPDATE gpay_history SET raw_text=?, monthly_estimate=? WHERE application_id=?`).run(
      b.raw_text || '',
      Number(b.monthly_estimate) || 0,
      id
    );
  } else {
    db.prepare(`INSERT INTO gpay_history (application_id, raw_text, monthly_estimate) VALUES (?,?,?)`).run(
      id,
      b.raw_text || '',
      Number(b.monthly_estimate) || 0
    );
  }
  res.json({ ok: true });
});

async function postJson(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!r.ok) throw new Error(data.error || r.statusText || 'Upstream error');
  return data;
}

app.post('/applications/:id/submit', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const appRow = db.prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ?`).get(id, req.user.sub);
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const docs = db.prepare(`SELECT doc_type FROM documents WHERE application_id = ?`).all(id);
  const types = new Set(docs.map((d) => d.doc_type));
  const missing = ['utility', 'gpay', 'income'].filter((t) => !types.has(t));
  if (missing.length) return res.status(400).json({ error: `Missing documents: ${missing.join(', ')}` });
  const income = db.prepare(`SELECT * FROM income_details WHERE application_id = ?`).get(id);
  const gpay = db.prepare(`SELECT * FROM gpay_history WHERE application_id = ?`).get(id);
  if (!income || !gpay) return res.status(400).json({ error: 'Income details and GPay history required' });
  if (!appRow.monthly_income || !appRow.coverage_type) return res.status(400).json({ error: 'Complete insurance form first' });

  const serviceKey = process.env.SERVICE_SECRET || 'dev-service-secret';
  const workerUrl = process.env.WORKER_SERVICE_URL || 'http://127.0.0.1:4101';
  const riskUrl = process.env.RISK_ENGINE_URL || 'http://127.0.0.1:5100';
  const utilUrl = process.env.UTILITY_SERVICE_URL || 'http://127.0.0.1:4103';

  try {
    await postJson(`${utilUrl}/internal/utility/analyze`, { applicationId: id }, { 'X-Service-Key': serviceKey });
  } catch (e) {
    console.warn('Utility analyze:', e.message);
  }
  try {
    await postJson(`${workerUrl}/worker/ingest`, { applicationId: id }, { 'X-Service-Key': serviceKey });
  } catch (e) {
    return res.status(502).json({ error: 'Worker service unavailable', detail: e.message });
  }
  try {
    await postJson(`${riskUrl}/risk/evaluate`, { applicationId: id }, { 'X-Service-Key': serviceKey });
  } catch (e) {
    return res.status(502).json({ error: 'Risk engine unavailable', detail: e.message });
  }
  db.prepare(`UPDATE applications SET status = 'submitted', updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ ok: true, status: 'submitted' });
});

app.get('/internal/applications', assertService, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.user_id, a.status, a.coverage_type, a.updated_at, u.email AS applicant_email
       FROM applications a JOIN users u ON u.id = a.user_id ORDER BY a.id DESC`
    )
    .all();
  res.json(rows);
});

app.get('/internal/applications/:id', assertService, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT a.*, u.email as applicant_email FROM applications a JOIN users u ON u.id = a.user_id WHERE a.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const docs = db.prepare(`SELECT id, doc_type, original_name, created_at FROM documents WHERE application_id = ?`).all(id);
  const income = db.prepare(`SELECT * FROM income_details WHERE application_id = ?`).get(id);
  const gpay = db.prepare(`SELECT * FROM gpay_history WHERE application_id = ?`).get(id);
  res.json({ ...row, documents: docs, income_details: income, gpay_history: gpay });
});

app.get('/health', (_req, res) => res.json({ ok: true, db: getDbPath() }));

app.listen(PORT, () => console.log(`Applicant API on ${PORT}`));
