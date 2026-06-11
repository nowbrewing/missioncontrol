import { getMissionLayout, upsertMissionLayout } from "../mongodb/store/daily-logs";
import type { DayGuide } from "./parse-orchestration-result";
import { formatDayGuideForStorage } from "./parse-orchestration-result";

export async function storeAgentReflection(
  userId: number,
  planDate: string,
  dayGuide: DayGuide
) {
  const existing = await getMissionLayout(userId, planDate);
  await upsertMissionLayout(userId, planDate, {
    today: existing?.today ?? [],
    coming_up: existing?.coming_up ?? [],
    later: existing?.later ?? [],
    today_user_ordered: existing?.today_user_ordered ?? false,
    reflection: {
      reflection: formatDayGuideForStorage(dayGuide),
      kickoff: dayGuide.kickoff || undefined,
      rest_of_day: dayGuide.rest_of_day || undefined,
      flags: dayGuide.flags,
      buckets: {
        today: [],
        tomorrow: [],
        this_week: [],
        later: [],
      },
      generated_at: new Date().toISOString(),
    },
  });
}
