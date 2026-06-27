export function isYyyyMmDd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function todayIsoYyyyMmDd() {
  return isoYyyyMmDdFromDate(new Date());
}

export function yesterdayIsoYyyyMmDd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoYyyyMmDdFromDate(d);
}

export function tomorrowIsoYyyyMmDd() {
  return addDaysIsoYyyyMmDd(todayIsoYyyyMmDd(), 1);
}

/** True when the user's local clock is at or after hour:minute (24h). */
export function isPastLocalTime(hour: number, minute = 0) {
  const now = new Date();
  if (now.getHours() > hour) return true;
  if (now.getHours() === hour) return now.getMinutes() >= minute;
  return false;
}

export function shouldAskPrioritizeDayChoice(calendarToday: string, planDate: string) {
  return planDate === calendarToday && isPastLocalTime(15);
}

export function addDaysIsoYyyyMmDd(base: string, days: number) {
  const [y, m, d] = base.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return isoYyyyMmDdFromDate(date);
}

function isoYyyyMmDdFromDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type CalendarDayCell = {
  date: string;
  inMonth: boolean;
};

/** Monday-first month grid (6 rows × 7 columns). */
export function buildMonthGrid(year: number, month: number): CalendarDayCell[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;

  const grid: CalendarDayCell[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    grid.push({ date: isoYyyyMmDdFromDate(d), inMonth: false });
  }

  for (let day = 1; day <= lastDay; day++) {
    grid.push({ date: isoYyyyMmDdFromDate(new Date(year, month, day)), inMonth: true });
  }

  while (grid.length % 7 !== 0) {
    const tail = grid[grid.length - 1].date;
    grid.push({ date: addDaysIsoYyyyMmDd(tail, 1), inMonth: false });
  }

  while (grid.length < 42) {
    const tail = grid[grid.length - 1].date;
    grid.push({ date: addDaysIsoYyyyMmDd(tail, 1), inMonth: false });
  }

  return grid;
}

export function parseMonthParam(value: string | null | undefined): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function monthParamFromDate(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function dayOfMonthFromIso(date: string) {
  return Number(date.slice(8, 10));
}

export function monthBoundsFor(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = isoYyyyMmDdFromDate(new Date(year, month, 1));
  const to = isoYyyyMmDdFromDate(new Date(year, month + 1, 0));
  return { from, to };
}

export function monthLabelFor(date = new Date()) {
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function addMonthsToDate(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function formatLogDateLabel(logDate: string) {
  const [y, m, d] = logDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
