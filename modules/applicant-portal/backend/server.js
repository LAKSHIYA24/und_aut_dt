import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { getDb, assertService } from '../../../shared/database.js';
import { ObjectId } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4100);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-jwt-secret-min-32-chars-long!!';
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../data/uploads'));

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

let db;

(async () => {
  db = await getDb();
})();

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

app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.collection('users').insertOne({
      email: String(email).toLowerCase().trim(),
      password_hash: hash,
      role: 'applicant',
      created_at: new Date()
    });
    const user = await db.collection('users').findOne({ _id: result.insertedId }, { projection: { id: '$_id', email: 1, role: 1 } });
    user.id = user._id.toString();
    delete user._id;
    res.json({ token: signUser(user), user });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.collection('users').findOne({ email: String(email || '').toLowerCase().trim() });
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { password_hash, ...pub } = user;
  pub.id = user._id.toString();
  res.json({ token: signUser(pub), user: pub });
});

app.get('/auth/me', authRequired, async (req, res) => {
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.sub) });
  if (!user) return res.status(401).json({ error: 'User not found' });
  const { password_hash, ...pub } = user;
  pub.id = user._id.toString();
  res.json(pub);
});

app.post('/applications', authRequired, async (req, res) => {
  const result = await db.collection('applications').insertOne({
    user_id: new ObjectId(req.user.sub),
    status: 'draft',
    created_at: new Date(),
    updated_at: new Date()
  });
  res.json({ id: result.insertedId.toString() });
});

app.get('/applications', authRequired, async (req, res) => {
  const rows = await db.collection('applications').find({ user_id: new ObjectId(req.user.sub) }).sort({ _id: -1 }).toArray();
  rows.forEach(r => {
    r.id = r._id.toString();
    delete r._id;
  });
  res.json(rows);
});

app.get('/applications/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  const row = await db.collection('applications').findOne({ _id: new ObjectId(id), user_id: new ObjectId(req.user.sub) });
  if (!row) return res.status(404).json({ error: 'Not found' });
  const docs = await db.collection('documents').find({ application_id: new ObjectId(id) }).project({ id: '$_id', doc_type: 1, original_name: 1, created_at: 1 }).toArray();
  docs.forEach(d => {
    d.id = d._id.toString();
    delete d._id;
  });
  const income = await db.collection('income_details').findOne({ application_id: new ObjectId(id) });
  if (income) {
    income.id = income._id.toString();
    delete income._id;
  }
  const gpay = await db.collection('gpay_history').findOne({ application_id: new ObjectId(id) });
  if (gpay) {
    gpay.id = gpay._id.toString();
    delete gpay._id;
  }
  row.id = row._id.toString();
  delete row._id;
  res.json({ ...row, documents: docs, income_details: income, gpay_history: gpay });
});

app.patch('/applications/:id/insurance', authRequired, async (req, res) => {
  const id = req.params.id;
  const appRow = await db.collection('applications').findOne({ _id: new ObjectId(id), user_id: new ObjectId(req.user.sub) });
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const update = {};
  if (b.coverage_type !== undefined) update.coverage_type = b.coverage_type;
  if (b.sum_assured !== undefined) update.sum_assured = b.sum_assured;
  if (b.tenure_months !== undefined) update.tenure_months = b.tenure_months;
  if (b.monthly_income !== undefined) update.monthly_income = b.monthly_income;
  if (b.income_type !== undefined) update.income_type = b.income_type;
  if (b.health_declaration !== undefined) update.health_declaration = b.health_declaration ? 1 : 0;
  if (b.existing_loans !== undefined) update.existing_loans = b.existing_loans;
  if (b.occupation_risk !== undefined) update.occupation_risk = b.occupation_risk;
  if (b.address_line !== undefined) update.address_line = b.address_line;
  if (b.city !== undefined) update.city = b.city;
  if (b.state !== undefined) update.state = b.state;
  if (b.pincode !== undefined) update.pincode = b.pincode;
  update.updated_at = new Date();
  await db.collection('applications').updateOne({ _id: new ObjectId(id) }, { $set: update });
  res.json({ ok: true });
});

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
const upload = multer({ dest: UPLOAD_ROOT });

app.post('/applications/:id/documents/:docType', authRequired, upload.single('file'), async (req, res) => {
  const id = req.params.id;
  const docType = req.params.docType;
  if (!['utility', 'gpay', 'income'].includes(docType)) return res.status(400).json({ error: 'Invalid doc type' });
  const appRow = await db.collection('applications').findOne({ _id: new ObjectId(id), user_id: new ObjectId(req.user.sub) });
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'File required' });
  await db.collection('documents').insertOne({
    application_id: new ObjectId(id),
    doc_type: docType,
    original_name: req.file.originalname || 'upload',
    stored_path: req.file.path,
    created_at: new Date()
  });
  res.json({ ok: true, path: req.file.path });
});

app.post('/applications/:id/income-details', authRequired, async (req, res) => {
  const id = req.params.id;
  const appRow = await db.collection('applications').findOne({ _id: new ObjectId(id), user_id: new ObjectId(req.user.sub) });
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const existing = await db.collection('income_details').findOne({ application_id: new ObjectId(id) });
  if (existing) {
    await db.collection('income_details').updateOne(
      { application_id: new ObjectId(id) },
      { $set: {
        employer_name: b.employer_name || '',
        job_title: b.job_title || '',
        annual_income: Number(b.annual_income) || 0,
        notes: b.notes || ''
      }}
    );
  } else {
    await db.collection('income_details').insertOne({
      application_id: new ObjectId(id),
      employer_name: b.employer_name || '',
      job_title: b.job_title || '',
      annual_income: Number(b.annual_income) || 0,
      notes: b.notes || '',
      created_at: new Date()
    });
  }
  res.json({ ok: true });
});

app.post('/applications/:id/gpay-history', authRequired, async (req, res) => {
  const id = req.params.id;
  const appRow = await db.collection('applications').findOne({ _id: new ObjectId(id), user_id: new ObjectId(req.user.sub) });
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const existing = await db.collection('gpay_history').findOne({ application_id: new ObjectId(id) });
  if (existing) {
    await db.collection('gpay_history').updateOne(
      { application_id: new ObjectId(id) },
      { $set: {
        raw_text: b.raw_text || '',
        monthly_estimate: Number(b.monthly_estimate) || 0
      }}
    );
  } else {
    await db.collection('gpay_history').insertOne({
      application_id: new ObjectId(id),
      raw_text: b.raw_text || '',
      monthly_estimate: Number(b.monthly_estimate) || 0,
      created_at: new Date()
    });
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
  const id = req.params.id;
  const appRow = await db.collection('applications').findOne({ _id: new ObjectId(id), user_id: new ObjectId(req.user.sub) });
  if (!appRow) return res.status(404).json({ error: 'Not found' });
  const docs = await db.collection('documents').find({ application_id: new ObjectId(id) }).toArray();
  const types = new Set(docs.map((d) => d.doc_type));
  const missing = ['utility', 'gpay', 'income'].filter((t) => !types.has(t));
  if (missing.length) return res.status(400).json({ error: `Missing documents: ${missing.join(', ')}` });
  const income = await db.collection('income_details').findOne({ application_id: new ObjectId(id) });
  const gpay = await db.collection('gpay_history').findOne({ application_id: new ObjectId(id) });
  if (!income || !gpay) return res.status(400).json({ error: 'Income details and GPay history required' });
  if (!appRow.monthly_income || !appRow.coverage_type) return res.status(400).json({ error: 'Complete insurance form first' });

  const serviceKey = process.env.SERVICE_SECRET || 'dev-service-secret';
  const riskUrl = process.env.RISK_ENGINE_URL || 'http://127.0.0.1:5100';

  try {
    await postJson(`${riskUrl}/risk/evaluate`, { applicationId: id }, { 'X-Service-Key': serviceKey });
  } catch (e) {
    return res.status(502).json({ error: 'Risk engine unavailable', detail: e.message });
  }

  await db.collection('applications').updateOne({ _id: new ObjectId(id) }, { $set: { status: 'submitted', updated_at: new Date() } });
  res.json({ ok: true, status: 'submitted' });
});

app.get('/internal/applications', assertService, async (_req, res) => {
  const rows = await db.collection('applications').aggregate([
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $project: { id: '$_id', user_id: 1, status: 1, coverage_type: 1, updated_at: 1, applicant_email: { $ifNull: ['$user.email', '$applicant_email'] } } },
    { $sort: { _id: -1 } }
  ]).toArray();
  rows.forEach(r => {
    r.id = r._id.toString();
    delete r._id;
  });
  res.json(rows);
});

app.get('/internal/applications/:id', assertService, async (req, res) => {
  const id = req.params.id;
  const row = await db.collection('applications').aggregate([
    { $match: { _id: new ObjectId(id) } },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $project: { id: '$_id', user_id: 1, status: 1, coverage_type: 1, updated_at: 1, applicant_email: { $ifNull: ['$user.email', '$applicant_email'] }, documents: 1, income_details: 1, gpay_history: 1, coverage_type: 1, monthly_income: 1, sum_assured: 1, income_type: 1, address_line: 1, city: 1, state: 1, pincode: 1, existing_loans: 1, occupation_risk: 1, health_declaration: 1, notes: 1 } }
  ]).next();
  if (!row) return res.status(404).json({ error: 'Not found' });
  const docs = await db.collection('documents').find({ application_id: new ObjectId(id) }).project({ id: '$_id', doc_type: 1, type: 1, original_name: 1, created_at: 1 }).toArray();
  docs.forEach((d) => {
    d.id = d._id.toString();
    delete d._id;
    if (!d.doc_type && d.type) d.doc_type = d.type;
    delete d.type;
  });

  const rawIncome = await db.collection('income_details').findOne({ application_id: new ObjectId(id) });
  let income = null;
  if (rawIncome) {
    income = { ...rawIncome };
    income.id = rawIncome._id.toString();
    delete income._id;
    income.annual_income = income.annual_income ?? (Number(income.total_monthly_income || income.salary || 0) || 0);
    income.employer_name = income.employer_name || income.employer || '';
  }

  const gpayRows = await db.collection('gpay_history').find({ application_id: new ObjectId(id) }).toArray();
  let gpay = null;
  if (gpayRows.length) {
    const source = gpayRows.find((row) => row.monthly_estimate !== undefined) || gpayRows[0];
    const amountRows = gpayRows.filter((row) => Number.isFinite(row.amount));
    const averageAmount = amountRows.length
      ? Math.round(amountRows.reduce((sum, row) => sum + Number(row.amount || 0), 0) / amountRows.length)
      : undefined;
    gpay = {
      id: source._id.toString(),
      monthly_estimate: source.monthly_estimate ?? averageAmount ?? 0,
      raw_text: source.raw_text || amountRows.map((row) => (row.month && row.amount ? `${row.month}: ${row.amount}` : '')).filter(Boolean).join('; '),
    };
  }

  row.id = row._id.toString();
  delete row._id;
  res.json({ ...row, documents: docs, income_details: income, gpay_history: gpay });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Applicant API on ${PORT}`));
