import { getMongoDb } from "./client";
import { ensureMongoIndexes } from "./indexes";

export async function ensureMongoReady() {
  const db = await getMongoDb();
  await ensureMongoIndexes(db);
}
