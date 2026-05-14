"""Flask risk API (canonical). For hosts without Python on PATH, use `npm start` in this folder to run `server.mjs` (same routes)."""
import json
import os
import sqlite3
from pathlib import Path

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

SERVICE_SECRET = os.environ.get("SERVICE_SECRET", "dev-service-secret")
DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    str(Path(__file__).resolve().parents[2] / "data" / "autouw.db"),
)
APPLICANT_URL = os.environ.get("APPLICANT_SERVICE_URL", "http://127.0.0.1:4100")
WORKER_URL = os.environ.get("WORKER_SERVICE_URL", "http://127.0.0.1:4101")
UTILITY_URL = os.environ.get("UTILITY_SERVICE_URL", "http://127.0.0.1:4103")


def headers():
    return {"X-Service-Key": SERVICE_SECRET}


def fetch_json(url, params=None):
    r = requests.get(url, params=params, headers=headers(), timeout=15)
    r.raise_for_status()
    return r.json()


def analyze_payload(app_row, worker_risk, utility_row):
    monthly = float(app_row.get("monthly_income") or 0)
    sum_assured = float(app_row.get("sum_assured") or 0)
    existing_loans = float(app_row.get("existing_loans") or 0)
    health = bool(app_row.get("health_declaration"))
    occ = (app_row.get("occupation_risk") or "Medium").lower()
    income_type = (app_row.get("income_type") or "stable").lower()

    variance = float(worker_risk.get("incomeVarianceScore") or 0)
    dti = worker_risk.get("debtToIncome")
    dti = float(dti) if dti is not None else (existing_loans / monthly * 100 if monthly > 0 else 0)

    util_score = float(utility_row.get("consistency_score") or 60) if utility_row else 55
    util_status = (utility_row.get("status") or "pending").lower()

    score = 100.0
    fraud = []

    if income_type == "gig":
        score -= min(25, variance * 0.25)
        if variance > 70:
            fraud.append("High declared vs. UPI income variance")
    else:
        if monthly < 15000:
            score -= 10
            fraud.append("Declared monthly income below guidance threshold")

    if dti > 50:
        score -= 20
        fraud.append("Debt-to-income elevated relative to declared income")
    elif dti > 35:
        score -= 10

    if health:
        score -= 12
        fraud.append("Health declaration increases underwriting exposure")

    if occ == "high":
        score -= 15
    elif occ == "medium":
        score -= 6

    if util_score < 55 or util_status == "flagged":
        score -= 15
        fraud.append("Utility verification weak or flagged")
    elif util_status == "review":
        score -= 6
        fraud.append("Utility record requires manual corroboration")

    if worker_risk.get("healthFlag"):
        score -= 5

    score = max(0, min(100, round(score, 1)))

    if score >= 78:
        classification = "APPROVED"
        eligibility = "Eligible for standard terms"
    elif score >= 52:
        classification = "REFER"
        eligibility = "Eligible with conditions / manual referral"
    else:
        classification = "REJECTED"
        eligibility = "Not eligible under current program rules"

    cap = monthly * 12 * 0.45 if monthly > 0 else 0
    principal = min(sum_assured or cap, cap) if cap > 0 else min(sum_assured or 0, 250000)
    principal = round(max(0, principal), 2)

    if classification == "APPROVED":
        recommendation = "Issue policy with standard premium and verified principal limit."
    elif classification == "REFER":
        recommendation = "Refer to underwriter: request additional income proof or reduced coverage."
    else:
        recommendation = "Decline or offer alternate micro-cover product after full manual review."

    parts = [
        f"Composite risk score is {score}/100.",
        f"Utility verification status is '{util_status}' with consistency {util_score:.0f}/100.",
        f"Income variance indicator is {variance:.0f}/100.",
    ]
    if classification == "APPROVED":
        parts.append("Strong alignment across income, utility, and obligation signals supports approval.")
    elif classification == "REFER":
        parts.append("Mixed signals require human judgment before final terms.")
    else:
        parts.append("Multiple negative factors exceed automated acceptance threshold.")

    explanation = " ".join(parts)

    return {
        "risk_score": score,
        "eligibility": eligibility,
        "principal_amount": principal,
        "recommendation": recommendation,
        "fraud_indicators": fraud,
        "classification": classification,
        "explanation": explanation,
    }


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/risk/evaluate")
def evaluate():
    if request.headers.get("X-Service-Key") != SERVICE_SECRET:
        return jsonify({"error": "Invalid service key"}), 401
    body = request.get_json(silent=True) or {}
    app_id = int(body.get("applicationId") or 0)
    if not app_id:
        return jsonify({"error": "applicationId required"}), 400

    try:
        app_row = fetch_json(f"{APPLICANT_URL}/internal/applications/{app_id}")
        worker_risk = fetch_json(f"{WORKER_URL}/worker/risk-data", params={"applicationId": app_id})
    except requests.RequestException as e:
        return jsonify({"error": "Upstream worker/applicant unavailable", "detail": str(e)}), 502

    utility_row = None
    try:
        utility_row = fetch_json(f"{UTILITY_URL}/api/verification/{app_id}")
    except requests.RequestException:
        utility_row = {"status": "pending", "consistency_score": 50, "notes": "Utility service unreachable"}

    result = analyze_payload(app_row, worker_risk, utility_row)

    conn = sqlite3.connect(DATABASE_PATH)
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO risk_assessments (
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
            created_at=datetime('now')
        """,
        (
            app_id,
            result["risk_score"],
            result["eligibility"],
            result["principal_amount"],
            result["recommendation"],
            json.dumps(result["fraud_indicators"]),
            result["classification"],
            result["explanation"],
        ),
    )
    conn.commit()
    conn.close()

    return jsonify({"ok": True, **result})


@app.get("/risk/result")
def risk_result():
    if request.headers.get("X-Service-Key") != SERVICE_SECRET:
        return jsonify({"error": "Invalid service key"}), 401
    app_id = int(request.args.get("applicationId") or 0)
    if not app_id:
        return jsonify({"error": "applicationId required"}), 400
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM risk_assessments WHERE application_id = ?", (app_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "No assessment"}), 404
    d = dict(row)
    d["fraud_indicators"] = json.loads(d.pop("fraud_indicators_json"))
    return jsonify(d)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5100)))
