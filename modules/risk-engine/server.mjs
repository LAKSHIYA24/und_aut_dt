/**
 * Node mirror of the Flask risk API (app.py) for environments without Python on PATH.
 * Canonical reference implementation remains app.py (Flask) as specified for AutoUW.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5100);
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev-service-secret';
const DATABASE_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '..', '..', 'data', 'autouw.db');
const APPLICANT_URL = process.env.APPLICANT_SERVICE_URL || 'http://127.0.0.1:4100';
const WORKER_URL = process.env.WORKER_SERVICE_URL || 'http://127.0.0.1:4101';
const UTILITY_URL = process.env.UTILITY_SERVICE_URL || 'http://127.0.0.1:4103';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function svcHeaders() {
  return { 'X-Service-Key': SERVICE_SECRET };
}

async function fetchJson(url, params) {
  const u = new URL(url);
  if (params) {
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  }
  const r = await fetch(u, { headers: svcHeaders() });
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

function analyzePayload(appRow, workerRisk, utilityRow) {
  const monthly = Number(appRow.monthly_income) || 0;
  const sumAssured = Number(appRow.sum_assured) || 0;
  const existingLoans = Number(appRow.existing_loans) || 0;
  const health = !!appRow.health_declaration;
  const occ = String(appRow.occupation_risk || 'Medium').toLowerCase();
  const incomeType = String(appRow.income_type || 'stable').toLowerCase();

  const variance = Number(workerRisk.incomeVarianceScore) || 0;
  let dti = workerRisk.debtToIncome;
  dti = dti != null ? Number(dti) : monthly > 0 ? (existingLoans / monthly) * 100 : 0;

  const utilScore = utilityRow ? Number(utilityRow.consistency_score) || 60 : 55;
  const utilStatus = String(utilityRow?.status || 'pending').toLowerCase();

  let score = 100;
  const fraud = [];

  if (incomeType === 'gig') {
    score -= Math.min(25, variance * 0.25);
    if (variance > 70) fraud.push('High declared vs. UPI income variance');
  } else {
    if (monthly < 15000) {
      score -= 10;
      fraud.push('Declared monthly income below guidance threshold');
    }
  }

  if (dti > 50) {
    score -= 20;
    fraud.push('Debt-to-income elevated relative to declared income');
  } else if (dti > 35) score -= 10;

  if (health) {
    score -= 12;
    fraud.push('Health declaration increases underwriting exposure');
  }

  if (occ === 'high') score -= 15;
  else if (occ === 'medium') score -= 6;

  if (utilScore < 55 || utilStatus === 'flagged') {
    score -= 15;
    fraud.push('Utility verification weak or flagged');
  } else if (utilStatus === 'review') {
    score -= 6;
    fraud.push('Utility record requires manual corroboration');
  }

  if (workerRisk.healthFlag) score -= 5;

  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  let classification;
  let eligibility;
  if (score >= 78) {
    classification = 'APPROVED';
    eligibility = 'Eligible for standard terms';
  } else if (score >= 52) {
    classification = 'REFER';
    eligibility = 'Eligible with conditions / manual referral';
  } else {
    classification = 'REJECTED';
    eligibility = 'Not eligible under current program rules';
  }

  const cap = monthly > 0 ? monthly * 12 * 0.45 : 0;
  let principal = cap > 0 ? Math.min(sumAssured || cap, cap) : Math.min(sumAssured || 0, 250000);
  principal = Math.round(Math.max(0, principal) * 100) / 100;

  let recommendation;
  if (classification === 'APPROVED') recommendation = 'Issue policy with standard premium and verified principal limit.';
  else if (classification === 'REFER')
    recommendation = 'Refer to underwriter: request additional income proof or reduced coverage.';
  else recommendation = 'Decline or offer alternate micro-cover product after full manual review.';

  const parts = [
    `Composite risk score is ${score}/100.`,
    `Utility verification status is '${utilStatus}' with consistency ${Math.round(utilScore)}/100.`,
    `Income variance indicator is ${Math.round(variance)}/100.`,
  ];
  if (classification === 'APPROVED') parts.push('Strong alignment across income, utility, and obligation signals supports approval.');
  else if (classification === 'REFER') parts.push('Mixed signals require human judgment before final terms.');
  else parts.push('Multiple negative factors exceed automated acceptance threshold.');

  return {
    risk_score: score,
    eligibility,
    principal_amount: principal,
    recommendation,
    fraud_indicators: fraud,
    classification,
    explanation: parts.join(' '),
  };
}

function assertService(req, res, next) {
  if (req.headers['x-service-key'] !== SERVICE_SECRET) return res.status(401).json({ error: 'Invalid service key' });
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, engine: 'node' }));

app.post('/risk/evaluate', assertService, async (req, res) => {
  const applicationId = Number(req.body?.applicationId);
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' });
  let appRow;
  let workerRisk;
  try {
    appRow = await fetchJson(`${APPLICANT_URL}/internal/applications/${applicationId}`);
    workerRisk = await fetchJson(`${WORKER_URL}/worker/risk-data`, { applicationId });
  } catch (e) {
    return res.status(502).json({ error: 'Upstream worker/applicant unavailable', detail: e.message });
  }
  let utilityRow = null;
  try {
    utilityRow = await fetchJson(`${UTILITY_URL}/api/verification/${applicationId}`);
  } catch {
    utilityRow = { status: 'pending', consistency_score: 50, notes: 'Utility service unreachable' };
  }
  const result = analyzePayload(appRow, workerRisk, utilityRow);
  const db = new Database(DATABASE_PATH);
  db.prepare(
    `INSERT INTO risk_assessments (
      application_id, risk_score, eligibility, principal_amount, recommendation,
      fraud_indicators_json, classification, explanation
    ) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(application_id) DO UPDATE SET
      risk_score=excluded.risk_score,
      eligibility=excluded.eligibility,
      principal_amount=excluded.principal_amount,
      recommendation=excluded.recommendation,
      fraud_indicators_json=excluded.fraud_indicators_json,
      classification=excluded.classification,
      explanation=excluded.explanation,
      created_at=datetime('now')`
  ).run(
    applicationId,
    result.risk_score,
    result.eligibility,
    result.principal_amount,
    result.recommendation,
    JSON.stringify(result.fraud_indicators),
    result.classification,
    result.explanation
  );
  db.close();
  res.json({ ok: true, ...result });
});

app.get('/risk/result', assertService, (req, res) => {
  const applicationId = Number(req.query.applicationId);
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' });
  const db = new Database(DATABASE_PATH);
  const row = db.prepare(`SELECT * FROM risk_assessments WHERE application_id = ?`).get(applicationId);
  db.close();
  if (!row) return res.status(404).json({ error: 'No assessment' });
  const { fraud_indicators_json, ...rest } = row;
  res.json({ ...rest, fraud_indicators: JSON.parse(fraud_indicators_json) });
});

app.listen(PORT, () => console.log(`Risk engine (Node) on ${PORT}`));
