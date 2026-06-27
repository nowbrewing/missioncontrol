import { addDaysIsoYyyyMmDd } from "./date";
import { weekMondayFor } from "./recurring-week";

/** Rolling lookahead for indefinite habits (Mon–Sun week blocks). */
export const HABIT_CALENDAR_HORIZON_WEEKS = 4;

export function habitCalendarHorizonEnd(today: string, endDate: string | null): string {
  const weekStart = weekMondayFor(today);
  const rollingEnd = addDaysIsoYyyyMmDd(weekStart, HABIT_CALENDAR_HORIZON_WEEKS * 7 - 1);

  if (!endDate) return rollingEnd;
  if (endDate < today) return endDate;
  return endDate;
}

export function weekMondaysThrough(startMonday: string, horizonEnd: string): string[] {
  const mondays: string[] = [];
  let cursor = startMonday;
  const lastMonday = weekMondayFor(horizonEnd);

  while (cursor <= lastMonday) {
    mondays.push(cursor);
    cursor = addDaysIsoYyyyMmDd(cursor, 7);
  }

  return mondays;
}

export function formatHabitEndLabel(endDate: string | null): string {
  if (!endDate) return "Ongoing · 4-week rolling";
  return `Through ${endDate}`;
}
