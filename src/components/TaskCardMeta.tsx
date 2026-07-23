"use client";

import { useState, type ReactNode } from "react";
import ActionIconButton, { EditIcon } from "./ActionIconButton";
import PillarChip from "./PillarChip";
import TaskMilestoneSelect from "./TaskMilestoneSelect";
import TaskPillarSelect from "./TaskPillarSelect";
import TaskScheduleSelect, {
  scheduleModeFromType,
  scheduleTypeFromMode,
  type TaskScheduleMode,
} from "./TaskScheduleSelect";

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color?: string | null;
};

type Milestone = {
  id: number;
  title: string;
  pillar_id: number | null;
  completed_at?: string | null;
};

export default function TaskCardMeta({
  pillars,
  milestones,
  pillarId,
  milestoneId,
  scheduleType,
  compact = false,
  editable = true,
  leading,
  onPillarChange,
  onMilestoneChange,
  onScheduleChange,
}: {
  pillars: Pillar[];
  milestones: Milestone[];
  pillarId: number | null;
  milestoneId: number | null;
  scheduleType?: string | null;
  compact?: boolean;
  editable?: boolean;
  leading?: ReactNode;
  onPillarChange?: (pillarId: number | null) => void;
  onMilestoneChange?: (milestoneId: number | null) => void;
  onScheduleChange?: (mode: TaskScheduleMode) => void;
}) {
  const [editing, setEditing] = useState(false);
  const mode = scheduleModeFromType(scheduleType);

  const pillar = pillarId ? pillars.find((p) => p.id === pillarId) : null;
  const milestone = milestoneId ? milestones.find((m) => m.id === milestoneId) : null;
  const hasChips = !!(leading || pillar || milestone);

  if (editable && editing) {
    return (
      <div className={`taskCardMeta taskCardMetaEditing ${compact ? "taskCardMetaCompact" : ""}`}>
        <TaskPillarSelect
          pillars={pillars}
          value={pillarId}
          onChange={(id) => onPillarChange?.(id)}
          compact={compact}
        />
        <TaskMilestoneSelect
          milestones={milestones}
          pillarId={pillarId}
          value={milestoneId}
          onChange={(id) => onMilestoneChange?.(id)}
          compact={compact}
        />
        <TaskScheduleSelect
          value={mode}
          onChange={(next) => onScheduleChange?.(next)}
          compact={compact}
        />
        <button
          type="button"
          className="outlineButton btnCompact"
          onClick={() => setEditing(false)}
        >
          Done
        </button>
      </div>
    );
  }

  if (!hasChips && !editable) return null;

  return (
    <>
      {hasChips ? (
        <div className={`taskCardMeta ${compact ? "taskCardMetaCompact" : ""}`}>
          {leading}
          {pillar ? (
            <PillarChip
              name={pillar.name}
              abbreviation={pillar.abbreviation}
              color={pillar.color}
              compact
            />
          ) : null}
          {milestone ? (
            <span className="pill pillSubtle taskMilestonePill" title={milestone.title}>
              {compact && milestone.title.length > 20
                ? `${milestone.title.slice(0, 18)}…`
                : milestone.title}
            </span>
          ) : null}
        </div>
      ) : null}
      {editable ? (
        <ActionIconButton
          className="taskCardMetaEdit"
          label="Edit pillar, milestone, and schedule"
          onClick={() => setEditing(true)}
        >
          <EditIcon />
        </ActionIconButton>
      ) : null}
    </>
  );
}

export { scheduleTypeFromMode, scheduleModeFromType };
