"use client";

type Milestone = {
  id: number;
  title: string;
  pillar_id: number | null;
  completed_at?: string | null;
};

export default function TaskMilestoneSelect({
  milestones,
  pillarId,
  value,
  onChange,
  compact,
  emptyLabel,
}: {
  milestones: Milestone[];
  pillarId: number | null;
  value: number | null;
  onChange: (milestoneId: number | null) => void;
  compact?: boolean;
  emptyLabel?: string;
}) {
  const open = milestones.filter((m) => !m.completed_at);
  const filtered = pillarId
    ? open.filter((m) => m.pillar_id === pillarId)
    : open;

  const selected = value ? milestones.find((m) => m.id === value) : null;
  const placeholder = emptyLabel ?? (compact ? "—" : "No milestone");

  return (
    <select
      className={`${compact ? "invInput taskPillarSelectCompact" : "invInput missionPillarSelect"} ${!value ? "taskMilestoneSelectEmpty" : ""}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      aria-label="Milestone"
      title={selected ? selected.title : undefined}
    >
      <option value="">{placeholder}</option>
      {filtered.map((m) => (
        <option key={m.id} value={m.id} title={m.title}>
          {compact && m.title.length > 24 ? `${m.title.slice(0, 22)}…` : m.title}
        </option>
      ))}
    </select>
  );
}
