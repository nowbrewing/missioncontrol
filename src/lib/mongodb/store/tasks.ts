import type { ObjectId } from "mongodb";
import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { toDateOnly, toIso, toSqlDatetime } from "../serialize";
import { COLLECTIONS, type MongoTask, type TaskStatus } from "../schemas";
import { findUserById } from "./users";

function taskToRow(t: MongoTask) {
  return {
    id: t.tursoId,
    user_id: t.tursoUserId,
    title: t.title,
    description: t.description,
    note: t.note ?? null,
    deadline: toDateOnly(t.deadline),
    completed_at: toIso(t.completedAt),
    rank: t.rank,
    pillar_id: t.pillarId,
    milestone_id: t.milestoneId,
    schedule_type: t.scheduleType,
    window_start: t.windowStart,
    recurring_event_id: t.recurringEventId,
    recurring_week_monday: t.recurringWeekMonday,
    recurring_slot: t.recurringSlot,
    is_new: t.isNew ? 1 : 0,
    date_locked: t.dateLocked ? 1 : 0,
    created_at: toSqlDatetime(t.createdAt),
  };
}

export async function listTasks(userId: number) {
  const db = await getMongoDb();
  const tasks = await db
    .collection<MongoTask>(COLLECTIONS.tasks)
    .find({ tursoUserId: userId })
    .toArray();
  tasks.sort((a, b) => {
    const aDone = a.completedAt ? 1 : 0;
    const bDone = b.completedAt ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.tursoId - b.tursoId;
  });
  return tasks.map(taskToRow);
}

/** Day-specific routine cards (not weekly tally/counter) default to date-locked. */
function defaultDateLockedForRoutineTask(data: {
  recurringEventId?: number | null;
  recurringSlot?: string | null;
}): boolean {
  if (data.recurringEventId == null) return false;
  const slot = data.recurringSlot;
  if (!slot || slot === "tally" || slot === "counter") return false;
  return true;
}

export async function getMaxTaskRank(userId: number): Promise<number> {
  const db = await getMongoDb();
  const top = await db
    .collection<MongoTask>(COLLECTIONS.tasks)
    .find({ tursoUserId: userId })
    .sort({ rank: -1 })
    .limit(1)
    .toArray();
  return top[0]?.rank ?? -1;
}

export async function insertTask(
  userId: number,
  data: {
    title: string;
    description?: string | null;
    note?: string | null;
    deadline?: string | null;
    rank: number;
    pillarId?: number | null;
    milestoneId?: number | null;
    scheduleType?: string;
    windowStart?: string | null;
    recurringEventId?: number | null;
    recurringWeekMonday?: string | null;
    recurringSlot?: string | null;
    isNew?: boolean;
    dateLocked?: boolean;
  }
) {
  const user = await findUserById(userId);
  if (!user?._id) throw new Error("User not found");

  const db = await getMongoDb();
  const tursoId = await nextLegacyId("task");
  const doc: MongoTask = {
    tursoId,
    userId: user._id,
    tursoUserId: userId,
    title: data.title,
    description: data.description ?? null,
    note: data.note ?? null,
    deadline: data.deadline ? new Date(`${data.deadline}T12:00:00Z`) : null,
    rank: data.rank,
    pillarId: data.pillarId ?? null,
    milestoneId: data.milestoneId ?? null,
    scheduleType: data.scheduleType ?? "flexible",
    windowStart: data.windowStart ?? null,
    recurringEventId: data.recurringEventId ?? null,
    recurringWeekMonday: data.recurringWeekMonday ?? null,
    recurringSlot: data.recurringSlot ?? null,
    bucket: null,
    status: "pending",
    isNew: data.isNew ?? false,
    dateLocked:
      data.dateLocked !== undefined
        ? data.dateLocked
        : defaultDateLockedForRoutineTask(data),
    completedAt: null,
    createdAt: new Date(),
  };
  await db.collection<MongoTask>(COLLECTIONS.tasks).insertOne(doc);
  return taskToRow(doc);
}

export async function updateTask(
  userId: number,
  taskId: number,
  patch: Partial<{
    title: string;
    description: string | null;
    note: string | null;
    deadline: string | null;
    completedAt: string | null;
    rank: number;
    pillarId: number | null;
    milestoneId: number | null;
    scheduleType: string;
    windowStart: string | null;
    dateLocked: boolean;
    bucket: MongoTask["bucket"];
  }>
) {
  const db = await getMongoDb();
  const set: Partial<MongoTask> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.note !== undefined) set.note = patch.note;
  if (patch.rank !== undefined) set.rank = patch.rank;
  if (patch.pillarId !== undefined) set.pillarId = patch.pillarId;
  if (patch.milestoneId !== undefined) set.milestoneId = patch.milestoneId;
  if (patch.scheduleType !== undefined) set.scheduleType = patch.scheduleType;
  if (patch.windowStart !== undefined) set.windowStart = patch.windowStart;
  if (patch.dateLocked !== undefined) set.dateLocked = patch.dateLocked;
  if (patch.bucket !== undefined) set.bucket = patch.bucket;
  if (patch.deadline !== undefined) {
    set.deadline = patch.deadline ? new Date(`${patch.deadline}T12:00:00Z`) : null;
  }
  if (patch.completedAt !== undefined) {
    set.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
    set.status = (patch.completedAt ? "completed" : "pending") as TaskStatus;
  }

  const result = await db.collection<MongoTask>(COLLECTIONS.tasks).findOneAndUpdate(
    { tursoUserId: userId, tursoId: taskId },
    { $set: set },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Task not found");
  return taskToRow(result);
}

export async function deleteTask(userId: number, taskId: number) {
  const db = await getMongoDb();
  await db.collection<MongoTask>(COLLECTIONS.tasks).deleteOne({
    tursoUserId: userId,
    tursoId: taskId,
  });
}

export async function listTasksByRecurring(
  userId: number,
  eventId: number,
  weekMonday: string
) {
  const db = await getMongoDb();
  const tasks = await db
    .collection<MongoTask>(COLLECTIONS.tasks)
    .find({ tursoUserId: userId, recurringEventId: eventId, recurringWeekMonday: weekMonday })
    .toArray();
  return tasks.map(taskToRow);
}

export async function normalizeRecurringTaskSchedules(userId: number) {
  const db = await getMongoDb();
  await db.collection<MongoTask>(COLLECTIONS.tasks).updateMany(
    {
      tursoUserId: userId,
      recurringEventId: { $ne: null },
      completedAt: null,
      $or: [
        { recurringSlot: null },
        { recurringSlot: { $nin: ["counter", "tally"] } },
      ],
      scheduleType: { $ne: "fixed" },
    },
    { $set: { scheduleType: "fixed", windowStart: null } }
  );
}

export async function listTaskTitles(userId: number, taskIds: number[]) {
  const db = await getMongoDb();
  const tasks = await db
    .collection<MongoTask>(COLLECTIONS.tasks)
    .find({ tursoUserId: userId, tursoId: { $in: taskIds } })
    .toArray();
  return tasks.map((t) => ({ id: t.tursoId, title: t.title }));
}

export async function listCompletedTasksInRange(
  userId: number,
  since: string,
  before: string
) {
  const db = await getMongoDb();
  const sinceDate = new Date(`${since}T00:00:00Z`);
  const beforeDate = new Date(`${before}T00:00:00Z`);
  const tasks = await db
    .collection<MongoTask>(COLLECTIONS.tasks)
    .find({
      tursoUserId: userId,
      completedAt: { $gte: sinceDate, $lt: beforeDate },
    })
    .toArray();
  return tasks.map((t) => ({
    pillar_id: t.pillarId,
    completed_at: toIso(t.completedAt),
  }));
}

export { taskToRow };
