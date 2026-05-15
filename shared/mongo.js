import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'autodb';
let client;

export async function getMongoClient() {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  if (client) return client;
  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  return client;
}

export async function getMongoDb() {
  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

export async function closeMongoClient() {
  if (client) {
    await client.close();
    client = null;
  }
}
