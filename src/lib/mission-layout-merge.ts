import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";
import { normalizeScheduleType } from "./task-schedule";
import { taskBelongsInTodayPriorities } from "./task-schedule";
import {
  boardItemKey,
  parseMissionLayout,
  type MissionLayout,
} from "./mission-layout";

export async function appendCreatedTasksToMissionLayout(
  turso: Client,
  userId: number,
  todayIso: string,
  createdTasks: {
    id: number;
    title?: string | null;
    deadline?: string | null;
    schedule_type?: string | null;
    window_start?: string | null;
  }[]
) {
  if (createdTasks.length === 0) return;

  await ensureLifeSchema(turso);

  const row = await turso.execute({
    sql: `SELECT mission_layout FROM daily_logs WHERE user_id = ? AND log_date = ? LIMIT 1;`,
    args: [userId, todayIso],
  });

  const layout: MissionLayout = parseMissionLayout(
    (row.rows[0] as Record<string, unknown> | undefined)?.mission_layout as string | undefined
  ) ?? { today: [], coming_up: [] };

  const todayKeys = new Set(layout.today.map((r) => boardItemKey(r.kind, r.id)));
  const comingKeys = new Set(layout.coming_up.map((r) => boardItemKey(r.kind, r.id)));

  for (const task of createdTasks) {
    const key = boardItemKey("task", Number(task.id));
    if (todayKeys.has(key) || comingKeys.has(key)) continue;

    const ref = { kind: "task" as const, id: Number(task.id) };
    const schedule = {
      title: task.title ? String(task.title) : null,
      deadline: task.deadline ? String(task.deadline) : null,
      schedule_type: task.schedule_type
        ? normalizeScheduleType(String(task.schedule_type))
        : "flexible",
      window_start: task.window_start ? String(task.window_start) : null,
    };

    if (taskBelongsInTodayPriorities(schedule, todayIso)) {
      layout.today.push(ref);
      todayKeys.add(key);
    } else {
      layout.coming_up.push(ref);
      comingKeys.add(key);
    }
  }

  await turso.execute({
    sql: `INSERT INTO daily_logs (user_id, log_date, mission_layout, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, log_date) DO UPDATE SET
            mission_layout = excluded.mission_layout,
            updated_at = datetime('now');`,
    args: [userId, todayIso, JSON.stringify(layout)],
  });
}

export async function promoteTasksToMissionLayoutToday(
  turso: Client,
  userId: number,
  planDateIso: string,
  taskIds: number[]
) {
  if (taskIds.length === 0) return;

  await ensureLifeSchema(turso);

  const row = await turso.execute({
    sql: `SELECT mission_layout FROM daily_logs WHERE user_id = ? AND log_date = ? LIMIT 1;`,
    args: [userId, planDateIso],
  });

  const layout: MissionLayout = parseMissionLayout(
    (row.rows[0] as Record<string, unknown> | undefined)?.mission_layout as string | undefined
  ) ?? { today: [], coming_up: [] };

  for (const id of taskIds) {
    const ref = { kind: "task" as const, id, pinned: true as const };
    layout.coming_up = layout.coming_up.filter(
      (r) => !(r.kind === "task" && r.id === id)
    );
    layout.today = layout.today.filter((r) => !(r.kind === "task" && r.id === id));
    layout.today.unshift(ref);
  }

  await turso.execute({
    sql: `INSERT INTO daily_logs (user_id, log_date, mission_layout, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, log_date) DO UPDATE SET
            mission_layout = excluded.mission_layout,
            updated_at = datetime('now');`,
    args: [userId, planDateIso, JSON.stringify(layout)],
  });
}
