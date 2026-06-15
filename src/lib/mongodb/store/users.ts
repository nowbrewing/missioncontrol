import type { ObjectId } from "mongodb";
import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { toSqlDatetime } from "../serialize";
import { COLLECTIONS, type MongoPillar, type MongoUser } from "../schemas";

export type UserRow = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

function toUserRow(doc: MongoUser): UserRow {
  return {
    id: doc.tursoId,
    email: doc.email,
    name: doc.name,
    created_at: toSqlDatetime(doc.createdAt),
  };
}

export function pillarToRow(p: MongoPillar, userId: number) {
  return {
    id: p.tursoId,
    user_id: userId,
    name: p.name,
    description: p.description,
    abbreviation: p.abbreviation,
    color: p.color,
    rank: p.rank,
    created_at: toSqlDatetime(p.createdAt),
  };
}

export async function findUserByEmail(email: string): Promise<(MongoUser & { _id: ObjectId }) | null> {
  const db = await getMongoDb();
  return db.collection<MongoUser>(COLLECTIONS.users).findOne({ email });
}

export async function findUserById(userId: number): Promise<(MongoUser & { _id: ObjectId }) | null> {
  const db = await getMongoDb();
  return db.collection<MongoUser>(COLLECTIONS.users).findOne({ tursoId: userId });
}

export async function findUserWithPassword(email: string) {
  const db = await getMongoDb();
  return db.collection<MongoUser>(COLLECTIONS.users).findOne({ email });
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<UserRow> {
  const db = await getMongoDb();
  const tursoId = await nextLegacyId("user");
  const doc: MongoUser = {
    tursoId,
    email,
    name,
    passwordHash,
    preferences: null,
    routineRules: null,
    pillars: [],
    createdAt: new Date(),
  };
  await db.collection<MongoUser>(COLLECTIONS.users).insertOne(doc);
  return toUserRow(doc);
}

export async function getUserPreferences(userId: number): Promise<string | null> {
  const user = await findUserById(userId);
  return user?.preferences ?? null;
}

export async function setUserPreferences(userId: number, preferences: string | null) {
  const db = await getMongoDb();
  await db.collection<MongoUser>(COLLECTIONS.users).updateOne(
    { tursoId: userId },
    { $set: { preferences } }
  );
}

export async function listPillars(userId: number) {
  const user = await findUserById(userId);
  if (!user) return [];
  return [...user.pillars]
    .sort((a, b) => a.rank - b.rank || a.tursoId - b.tursoId)
    .map((p) => pillarToRow(p, userId));
}

export async function userHasPillars(userId: number): Promise<boolean> {
  const user = await findUserById(userId);
  return (user?.pillars.length ?? 0) > 0;
}

export async function getMaxPillarRank(userId: number): Promise<number> {
  const user = await findUserById(userId);
  if (!user || user.pillars.length === 0) return -1;
  return Math.max(...user.pillars.map((p) => p.rank));
}

export async function insertPillar(
  userId: number,
  data: {
    name: string;
    description: string | null;
    abbreviation: string | null;
    color: string;
    rank: number;
  }
) {
  const db = await getMongoDb();
  const tursoId = await nextLegacyId("pillar");
  const pillar: MongoPillar = {
    tursoId,
    name: data.name,
    description: data.description,
    abbreviation: data.abbreviation,
    color: data.color,
    rank: data.rank,
    createdAt: new Date(),
  };
  const result = await db.collection<MongoUser>(COLLECTIONS.users).findOneAndUpdate(
    { tursoId: userId },
    { $push: { pillars: pillar } },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("User not found");
  return pillarToRow(pillar, userId);
}

export async function updatePillar(
  userId: number,
  pillarId: number,
  patch: Partial<Pick<MongoPillar, "name" | "description" | "abbreviation" | "color" | "rank">>
) {
  const db = await getMongoDb();
  const setFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) setFields[`pillars.$.${key}`] = value;
  }
  const result = await db.collection<MongoUser>(COLLECTIONS.users).findOneAndUpdate(
    { tursoId: userId, "pillars.tursoId": pillarId },
    { $set: setFields },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Pillar not found");
  const pillar = result.pillars.find((p) => p.tursoId === pillarId);
  if (!pillar) throw new Error("Pillar not found");
  return pillarToRow(pillar, userId);
}

export async function deletePillar(userId: number, pillarId: number) {
  const db = await getMongoDb();
  await db.collection<MongoUser>(COLLECTIONS.users).updateOne(
    { tursoId: userId },
    { $pull: { pillars: { tursoId: pillarId } } }
  );
}

export async function reorderPillars(userId: number, ids: number[]) {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  const byId = new Map(user.pillars.map((p) => [p.tursoId, p]));
  const reordered = ids.map((id, rank) => {
    const p = byId.get(id);
    if (!p) throw new Error(`Pillar ${id} not found`);
    return { ...p, rank };
  });
  const db = await getMongoDb();
  await db.collection<MongoUser>(COLLECTIONS.users).updateOne(
    { tursoId: userId },
    { $set: { pillars: reordered } }
  );
}

export { toUserRow };
