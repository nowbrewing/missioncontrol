import type { Client } from "@libsql/client";
import type { ObjectId } from "mongodb";
import { ensureLifeSchema } from "../src/db/life";
import { ensureUsersSchema } from "../src/db/users";
import { parseMissionLayout } from "../src/lib/mission-layout";
import {
  normalizeRecurringKind,
  parseDailyDays,
  parseProgress,
} from "../src/lib/recurring-week";
import { buildTaskBucketMap } from "../src/lib/mongodb/bucket-from-layout";
import { getMongoDb } from "../src/lib/mongodb/client";
import { seedCountersFromMax, type CounterKey } from "../src/lib/mongodb/ids";
import { ensureMongoIndexes } from "../src/lib/mongodb/indexes";
import {
  COLLECTIONS,
  type MongoDailyLog,
  type MongoDailyLogEntry,
  type MongoGoal,
  type MongoMilestone,
  type MongoRoutine,
  type MongoRoutineProgress,
  type MongoSession,
  type MongoTask,
  type MongoUser,
} from "../src/lib/mongodb/schemas";

export type SyncResult = {
  users: number;
  sessions: number;
  goals: number;
  milestones: number;
  tasks: number;
  routines: number;
  routine_progress: number;
  daily_logs: number;
  daily_log_entries: number;
};

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadLatestBucketMap(
  turso: Client,
  userId: number
): Promise<Map<number, import("./schemas").TaskBucket>> {
  const result = await turso.execute({
    sql: `SELECT mission_layout FROM daily_logs
          WHERE user_id = ? AND mission_layout IS NOT NULL
          ORDER BY log_date DESC LIMIT 1;`,
    args: [userId],
  });
  const raw = result.rows[0]?.mission_layout;
  return buildTaskBucketMap(raw != null ? String(raw) : null);
}

export async function syncTursoToMongo(turso: Client): Promise<SyncResult> {
  await ensureUsersSchema(turso);
  await ensureLifeSchema(turso);

  const db = await getMongoDb();
  await ensureMongoIndexes(db);

  const maxIds: Partial<Record<CounterKey, number>> = {};

  let userCount = 0;
  let sessionCount = 0;
  let goalCount = 0;
  let milestoneCount = 0;
  let taskCount = 0;
  let routineCount = 0;
  let progressCount = 0;
  let dailyLogCount = 0;
  let entryCount = 0;

  const usersResult = await turso.execute({
    sql: `SELECT id, email, name, password_hash, preferences, created_at FROM users ORDER BY id;`,
  });

  for (const row of usersResult.rows as Record<string, unknown>[]) {
    const tursoUserId = Number(row.id);
    maxIds.user = Math.max(maxIds.user ?? 0, tursoUserId);

    const pillarsResult = await turso.execute({
      sql: `SELECT id, name, description, color, abbreviation, rank, created_at
            FROM pillars WHERE user_id = ? ORDER BY rank, id;`,
      args: [tursoUserId],
    });

    for (const p of pillarsResult.rows as Record<string, unknown>[]) {
      maxIds.pillar = Math.max(maxIds.pillar ?? 0, Number(p.id));
    }

    const doc: MongoUser = {
      tursoId: tursoUserId,
      email: String(row.email),
      name: String(row.name),
      passwordHash: String(row.password_hash),
      preferences:
        row.preferences != null && String(row.preferences).length > 0
          ? String(row.preferences)
          : null,
      pillars: (pillarsResult.rows as Record<string, unknown>[]).map((p) => ({
        tursoId: Number(p.id),
        name: String(p.name),
        description: p.description != null ? String(p.description) : null,
        color: String(p.color ?? "#FF6F61"),
        abbreviation: p.abbreviation != null ? String(p.abbreviation) : null,
        rank: Number(p.rank) || 0,
        createdAt: toDate(String(p.created_at)) ?? new Date(),
      })),
      createdAt: toDate(String(row.created_at)) ?? new Date(),
    };

    const upserted = await db.collection<MongoUser>(COLLECTIONS.users).findOneAndUpdate(
      { tursoId: tursoUserId },
      { $set: doc },
      { upsert: true, returnDocument: "after" }
    );

    const mongoUserId = upserted?._id as ObjectId | undefined;
    if (!mongoUserId) throw new Error(`Failed to upsert user tursoId=${tursoUserId}`);
    userCount += 1;

    const sessionsResult = await turso.execute({
      sql: `SELECT id, token, expires_at, created_at FROM sessions WHERE user_id = ?;`,
      args: [tursoUserId],
    });
    for (const s of sessionsResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(s.id);
      maxIds.session = Math.max(maxIds.session ?? 0, tursoId);
      const session: MongoSession = {
        tursoId,
        userId: mongoUserId,
        tursoUserId,
        token: String(s.token),
        expiresAt: toDate(String(s.expires_at)) ?? new Date(),
        createdAt: toDate(String(s.created_at)) ?? new Date(),
      };
      await db.collection<MongoSession>(COLLECTIONS.sessions).updateOne(
        { tursoId },
        { $set: session },
        { upsert: true }
      );
      sessionCount += 1;
    }

    const goalsResult = await turso.execute({
      sql: `SELECT id, pillar_id, title, target_date, rank, status, created_at
            FROM goals WHERE user_id = ? ORDER BY rank, id;`,
      args: [tursoUserId],
    });
    for (const g of goalsResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(g.id);
      maxIds.goal = Math.max(maxIds.goal ?? 0, tursoId);
      const goal: MongoGoal = {
        tursoId,
        tursoUserId,
        pillarId: Number(g.pillar_id),
        title: String(g.title),
        targetDate: g.target_date != null ? String(g.target_date) : null,
        rank: Number(g.rank) || 0,
        status: String(g.status ?? "active"),
        createdAt: toDate(String(g.created_at)) ?? new Date(),
      };
      await db.collection<MongoGoal>(COLLECTIONS.goals).updateOne(
        { tursoUserId, tursoId },
        { $set: goal },
        { upsert: true }
      );
      goalCount += 1;
    }

    const bucketMap = await loadLatestBucketMap(turso, tursoUserId);

    const milestonesResult = await turso.execute({
      sql: `SELECT id, goal_id, pillar_id, title, target_date, rank, completed_at, created_at
            FROM milestones WHERE user_id = ? ORDER BY rank, id;`,
      args: [tursoUserId],
    });
    for (const m of milestonesResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(m.id);
      maxIds.milestone = Math.max(maxIds.milestone ?? 0, tursoId);
      const completedAt = toDate(m.completed_at != null ? String(m.completed_at) : null);
      const milestone: MongoMilestone = {
        tursoId,
        userId: mongoUserId,
        tursoUserId,
        pillarId: m.pillar_id != null ? Number(m.pillar_id) : null,
        goalId: m.goal_id != null ? Number(m.goal_id) : null,
        title: String(m.title),
        deadline: toDate(m.target_date != null ? String(m.target_date) : null),
        rank: Number(m.rank) || 0,
        status: completedAt ? "completed" : "in_progress",
        completedAt,
        createdAt: toDate(String(m.created_at)) ?? new Date(),
      };
      await db.collection<MongoMilestone>(COLLECTIONS.milestones).updateOne(
        { tursoUserId, tursoId },
        { $set: milestone },
        { upsert: true }
      );
      milestoneCount += 1;
    }

    const tasksResult = await turso.execute({
      sql: `SELECT id, title, description, deadline, completed_at, rank, pillar_id,
                   milestone_id, schedule_type, window_start, recurring_event_id,
                   recurring_week_monday, recurring_slot, created_at
            FROM tasks WHERE user_id = ? ORDER BY rank, id;`,
      args: [tursoUserId],
    });
    for (const t of tasksResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(t.id);
      maxIds.task = Math.max(maxIds.task ?? 0, tursoId);
      const completedAt = toDate(t.completed_at != null ? String(t.completed_at) : null);
      const task: MongoTask = {
        tursoId,
        userId: mongoUserId,
        tursoUserId,
        pillarId: t.pillar_id != null ? Number(t.pillar_id) : null,
        milestoneId: t.milestone_id != null ? Number(t.milestone_id) : null,
        title: String(t.title),
        description: t.description != null ? String(t.description) : null,
        deadline: toDate(t.deadline != null ? String(t.deadline) : null),
        bucket: bucketMap.get(tursoId) ?? null,
        status: completedAt ? "completed" : "pending",
        rank: Number(t.rank) || 0,
        scheduleType: String(t.schedule_type ?? "flexible"),
        windowStart: t.window_start != null ? String(t.window_start) : null,
        recurringEventId: t.recurring_event_id != null ? Number(t.recurring_event_id) : null,
        recurringWeekMonday:
          t.recurring_week_monday != null ? String(t.recurring_week_monday) : null,
        recurringSlot: t.recurring_slot != null ? String(t.recurring_slot) : null,
        isNew: false,
        completedAt,
        createdAt: toDate(String(t.created_at)) ?? new Date(),
      };
      await db.collection<MongoTask>(COLLECTIONS.tasks).updateOne(
        { tursoUserId, tursoId },
        { $set: task },
        { upsert: true }
      );
      taskCount += 1;
    }

    const routinesResult = await turso.execute({
      sql: `SELECT id, title, kind, target_count, daily_days, tally_enabled,
                   pillar_id, milestone_id, spawn_task_cards, active, rank, created_at
            FROM recurring_events WHERE user_id = ? ORDER BY rank, id;`,
      args: [tursoUserId],
    });
    for (const r of routinesResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(r.id);
      maxIds.routine = Math.max(maxIds.routine ?? 0, tursoId);
      const normalized = normalizeRecurringKind(
        String(r.kind),
        r.tally_enabled != null ? Number(r.tally_enabled) : false
      );
      const routine: MongoRoutine = {
        tursoId,
        userId: mongoUserId,
        tursoUserId,
        pillarId: r.pillar_id != null ? Number(r.pillar_id) : null,
        milestoneId: r.milestone_id != null ? Number(r.milestone_id) : null,
        title: String(r.title),
        kind: normalized.kind,
        targetFrequency: Number(r.target_count) || 0,
        dailyDays: [...parseDailyDays(r.daily_days != null ? String(r.daily_days) : null)],
        tallyEnabled: normalized.tally_enabled,
        spawnTaskCards: Number(r.spawn_task_cards) === 1,
        active: Number(r.active) === 1,
        rank: Number(r.rank) || 0,
        createdAt: toDate(String(r.created_at)) ?? new Date(),
      };
      await db.collection<MongoRoutine>(COLLECTIONS.routines).updateOne(
        { tursoUserId, tursoId },
        { $set: routine },
        { upsert: true }
      );
      routineCount += 1;
    }

    const progressResult = await turso.execute({
      sql: `SELECT id, recurring_event_id, week_monday, progress, tasks_spawned, created_at, updated_at
            FROM recurring_weekly_progress WHERE user_id = ?;`,
      args: [tursoUserId],
    });
    for (const pr of progressResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(pr.id);
      maxIds.routine_progress = Math.max(maxIds.routine_progress ?? 0, tursoId);
      const routineId = Number(pr.recurring_event_id);
      const routine = await db.collection<MongoRoutine>(COLLECTIONS.routines).findOne({
        tursoUserId,
        tursoId: routineId,
      });
      const kind = routine?.kind ?? "daily";
      const target = routine?.targetFrequency ?? 1;
      const tally = routine?.tallyEnabled ?? false;
      const progressDoc: MongoRoutineProgress = {
        tursoId,
        tursoUserId,
        routineId,
        weekMonday: String(pr.week_monday),
        progress: parseProgress(String(pr.progress), kind, target, tally),
        tasksSpawned: Number(pr.tasks_spawned) === 1,
        createdAt: toDate(String(pr.created_at)) ?? new Date(),
        updatedAt: toDate(String(pr.updated_at)) ?? new Date(),
      };
      await db.collection<MongoRoutineProgress>(COLLECTIONS.routine_progress).updateOne(
        { tursoUserId, tursoId },
        { $set: progressDoc },
        { upsert: true }
      );
      progressCount += 1;
    }

    const dailyLogsResult = await turso.execute({
      sql: `SELECT log_date, went_well, went_poorly, daily_focus, mission_layout, created_at, updated_at
            FROM daily_logs WHERE user_id = ?;`,
      args: [tursoUserId],
    });
    for (const dl of dailyLogsResult.rows as Record<string, unknown>[]) {
      const logDate = String(dl.log_date);
      const layoutRaw = dl.mission_layout != null ? String(dl.mission_layout) : null;
      const dailyLog: MongoDailyLog = {
        tursoUserId,
        logDate,
        wentWell: dl.went_well != null ? String(dl.went_well) : null,
        wentPoorly: dl.went_poorly != null ? String(dl.went_poorly) : null,
        dailyFocus: dl.daily_focus != null ? String(dl.daily_focus) : null,
        missionLayout: layoutRaw ? parseMissionLayout(layoutRaw) : null,
        createdAt: toDate(String(dl.created_at)) ?? new Date(),
        updatedAt: toDate(String(dl.updated_at)) ?? new Date(),
      };
      await db.collection<MongoDailyLog>(COLLECTIONS.daily_logs).updateOne(
        { tursoUserId, logDate },
        { $set: dailyLog },
        { upsert: true }
      );
      dailyLogCount += 1;
    }

    const entriesResult = await turso.execute({
      sql: `SELECT id, log_date, kind, content, created_at
            FROM daily_log_entries WHERE user_id = ? ORDER BY id;`,
      args: [tursoUserId],
    });
    for (const e of entriesResult.rows as Record<string, unknown>[]) {
      const tursoId = Number(e.id);
      maxIds.daily_log_entry = Math.max(maxIds.daily_log_entry ?? 0, tursoId);
      const entry: MongoDailyLogEntry = {
        tursoId,
        tursoUserId,
        logDate: String(e.log_date),
        kind: String(e.kind) as MongoDailyLogEntry["kind"],
        content: String(e.content),
        createdAt: toDate(String(e.created_at)) ?? new Date(),
      };
      await db.collection<MongoDailyLogEntry>(COLLECTIONS.daily_log_entries).updateOne(
        { tursoUserId, tursoId },
        { $set: entry },
        { upsert: true }
      );
      entryCount += 1;
    }
  }

  await seedCountersFromMax(maxIds);

  return {
    users: userCount,
    sessions: sessionCount,
    goals: goalCount,
    milestones: milestoneCount,
    tasks: taskCount,
    routines: routineCount,
    routine_progress: progressCount,
    daily_logs: dailyLogCount,
    daily_log_entries: entryCount,
  };
}
