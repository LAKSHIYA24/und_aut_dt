import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../../../shared/database.js';

const PORT = Number(process.env.PORT || 4102);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-jwt-secret-min-32-chars-long!!';
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev-service-secret';

const APPLICANT_URL = process.env.APPLICANT_SERVICE_URL || 'http://127.0.0.1:4100';
const WORKER_URL = process.env.WORKER_SERVICE_URL || 'http://127.0.0.1:4101';
const UTILITY_URL = process.env.UTILITY_SERVICE_URL || 'http://127.0.0.1:4103';
const RISK_URL = process.env.RISK_ENGINE_URL || 'http://127.0.0.1:5100';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const db = getDb();

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

app.post('/admin/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare(`SELECT id, email, role, password_hash FROM users WHERE email = ?`).get(
    String(email || '').toLowerCase().trim()
  );
  if (!user || user.role !== 'admin' || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
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
  const id = Number(req.params.id);
  try {
    const [application, profile, earnings, activity, riskWorker, utility, risk] = await Promise.all([
      fetchJson(`${APPLICANT_URL}/internal/applications/${id}`),
      fetchJson(`${WORKER_URL}/worker/profile?applicationId=${id}`).catch(() => null),
      fetchJson(`${WORKER_URL}/worker/earnings?applicationId=${id}`).catch(() => null),
      fetchJson(`${WORKER_URL}/worker/activity?applicationId=${id}`).catch(() => null),
      fetchJson(`${WORKER_URL}/worker/risk-data?applicationId=${id}`).catch(() => null),
      fetchJson(`${UTILITY_URL}/api/verification/${id}`).catch(() => null),
      fetchJson(`${RISK_URL}/risk/result?applicationId=${id}`).catch(() => null),
    ]);
    res.json({ application, worker: { profile, earnings, activity, riskData: riskWorker }, utility, risk });
  } catch (e) {
    res.status(502).json({ error: 'Failed to assemble case', detail: e.message });
  }
});

app.patch('/admin/cases/:id/decision', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  const appRow = db.prepare(`SELECT id FROM applications WHERE id = ?`).get(id);
  if (!appRow) return res.status(404).json({ error: 'Application not found' });
  db.prepare(`UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
  db.prepare(
    `UPDATE risk_assessments SET underwriter_status = ?, underwriter_notes = ? WHERE application_id = ?`
  ).run(status, notes || '', id);
  res.json({ ok: true });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Underwriter API on ${PORT}`));
