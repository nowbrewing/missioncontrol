import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../../db/life";
import { isYyyyMmDd } from "../date";
import type { ExtractedBrainDumpTask } from "./run-brain-dump";

type PillarRow = { id: number; name: string };

export function resolvePillarId(
  pillarName: string,
  pillars: PillarRow[]
): number | null {
  const normalized = pillarName.trim().toLowerCase();
  if (!normalized) return null;

  const match = pillars.find((p) => p.name.trim().toLowerCase() === normalized);
  return match ? match.id : null;
}

export async function persistBrainDumpTasks(
  turso: Client,
  userId: number,
  tasks: ExtractedBrainDumpTask[],
  pillars: PillarRow[]
) {
  await ensureLifeSchema(turso);

  const maxRank = await turso.execute({
    sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM tasks WHERE user_id = ?;`,
    args: [userId],
  });
  let nextRank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

  const created: Record<string, unknown>[] = [];

  for (const task of tasks) {
    const title = task.title.trim();
    if (!title) continue;

    const deadline =
      task.due_date && isYyyyMmDd(task.due_date) ? task.due_date : null;
    const pillarId = resolvePillarId(task.pillar, pillars);

    const result = await turso.execute({
      sql: `INSERT INTO tasks (user_id, title, description, deadline, rank, pillar_id, milestone_id, schedule_type, window_start)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, user_id, title, description, deadline, completed_at, rank, pillar_id, milestone_id, schedule_type, window_start, created_at;`,
      args: [
        userId,
        title,
        null,
        deadline,
        nextRank++,
        pillarId,
        null,
        "flexible",
        null,
      ],
    });
    created.push(result.rows[0] as Record<string, unknown>);
  }

  return created;
}
