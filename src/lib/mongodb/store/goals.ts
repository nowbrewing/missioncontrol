import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { toDateOnly, toSqlDatetime } from "../serialize";
import { COLLECTIONS, type MongoGoal } from "../schemas";

function goalToRow(g: MongoGoal) {
  return {
    id: g.tursoId,
    user_id: g.tursoUserId,
    pillar_id: g.pillarId,
    title: g.title,
    target_date: g.targetDate,
    rank: g.rank,
    status: g.status,
    created_at: toSqlDatetime(g.createdAt),
  };
}

export async function listGoals(userId: number) {
  const db = await getMongoDb();
  const goals = await db
    .collection<MongoGoal>(COLLECTIONS.goals)
    .find({ tursoUserId: userId })
    .sort({ rank: 1, tursoId: 1 })
    .toArray();
  return goals.map(goalToRow);
}

export async function getMaxGoalRank(userId: number): Promise<number> {
  const db = await getMongoDb();
  const top = await db
    .collection<MongoGoal>(COLLECTIONS.goals)
    .find({ tursoUserId: userId })
    .sort({ rank: -1 })
    .limit(1)
    .toArray();
  return top[0]?.rank ?? -1;
}

export async function insertGoal(
  userId: number,
  data: { pillarId: number; title: string; targetDate: string | null; rank: number }
) {
  const db = await getMongoDb();
  const tursoId = await nextLegacyId("goal");
  const doc: MongoGoal = {
    tursoId,
    tursoUserId: userId,
    pillarId: data.pillarId,
    title: data.title,
    targetDate: data.targetDate,
    rank: data.rank,
    status: "active",
    createdAt: new Date(),
  };
  await db.collection<MongoGoal>(COLLECTIONS.goals).insertOne(doc);
  return goalToRow(doc);
}

export async function updateGoal(
  userId: number,
  goalId: number,
  patch: Partial<Pick<MongoGoal, "title" | "targetDate" | "status" | "pillarId" | "rank">>
) {
  const db = await getMongoDb();
  const result = await db.collection<MongoGoal>(COLLECTIONS.goals).findOneAndUpdate(
    { tursoUserId: userId, tursoId: goalId },
    { $set: patch },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Goal not found");
  return goalToRow(result);
}

export async function deleteGoal(userId: number, goalId: number) {
  const db = await getMongoDb();
  await db.collection<MongoGoal>(COLLECTIONS.goals).deleteOne({
    tursoUserId: userId,
    tursoId: goalId,
  });
}

export async function reorderGoals(userId: number, ids: number[]) {
  const db = await getMongoDb();
  for (let i = 0; i < ids.length; i++) {
    await db.collection<MongoGoal>(COLLECTIONS.goals).updateOne(
      { tursoUserId: userId, tursoId: ids[i] },
      { $set: { rank: i } }
    );
  }
}

export async function goalExists(userId: number, goalId: number): Promise<boolean> {
  const db = await getMongoDb();
  const n = await db.collection<MongoGoal>(COLLECTIONS.goals).countDocuments({
    tursoUserId: userId,
    tursoId: goalId,
  });
  return n > 0;
}

export { goalToRow, toDateOnly };
