import type { DailyLogEntry } from "./mongodb/store/daily-logs";

export function formatWentWellEntriesForPrompt(
  entries: DailyLogEntry[],
  pillars: { id: number; name: string }[]
): string {
  if (entries.length === 0) return "(none)";

  const pillarById = new Map(pillars.map((p) => [p.id, p.name]));
  const general: string[] = [];
  const byPillar = new Map<number, string[]>();

  for (const entry of entries) {
    const line = `[${entry.log_date}] ${entry.content}`;
    if (entry.pillar_ids.length === 0) {
      general.push(line);
      continue;
    }
    for (const pillarId of entry.pillar_ids) {
      const bucket = byPillar.get(pillarId) ?? [];
      bucket.push(line);
      byPillar.set(pillarId, bucket);
    }
  }

  const sections: string[] = [];
  if (general.length > 0) {
    sections.push(`General wins:\n${general.join("\n")}`);
  }

  for (const [pillarId, lines] of [...byPillar.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const name = pillarById.get(pillarId) ?? `Pillar ${pillarId}`;
    sections.push(`${name} wins:\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
