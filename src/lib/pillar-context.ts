import { todayIsoYyyyMmDd } from "./date";

export type PillarContextEntry = { at: string; text: string };

const CONTEXT_PREFIX = "ctx:v1:";

export function parsePillarContext(description: string | null | undefined): PillarContextEntry[] {
  if (!description?.trim()) return [];

  const trimmed = description.trim();
  if (trimmed.startsWith(CONTEXT_PREFIX)) {
    try {
      const parsed = JSON.parse(trimmed.slice(CONTEXT_PREFIX.length)) as PillarContextEntry[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((e) => e && typeof e.text === "string" && e.text.trim())
        .map((e) => ({ at: String(e.at || ""), text: e.text.trim() }));
    } catch {
      return [];
    }
  }

  return [{ at: "", text: trimmed }];
}

export function serializePillarContext(entries: PillarContextEntry[]): string | null {
  const filtered = entries.filter((e) => e.text.trim());
  if (filtered.length === 0) return null;
  return `${CONTEXT_PREFIX}${JSON.stringify(filtered)}`;
}

export function appendPillarContext(
  description: string | null | undefined,
  text: string,
  at = todayIsoYyyyMmDd()
): string | null {
  const entry = text.trim();
  if (!entry) return description?.trim() || null;

  const entries = parsePillarContext(description);
  entries.unshift({ at, text: entry });
  return serializePillarContext(entries);
}

export function formatPillarContextForPrompt(description: string | null | undefined): string | null {
  const entries = parsePillarContext(description);
  if (entries.length === 0) return null;
  return entries
    .map((e) => (e.at ? `[${e.at}] ${e.text}` : e.text))
    .join("\n");
}

export function updatePillarContextAt(
  description: string | null | undefined,
  index: number,
  text: string
): string | null {
  const entries = parsePillarContext(description);
  if (index < 0 || index >= entries.length) return description?.trim() || null;
  const trimmed = text.trim();
  if (!trimmed) return description?.trim() || null;
  entries[index] = { ...entries[index], text: trimmed };
  return serializePillarContext(entries);
}

export function removePillarContextAt(
  description: string | null | undefined,
  index: number
): string | null {
  const entries = parsePillarContext(description);
  if (index < 0 || index >= entries.length) return description?.trim() || null;
  entries.splice(index, 1);
  return serializePillarContext(entries);
}

export function latestPillarContextSnippet(
  description: string | null | undefined,
  maxLen = 80
): string | null {
  const latest = parsePillarContext(description)[0]?.text;
  if (!latest) return null;
  return latest.length > maxLen ? `${latest.slice(0, maxLen)}…` : latest;
}
