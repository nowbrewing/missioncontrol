import { listDailyLogEntriesInRange } from "./daily-log-entries";
import { parsePillarContext } from "./pillar-context";
import { weekMondayFor } from "./recurring-week";
import { parseTaskNoteLines } from "./task-notes";
import { parseUserPreferences } from "./user-preferences";
import { listTasks } from "./mongodb/store/tasks";
import { getUserPreferences, listPillars } from "./mongodb/store/users";

export type CorrectionRecordKind =
  | "daily_log"
  | "pillar_context"
  | "task_note"
  | "user_preference";

export type CorrectionRecord = {
  record_id: string;
  kind: CorrectionRecordKind;
  log_date?: string;
  log_kind?: string;
  pillar_id?: number;
  pillar_name?: string;
  task_id?: number;
  task_title?: string;
  entry_index?: number;
  recorded_at?: string | null;
  snippet: string;
  in_week: boolean;
};

export type CorrectionWeekScope = {
  week_monday: string;
  week_end: string;
};

export function correctionWeekScope(planDate: string): CorrectionWeekScope {
  return { week_monday: weekMondayFor(planDate), week_end: planDate };
}

function inWeek(date: string | null | undefined, weekMonday: string, weekEnd: string): boolean {
  if (!date) return false;
  return date >= weekMonday && date <= weekEnd;
}

export async function buildCorrectionCorpus(
  userId: number,
  planDate: string
): Promise<{ scope: CorrectionWeekScope; records: CorrectionRecord[] }> {
  const scope = correctionWeekScope(planDate);
  const { week_monday, week_end } = scope;

  const [logEntries, pillars, tasks, preferences] = await Promise.all([
    listDailyLogEntriesInRange(userId, week_monday, week_end),
    listPillars(userId),
    listTasks(userId),
    getUserPreferences(userId),
  ]);

  const records: CorrectionRecord[] = [];

  for (const entry of logEntries) {
    records.push({
      record_id: `daily_log:${entry.id}`,
      kind: "daily_log",
      log_date: entry.log_date,
      log_kind: entry.kind,
      recorded_at: entry.log_date,
      snippet: entry.content,
      in_week: true,
    });
  }

  for (const pillar of pillars) {
    const entries = parsePillarContext(pillar.description);
    entries.forEach((e, i) => {
      records.push({
        record_id: `pillar:${pillar.id}:${i}`,
        kind: "pillar_context",
        pillar_id: Number(pillar.id),
        pillar_name: String(pillar.name),
        entry_index: i,
        recorded_at: e.at || null,
        snippet: e.text,
        in_week: inWeek(e.at, week_monday, week_end),
      });
    });
  }

  for (const task of tasks) {
    const lines = parseTaskNoteLines(task.note);
    lines.forEach((line, i) => {
      const lineInWeek = inWeek(line.at, week_monday, week_end);
      records.push({
        record_id: `task_note:${task.id}:${i}`,
        kind: "task_note",
        task_id: Number(task.id),
        task_title: String(task.title),
        entry_index: i,
        recorded_at: line.at || null,
        snippet: line.text,
        in_week: lineInWeek || !line.at,
      });
    });
  }

  const prefEntries = parseUserPreferences(preferences);
  prefEntries.forEach((e, i) => {
    records.push({
      record_id: `preference:${i}`,
      kind: "user_preference",
      entry_index: i,
      recorded_at: e.at || null,
      snippet: e.text,
      in_week: inWeek(e.at, week_monday, week_end),
    });
  });

  return { scope, records };
}

export function formatCorpusForPrompt(records: CorrectionRecord[], scope: CorrectionWeekScope): string {
  const weekRecords = records.filter((r) => r.in_week);
  const olderContext = records.filter((r) => !r.in_week);

  const formatRecord = (r: CorrectionRecord) => {
    const parts = [`id=${r.record_id}`, `kind=${r.kind}`];
    if (r.pillar_name) parts.push(`pillar=${r.pillar_name}`);
    if (r.task_title) parts.push(`task=${r.task_title}`);
    if (r.log_kind) parts.push(`log_kind=${r.log_kind}`);
    if (r.recorded_at) parts.push(`at=${r.recorded_at}`);
    return `- [${parts.join(" | ")}]\n  "${r.snippet}"`;
  };

  const weekBlock =
    weekRecords.length > 0
      ? weekRecords.map(formatRecord).join("\n")
      : "(nothing recorded this week yet)";

  const contextBlock =
    olderContext.length > 0
      ? olderContext.map(formatRecord).join("\n")
      : "(none)";

  return `CORRECTION SCOPE — Mon ${scope.week_monday} through ${scope.week_end}

RECORDS FROM THIS WEEK (edit these when the user's correction applies):
${weekBlock}

OLDER PILLAR / PREFERENCE CONTEXT (edit only if the correction should fix lasting confusion):
${contextBlock}`;
}

export const CORRECTION_KICKOFF = `**Correction mode** — tell me what was recorded wrong or left ambiguous this week.

I'll help you clarify, then find matching entries in your logs, pillar context, task notes, and preferences so we can fix them before the confusion spreads.

Example: _"When I said hackathon, I meant the Acme API sprint — not the charity event."_

What needs correcting?`;
