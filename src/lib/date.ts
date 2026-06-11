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
