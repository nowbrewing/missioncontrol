import { addDaysIsoYyyyMmDd } from "./date";
import { weekMondayFor } from "./recurring-week";

export type ReflectionWeekRange = {
  week_monday: string;
  week_end: string;
};

/** Most recent fully completed Mon–Sun week relative to planDate. */
export function mostRecentCompletedWeek(planDate: string): ReflectionWeekRange {
  const currentMonday = weekMondayFor(planDate);
  const week_monday = addDaysIsoYyyyMmDd(currentMonday, -7);
  const week_end = addDaysIsoYyyyMmDd(week_monday, 6);
  return { week_monday, week_end };
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, date: new Date(y, m - 1, d) };
}

/** Human-readable Mon–Sun range, e.g. "Jun 8–14, 2026" or "May 26 – Jun 1, 2026". */
export function formatWeekRangeLabel(weekMonday: string, weekEnd: string): string {
  const start = parseIsoDate(weekMonday);
  const end = parseIsoDate(weekEnd);
  const sameMonth = start.y === end.y && start.m === end.m;

  const monthShort = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short" });

  if (sameMonth) {
    return `${monthShort(start.date)} ${start.d}–${end.d}, ${start.y}`;
  }

  const startFmt = start.date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFmt = end.date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}

/** Week range with weekdays for reflection UI copy. */
export function formatWeekRangeLong(weekMonday: string, weekEnd: string): string {
  const start = parseIsoDate(weekMonday);
  const end = parseIsoDate(weekEnd);
  const range = formatWeekRangeLabel(weekMonday, weekEnd);
  const mon = start.date.toLocaleDateString("en-US", { weekday: "long" });
  const sun = end.date.toLocaleDateString("en-US", { weekday: "long" });
  return `${range} (${mon}–${sun})`;
}

export function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}
