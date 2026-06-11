export const PILLAR_COLOR_OPTIONS = [
  { value: "#FF6F61", name: "Vibrant Coral", label: "Passion & Romance" },
  { value: "#FF8C00", name: "Electric Tangerine", label: "Creativity & Play" },
  { value: "#FFD166", name: "Golden Yellow", label: "Career & Success" },
  { value: "#A7D452", name: "Bright Lime", label: "Growth & Finances" },
  { value: "#06B6D4", name: "Electric Teal", label: "Travel & Adventure" },
  { value: "#E0115F", name: "Hot Magenta", label: "Self-Care & Wellness" },
  { value: "#FCEADE", name: "Sunny Lemon", label: "Spirituality & Peace" },
  { value: "#D946EF", name: "Radiant Fuchsia", label: "Personal Development" },
  { value: "#2563EB", name: "Cobalt Blue", label: "Wisdom & Communication" },
  { value: "#D87093", name: "Rich Terracotta", label: "Environment & Home" },
  { value: "#000000", name: "Classic Black", label: "Neutral & Focus" },
] as const;

export const DEFAULT_PILLAR_COLOR = PILLAR_COLOR_OPTIONS[0].value;

export type PillarColor = (typeof PILLAR_COLOR_OPTIONS)[number]["value"];

export function isLightPillarColor(color: string): boolean {
  const hex = normalizePillarColor(color).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.82;
}

export function pillarColorAriaLabel(option: (typeof PILLAR_COLOR_OPTIONS)[number]): string {
  return `${option.name} — ${option.label}`;
}

export function isValidPillarColor(color: string): boolean {
  return (
    PILLAR_COLOR_OPTIONS.some((o) => o.value === color) || /^#[0-9A-Fa-f]{6}$/.test(color)
  );
}

export function normalizePillarColor(color: string | null | undefined): string {
  const c = color?.trim();
  if (c && isValidPillarColor(c)) return c;
  return DEFAULT_PILLAR_COLOR;
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizePillarColor(hex).replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function pillarColorVars(color: string | null | undefined): Record<string, string> {
  const hex = normalizePillarColor(color);
  return {
    ["--pillar-color" as string]: hex,
    ["--pillar-color-soft" as string]: hexToRgba(hex, 0.12),
    ["--pillar-color-medium" as string]: hexToRgba(hex, 0.28),
  };
}
