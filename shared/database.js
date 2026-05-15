import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autodb';
const MONGODB_DB = process.env.MONGODB_DB || 'autodb';

let client;
let db;

export async function getDb() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB);
  await initSchema(db);
  await seedAdmin(db);
  return db;
}

async function initSchema(db) {
  // MongoDB collections are created automatically when first document is inserted
  // Ensure indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('applications').createIndex({ user_id: 1 });
  await db.collection('risk_assessments').createIndex({ application_id: 1 }, { unique: true });
}

async function seedAdmin(db) {
  const existing = await db.collection('users').findOne({ email: 'admin@autouw.gov' });
  if (existing) return;
  const hash = bcrypt.hashSync(process.env.ADMIN_SEED_PASSWORD || 'ChangeMe!Admin1', 10);
  await db.collection('users').insertOne({
    email: 'admin@autouw.gov',
    password_hash: hash,
    role: 'admin',
    created_at: new Date()
  });
}

export function assertService(req, res, next) {
  const key = req.headers['x-service-key'] || req.get('X-Service-Key');
  const expected = process.env.SERVICE_SECRET || 'dev-service-secret';
  if (key !== expected) return res.status(401).json({ error: 'Invalid service key' });
  next();
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
