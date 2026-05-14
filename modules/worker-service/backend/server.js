import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { getDb, assertService } from '../../../shared/database.js';

const PORT = Number(process.env.PORT || 4101);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-jwt-secret-min-32-chars-long!!';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const db = getDb();

function parseBearer(req) {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

function loadUserFromToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function canAccessApplication(user, applicationId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const row = db.prepare(`SELECT user_id FROM applications WHERE id = ?`).get(applicationId);
  return row && Number(row.user_id) === Number(user.sub);
}

function authApplication(req, res, next) {
  const applicationId = Number(req.query.applicationId);
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' });
  const user = loadUserFromToken(parseBearer(req));
  const service = req.headers['x-service-key'] === (process.env.SERVICE_SECRET || 'dev-service-secret');
  if (!service && !canAccessApplication(user, applicationId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.applicationId = applicationId;
  next();
}

app.post('/worker/ingest', assertService, (req, res) => {
  const applicationId = Number(req.body?.applicationId);
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' });
  const appRow = db.prepare(`SELECT a.*, u.email FROM applications a JOIN users u ON u.id = a.user_id WHERE a.id = ?`).get(applicationId);
  if (!appRow) return res.status(404).json({ error: 'Application not found' });
  const gpay = db.prepare(`SELECT * FROM gpay_history WHERE application_id = ?`).get(applicationId);
  const income = db.prepare(`SELECT * FROM income_details WHERE application_id = ?`).get(applicationId);
  const docRows = db.prepare(`SELECT doc_type FROM documents WHERE application_id = ?`).all(applicationId);
  const docTypes = new Set(docRows.map((d) => d.doc_type));

  const baseIncome = Number(appRow.monthly_income) || 0;
  const gpayEst = gpay ? Number(gpay.monthly_estimate) || 0 : 0;
  const annualDeclared = income ? Number(income.annual_income) || 0 : 0;
  const monthlyFromAnnual = annualDeclared / 12;

  const volatility =
    baseIncome > 0 ? Math.min(100, (Math.abs(gpayEst - baseIncome) / baseIncome) * 100) : gpayEst > 0 ? 60 : 20;

  const profile = {
    workerId: `WRK-${applicationId}`,
    applicantEmail: appRow.email,
    incomeType: appRow.income_type || 'unknown',
    declaredMonthlyIncome: baseIncome,
    gpayMonthlyEstimate: gpayEst,
    employer: income?.employer_name || null,
    jobTitle: income?.job_title || null,
    annualIncomeDeclared: annualDeclared,
    monthlyImpliedFromAnnual: Math.round(monthlyFromAnnual * 100) / 100,
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const earnings = months.map((m, i) => {
    const jitter = 0.85 + ((applicationId + i * 7) % 20) / 100;
    const amt = Math.round((gpayEst || baseIncome || 15000) * jitter);
    return { month: m, amount: amt, platformShare: Math.round(amt * 0.12) };
  });

  const activity = {
    deliveriesLast30d: 120 + (applicationId % 40),
    hoursOnline: 160 + (applicationId % 30),
    peakHoursShare: Math.min(95, 35 + volatility * 0.4),
    cancellationRate: Math.min(15, 2 + volatility * 0.08),
    rating: Math.max(3.5, 5 - volatility / 80),
  };

  const riskData = {
    incomeVarianceScore: Math.round(volatility),
    documentCoverage: ['utility', 'gpay', 'income'].every((t) => docTypes.has(t)),
    debtToIncome:
      baseIncome > 0 ? Math.round((Number(appRow.existing_loans) / baseIncome) * 1000) / 10 : null,
    healthFlag: !!appRow.health_declaration,
    occupationRisk: appRow.occupation_risk || 'Medium',
    gigNightExposure: appRow.income_type === 'gig' ? Math.min(100, 20 + volatility * 0.5) : 5,
  };

  const payload = {
    profile_json: JSON.stringify(profile),
    earnings_json: JSON.stringify(earnings),
    activity_json: JSON.stringify(activity),
    risk_data_json: JSON.stringify(riskData),
  };
  db.prepare(
    `INSERT INTO worker_snapshots (application_id, profile_json, earnings_json, activity_json, risk_data_json, updated_at)
     VALUES (@application_id, @profile_json, @earnings_json, @activity_json, @risk_data_json, datetime('now'))
     ON CONFLICT(application_id) DO UPDATE SET
       profile_json = excluded.profile_json,
       earnings_json = excluded.earnings_json,
       activity_json = excluded.activity_json,
       risk_data_json = excluded.risk_data_json,
       updated_at = datetime('now')`
  ).run({ application_id: applicationId, ...payload });

  res.json({ ok: true });
});

function snapshotOr404(applicationId) {
  return db.prepare(`SELECT * FROM worker_snapshots WHERE application_id = ?`).get(applicationId);
}

app.get('/worker/profile', authApplication, (req, res) => {
  const snap = snapshotOr404(req.applicationId);
  if (!snap) return res.status(404).json({ error: 'No worker snapshot; run ingest' });
  res.json(JSON.parse(snap.profile_json));
});

app.get('/worker/earnings', authApplication, (req, res) => {
  const snap = snapshotOr404(req.applicationId);
  if (!snap) return res.status(404).json({ error: 'No worker snapshot; run ingest' });
  res.json(JSON.parse(snap.earnings_json));
});

app.get('/worker/activity', authApplication, (req, res) => {
  const snap = snapshotOr404(req.applicationId);
  if (!snap) return res.status(404).json({ error: 'No worker snapshot; run ingest' });
  res.json(JSON.parse(snap.activity_json));
});

app.get('/worker/risk-data', authApplication, (req, res) => {
  const snap = snapshotOr404(req.applicationId);
  if (!snap) return res.status(404).json({ error: 'No worker snapshot; run ingest' });
  res.json(JSON.parse(snap.risk_data_json));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Worker API on ${PORT}`));
