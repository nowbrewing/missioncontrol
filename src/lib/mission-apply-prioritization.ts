import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";
import { isYyyyMmDd } from "./date";
import type { PrioritizationResult } from "./ai/mission-checkin-agent";
import { type MissionLayout, type MissionLayoutRef } from "./mission-layout";

function toLayoutRefs(
  refs: { kind: "task" | "milestone"; id: number }[],
  pinned = false
): MissionLayoutRef[] {
  return refs.map((r) => ({
    kind: r.kind,
    id: r.id,
    ...(pinned ? { pinned: true } : {}),
  }));
}

export async function applyPrioritization(
  turso: Client,
  userId: number,
  planDate: string,
  result: PrioritizationResult
) {
  await ensureLifeSchema(turso);

  if (result.deadline_updates?.length) {
    for (const update of result.deadline_updates) {
      const deadline =
        update.deadline && isYyyyMmDd(update.deadline) ? update.deadline : null;
      await turso.execute({
        sql: `UPDATE tasks SET deadline = ? WHERE id = ? AND user_id = ? AND completed_at IS NULL;`,
        args: [deadline, update.task_id, userId],
      });
    }
  }

  const today = toLayoutRefs(result.buckets.today, true);
  const comingUpRefs: MissionLayoutRef[] = [
    ...toLayoutRefs(result.buckets.tomorrow),
    ...toLayoutRefs(result.buckets.this_week),
  ];

  const layout: MissionLayout = {
    today,
    coming_up: comingUpRefs,
    later: toLayoutRefs(result.buckets.later),
    reflection: {
      reflection: result.reflection,
      flags: result.flags,
      buckets: {
        today: toLayoutRefs(result.buckets.today),
        tomorrow: toLayoutRefs(result.buckets.tomorrow),
        this_week: toLayoutRefs(result.buckets.this_week),
        later: toLayoutRefs(result.buckets.later),
      },
      generated_at: new Date().toISOString(),
    },
  };

  await turso.execute({
    sql: `INSERT INTO daily_logs (user_id, log_date, mission_layout, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, log_date) DO UPDATE SET
            mission_layout = excluded.mission_layout,
            updated_at = datetime('now');`,
    args: [userId, planDate, JSON.stringify(layout)],
  });
}
