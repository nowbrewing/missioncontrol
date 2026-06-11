import { getMongoDb } from "./client";
import { COLLECTIONS } from "./schemas";

const COUNTERS_ID = "app";

export type CounterKey =
  | "user"
  | "session"
  | "pillar"
  | "goal"
  | "milestone"
  | "task"
  | "routine"
  | "routine_progress"
  | "daily_log_entry";

type CounterDoc = { _id: string } & Partial<Record<CounterKey, number>>;

export async function nextLegacyId(key: CounterKey): Promise<number> {
  const db = await getMongoDb();
  const result = await db.collection<CounterDoc>(COLLECTIONS.counters).findOneAndUpdate(
    { _id: COUNTERS_ID },
    { $inc: { [key]: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const value = result?.[key];
  if (typeof value !== "number") {
    throw new Error(`Failed to allocate legacy id for ${key}`);
  }
  return value;
}

export async function seedCountersFromMax(values: Partial<Record<CounterKey, number>>) {
  const db = await getMongoDb();
  const inc: Record<string, number> = {};
  for (const [key, max] of Object.entries(values)) {
    if (max != null && max > 0) inc[key] = max;
  }
  if (Object.keys(inc).length === 0) return;
  await db.collection<CounterDoc>(COLLECTIONS.counters).updateOne(
    { _id: COUNTERS_ID },
    { $max: inc },
    { upsert: true }
  );
}
