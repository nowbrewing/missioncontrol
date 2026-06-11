import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const MONGO_CLIENT_OPTIONS: MongoClientOptions = {
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  maxIdleTimeMS: 10_000,
  family: 4,
};

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it in Vercel → Project → Settings → Environment Variables (Production)."
    );
  }
  return uri;
}

function wrapMongoConnectError(error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("SSL") ||
    msg.includes("tlsv1 alert internal error") ||
    msg.includes("alert number 80")
  ) {
    return new Error(
      "MongoDB TLS failed. Local works but Vercel fails when Atlas Network Access blocks cloud IPs. In MongoDB Atlas → Network Access, add 0.0.0.0/0 (Allow access from anywhere), wait 2 minutes, then redeploy."
    );
  }
  return error instanceof Error ? error : new Error(msg);
}

async function getMongoClient() {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(getMongoUri(), MONGO_CLIENT_OPTIONS);
    globalForMongo._mongoClientPromise = client.connect().catch((error) => {
      globalForMongo._mongoClientPromise = undefined;
      throw wrapMongoConnectError(error);
    });
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
