"use client";

export default function TaskDeadlineEditor({
  deadline,
  onChange,
  overdue = false,
}: {
  deadline: string | null;
  onChange: (deadline: string | null) => void;
  overdue?: boolean;
}) {
  return (
    <input
      type="date"
      className={`taskDeadlineInput ${overdue ? "taskDeadlineOverdue" : ""}`}
      value={deadline ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Task deadline"
      title="Edit deadline"
    />
  );
}
