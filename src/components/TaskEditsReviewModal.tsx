"use client";

import { useState } from "react";
import ActionIconButton, { DeleteIcon } from "./ActionIconButton";
import TaskPillarSelect from "./TaskPillarSelect";
import { isYyyyMmDd } from "../lib/date";

export type TaskEditDraft = {
  localId: string;
  task_id: number;
  originalTitle: string;
  title: string;
  pillar_id: number | null;
  pillar: string;
  deadline: string | null;
  note: string | null;
  titleChanged: boolean;
  deadlineChanged: boolean;
  pillarChanged: boolean;
  noteChanged: boolean;
};

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
};

export default function TaskEditsReviewModal({
  edits: initialEdits,
  pillars,
  saving,
  saveError,
  onConfirm,
  onDismiss,
}: {
  edits: TaskEditDraft[];
  pillars: Pillar[];
  saving: boolean;
  saveError?: string | null;
  onConfirm: (edits: TaskEditDraft[]) => void;
  onDismiss: () => void;
}) {
  const [edits, setEdits] = useState(initialEdits);

  function updateEdit(localId: string, patch: Partial<TaskEditDraft>) {
    setEdits((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e))
    );
  }

  function removeEdit(localId: string) {
    setEdits((prev) => prev.filter((e) => e.localId !== localId));
  }

  function handlePillarChange(localId: string, pillarId: number | null) {
    const pillar = pillarId ? pillars.find((p) => p.id === pillarId) : null;
    updateEdit(localId, {
      pillar_id: pillarId,
      pillar: pillar?.name ?? "",
    });
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-edits-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onDismiss()}
    >
      <div className="modalCard proposedTasksModal">
        <h2 id="task-edits-title" className="modalTitle">
          Review task changes
        </h2>
        <p className="modalNote">
          The assistant suggested {edits.length} change{edits.length === 1 ? "" : "s"} to
          existing tasks. Edit or remove anything that looks off, then save.
        </p>

        {edits.length === 0 ? (
          <p className="sectionHint">All suggested changes were removed.</p>
        ) : (
          <ul className="proposedTasksList">
            {edits.map((edit) => (
              <li key={edit.localId} className="card proposedTaskCard">
                <div className="proposedTaskCardHead">
                  <span className="pill pillSubtle">Edit</span>
                  <span className="pill pillSubtle">id {edit.task_id}</span>
                  <ActionIconButton
                    label={`Remove edit for ${edit.originalTitle}`}
                    onClick={() => removeEdit(edit.localId)}
                    disabled={saving}
                    variant="danger"
                    className="proposedTaskRemoveBtn"
                  >
                    <DeleteIcon />
                  </ActionIconButton>
                </div>

                {edit.titleChanged && (
                  <div className="modalField">
                    <label className="modalLabel" htmlFor={`edit-title-${edit.localId}`}>
                      Title
                    </label>
                    <input
                      id={`edit-title-${edit.localId}`}
                      className="invInput"
                      value={edit.title}
                      onChange={(e) => updateEdit(edit.localId, { title: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                )}

                <div className="proposedTaskMetaRow">
                  {edit.pillarChanged && (
                    <div className="modalField proposedTaskMetaField">
                      <label className="modalLabel">Pillar</label>
                      <TaskPillarSelect
                        pillars={pillars}
                        value={edit.pillar_id}
                        onChange={(id) => handlePillarChange(edit.localId, id)}
                      />
                    </div>
                  )}
                  {edit.deadlineChanged && (
                    <div className="modalField proposedTaskMetaField">
                      <label className="modalLabel" htmlFor={`edit-deadline-${edit.localId}`}>
                        Deadline
                      </label>
                      <input
                        id={`edit-deadline-${edit.localId}`}
                        className="invInput invInputDate"
                        type="date"
                        value={edit.deadline ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateEdit(edit.localId, {
                            deadline: value && isYyyyMmDd(value) ? value : null,
                          });
                        }}
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>

                {edit.noteChanged && (
                  <div className="modalField">
                    <label className="modalLabel" htmlFor={`edit-note-${edit.localId}`}>
                      Note
                    </label>
                    <textarea
                      id={`edit-note-${edit.localId}`}
                      className="invInput"
                      rows={2}
                      value={edit.note ?? ""}
                      onChange={(e) =>
                        updateEdit(edit.localId, {
                          note: e.target.value.trim() ? e.target.value : null,
                        })
                      }
                      disabled={saving}
                    />
                  </div>
                )}

                {!edit.titleChanged &&
                  !edit.deadlineChanged &&
                  !edit.pillarChanged &&
                  !edit.noteChanged && (
                    <p className="sectionHint">{edit.originalTitle}</p>
                  )}
              </li>
            ))}
          </ul>
        )}

        {saveError && (
          <div className="chatErrorBox">
            <strong>Could not save changes</strong>
            <p className="chatError">{saveError}</p>
          </div>
        )}

        <div className="modalActions">
          <button
            type="button"
            className="outlineButton"
            onClick={onDismiss}
            disabled={saving}
          >
            {edits.length === 0 ? "Close" : "Skip all"}
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => onConfirm(edits)}
            disabled={saving || edits.length === 0}
          >
            {saving ? "Saving..." : `Save ${edits.length} change${edits.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
