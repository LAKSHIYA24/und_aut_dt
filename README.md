# AutoUW Prototype

This repository is now cleaned to run the applicant portal, risk engine, and underwriter admin flow. The worker service and utility verification modules have been removed.

## Local setup

1. Install dependencies
   - `cd modules/applicant-portal/backend && npm install`
   - `cd modules/underwriter-dashboard/backend && npm install`
   - `cd modules/risk-engine && npm install`
   - `cd frontend && npm install`

2. Copy environment examples
   - `cp .env.example .env`
   - `cp modules/applicant-portal/backend/.env.example modules/applicant-portal/backend/.env`
   - `cp modules/underwriter-dashboard/backend/.env.example modules/underwriter-dashboard/backend/.env`
   - `cp modules/risk-engine/.env.example modules/risk-engine/.env`

3. Start services
   - `cd modules/applicant-portal/backend && npm run dev`
   - `cd modules/risk-engine && npm start`
   - `cd modules/underwriter-dashboard/backend && npm run dev`
   - `cd frontend && npm run dev`

4. Open the main prototype UI
   - Visit the Vite URL shown in the terminal for `frontend`.
   - The main page now shows only the underwriter admin dashboard.

## MongoDB preparation

A MongoDB connection scaffold is available, but the current service logic still uses SQLite for production-readiness and ease of migration.

- Install MongoDB locally.
- Set `MONGODB_URI` in `.env` to your local Mongo instance, e.g. `mongodb://127.0.0.1:27017/autodb`.
- Set `MONGODB_DB=autodb` if needed.

The shared helper file `shared/mongo.js` is added for future MongoDB integration.

## Cleanup work completed

- Removed `modules/worker-service/` and `modules/utility-verification/`
- Root prototype now only shows the underwriter admin dashboard
- Applicant portal and underwriter portal share the same internal API and service secrets
- Risk engine updated to evaluate using applicant data directly, without worker/utility dependencies
- Environment examples cleaned and simplified for local development
