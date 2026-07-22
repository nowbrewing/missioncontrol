"use client";

import { useEffect, useMemo, useState } from "react";
import ActionIconButton, { DeleteIcon } from "../ActionIconButton";
import TaskPillarSelect from "../TaskPillarSelect";
import TaskPillarNoteFields from "./TaskPillarNoteFields";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../../lib/pillar-note-fields";
import type { PlanningIdeaTask } from "./PlanningIdeas";

export type PlanningIdeaModalPillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  note_fields?: PillarNoteFieldDef[];
};

export type PlanningIdeaModalPatch = {
  title: string;
  note: string | null;
  note_field_values: PillarNoteFieldValues;
  deadline: string | null;
  pillar_id: number | null;
  completed?: boolean;
};

type Props = {
  idea: PlanningIdeaTask;
  pillars: PlanningIdeaModalPillar[];
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: PlanningIdeaModalPatch) => Promise<void>;
  onDelete: () => Promise<void>;
};

function isScheduledTask(idea: PlanningIdeaTask) {
  return !!idea.deadline || Number(idea.is_idea) === 0;
}

export default function PlanningIdeaModal({
  idea,
  pillars,
  open,
  busy,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(idea.title);
  const [note, setNote] = useState(idea.note ?? "");
  const [noteFieldValues, setNoteFieldValues] = useState<PillarNoteFieldValues>(
    idea.note_field_values ?? {}
  );
  const [deadline, setDeadline] = useState(idea.deadline ?? "");
  const [pillarId, setPillarId] = useState<number | null>(idea.pillar_id ?? null);
  const [completed, setCompleted] = useState(!!idea.completed_at);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(idea.title);
    setNote(idea.note ?? "");
    setNoteFieldValues(idea.note_field_values ?? {});
    setDeadline(idea.deadline ?? "");
    setPillarId(idea.pillar_id ?? null);
    setCompleted(!!idea.completed_at);
    setSaveError(null);
  }, [open, idea]);

  const noteFields = useMemo(
    () =>
      pillarId != null
        ? (pillars.find((p) => p.id === pillarId)?.note_fields ?? [])
        : [],
    [pillars, pillarId]
  );

  if (!open) return null;

  const scheduled = isScheduledTask(idea);

  async function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || busy) return;

    setSaveError(null);
    try {
      await onSave({
        title: trimmedTitle,
        note: note.trim() || null,
        note_field_values: noteFieldValues,
        deadline: deadline.trim() || null,
        pillar_id: pillarId,
        ...(scheduled ? { completed } : {}),
      });
      onClose();
    } catch {
      setSaveError("Could not save idea");
    }
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planning-idea-modal-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="modalCard planningIdeaModal">
        <div className="planningIdeaModalHeader">
          <h2 id="planning-idea-modal-title" className="modalTitle">
            {scheduled ? "Task" : "Idea"}
          </h2>
          <ActionIconButton
            label={`Delete idea: ${idea.title}`}
            onClick={() => void onDelete()}
            disabled={busy}
            variant="danger"
          >
            <DeleteIcon />
          </ActionIconButton>
        </div>

        <div className="modalForm planningIdeaModalForm">
          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-title">
              Title
            </label>
            <input
              id="planning-idea-title"
              className="invInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>

          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-pillar">
              Pillar
            </label>
            <TaskPillarSelect
              pillars={pillars}
              value={pillarId}
              onChange={setPillarId}
            />
          </div>

          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-note">
              Note
            </label>
            <textarea
              id="planning-idea-note"
              className="invInput planningIdeaModalNoteInput"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Leave a note for yourself…"
              rows={10}
              disabled={busy}
            />
          </div>

          <TaskPillarNoteFields
            fields={noteFields}
            values={noteFieldValues}
            disabled={busy}
            onChange={setNoteFieldValues}
          />

          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-date">
              Schedule on
            </label>
            <input
              id="planning-idea-date"
              type="date"
              className="invInput invInputDate planningIdeaModalDateInput"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={busy}
            />
            <p className="sectionHint planningIdeaModalDateHint">
              {scheduled
                ? "Change the date to move it on the calendar, or clear the date to move it back to Ideas."
                : "Adding a date moves this to the calendar. You can also drag the idea onto a day."}
            </p>
          </div>

          {scheduled ? (
            <label className="planningIdeaCompleteToggle">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                disabled={busy}
              />
              Done
            </label>
          ) : null}
        </div>

        {saveError ? <p className="chatError">{saveError}</p> : null}

        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => void save()}
            disabled={busy || !title.trim()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
