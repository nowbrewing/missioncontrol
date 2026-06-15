import type { DailyLogKind } from "./daily-log-entries";
import { formatWeekRangeLabel } from "./reflection-week";

export const WEEKLY_SUMMARY_LOG_KIND = "weekly_summary" as const satisfies DailyLogKind;

export function isWeeklySummaryLogKind(
  kind: DailyLogKind
): kind is typeof WEEKLY_SUMMARY_LOG_KIND {
  return kind === WEEKLY_SUMMARY_LOG_KIND;
}

export function weeklySummaryEntryLabel(
  weekMonday?: string | null,
  weekEnd?: string | null
): string {
  if (weekMonday && weekEnd) {
    return `Weekly reflection · ${formatWeekRangeLabel(weekMonday, weekEnd)}`;
  }
  if (weekMonday) return `Weekly reflection (${weekMonday})`;
  return "Weekly reflection";
}
