"use client";

import { useEffect, useState } from "react";
import type { ThinkpadSaveTarget } from "../../lib/thinkpad-save";

export type ThinkpadContext = {
  pillars: { id: number; name: string; color: string; rank: number }[];
  milestones: {
    id: number;
    title: string;
    pillar_id: number | null;
    target_date: string | null;
  }[];
  tasks: {
    id: number;
    title: string;
    pillar_id: number | null;
    deadline: string | null;
  }[];
};

export default function ThinkpadSaveModal({
  summary: initialSummary,
  context,
  saving,
  saveError,
  onConfirm,
  onDismiss,
}: {
  summary: string;
  context: ThinkpadContext;
  saving: boolean;
  saveError: string | null;
  onConfirm: (target: ThinkpadSaveTarget, targetId: number | null, summary: string) => void;
  onDismiss: () => void;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [target, setTarget] = useState<ThinkpadSaveTarget>("general");
  const [targetId, setTargetId] = useState<number | null>(null);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    if (target === "general") {
      setTargetId(null);
      return;
    }
    if (target === "task" && context.tasks.length > 0) {
      setTargetId(context.tasks[0]!.id);
    } else if (target === "milestone" && context.milestones.length > 0) {
      setTargetId(context.milestones[0]!.id);
    } else if (target === "pillar" && context.pillars.length > 0) {
      setTargetId(context.pillars[0]!.id);
    } else {
      setTargetId(null);
    }
  }, [target, context]);

  const needsTarget = target !== "general";
  const canSave =
    summary.trim().length > 0 && (!needsTarget || targetId != null) && !saving;

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thinkpad-save-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onDismiss()}
    >
      <div className="modalCard thinkpadSaveModal">
        <h2 id="thinkpad-save-title" className="modalTitle">
          Save session notes
        </h2>
        <p className="modalNote">
          Review the summary, choose where it should live, then save. Milestone notes are
          appended to the milestone&apos;s pillar context.
        </p>

        <label className="modalLabel" htmlFor="thinkpad-summary">
          Summary
        </label>
        <textarea
          id="thinkpad-summary"
          className="thinkpadSummaryInput"
          rows={8}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={saving}
        />

        <fieldset className="thinkpadTargetFieldset">
          <legend className="modalLabel">Assign to</legend>
          <div className="thinkpadTargetOptions">
            {(
              [
                ["general", "General (preferences)"],
                ["pillar", "Pillar"],
                ["milestone", "Milestone"],
                ["task", "Task"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="thinkpadTargetOption">
                <input
                  type="radio"
                  name="thinkpad-target"
                  value={value}
                  checked={target === value}
                  onChange={() => setTarget(value)}
                  disabled={saving}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {target === "task" && (
          <>
            <label className="modalLabel" htmlFor="thinkpad-task">
              Task
            </label>
            <select
              id="thinkpad-task"
              className="thinkpadSelect"
              value={targetId ?? ""}
              onChange={(e) => setTargetId(Number(e.target.value))}
              disabled={saving || context.tasks.length === 0}
            >
              {context.tasks.length === 0 ? (
                <option value="">No open tasks</option>
              ) : (
                context.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))
              )}
            </select>
          </>
        )}

        {target === "milestone" && (
          <>
            <label className="modalLabel" htmlFor="thinkpad-milestone">
              Milestone
            </label>
            <select
              id="thinkpad-milestone"
              className="thinkpadSelect"
              value={targetId ?? ""}
              onChange={(e) => setTargetId(Number(e.target.value))}
              disabled={saving || context.milestones.length === 0}
            >
              {context.milestones.length === 0 ? (
                <option value="">No open milestones</option>
              ) : (
                context.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))
              )}
            </select>
          </>
        )}

        {target === "pillar" && (
          <>
            <label className="modalLabel" htmlFor="thinkpad-pillar">
              Pillar
            </label>
            <select
              id="thinkpad-pillar"
              className="thinkpadSelect"
              value={targetId ?? ""}
              onChange={(e) => setTargetId(Number(e.target.value))}
              disabled={saving || context.pillars.length === 0}
            >
              {context.pillars.length === 0 ? (
                <option value="">No pillars</option>
              ) : (
                context.pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </>
        )}

        {saveError && <p className="chatError">{saveError}</p>}

        <div className="modalActions">
          <button
            type="button"
            className="thinkpadToolbarBtn"
            onClick={onDismiss}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => onConfirm(target, targetId, summary.trim())}
            disabled={!canSave}
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
