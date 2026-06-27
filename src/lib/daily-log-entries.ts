import {
  appendDailyLogEntry as mongoAppendDailyLogEntry,
  deleteDailyLogEntry as mongoDeleteDailyLogEntry,
  listDailyLogEntries as mongoListDailyLogEntries,
  listDailyLogEntriesInRange as mongoListDailyLogEntriesInRange,
  listRecentDailyLogEntryDates,
  updateDailyLogEntry as mongoUpdateDailyLogEntry,
  type DailyLogEntry,
} from "./mongodb/store/daily-logs";

export const DAILY_LOG_KINDS = [
  "went_well",
  "went_poorly",
  "daily_focus",
  "assistant_chat",
  "weekly_summary",
] as const;
export type DailyLogKind = (typeof DAILY_LOG_KINDS)[number];

export type { DailyLogEntry };

export type DailyLogByKind = Record<DailyLogKind, DailyLogEntry[]>;

export function groupEntriesByKind(entries: DailyLogEntry[]): DailyLogByKind {
  const byKind: DailyLogByKind = {
    went_well: [],
    went_poorly: [],
    daily_focus: [],
    assistant_chat: [],
    weekly_summary: [],
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

export async function appendDailyLogEntry(
  userId: number,
  logDate: string,
  kind: DailyLogKind,
  content: string,
  pillarIds?: number[],
  weekMonday?: string
): Promise<DailyLogEntry> {
  return mongoAppendDailyLogEntry(userId, logDate, kind, content, pillarIds, weekMonday);
}

export async function appendDailyLogEntries(
  userId: number,
  logDate: string,
  items: {
    kind: DailyLogKind;
    content: string;
    pillar_ids?: number[];
    week_monday?: string;
  }[]
): Promise<DailyLogEntry[]> {
  const created: DailyLogEntry[] = [];
  for (const item of items) {
    const text = item.content.trim();
    if (!text) continue;
    created.push(
      await appendDailyLogEntry(
        userId,
        logDate,
        item.kind,
        text,
        item.pillar_ids,
        item.week_monday
      )
    );
  }
  return created;
}

export async function listDailyLogEntriesInRange(
  userId: number,
  fromDate: string,
  toDate: string
): Promise<DailyLogEntry[]> {
  return mongoListDailyLogEntriesInRange(userId, fromDate, toDate);
}

export async function listDailyLogEntries(
  userId: number,
  logDate: string
): Promise<DailyLogEntry[]> {
  return mongoListDailyLogEntries(userId, logDate);
}

export async function updateDailyLogEntry(
  userId: number,
  entryId: number,
  content: string,
  pillarIds?: number[] | null
): Promise<DailyLogEntry | null> {
  return mongoUpdateDailyLogEntry(userId, entryId, content, pillarIds);
}

export async function deleteDailyLogEntry(
  userId: number,
  entryId: number
): Promise<boolean> {
  return mongoDeleteDailyLogEntry(userId, entryId);
}

export async function listRecentDailyLogEntries(
  userId: number,
  beforeDate: string,
  limitDays = 7
): Promise<{ log_date: string; entries: DailyLogEntry[] }[]> {
  const dates = await listRecentDailyLogEntryDates(userId, beforeDate, limitDays);
  const out: { log_date: string; entries: DailyLogEntry[] }[] = [];
  for (const logDate of dates) {
    const entries = await listDailyLogEntries(userId, logDate);
    if (entries.length > 0) out.push({ log_date: logDate, entries });
  }
  return out;
}

export async function buildDailyLogAggregate(userId: number, logDate: string) {
  const entries = await listDailyLogEntries(userId, logDate);
  const by_kind = groupEntriesByKind(entries);
  return {
    entries,
    by_kind,
    aggregate: {
      went_well: combineEntryText(by_kind.went_well),
      went_poorly: combineEntryText(by_kind.went_poorly),
      daily_focus: combineEntryText(by_kind.daily_focus),
      assistant_chat: combineEntryText(by_kind.assistant_chat),
      weekly_summary: combineEntryText(by_kind.weekly_summary),
    },
  };
}
