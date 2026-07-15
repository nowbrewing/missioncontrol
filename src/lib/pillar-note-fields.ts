export type PillarNoteFieldType = "text" | "long_text" | "number" | "select";

export type PillarNoteFieldDef = {
  id: string;
  label: string;
  type: PillarNoteFieldType;
  options?: string[];
};

export type PillarNoteFieldValues = Record<string, string>;

const FIELD_TYPES: PillarNoteFieldType[] = ["text", "long_text", "number", "select"];
const MAX_FIELDS = 12;
const MAX_LABEL_LEN = 40;
const MAX_TEXT_LEN = 200;
const MAX_LONG_TEXT_LEN = 2000;
const MAX_OPTION_LEN = 60;
const MAX_OPTIONS = 20;

function isFieldType(value: unknown): value is PillarNoteFieldType {
  return typeof value === "string" && FIELD_TYPES.includes(value as PillarNoteFieldType);
}

function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    out.push(trimmed.slice(0, MAX_OPTION_LEN));
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

export function parsePillarNoteFieldDefs(raw: unknown): PillarNoteFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const out: PillarNoteFieldDef[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const type = isFieldType(row.type) ? row.type : "text";
    if (!id || !label || seenIds.has(id)) continue;

    const def: PillarNoteFieldDef = {
      id,
      label: label.slice(0, MAX_LABEL_LEN),
      type,
    };

    if (type === "select") {
      const options = normalizeOptions(row.options);
      if (options.length === 0) continue;
      def.options = options;
    }

    seenIds.add(id);
    out.push(def);
    if (out.length >= MAX_FIELDS) break;
  }

  return out;
}

export function sanitizePillarNoteFieldDefs(defs: PillarNoteFieldDef[]): PillarNoteFieldDef[] {
  return parsePillarNoteFieldDefs(defs);
}

export function parsePillarNoteFieldValues(
  raw: unknown,
  defs: PillarNoteFieldDef[]
): PillarNoteFieldValues {
  const out: PillarNoteFieldValues = {};
  if (!raw || typeof raw !== "object") return out;

  for (const def of defs) {
    const value = (raw as Record<string, unknown>)[def.id];
    if (value == null || value === "") continue;

    if (def.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      out[def.id] = String(n);
      continue;
    }

    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;

    if (def.type === "select") {
      const match = def.options?.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
      if (!match) continue;
      out[def.id] = match;
      continue;
    }

    const maxLen = def.type === "long_text" ? MAX_LONG_TEXT_LEN : MAX_TEXT_LEN;
    out[def.id] = trimmed.slice(0, maxLen);
  }

  return out;
}

export function prunePillarNoteFieldValues(
  values: PillarNoteFieldValues,
  defs: PillarNoteFieldDef[]
): PillarNoteFieldValues {
  return parsePillarNoteFieldValues(values, defs);
}

export function newPillarNoteFieldId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function displayPillarNoteFieldValue(
  def: PillarNoteFieldDef,
  values: PillarNoteFieldValues
): string {
  const raw = values[def.id];
  if (raw == null || raw === "") return "—";
  return raw;
}
