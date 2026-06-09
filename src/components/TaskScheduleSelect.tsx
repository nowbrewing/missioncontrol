"use client";

import { normalizeScheduleType, type ScheduleType } from "../lib/task-schedule";

export type TaskScheduleMode = "flexible" | "fixed";

export function scheduleModeFromType(scheduleType: string | null | undefined): TaskScheduleMode {
  return normalizeScheduleType(scheduleType) === "fixed" ? "fixed" : "flexible";
}

export default function TaskScheduleSelect({
  value,
  onChange,
  compact,
}: {
  value: TaskScheduleMode;
  onChange: (mode: TaskScheduleMode) => void;
  compact?: boolean;
}) {
  return (
    <select
      className={compact ? "invInput taskPillarSelectCompact" : "invInput missionPillarSelect"}
      value={value}
      onChange={(e) => onChange(e.target.value as TaskScheduleMode)}
      aria-label="Schedule type"
      title={value === "fixed" ? "Must happen on this day" : "No specific day required"}
    >
      <option value="flexible">{compact ? "Flex" : "Flexible"}</option>
      <option value="fixed">{compact ? "Fixed" : "Fixed date"}</option>
    </select>
  );
}

export function scheduleTypeFromMode(mode: TaskScheduleMode): ScheduleType {
  return mode === "fixed" ? "fixed" : "flexible";
}
