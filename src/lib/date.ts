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
