"use client";

import { resolvePillarAbbreviation } from "../lib/pillar-abbreviation";
import { LIFE_ADMIN_PILLAR_NAME, selectablePillars } from "../lib/life-admin";

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
};

export default function TaskPillarSelect({
  pillars,
  value,
  onChange,
  compact,
}: {
  pillars: Pillar[];
  value: number | null;
  onChange: (pillarId: number | null) => void;
  compact?: boolean;
}) {
  const selected = value ? pillars.find((p) => p.id === value) : null;
  const lifeAdminLabel = compact
    ? resolvePillarAbbreviation(LIFE_ADMIN_PILLAR_NAME, "ADMIN")
    : LIFE_ADMIN_PILLAR_NAME;

  return (
    <select
      className={compact ? "invInput taskPillarSelectCompact" : "invInput missionPillarSelect"}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      aria-label="Pillar"
      title={selected ? selected.name : lifeAdminLabel}
    >
      <option value="">{lifeAdminLabel}</option>
      {selectablePillars(pillars).map((p) => {
        const label = compact
          ? resolvePillarAbbreviation(p.name, p.abbreviation)
          : p.name;
        return (
          <option key={p.id} value={p.id} title={p.name}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
