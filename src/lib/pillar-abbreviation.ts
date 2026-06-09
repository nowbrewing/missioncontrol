export function defaultPillarAbbreviation(name: string): string {
  const words = name
    .split(/[\s&+/\-]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (words.length === 0) {
    const letters = name.replace(/[^a-zA-Z0-9]/g, "");
    return (letters.slice(0, 2) || "?").toUpperCase();
  }

  return words.map((w) => w[0]).join("").toUpperCase();
}

export function resolvePillarAbbreviation(
  name: string,
  abbreviation?: string | null
): string {
  const trimmed = abbreviation?.trim();
  if (trimmed) return trimmed.toUpperCase();
  return defaultPillarAbbreviation(name);
}

export function normalizePillarAbbreviationInput(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  return trimmed.slice(0, 8);
}
