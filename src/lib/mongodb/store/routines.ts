import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { toSqlDatetime } from "../serialize";
import {
  COLLECTIONS,
  type MongoRoutine,
  type MongoRoutineProgress,
} from "../schemas";
import {
  emptyProgress,
  normalizeRecurringKind,
  parseDailyDays,
  parseProgress,
  serializeProgress,
  type RecurringKind,
  type RecurringProgress,
} from "../../recurring-week";
import { findUserById } from "./users";

function routineToRow(r: MongoRoutine) {
  return {
    id: r.tursoId,
    user_id: r.tursoUserId,
    title: r.title,
    kind: r.kind,
    target_count: r.targetFrequency,
    daily_days: JSON.stringify(r.dailyDays),
    tally_enabled: r.tallyEnabled ? 1 : 0,
    pillar_id: r.pillarId,
    milestone_id: r.milestoneId,
    spawn_task_cards: r.spawnTaskCards ? 1 : 0,
    active: r.active ? 1 : 0,
    rank: r.rank,
    rules: r.rules ?? null,
    created_at: toSqlDatetime(r.createdAt),
  };
}

export async function listActiveRoutines(userId: number) {
  const db = await getMongoDb();
  const rows = await db
    .collection<MongoRoutine>(COLLECTIONS.routines)
    .find({ tursoUserId: userId, active: true })
    .sort({ rank: 1, tursoId: 1 })
    .toArray();
  return rows;
}

export async function listAllRoutines(userId: number) {
  const db = await getMongoDb();
  const rows = await db
    .collection<MongoRoutine>(COLLECTIONS.routines)
    .find({ tursoUserId: userId })
    .sort({ rank: 1, tursoId: 1 })
    .toArray();
  return rows.map(routineToRow);
}

export async function getMaxRoutineRank(userId: number): Promise<number> {
  const db = await getMongoDb();
  const top = await db
    .collection<MongoRoutine>(COLLECTIONS.routines)
    .find({ tursoUserId: userId })
    .sort({ rank: -1 })
    .limit(1)
    .toArray();
  return top[0]?.rank ?? -1;
}

export async function insertRoutine(
  userId: number,
  data: {
    title: string;
    kind: RecurringKind;
    targetCount: number;
    dailyDays: boolean[];
    tallyEnabled: boolean;
    pillarId: number | null;
    milestoneId: number | null;
    spawnTaskCards: boolean;
    rank: number;
    rules?: string | null;
  }
) {
  const user = await findUserById(userId);
  if (!user?._id) throw new Error("User not found");

  const db = await getMongoDb();
  const tursoId = await nextLegacyId("routine");
  const doc: MongoRoutine = {
    tursoId,
    userId: user._id,
    tursoUserId: userId,
    title: data.title,
    kind: data.kind,
    targetFrequency: data.targetCount,
    dailyDays: data.dailyDays,
    tallyEnabled: data.tallyEnabled,
    pillarId: data.pillarId,
    milestoneId: data.milestoneId,
    spawnTaskCards: data.spawnTaskCards,
    active: true,
    rank: data.rank,
    rules: data.rules?.trim() || null,
    createdAt: new Date(),
  };
  await db.collection<MongoRoutine>(COLLECTIONS.routines).insertOne(doc);
  return routineToRow(doc);
}

export async function updateRoutine(
  userId: number,
  routineId: number,
  patch: Partial<{
    title: string;
    kind: RecurringKind;
    targetFrequency: number;
    dailyDays: boolean[];
    tallyEnabled: boolean;
    pillarId: number | null;
    milestoneId: number | null;
    spawnTaskCards: boolean;
    active: boolean;
    rank: number;
    rules: string | null;
  }>
) {
  const db = await getMongoDb();
  const result = await db.collection<MongoRoutine>(COLLECTIONS.routines).findOneAndUpdate(
    { tursoUserId: userId, tursoId: routineId },
    { $set: patch },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Routine not found");
  return routineToRow(result);
}

export async function reorderRoutines(userId: number, ids: number[]) {
  const db = await getMongoDb();
  for (let i = 0; i < ids.length; i++) {
    await db.collection<MongoRoutine>(COLLECTIONS.routines).updateOne(
      { tursoUserId: userId, tursoId: ids[i] },
      { $set: { rank: i } }
    );
  }
}

export async function deleteRoutine(userId: number, routineId: number) {
  const db = await getMongoDb();
  await db.collection<MongoRoutine>(COLLECTIONS.routines).deleteOne({
    tursoUserId: userId,
    tursoId: routineId,
  });
  await db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).deleteMany({
    tursoUserId: userId,
    routineId,
  });
}

export async function findRoutine(userId: number, routineId: number) {
  const db = await getMongoDb();
  return db.collection<MongoRoutine>(COLLECTIONS.routines).findOne({
    tursoUserId: userId,
    tursoId: routineId,
  });
}

export async function getOrCreateRoutineProgress(
  userId: number,
  routineId: number,
  weekMonday: string,
  kind: RecurringKind,
  targetCount: number,
  tallyEnabled: boolean
) {
  const db = await getMongoDb();
  let progress = await db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).findOne({
    tursoUserId: userId,
    routineId,
    weekMonday,
  });

  if (!progress) {
    const tursoId = await nextLegacyId("routine_progress");
    const now = new Date();
    const doc: MongoRoutineProgress = {
      tursoId,
      tursoUserId: userId,
      routineId,
      weekMonday,
      progress: emptyProgress(kind, targetCount, tallyEnabled),
      tasksSpawned: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).insertOne(doc);
    return {
      progress_id: tursoId,
      progress: doc.progress,
      tasks_spawned: false,
    };
  }

  return {
    progress_id: progress.tursoId,
    progress: parseProgress(
      JSON.stringify(progress.progress),
      kind,
      targetCount,
      tallyEnabled
    ),
    tasks_spawned: progress.tasksSpawned,
  };
}

export async function markRoutineTasksSpawned(
  userId: number,
  progressId: number
) {
  const db = await getMongoDb();
  await db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).updateOne(
    { tursoUserId: userId, tursoId: progressId },
    { $set: { tasksSpawned: true, updatedAt: new Date() } }
  );
}

export async function updateRoutineProgress(
  userId: number,
  progressId: number,
  progress: RecurringProgress
) {
  const db = await getMongoDb();
  await db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).updateOne(
    { tursoUserId: userId, tursoId: progressId },
    { $set: { progress, updatedAt: new Date() } }
  );
}

export async function findRoutineProgressById(userId: number, progressId: number) {
  const db = await getMongoDb();
  return db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).findOne({
    tursoUserId: userId,
    tursoId: progressId,
  });
}

export function parseRoutineRow(raw: Record<string, unknown>): MongoRoutine & { id: number } {
  const normalized = normalizeRecurringKind(
    String(raw.kind),
    raw.tally_enabled != null ? Number(raw.tally_enabled) : false
  );
  return {
    tursoId: Number(raw.id),
    userId: raw.userId as MongoRoutine["userId"],
    tursoUserId: Number(raw.user_id),
    title: String(raw.title),
    kind: normalized.kind,
    targetFrequency: Number(raw.target_count) || 0,
    dailyDays: parseDailyDays(raw.daily_days != null ? String(raw.daily_days) : null),
    tallyEnabled: normalized.tally_enabled,
    pillarId: raw.pillar_id != null ? Number(raw.pillar_id) : null,
    milestoneId: raw.milestone_id != null ? Number(raw.milestone_id) : null,
    spawnTaskCards: Number(raw.spawn_task_cards) === 1,
    active: Number(raw.active) === 1,
    rank: Number(raw.rank),
    rules: raw.rules != null ? String(raw.rules) : null,
    createdAt: new Date(String(raw.created_at)),
    id: Number(raw.id),
  };
}

export { routineToRow, serializeProgress };
