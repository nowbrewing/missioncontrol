import { extractAndApplyPillarContextFromCheckIn } from "./apply-check-in-pillar-context";
import { appendDailyLogEntry } from "./daily-log-entries";
import { pillarIdsForLogText } from "./daily-log-pillar-tags";
import { WEEKLY_SUMMARY_LOG_KIND } from "./weekly-summary-log";
import { listPillars } from "./mongodb/store/users";

export async function saveReflectionSummary(params: {
  userId: number;
  weekMonday: string;
  weekEnd: string;
  summary: string;
}) {
  const summary = params.summary.trim();
  if (!summary) throw new Error("Summary is required");

  const pillars = await listPillars(params.userId);
  const pillarRows = pillars.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    description: p.description ? String(p.description) : null,
  }));

  const pillar_ids = await pillarIdsForLogText(summary, pillars);

  const entry = await appendDailyLogEntry(
    params.userId,
    params.weekEnd,
    WEEKLY_SUMMARY_LOG_KIND,
    summary,
    pillar_ids,
    params.weekMonday
  );

  const pillarContextSaved = await extractAndApplyPillarContextFromCheckIn(
    params.userId,
    params.weekEnd,
    { brainDump: summary },
    pillarRows
  );

  return {
    entry,
    pillar_ids,
    pillar_context_saved: pillarContextSaved,
  };
}
