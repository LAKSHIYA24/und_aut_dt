import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../../../shared/database.js';
import { ObjectId } from 'mongodb';

const PORT = Number(process.env.PORT || 4102);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-jwt-secret-min-32-chars-long!!';
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev-service-secret';

const APPLICANT_URL = process.env.APPLICANT_SERVICE_URL || 'http://127.0.0.1:4100';
const RISK_URL = process.env.RISK_ENGINE_URL || 'http://127.0.0.1:5100';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

let db;

(async () => {
  db = await getDb();
})();

function serviceHeaders() {
  return { 'X-Service-Key': SERVICE_SECRET };
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...serviceHeaders(), ...(opts.headers || {}) } });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!r.ok) throw new Error(data.error || text || r.statusText);
  return data;
}

function adminAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const u = jwt.verify(token, JWT_SECRET);
    if (u.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.admin = u;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/admin/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.collection('users').findOne({ email: String(email || '').toLowerCase().trim() });
  if (!user || user.role !== 'admin' || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user._id.toString(), email: user.email, role: user.role } });
});

app.get('/admin/cases', adminAuth, async (_req, res) => {
  try {
    const rows = await fetchJson(`${APPLICANT_URL}/internal/applications`);
    res.json(rows);
  } catch (e) {
    res.status(502).json({ error: 'Applicant service unavailable', detail: e.message });
  }
});

app.get('/admin/cases/:id', adminAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const [application, risk] = await Promise.all([
      fetchJson(`${APPLICANT_URL}/internal/applications/${id}`),
      fetchJson(`${RISK_URL}/risk/result?applicationId=${id}`).catch(() => null),
    ]);
    res.json({ application, risk });
  } catch (e) {
    res.status(502).json({ error: 'Failed to assemble case', detail: e.message });
  }
});

app.patch('/admin/cases/:id/decision', adminAuth, async (req, res) => {
  const id = req.params.id;
  const { status, notes } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  const appRow = await db.collection('applications').findOne({ _id: new ObjectId(id) });
  if (!appRow) return res.status(404).json({ error: 'Application not found' });
  await db.collection('applications').updateOne({ _id: new ObjectId(id) }, { $set: { status, updated_at: new Date() } });
  await db.collection('risk_assessments').updateOne(
    { application_id: new ObjectId(id) },
    { $set: { underwriter_status: status, underwriter_notes: notes || '' } }
  );
  res.json({ ok: true });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Underwriter API on ${PORT}`));
