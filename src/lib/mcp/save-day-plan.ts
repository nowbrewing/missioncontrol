import type { MissionLayout, MissionLayoutRef } from "../mission-layout";
import { getMissionLayout, upsertMissionLayout } from "../mongodb/store/daily-logs";

function toRefs(ids: number[]): MissionLayoutRef[] {
  return ids.map((id) => ({ kind: "task" as const, id, pinned: true }));
}

export async function saveDayPlanForUser(
  userId: number,
  planDate: string,
  input: {
    reflection: string;
    today_task_ids?: number[];
    this_week_task_ids?: number[];
    later_task_ids?: number[];
    flags?: string[];
  }
) {
  const existing = await getMissionLayout(userId, planDate);
  const todayIds = input.today_task_ids ?? [];
  const weekIds = input.this_week_task_ids ?? [];
  const laterIds = input.later_task_ids ?? [];

  const layout: MissionLayout = {
    today: toRefs(todayIds),
    coming_up: weekIds.map((id) => ({ kind: "task", id })),
    later: laterIds.map((id) => ({ kind: "task", id })),
    reflection: {
      reflection: input.reflection,
      flags: input.flags ?? [],
      buckets: {
        today: toRefs(todayIds),
        tomorrow: [],
        this_week: weekIds.map((id) => ({ kind: "task", id })),
        later: laterIds.map((id) => ({ kind: "task", id })),
      },
      generated_at: new Date().toISOString(),
    },
  };

  if (!todayIds.length && !weekIds.length && !laterIds.length && existing) {
    layout.today = existing.today;
    layout.coming_up = existing.coming_up;
    layout.later = existing.later;
  }

  await upsertMissionLayout(userId, planDate, layout);
  return { ok: true };
}
