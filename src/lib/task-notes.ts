import { todayIsoYyyyMmDd } from "./date";

export function appendTaskNote(
  existing: string | null | undefined,
  note: string,
  at = todayIsoYyyyMmDd()
): string {
  const line = `[${at}] ${note.trim()}`;
  if (!existing?.trim()) return line;
  return `${existing.trim()}\n${line}`;
}

export type TaskNoteLine = { at: string; text: string };

export function parseTaskNoteLines(note: string | null | undefined): TaskNoteLine[] {
  if (!note?.trim()) return [];
  return note.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/);
    if (match) return { at: match[1], text: match[2].trim() };
    return { at: "", text: trimmed };
  }).filter((line): line is TaskNoteLine => line != null);
}

export function replaceTaskNoteLine(
  note: string | null | undefined,
  lineIndex: number,
  newText: string
): string {
  const lines = parseTaskNoteLines(note);
  if (lineIndex < 0 || lineIndex >= lines.length) return note?.trim() || "";
  const at = lines[lineIndex].at || todayIsoYyyyMmDd();
  lines[lineIndex] = { at, text: newText.trim() };
  return lines.map((l) => (l.at ? `[${l.at}] ${l.text}` : l.text)).join("\n");
}

export function serializeTaskNote(lines: TaskNoteLine[]): string {
  return lines.map((l) => (l.at ? `[${l.at}] ${l.text}` : l.text)).join("\n");
}
