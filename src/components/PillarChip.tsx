import { resolvePillarAbbreviation } from "../lib/pillar-abbreviation";
import { normalizePillarColor, pillarColorVars } from "../lib/pillar-colors";

export default function PillarChip({
  name,
  abbreviation,
  color,
  rank,
  compact = false,
}: {
  name: string;
  abbreviation?: string | null;
  color: string | null | undefined;
  rank?: number;
  compact?: boolean;
}) {
  const label = compact ? resolvePillarAbbreviation(name, abbreviation) : name;

  return (
    <span
      className={`pillarChip ${compact ? "pillarChipCompact" : ""}`}
      style={pillarColorVars(color)}
      title={compact ? name : undefined}
    >
      {rank != null && <span className="pillarChipRank">#{rank}</span>}
      {label}
    </span>
  );
}

export function PillarHeaderBar({
  name,
  color,
  rank,
  className = "",
}: {
  name: string;
  color: string | null | undefined;
  rank?: number;
  className?: string;
}) {
  const hex = normalizePillarColor(color);
  return (
    <div
      className={`pillarHeaderBar ${className}`.trim()}
      style={pillarColorVars(hex)}
    >
      {rank != null && <span className="rankBadge">#{rank}</span>}
      <strong className="pillarName">{name}</strong>
    </div>
  );
}
