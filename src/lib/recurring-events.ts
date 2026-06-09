import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";
import { addDaysIsoYyyyMmDd, todayIsoYyyyMmDd } from "./date";
import { resolvePillarAbbreviation } from "./pillar-abbreviation";
import { isRunTask } from "./workout-schedule";
import {
  dailyCheckDone,
  dailyTallyTotal,
  emptyProgress,
  normalizeRecurringKind,
  parseDailyDays,
  parseProgress,
  serializeDailyDays,
  serializeProgress,
  weekDatesFromMonday,
  weekMondayFor,
  type DailyCheckProgress,
  type DailyTallyProgress,
  type RecurringKind,
  type RecurringProgress,
} from "./recurring-week";

export type RecurringEventRow = {
  id: number;
  user_id: number;
  title: string;
  kind: RecurringKind;
  target_count: number;
  daily_days: string | null;
  tally_enabled: number;
  pillar_id: number | null;
  milestone_id: number | null;
  spawn_task_cards: number;
  active: number;
  rank: number;
  created_at: string;
};

export type RecurringWeekItem = {
  event_id: number;
  progress_id: number;
  title: string;
  kind: RecurringKind;
  target_count: number;
  daily_days: ReturnType<typeof parseDailyDays>;
  tally_enabled: boolean;
  pillar_id: number | null;
  milestone_id: number | null;
  pillar_name: string | null;
  pillar_color: string | null;
  pillar_abbreviation: string | null;
  milestone_title: string | null;
  spawn_task_cards: boolean;
  week_monday: string;
  week_dates: string[];
  progress: RecurringProgress;
  tasks_spawned: boolean;
};

function rowToEvent(row: Record<string, unknown>): RecurringEventRow {
  const normalized = normalizeRecurringKind(
    String(row.kind),
    row.tally_enabled != null ? Number(row.tally_enabled) : String(row.kind) === "counter"
  );
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: String(row.title),
    kind: normalized.kind,
    target_count: Number(row.target_count) || 0,
    daily_days: row.daily_days ? String(row.daily_days) : null,
    tally_enabled: normalized.tally_enabled ? 1 : 0,
    pillar_id: row.pillar_id != null ? Number(row.pillar_id) : null,
    milestone_id: row.milestone_id != null ? Number(row.milestone_id) : null,
    spawn_task_cards: Number(row.spawn_task_cards) ? 1 : 0,
    active: Number(row.active) ? 1 : 0,
    rank: Number(row.rank),
    created_at: String(row.created_at),
  };
}

function weekEnd(weekMonday: string): string {
  return addDaysIsoYyyyMmDd(weekMonday, 6);
}

function tallyTaskDescription(total: number, targetCount: number): string {
  if (targetCount > 0) return `${total} / ${targetCount} this week`;
  return `Week total: ${total}`;
}

async function spawnWeeklyTasks(
  turso: Client,
  userId: number,
  event: RecurringEventRow,
  weekMonday: string,
  progressId: number
) {
  const weekDates = weekDatesFromMonday(weekMonday);
  const dailyDays = parseDailyDays(event.daily_days);
  const end = weekEnd(weekMonday);
  const tally = !!event.tally_enabled;

  const maxRank = await turso.execute({
    sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM tasks WHERE user_id = ?;`,
    args: [userId],
  });
  let nextRank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

  if (event.kind === "daily" && tally) {
    await turso.execute({
      sql: `INSERT INTO tasks (user_id, title, description, deadline, rank, pillar_id, milestone_id, schedule_type, recurring_event_id, recurring_week_monday, recurring_slot)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'window', ?, ?, 'tally');`,
      args: [
        userId,
        event.title,
        tallyTaskDescription(0, event.target_count),
        end,
        nextRank++,
        event.pillar_id,
        event.milestone_id,
        event.id,
        weekMonday,
      ],
    });
  } else if (event.kind === "daily") {
    for (let i = 0; i < 7; i++) {
      if (!dailyDays[i]) continue;
      await turso.execute({
        sql: `INSERT INTO tasks (user_id, title, deadline, rank, pillar_id, milestone_id, schedule_type, recurring_event_id, recurring_week_monday, recurring_slot)
              VALUES (?, ?, ?, ?, ?, ?, 'fixed', ?, ?, ?);`,
        args: [
          userId,
          event.title,
          weekDates[i],
          nextRank++,
          event.pillar_id,
          event.milestone_id,
          event.id,
          weekMonday,
          weekDates[i],
        ],
      });
    }
  } else if (event.kind === "count") {
    const occupied = new Set<string>();
    for (let i = 0; i < event.target_count; i++) {
      let deadline = addDaysIsoYyyyMmDd(weekMonday, i);
      if (isRunTask(event.title)) {
        while (occupied.has(deadline) && deadline <= end) {
          deadline = addDaysIsoYyyyMmDd(deadline, 1);
        }
        occupied.add(deadline);
      } else {
        const step = Math.max(1, Math.floor(7 / event.target_count));
        deadline = addDaysIsoYyyyMmDd(weekMonday, Math.min(i * step, 6));
      }
      if (deadline > end) deadline = end;

      await turso.execute({
        sql: `INSERT INTO tasks (user_id, title, deadline, rank, pillar_id, milestone_id, schedule_type, recurring_event_id, recurring_week_monday, recurring_slot)
              VALUES (?, ?, ?, ?, ?, ?, 'fixed', ?, ?, ?);`,
        args: [
          userId,
          `${event.title} (${i + 1}/${event.target_count})`,
          deadline,
          nextRank++,
          event.pillar_id,
          event.milestone_id,
          event.id,
          weekMonday,
          String(i),
        ],
      });
    }
  }

  await turso.execute({
    sql: `UPDATE recurring_weekly_progress SET tasks_spawned = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?;`,
    args: [progressId, userId],
  });
}

async function normalizeRecurringTaskSchedules(turso: Client, userId: number) {
  await turso.execute({
    sql: `UPDATE tasks SET schedule_type = 'fixed', window_start = NULL
          WHERE user_id = ? AND recurring_event_id IS NOT NULL
          AND (recurring_slot IS NULL OR recurring_slot NOT IN ('counter', 'tally'))
          AND schedule_type != 'fixed'
          AND completed_at IS NULL;`,
    args: [userId],
  });
}

export async function ensureRecurringWeek(
  turso: Client,
  userId: number,
  today = todayIsoYyyyMmDd()
): Promise<{ week_monday: string; items: RecurringWeekItem[] }> {
  await ensureLifeSchema(turso);
  await normalizeRecurringTaskSchedules(turso, userId);
  const weekMonday = weekMondayFor(today);
  const weekDates = weekDatesFromMonday(weekMonday);

  const events = await turso.execute({
    sql: `SELECT id, user_id, title, kind, target_count, daily_days, tally_enabled, pillar_id, milestone_id, spawn_task_cards, active, rank, created_at
          FROM recurring_events WHERE user_id = ? AND active = 1 ORDER BY rank ASC, id ASC;`,
    args: [userId],
  });

  const [pillars, milestones] = await Promise.all([
    turso.execute({
      sql: `SELECT id, name, abbreviation, color FROM pillars WHERE user_id = ?;`,
      args: [userId],
    }),
    turso.execute({
      sql: `SELECT id, title FROM milestones WHERE user_id = ?;`,
      args: [userId],
    }),
  ]);

  const pillarById = new Map(
    (pillars.rows as Record<string, unknown>[]).map((p) => [Number(p.id), p])
  );
  const milestoneById = new Map(
    (milestones.rows as Record<string, unknown>[]).map((m) => [Number(m.id), m])
  );

  const items: RecurringWeekItem[] = [];

  for (const raw of events.rows as Record<string, unknown>[]) {
    const event = rowToEvent(raw);
    const tallyEnabled = !!event.tally_enabled;

    let progressRow = await turso.execute({
      sql: `SELECT id, progress, tasks_spawned FROM recurring_weekly_progress
            WHERE user_id = ? AND recurring_event_id = ? AND week_monday = ?;`,
      args: [userId, event.id, weekMonday],
    });

    if (progressRow.rows.length === 0) {
      const empty = serializeProgress(
        emptyProgress(event.kind, event.target_count, tallyEnabled)
      );
      await turso.execute({
        sql: `INSERT INTO recurring_weekly_progress (user_id, recurring_event_id, week_monday, progress)
              VALUES (?, ?, ?, ?);`,
        args: [userId, event.id, weekMonday, empty],
      });
      progressRow = await turso.execute({
        sql: `SELECT id, progress, tasks_spawned FROM recurring_weekly_progress
              WHERE user_id = ? AND recurring_event_id = ? AND week_monday = ?;`,
        args: [userId, event.id, weekMonday],
      });
    }

    const pr = progressRow.rows[0] as Record<string, unknown>;
    const progressId = Number(pr.id);
    const tasksSpawned = Number(pr.tasks_spawned) === 1;

    if (event.spawn_task_cards && !tasksSpawned) {
      await spawnWeeklyTasks(turso, userId, event, weekMonday, progressId);
    }

    const pillar = event.pillar_id ? pillarById.get(event.pillar_id) : null;
    const milestone = event.milestone_id ? milestoneById.get(event.milestone_id) : null;

    items.push({
      event_id: event.id,
      progress_id: progressId,
      title: event.title,
      kind: event.kind,
      target_count: event.target_count,
      daily_days: parseDailyDays(event.daily_days),
      tally_enabled: tallyEnabled,
      pillar_id: event.pillar_id,
      milestone_id: event.milestone_id,
      pillar_name: pillar ? String(pillar.name) : null,
      pillar_color: pillar ? String(pillar.color) : null,
      pillar_abbreviation: pillar
        ? resolvePillarAbbreviation(
            String(pillar.name),
            pillar.abbreviation as string | null | undefined
          )
        : null,
      milestone_title: milestone ? String(milestone.title) : null,
      spawn_task_cards: !!event.spawn_task_cards,
      week_monday: weekMonday,
      week_dates: weekDates,
      progress: parseProgress(
        String(pr.progress),
        event.kind,
        event.target_count,
        tallyEnabled
      ),
      tasks_spawned: event.spawn_task_cards ? true : tasksSpawned,
    });
  }

  return { week_monday: weekMonday, items };
}

export async function updateRecurringProgress(
  turso: Client,
  userId: number,
  progressId: number,
  progress: RecurringProgress,
  kind: RecurringKind,
  targetCount: number,
  eventId: number,
  weekMonday: string,
  spawnTaskCards: boolean,
  tallyEnabled = false
) {
  await ensureLifeSchema(turso);

  const serialized = serializeProgress(progress);
  await turso.execute({
    sql: `UPDATE recurring_weekly_progress SET progress = ?, updated_at = datetime('now')
          WHERE id = ? AND user_id = ?;`,
    args: [serialized, progressId, userId],
  });

  if (!spawnTaskCards) return;

  const tasks = await turso.execute({
    sql: `SELECT id, recurring_slot FROM tasks
          WHERE user_id = ? AND recurring_event_id = ? AND recurring_week_monday = ?;`,
    args: [userId, eventId, weekMonday],
  });

  const taskRows = tasks.rows as Record<string, unknown>[];

  if (kind === "daily" && tallyEnabled && "values" in progress) {
    const total = dailyTallyTotal(progress);
    const done = targetCount > 0 ? total >= targetCount : false;
    for (const row of taskRows) {
      await turso.execute({
        sql: `UPDATE tasks SET description = ?, completed_at = ? WHERE id = ? AND user_id = ?;`,
        args: [
          tallyTaskDescription(total, targetCount),
          done ? new Date().toISOString() : null,
          Number(row.id),
          userId,
        ],
      });
    }
  } else if (kind === "daily" && "days" in progress) {
    for (const row of taskRows) {
      const slot = String(row.recurring_slot);
      const done = !!progress.days[slot];
      await turso.execute({
        sql: `UPDATE tasks SET completed_at = ? WHERE id = ? AND user_id = ?;`,
        args: [done ? new Date().toISOString() : null, Number(row.id), userId],
      });
    }
  } else if (kind === "count" && "slots" in progress) {
    for (const row of taskRows) {
      const idx = Number(row.recurring_slot);
      const done = !!progress.slots[idx];
      await turso.execute({
        sql: `UPDATE tasks SET completed_at = ? WHERE id = ? AND user_id = ?;`,
        args: [done ? new Date().toISOString() : null, Number(row.id), userId],
      });
    }
  }
}
