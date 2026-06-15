import { addDaysIsoYyyyMmDd } from "./date";
import { mondayOfWeekContaining } from "./mission-dates";

export const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export type RecurringKind = "daily" | "count";

export type DailyDaysMask = [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

export const DEFAULT_DAILY_DAYS: DailyDaysMask = [true, true, true, true, true, true, true];

export type DailyCheckProgress = { days: Record<string, boolean> };
export type DailyTallyProgress = { values: Record<string, number> };
export type CountProgress = { slots: boolean[] };

export type DailyProgress = DailyCheckProgress | DailyTallyProgress;
export type RecurringProgress = DailyProgress | CountProgress;

export function isDailyTallyProgress(
  progress: DailyProgress,
  tallyEnabled: boolean
): progress is DailyTallyProgress {
  return tallyEnabled;
}

export function weekMondayFor(iso: string): string {
  return mondayOfWeekContaining(iso);
}

export function weekDatesFromMonday(weekMonday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIsoYyyyMmDd(weekMonday, i));
}

export function isMonday(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 1;
}

export function parseDailyDays(raw: string | null | undefined): DailyDaysMask {
  if (!raw) return [...DEFAULT_DAILY_DAYS];
  try {
    const parsed = JSON.parse(raw) as boolean[];
    if (!Array.isArray(parsed) || parsed.length !== 7) return [...DEFAULT_DAILY_DAYS];
    return parsed.map(Boolean) as DailyDaysMask;
  } catch {
    return [...DEFAULT_DAILY_DAYS];
  }
}

export function serializeDailyDays(days: DailyDaysMask): string {
  return JSON.stringify(days);
}

export function emptyProgress(
  kind: RecurringKind,
  targetCount: number,
  tallyEnabled = false
): RecurringProgress {
  if (kind === "daily") {
    return tallyEnabled ? { values: {} } : { days: {} };
  }
  return { slots: Array.from({ length: targetCount }, () => false) };
}

export function parseProgress(
  raw: string | null | undefined,
  kind: RecurringKind,
  targetCount: number,
  tallyEnabled = false
): RecurringProgress {
  if (!raw) return emptyProgress(kind, targetCount, tallyEnabled);
  try {
    const parsed = JSON.parse(raw) as RecurringProgress & {
      days?: Record<string, boolean | number>;
      values?: Record<string, number>;
    };

    if (kind === "daily" && tallyEnabled) {
      if (parsed && typeof parsed === "object" && "values" in parsed && parsed.values) {
        const values: Record<string, number> = {};
        for (const [date, n] of Object.entries(parsed.values)) {
          const num = Number(n);
          if (Number.isFinite(num) && num !== 0) values[date] = num;
        }
        return { values };
      }
      // Legacy counter / merged format: numeric days map
      if (parsed && typeof parsed === "object" && "days" in parsed && parsed.days) {
        const values: Record<string, number> = {};
        for (const [date, v] of Object.entries(parsed.days)) {
          if (typeof v === "number") {
            const num = Number(v);
            if (Number.isFinite(num) && num !== 0) values[date] = num;
          }
        }
        return { values };
      }
      return { values: {} };
    }

    if (kind === "daily") {
      if (parsed && typeof parsed === "object" && "days" in parsed && parsed.days) {
        const days: Record<string, boolean> = {};
        for (const [date, v] of Object.entries(parsed.days)) {
          if (typeof v === "boolean") days[date] = v;
        }
        return { days };
      }
      return { days: {} };
    }

    if (kind === "count" && parsed && typeof parsed === "object" && "slots" in parsed) {
      const slots = (parsed as CountProgress).slots;
      const normalized = Array.from({ length: targetCount }, (_, i) => !!slots[i]);
      return { slots: normalized };
    }
  } catch {
    /* fall through */
  }
  return emptyProgress(kind, targetCount, tallyEnabled);
}

export function serializeProgress(progress: RecurringProgress): string {
  return JSON.stringify(progress);
}

export function countProgressDone(progress: CountProgress): number {
  return progress.slots.filter(Boolean).length;
}

export function dailyCheckDone(progress: DailyCheckProgress): number {
  return Object.values(progress.days).filter(Boolean).length;
}

export function dailyTallyTotal(progress: DailyTallyProgress): number {
  return Object.values(progress.values).reduce(
    (sum, n) => sum + (Number.isFinite(Number(n)) ? Number(n) : 0),
    0
  );
}

/** Progress bar fill — clamped at 0 when the running total is negative. */
export function tallyBarFillPercent(total: number, targetCount: number): number {
  if (targetCount <= 0) return 0;
  const barTotal = Math.max(0, total);
  return Math.min(100, (barTotal / targetCount) * 100);
}

export function normalizeRecurringKind(
  kind: string,
  tallyEnabled: number | boolean
): { kind: RecurringKind; tally_enabled: boolean } {
  if (kind === "counter") {
    return { kind: "daily", tally_enabled: true };
  }
  return {
    kind: kind === "count" ? "count" : "daily",
    tally_enabled: !!tallyEnabled,
  };
}
