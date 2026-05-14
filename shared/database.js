import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getDbPath() {
  const fromEnv = process.env.DATABASE_PATH;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(__dirname, '..', 'data', 'autouw.db');
}

let _db;

export function getDb() {
  if (_db) return _db;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  seedAdmin(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'applicant',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      coverage_type TEXT,
      sum_assured REAL,
      tenure_months INTEGER,
      monthly_income REAL,
      income_type TEXT,
      health_declaration INTEGER DEFAULT 0,
      existing_loans REAL DEFAULT 0,
      occupation_risk TEXT,
      address_line TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      original_name TEXT,
      stored_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
    CREATE TABLE IF NOT EXISTS income_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE,
      employer_name TEXT,
      job_title TEXT,
      annual_income REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
    CREATE TABLE IF NOT EXISTS gpay_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE,
      raw_text TEXT,
      monthly_estimate REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
    CREATE TABLE IF NOT EXISTS utility_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      consistency_score REAL,
      extracted_address TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
    CREATE TABLE IF NOT EXISTS worker_snapshots (
      application_id INTEGER PRIMARY KEY,
      profile_json TEXT NOT NULL,
      earnings_json TEXT NOT NULL,
      activity_json TEXT NOT NULL,
      risk_data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE,
      risk_score REAL NOT NULL,
      eligibility TEXT NOT NULL,
      principal_amount REAL NOT NULL,
      recommendation TEXT NOT NULL,
      fraud_indicators_json TEXT NOT NULL,
      classification TEXT NOT NULL,
      explanation TEXT NOT NULL,
      underwriter_status TEXT,
      underwriter_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );
    CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
  `);
}

function seedAdmin(db) {
  const row = db.prepare(`SELECT id FROM users WHERE email = ?`).get('admin@autouw.gov');
  if (row) return;
  const hash = bcrypt.hashSync(process.env.ADMIN_SEED_PASSWORD || 'ChangeMe!Admin1', 10);
  db.prepare(`INSERT INTO users (email, password_hash, role) VALUES (?,?, 'admin')`).run(
    'admin@autouw.gov',
    hash
  );
}

export function assertService(req, res, next) {
  const key = req.headers['x-service-key'] || req.get('X-Service-Key');
  const expected = process.env.SERVICE_SECRET || 'dev-service-secret';
  if (key !== expected) return res.status(401).json({ error: 'Invalid service key' });
  next();
}
