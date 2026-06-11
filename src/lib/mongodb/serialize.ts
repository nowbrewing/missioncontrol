export function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function toSqlDatetime(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString().replace("T", " ").slice(0, 19);
  if (value instanceof Date) return value.toISOString().replace("T", " ").slice(0, 19);
  return String(value).replace("T", " ").slice(0, 19);
}
