import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";
import { addDaysIsoYyyyMmDd } from "./date";
import {
  boardItemKey,
  parseMissionLayout,
  type MissionLayoutRef,
} from "./mission-layout";

export type TaskStreakInfo = {
  days_in_priorities: number;
  mentioned_in_checkin: boolean;
};

export async function getRecentMissionLayoutDates(
  turso: Client,
  userId: number,
  beforeDate: string,
  limitDays = 7
): Promise<string[]> {
  await ensureLifeSchema(turso);
  const result = await turso.execute({
    sql: `SELECT log_date FROM daily_logs
          WHERE user_id = ? AND log_date < ? AND mission_layout IS NOT NULL
          ORDER BY log_date DESC
          LIMIT ?;`,
    args: [userId, beforeDate, limitDays],
  });
  return (result.rows as Record<string, unknown>[]).map((r) => String(r.log_date));
}

export async function computeTaskPriorityStreaks(
  turso: Client,
  userId: number,
  planDate: string,
  openTaskIds: number[]
): Promise<Map<number, TaskStreakInfo>> {
  const streaks = new Map<number, TaskStreakInfo>();
  if (openTaskIds.length === 0) return streaks;

  const dates = await getRecentMissionLayoutDates(turso, userId, planDate, 14);
  const layoutByDate = new Map<string, MissionLayoutRef[]>();

  for (const date of dates) {
    const row = await turso.execute({
      sql: `SELECT mission_layout FROM daily_logs WHERE user_id = ? AND log_date = ? LIMIT 1;`,
      args: [userId, date],
    });
    const layout = parseMissionLayout(
      (row.rows[0] as Record<string, unknown> | undefined)?.mission_layout as string | undefined
    );
    if (layout) layoutByDate.set(date, layout.today);
  }

  for (const taskId of openTaskIds) {
    let days = 0;
    let cursor = addDaysIsoYyyyMmDd(planDate, -1);
    const checked = new Set<string>();

    while (checked.size < 14) {
      const key = boardItemKey("task", taskId);
      const todayRefs = layoutByDate.get(cursor);
      if (!todayRefs) break;
      if (!todayRefs.some((r) => r.kind === "task" && r.id === taskId)) break;
      days++;
      checked.add(cursor);
      cursor = addDaysIsoYyyyMmDd(cursor, -1);
    }

    streaks.set(taskId, { days_in_priorities: days, mentioned_in_checkin: false });
  }

  const [mentionRows, titleRows] = await Promise.all([
    turso.execute({
      sql: `SELECT content FROM daily_log_entries
            WHERE user_id = ? AND log_date >= ? AND log_date < ?
              AND kind IN ('went_poorly', 'daily_focus');`,
      args: [userId, addDaysIsoYyyyMmDd(planDate, -7), planDate],
    }),
    openTaskIds.length > 0
      ? turso.execute({
          sql: `SELECT id, title FROM tasks WHERE user_id = ? AND id IN (${openTaskIds.map(() => "?").join(",")});`,
          args: [userId, ...openTaskIds],
        })
      : Promise.resolve({ rows: [] }),
  ]);

  const recentText = (mentionRows.rows as Record<string, unknown>[])
    .map((r) => String(r.content).toLowerCase())
    .join("\n");

  for (const row of titleRows.rows as Record<string, unknown>[]) {
    const taskId = Number(row.id);
    const info = streaks.get(taskId);
    if (!info) continue;
    const title = String(row.title || "").toLowerCase();
    if (title.length >= 4 && recentText.includes(title.slice(0, Math.min(title.length, 20)))) {
      info.mentioned_in_checkin = true;
    }
  }

  return streaks;
}

export async function computePillarMovement(
  turso: Client,
  userId: number,
  planDate: string,
  lookbackDays = 3
): Promise<Map<number, { completed: number; last_completion: string | null }>> {
  await ensureLifeSchema(turso);
  const since = addDaysIsoYyyyMmDd(planDate, -lookbackDays);

  const result = await turso.execute({
    sql: `SELECT pillar_id, completed_at FROM tasks
          WHERE user_id = ? AND completed_at IS NOT NULL
            AND date(completed_at) >= ? AND date(completed_at) < ?;`,
    args: [userId, since, planDate],
  });

  const movement = new Map<number, { completed: number; last_completion: string | null }>();
  for (const row of result.rows as Record<string, unknown>[]) {
    const pillarId = row.pillar_id != null ? Number(row.pillar_id) : null;
    if (pillarId == null) continue;
    const completedAt = String(row.completed_at);
    const prev = movement.get(pillarId) ?? { completed: 0, last_completion: null };
    prev.completed++;
    if (!prev.last_completion || completedAt > prev.last_completion) {
      prev.last_completion = completedAt;
    }
    movement.set(pillarId, prev);
  }
  return movement;
}
