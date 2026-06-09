import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../../db/life";
import { ensureUsersSchema } from "../../db/users";
import { todayIsoYyyyMmDd } from "../date";
import {
  buildDailyLogAggregate,
  combineEntryText,
  formatEntriesForPrompt,
  groupEntriesByKind,
  listRecentDailyLogEntries,
} from "../daily-log-entries";
import { formatPillarContextForPrompt } from "../pillar-context";
import { formatUserPreferencesForPrompt } from "../user-preferences";

export async function getUserContext(turso: Client, userId: number) {
  await ensureLifeSchema(turso);
  await ensureUsersSchema(turso);
  const today = todayIsoYyyyMmDd();

  const [pillars, goals, milestones, todayAggregate, tasks, recentEntryDays, userRow] =
    await Promise.all([
      turso.execute({
        sql: `SELECT id, name, description, color, rank FROM pillars WHERE user_id = ? ORDER BY rank;`,
        args: [userId],
      }),
      turso.execute({
        sql: `SELECT id, pillar_id, title, target_date, rank, status FROM goals WHERE user_id = ? ORDER BY rank;`,
        args: [userId],
      }),
      turso.execute({
        sql: `SELECT id, goal_id, pillar_id, title, target_date, rank, completed_at FROM milestones WHERE user_id = ? ORDER BY rank;`,
        args: [userId],
      }),
      buildDailyLogAggregate(turso, userId, today),
      turso.execute({
        sql: `SELECT id, title, description, deadline, completed_at, rank, pillar_id, milestone_id, schedule_type, window_start, created_at
            FROM tasks WHERE user_id = ?
            ORDER BY completed_at IS NOT NULL, rank;`,
        args: [userId],
      }),
      listRecentDailyLogEntries(turso, userId, today, 7),
      turso.execute({
        sql: `SELECT preferences FROM users WHERE id = ?;`,
        args: [userId],
      }),
    ]);

  const pillarRows = (pillars.rows as Record<string, unknown>[]).map((p) => ({
    ...p,
    description: formatPillarContextForPrompt(p.description as string) ?? p.description,
  }));

  const preferencesRaw = (userRow.rows[0] as Record<string, unknown> | undefined)
    ?.preferences as string | null | undefined;

  const todayLog = {
    log_date: today,
    went_well: todayAggregate.aggregate.went_well || null,
    went_poorly: todayAggregate.aggregate.went_poorly || null,
    daily_focus: todayAggregate.aggregate.daily_focus || null,
    entries: todayAggregate.entries,
  };

  const recentLogs = recentEntryDays.map(({ log_date, entries }) => {
    const byKind = groupEntriesByKind(entries);
    return {
      log_date,
      went_well: combineEntryText(byKind.went_well) || null,
      went_poorly: combineEntryText(byKind.went_poorly) || null,
      daily_focus: combineEntryText(byKind.daily_focus) || null,
      went_well_detail: formatEntriesForPrompt(byKind.went_well),
      went_poorly_detail: formatEntriesForPrompt(byKind.went_poorly),
      daily_focus_detail: formatEntriesForPrompt(byKind.daily_focus),
    };
  });

  return {
    today,
    pillars: pillarRows,
    goals: goals.rows,
    milestones: milestones.rows,
    todayLog,
    tasks: tasks.rows,
    recentLogs,
    preferences: formatUserPreferencesForPrompt(preferencesRaw) ?? null,
    preferences_raw: preferencesRaw ?? null,
  };
}

export function formatUserContextForPrompt(ctx: Awaited<ReturnType<typeof getUserContext>>) {
  return JSON.stringify(ctx, null, 2);
}
