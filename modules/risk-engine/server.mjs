/**
 * Node mirror of the Flask risk API (app.py) for environments without Python on PATH.
 * Canonical reference implementation remains app.py (Flask) as specified for AutoUW.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDb } from '../../shared/database.js';
import { ObjectId } from 'mongodb';

const PORT = Number(process.env.PORT || 5100);
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev-service-secret';
const APPLICANT_URL = process.env.APPLICANT_SERVICE_URL || 'http://127.0.0.1:4100';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

let db;

(async () => {
  db = await getDb();
})();

function svcHeaders() {
  return { 'X-Service-Key': SERVICE_SECRET };
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: svcHeaders() });
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

function analyzePayload(appRow) {
  const monthly = Number(appRow.monthly_income) || 0;
  const sumAssured = Number(appRow.sum_assured) || 0;
  const existingLoans = Number(appRow.existing_loans) || 0;
  const health = !!appRow.health_declaration;
  const occ = String(appRow.occupation_risk || 'medium').toLowerCase();
  const incomeType = String(appRow.income_type || 'stable').toLowerCase();
  const gpay = appRow.gpay_history || {};
  const incomeDetails = appRow.income_details || {};
  const gpayEstimate = Number(gpay.monthly_estimate) || monthly;
  const declaredIncome = Number(incomeDetails.annual_income) || monthly * 12;

  const variance = monthly > 0 ? Math.min(100, Math.round((Math.abs(gpayEstimate - monthly) / Math.max(monthly, 1)) * 100)) : 40;
  const dti = monthly > 0 ? (existingLoans / monthly) * 100 : 0;
  const utilityDocs = Array.isArray(appRow.documents) && appRow.documents.some((d) => d.doc_type === 'utility');
  const utilScore = utilityDocs ? 78 : 50;
  const utilStatus = utilityDocs ? 'verified' : 'pending';

  let score = 100;
  const fraud = [];

  if (incomeType === 'gig') {
    score -= Math.min(25, variance * 0.25);
    if (variance > 70) fraud.push('High declared income variance from GPay estimate');
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

  if (gpayEstimate && monthly > 0 && Math.abs(gpayEstimate - monthly) / Math.max(monthly, 1) > 0.5) {
    score -= 10;
    fraud.push('GPay estimate differs significantly from declared income');
  }

  if (utilScore < 55 || utilStatus === 'flagged') {
    score -= 15;
    fraud.push('Utility verification weak or flagged');
  } else if (utilStatus === 'pending') {
    score -= 6;
    fraud.push('Utility document pending verification');
  }

  if (declaredIncome > 0 && declaredIncome / 12 < monthly * 0.8) {
    score -= 5;
    fraud.push('Form income is not aligned with declared monthly income');
  }

  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  let classification;
  let eligibility;

  if (score >= 78) {
    classification = 'APPROVED';
    eligibility = 'Eligible for standard terms';
  } else if (score >= 52) {
    classification = 'REFER FOR REVIEW';
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
  else if (classification === 'REFER FOR REVIEW') recommendation = 'Refer to underwriter: request additional income proof or reduced coverage.';
  else recommendation = 'Decline or offer alternate micro-cover product after full manual review.';

  const parts = [
    `Composite risk score is ${score}/100.`,
    `Utility verification status is '${utilStatus}' with consistency ${Math.round(utilScore)}/100.`,
    `GPay consistency variance is ${Math.round(variance)}/100.`,
  ];

  if (classification === 'APPROVED') parts.push('Strong alignment across income, utility, and obligation signals supports approval.');
  else if (classification === 'REFER FOR REVIEW') parts.push('Mixed signals require human judgment before final terms.');
  else parts.push('Multiple negative factors exceed automated acceptance threshold.');

  return {
    risk_score: score,
    eligibility,
    principal_amount: principal,
    recommendation,
    fraud_indicators: fraud,
    classification,
    explanation: parts.join(' '),
    utility_status: utilStatus,
    utility_consistency: utilScore,
  };
}

function assertService(req, res, next) {
  if (req.headers['x-service-key'] !== SERVICE_SECRET) return res.status(401).json({ error: 'Invalid service key' });
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, engine: 'node' }));

app.post('/risk/evaluate', assertService, async (req, res) => {
  const applicationId = req.body?.applicationId;
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

  let appRow;
  try {
    appRow = await fetchJson(`${APPLICANT_URL}/internal/applications/${applicationId}`);
  } catch (e) {
    return res.status(502).json({ error: 'Applicant service unavailable', detail: e.message });
  }

  const result = analyzePayload(appRow);
  await db.collection('risk_assessments').updateOne(
    { application_id: new ObjectId(applicationId) },
    {
      $set: {
        application_id: new ObjectId(applicationId),
        risk_score: result.risk_score,
        eligibility: result.eligibility,
        principal_amount: result.principal_amount,
        recommendation: result.recommendation,
        fraud_indicators_json: JSON.stringify(result.fraud_indicators),
        classification: result.classification,
        explanation: result.explanation,
        created_at: new Date()
      }
    },
    { upsert: true }
  );
  res.json({ ok: true, ...result });
});

app.get('/risk/result', assertService, async (req, res) => {
  const applicationId = req.query.applicationId;
  if (!applicationId) return res.status(400).json({ error: 'applicationId required' });
  const row = await db.collection('risk_assessments').findOne({ application_id: new ObjectId(applicationId) });
  if (!row) return res.status(404).json({ error: 'No assessment' });
  const { fraud_indicators_json, ...rest } = row;
  rest.id = rest._id.toString();
  delete rest._id;
  res.json({ ...rest, fraud_indicators: JSON.parse(fraud_indicators_json) });
});

app.listen(PORT, () => console.log(`Risk engine (Node) on ${PORT}`));
