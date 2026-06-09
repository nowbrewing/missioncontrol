import { addDaysIsoYyyyMmDd, isYyyyMmDd, todayIsoYyyyMmDd } from "./date";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function weekdayIndex(name: string): number | null {
  const i = WEEKDAYS.indexOf(name.toLowerCase() as (typeof WEEKDAYS)[number]);
  return i >= 0 ? i : null;
}

export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Next occurrence of weekday on or after `base` (if same weekday as base, returns base). */
export function nextWeekdayOnOrAfter(base: string, targetWeekday: number): string {
  const current = isoWeekday(base);
  let delta = targetWeekday - current;
  if (delta < 0) delta += 7;
  return addDaysIsoYyyyMmDd(base, delta);
}

export function formatWeekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}

export function upcomingWeekReference(today = todayIsoYyyyMmDd()) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIsoYyyyMmDd(today, i);
    return { date, label: formatWeekdayLabel(date) };
  });
}

export function mondayOfWeekContaining(iso: string): string {
  const day = isoWeekday(iso);
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDaysIsoYyyyMmDd(iso, mondayOffset);
}

export function fridayOfWeekContaining(iso: string): string {
  return addDaysIsoYyyyMmDd(mondayOfWeekContaining(iso), 4);
}

export function isInSameWeek(a: string, b: string): boolean {
  return mondayOfWeekContaining(a) === mondayOfWeekContaining(b);
}

export function formatRelativeDateLabel(
  deadline: string | null,
  today: string
): string {
  if (!deadline) return "No date";
  if (deadline === today) return "Today";
  if (deadline === addDaysIsoYyyyMmDd(today, 1)) return "Tomorrow";
  if (deadline > today && isInSameWeek(deadline, today)) return "This week";
  return deadline;
}

export function inferDeadlineFromText(text: string, today = todayIsoYyyyMmDd()): string | null {
  const lower = text.toLowerCase();

  if (/\btoday\b|\bthis morning\b|\btonight\b|\bthis afternoon\b/.test(lower)) {
    return today;
  }

  if (/\btomorrow\b/.test(lower)) {
    return addDaysIsoYyyyMmDd(today, 1);
  }

  if (/\bthis week\b/.test(lower)) {
    return fridayOfWeekContaining(today);
  }

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch && isYyyyMmDd(isoMatch[1])) return isoMatch[1];

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = slashMatch[3]
      ? Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : Number(today.slice(0, 4));
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isYyyyMmDd(candidate)) return candidate;
  }

  for (let i = 0; i < WEEKDAYS.length; i++) {
    const day = WEEKDAYS[i];
    const pattern = new RegExp(`\\b(?:on|for|this|next)?\\s*${day}\\b`, "i");
    if (pattern.test(lower)) {
      const resolved = nextWeekdayOnOrAfter(today, i);
      if (/\bnext\s+/.test(lower) && resolved === today) {
        return addDaysIsoYyyyMmDd(today, 7);
      }
      return resolved;
    }
  }

  return null;
}

export { taskBelongsInTodayPriorities } from "./task-schedule";
