import type { ObjectId } from "mongodb";
import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { toDateOnly, toIso, toSqlDatetime } from "../serialize";
import { COLLECTIONS, type MongoMilestone } from "../schemas";
import { findUserById } from "./users";

function milestoneToRow(m: MongoMilestone) {
  return {
    id: m.tursoId,
    user_id: m.tursoUserId,
    goal_id: m.goalId,
    pillar_id: m.pillarId,
    title: m.title,
    target_date: toDateOnly(m.deadline),
    rank: m.rank,
    completed_at: toIso(m.completedAt),
    created_at: toSqlDatetime(m.createdAt),
  };
}

export async function listMilestones(userId: number) {
  const db = await getMongoDb();
  const rows = await db
    .collection<MongoMilestone>(COLLECTIONS.milestones)
    .find({ tursoUserId: userId })
    .sort({ rank: 1, tursoId: 1 })
    .toArray();
  return rows.map(milestoneToRow);
}

export async function getMaxMilestoneRank(userId: number): Promise<number> {
  const db = await getMongoDb();
  const top = await db
    .collection<MongoMilestone>(COLLECTIONS.milestones)
    .find({ tursoUserId: userId })
    .sort({ rank: -1 })
    .limit(1)
    .toArray();
  return top[0]?.rank ?? -1;
}

export async function insertMilestone(
  userId: number,
  data: {
    goalId: number | null;
    pillarId: number | null;
    title: string;
    targetDate: string | null;
    rank: number;
  }
) {
  const user = await findUserById(userId);
  if (!user?._id) throw new Error("User not found");

  const db = await getMongoDb();
  const tursoId = await nextLegacyId("milestone");
  const doc: MongoMilestone = {
    tursoId,
    userId: user._id,
    tursoUserId: userId,
    goalId: data.goalId,
    pillarId: data.pillarId,
    title: data.title,
    deadline: data.targetDate ? new Date(`${data.targetDate}T12:00:00Z`) : null,
    rank: data.rank,
    status: "in_progress",
    completedAt: null,
    createdAt: new Date(),
  };
  await db.collection<MongoMilestone>(COLLECTIONS.milestones).insertOne(doc);
  return milestoneToRow(doc);
}

export async function updateMilestone(
  userId: number,
  milestoneId: number,
  patch: {
    title?: string;
    targetDate?: string | null;
    pillarId?: number | null;
    goalId?: number | null;
    rank?: number;
    completedAt?: string | null;
  }
) {
  const db = await getMongoDb();
  const set: Partial<MongoMilestone> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.rank !== undefined) set.rank = patch.rank;
  if (patch.pillarId !== undefined) set.pillarId = patch.pillarId;
  if (patch.goalId !== undefined) set.goalId = patch.goalId;
  if (patch.targetDate !== undefined) {
    set.deadline = patch.targetDate ? new Date(`${patch.targetDate}T12:00:00Z`) : null;
  }
  if (patch.completedAt !== undefined) {
    set.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
    set.status = patch.completedAt ? "completed" : "in_progress";
  }

  const result = await db.collection<MongoMilestone>(COLLECTIONS.milestones).findOneAndUpdate(
    { tursoUserId: userId, tursoId: milestoneId },
    { $set: set },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Milestone not found");
  return milestoneToRow(result);
}

export async function deleteMilestone(userId: number, milestoneId: number) {
  const db = await getMongoDb();
  await db.collection<MongoMilestone>(COLLECTIONS.milestones).deleteOne({
    tursoUserId: userId,
    tursoId: milestoneId,
  });
}

export async function reorderMilestones(userId: number, ids: number[]) {
  const db = await getMongoDb();
  for (let i = 0; i < ids.length; i++) {
    await db.collection<MongoMilestone>(COLLECTIONS.milestones).updateOne(
      { tursoUserId: userId, tursoId: ids[i] },
      { $set: { rank: i } }
    );
  }
}

export { milestoneToRow };
