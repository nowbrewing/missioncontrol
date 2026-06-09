import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";

export const DAILY_LOG_KINDS = ["went_well", "went_poorly", "daily_focus"] as const;
export type DailyLogKind = (typeof DAILY_LOG_KINDS)[number];

export type DailyLogEntry = {
  id: number;
  log_date: string;
  kind: DailyLogKind;
  content: string;
  created_at: string;
};

export type DailyLogByKind = Record<DailyLogKind, DailyLogEntry[]>;

function rowToEntry(row: Record<string, unknown>): DailyLogEntry {
  return {
    id: Number(row.id),
    log_date: String(row.log_date),
    kind: String(row.kind) as DailyLogKind,
    content: String(row.content),
    created_at: String(row.created_at),
  };
}

export function groupEntriesByKind(entries: DailyLogEntry[]): DailyLogByKind {
  const byKind: DailyLogByKind = {
    went_well: [],
    went_poorly: [],
    daily_focus: [],
  };
  for (const entry of entries) {
    if (entry.kind in byKind) byKind[entry.kind].push(entry);
  }
  return byKind;
}

export function combineEntryText(entries: DailyLogEntry[]): string {
  return entries.map((e) => e.content).join("\n\n");
}

export function formatEntriesForPrompt(entries: DailyLogEntry[]): string | null {
  if (entries.length === 0) return null;
  return entries.map((e) => `[${e.created_at}] ${e.content}`).join("\n");
}

/** Ensure a daily_logs shell row exists (mission layout anchor). */
export async function ensureDailyLogRow(
  turso: Client,
  userId: number,
  logDate: string
) {
  await turso.execute({
    sql: `INSERT INTO daily_logs (user_id, log_date, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(user_id, log_date) DO NOTHING;`,
    args: [userId, logDate],
  });
}

async function backfillLegacyEntries(
  turso: Client,
  userId: number,
  logDate: string
) {
  const existing = await turso.execute({
    sql: `SELECT COUNT(*) AS n FROM daily_log_entries WHERE user_id = ? AND log_date = ?;`,
    args: [userId, logDate],
  });
  if (Number((existing.rows[0] as Record<string, unknown>).n) > 0) return;

  const legacy = await turso.execute({
    sql: `SELECT went_well, went_poorly, daily_focus, updated_at FROM daily_logs
          WHERE user_id = ? AND log_date = ? LIMIT 1;`,
    args: [userId, logDate],
  });
  const row = legacy.rows[0] as Record<string, unknown> | undefined;
  if (!row) return;

  const stamp = String(row.updated_at || new Date().toISOString());
  const pairs: [DailyLogKind, string | null][] = [
    ["went_well", row.went_well ? String(row.went_well) : null],
    ["went_poorly", row.went_poorly ? String(row.went_poorly) : null],
    ["daily_focus", row.daily_focus ? String(row.daily_focus) : null],
  ];

  for (const [kind, content] of pairs) {
    if (!content?.trim()) continue;
    await turso.execute({
      sql: `INSERT INTO daily_log_entries (user_id, log_date, kind, content, created_at)
            VALUES (?, ?, ?, ?, ?);`,
      args: [userId, logDate, kind, content.trim(), stamp],
    });
  }
}

export async function appendDailyLogEntry(
  turso: Client,
  userId: number,
  logDate: string,
  kind: DailyLogKind,
  content: string
): Promise<DailyLogEntry> {
  const text = content.trim();
  if (!text) {
    throw new Error("Entry content is required");
  }

  await ensureLifeSchema(turso);
  await ensureDailyLogRow(turso, userId, logDate);

  const result = await turso.execute({
    sql: `INSERT INTO daily_log_entries (user_id, log_date, kind, content)
          VALUES (?, ?, ?, ?)
          RETURNING id, log_date, kind, content, created_at;`,
    args: [userId, logDate, kind, text],
  });

  return rowToEntry(result.rows[0] as Record<string, unknown>);
}

export async function appendDailyLogEntries(
  turso: Client,
  userId: number,
  logDate: string,
  items: { kind: DailyLogKind; content: string }[]
): Promise<DailyLogEntry[]> {
  const created: DailyLogEntry[] = [];
  for (const item of items) {
    const text = item.content.trim();
    if (!text) continue;
    created.push(await appendDailyLogEntry(turso, userId, logDate, item.kind, text));
  }
  return created;
}

export async function listDailyLogEntries(
  turso: Client,
  userId: number,
  logDate: string
): Promise<DailyLogEntry[]> {
  await ensureLifeSchema(turso);
  await backfillLegacyEntries(turso, userId, logDate);

  const result = await turso.execute({
    sql: `SELECT id, log_date, kind, content, created_at
          FROM daily_log_entries
          WHERE user_id = ? AND log_date = ?
          ORDER BY created_at ASC, id ASC;`,
    args: [userId, logDate],
  });

  return (result.rows as Record<string, unknown>[]).map(rowToEntry);
}

export async function listRecentDailyLogEntries(
  turso: Client,
  userId: number,
  beforeDate: string,
  limitDays = 7
): Promise<{ log_date: string; entries: DailyLogEntry[] }[]> {
  await ensureLifeSchema(turso);

  const dates = await turso.execute({
    sql: `SELECT DISTINCT log_date FROM daily_log_entries
          WHERE user_id = ? AND log_date < ?
          ORDER BY log_date DESC
          LIMIT ?;`,
    args: [userId, beforeDate, limitDays],
  });

  const out: { log_date: string; entries: DailyLogEntry[] }[] = [];
  for (const row of dates.rows as Record<string, unknown>[]) {
    const logDate = String(row.log_date);
    const entries = await listDailyLogEntries(turso, userId, logDate);
    if (entries.length > 0) out.push({ log_date: logDate, entries });
  }
  return out;
}

export async function buildDailyLogAggregate(
  turso: Client,
  userId: number,
  logDate: string
) {
  const entries = await listDailyLogEntries(turso, userId, logDate);
  const by_kind = groupEntriesByKind(entries);
  return {
    entries,
    by_kind,
    aggregate: {
      went_well: combineEntryText(by_kind.went_well),
      went_poorly: combineEntryText(by_kind.went_poorly),
      daily_focus: combineEntryText(by_kind.daily_focus),
    },
  };
}
