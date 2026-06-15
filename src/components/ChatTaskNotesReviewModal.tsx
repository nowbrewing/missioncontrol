"use client";

import { useState } from "react";
import TaskPillarSelect from "./TaskPillarSelect";
import { isYyyyMmDd } from "../lib/date";
import { appendTaskNote } from "../lib/task-notes";

export type TaskNoteUpdateDraft = {
  localId: string;
  task_id: number;
  task_title: string;
  existing_note: string | null;
  note: string;
};

export type NewTaskNoteDraft = {
  localId: string;
  title: string;
  pillar_id: number | null;
  pillar: string;
  note: string;
  deadline: string | null;
  bucket: "Today" | "Next 7 days" | "Later";
};

type OpenTask = {
  id: number;
  title: string;
  note?: string | null;
};

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
};

export default function ChatTaskNotesReviewModal({
  noteUpdates: initialNoteUpdates,
  newTasks: initialNewTasks,
  openTasks,
  pillars,
  planDate,
  saving,
  saveError,
  onConfirm,
  onDismiss,
}: {
  noteUpdates: TaskNoteUpdateDraft[];
  newTasks: NewTaskNoteDraft[];
  openTasks: OpenTask[];
  pillars: Pillar[];
  planDate: string;
  saving: boolean;
  saveError?: string | null;
  onConfirm: (noteUpdates: TaskNoteUpdateDraft[], newTasks: NewTaskNoteDraft[]) => void;
  onDismiss: () => void;
}) {
  const [noteUpdates, setNoteUpdates] = useState(initialNoteUpdates);
  const [newTasks, setNewTasks] = useState(initialNewTasks);

  const totalCount = noteUpdates.length + newTasks.length;

  function updateNoteUpdate(localId: string, patch: Partial<TaskNoteUpdateDraft>) {
    setNoteUpdates((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const next = { ...row, ...patch };
        if (patch.task_id !== undefined) {
          const task = openTasks.find((t) => t.id === patch.task_id);
          if (task) {
            next.task_title = task.title;
            next.existing_note = task.note?.trim() ? task.note : null;
          }
        }
        return next;
      })
    );
  }

  function removeNoteUpdate(localId: string) {
    setNoteUpdates((prev) => prev.filter((row) => row.localId !== localId));
  }

  function updateNewTask(localId: string, patch: Partial<NewTaskNoteDraft>) {
    setNewTasks((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row))
    );
  }

  function removeNewTask(localId: string) {
    setNewTasks((prev) => prev.filter((row) => row.localId !== localId));
  }

  function handlePillarChange(localId: string, pillarId: number | null) {
    const pillar = pillarId ? pillars.find((p) => p.id === pillarId) : null;
    updateNewTask(localId, {
      pillar_id: pillarId,
      pillar: pillar?.name ?? "",
    });
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-task-notes-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onDismiss()}
    >
      <div className="modalCard proposedTasksModal">
        <h2 id="chat-task-notes-title" className="modalTitle">
          Save chat notes to tasks
        </h2>
        <p className="modalNote">
          The assistant found {totalCount} note{totalCount === 1 ? "" : "s"} from your chat.
          Confirm the right task for each, edit anything that looks off, then save.
        </p>

        {totalCount === 0 ? (
          <p className="sectionHint">All suggested notes were removed.</p>
        ) : (
          <ul className="proposedTasksList">
            {noteUpdates.map((row) => {
              const mergedPreview = appendTaskNote(row.existing_note, row.note, planDate);
              return (
                <li key={row.localId} className="card proposedTaskCard">
                  <div className="proposedTaskCardHead">
                    <span className="pill pillSubtle">Add note</span>
                    <button
                      type="button"
                      className="rankBtn proposedTaskRemoveBtn"
                      onClick={() => removeNoteUpdate(row.localId)}
                      disabled={saving}
                      aria-label={`Remove note for ${row.task_title}`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="modalField">
                    <label className="modalLabel" htmlFor={`note-task-${row.localId}`}>
                      Task
                    </label>
                    <select
                      id={`note-task-${row.localId}`}
                      className="invInput"
                      value={row.task_id}
                      onChange={(e) =>
                        updateNoteUpdate(row.localId, {
                          task_id: Number(e.target.value),
                        })
                      }
                      disabled={saving}
                    >
                      {openTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="modalField">
                    <label className="modalLabel" htmlFor={`note-text-${row.localId}`}>
                      Note to add
                    </label>
                    <textarea
                      id={`note-text-${row.localId}`}
                      className="invInput"
                      rows={3}
                      value={row.note}
                      onChange={(e) =>
                        updateNoteUpdate(row.localId, { note: e.target.value })
                      }
                      disabled={saving}
                    />
                  </div>

                  {row.existing_note ? (
                    <div className="modalField">
                      <span className="modalLabel">Preview after save</span>
                      <p className="sectionHint chatTaskNotePreview">{mergedPreview}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}

            {newTasks.map((task) => (
              <li key={task.localId} className="card proposedTaskCard">
                <div className="proposedTaskCardHead">
                  <span className="pill pillNew">New task</span>
                  <span className="pill pillSubtle">{task.bucket}</span>
                  <button
                    type="button"
                    className="rankBtn proposedTaskRemoveBtn"
                    onClick={() => removeNewTask(task.localId)}
                    disabled={saving}
                    aria-label={`Remove new task ${task.title}`}
                  >
                    ×
                  </button>
                </div>

                <div className="modalField">
                  <label className="modalLabel" htmlFor={`new-task-title-${task.localId}`}>
                    Title
                  </label>
                  <input
                    id={`new-task-title-${task.localId}`}
                    className="invInput"
                    value={task.title}
                    onChange={(e) => updateNewTask(task.localId, { title: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="proposedTaskMetaRow">
                  <div className="modalField proposedTaskMetaField">
                    <label className="modalLabel">Pillar</label>
                    <TaskPillarSelect
                      pillars={pillars}
                      value={task.pillar_id}
                      onChange={(id) => handlePillarChange(task.localId, id)}
                    />
                  </div>
                  <div className="modalField proposedTaskMetaField">
                    <label className="modalLabel" htmlFor={`new-task-deadline-${task.localId}`}>
                      Deadline
                    </label>
                    <input
                      id={`new-task-deadline-${task.localId}`}
                      className="invInput invInputDate"
                      type="date"
                      value={task.deadline ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateNewTask(task.localId, {
                          deadline: value && isYyyyMmDd(value) ? value : null,
                        });
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="modalField">
                  <label className="modalLabel" htmlFor={`new-task-note-${task.localId}`}>
                    Note
                  </label>
                  <textarea
                    id={`new-task-note-${task.localId}`}
                    className="invInput"
                    rows={3}
                    value={task.note}
                    onChange={(e) => updateNewTask(task.localId, { note: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {saveError && (
          <div className="chatErrorBox">
            <strong>Could not save notes</strong>
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
            {totalCount === 0 ? "Close" : "Skip all"}
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() =>
              onConfirm(
                noteUpdates.filter((row) => row.note.trim()),
                newTasks.filter((task) => task.title.trim())
              )
            }
            disabled={
              saving ||
              (noteUpdates.every((row) => !row.note.trim()) &&
                newTasks.every((task) => !task.title.trim()))
            }
          >
            {saving
              ? "Saving..."
              : totalCount === 0
                ? "Done"
                : `Save ${noteUpdates.filter((row) => row.note.trim()).length + newTasks.filter((task) => task.title.trim()).length} note${noteUpdates.filter((row) => row.note.trim()).length + newTasks.filter((task) => task.title.trim()).length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
