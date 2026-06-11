import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  return uri;
}

async function getMongoClient() {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(getMongoUri());
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

function getMongoDbName() {
  const fromEnv = process.env.MONGODB_DB_NAME?.trim();
  if (fromEnv) return fromEnv;

  const uri = getMongoUri();
  const path = new URL(uri.replace("mongodb+srv://", "https://")).pathname;
  const name = path.replace(/^\//, "").split("/")[0];
  return name || "missioncontrol";
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}
