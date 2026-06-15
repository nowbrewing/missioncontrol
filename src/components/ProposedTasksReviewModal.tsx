"use client";

import { useState } from "react";
import TaskPillarSelect from "./TaskPillarSelect";
import { isYyyyMmDd } from "../lib/date";

export type ProposedTaskDraft = {
  localId: string;
  title: string;
  pillar_id: number | null;
  pillar: string;
  deadline: string | null;
  bucket: "Today" | "Next 7 days" | "Later";
};

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
};

export default function ProposedTasksReviewModal({
  tasks: initialTasks,
  pillars,
  planDate,
  saving,
  source = "check-in",
  saveError,
  onConfirm,
  onDismiss,
}: {
  tasks: ProposedTaskDraft[];
  pillars: Pillar[];
  planDate: string;
  saving: boolean;
  source?: "check-in" | "chat";
  saveError?: string | null;
  onConfirm: (tasks: ProposedTaskDraft[]) => void;
  onDismiss: () => void;
}) {
  const [tasks, setTasks] = useState(initialTasks);

  function updateTask(localId: string, patch: Partial<ProposedTaskDraft>) {
    setTasks((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t))
    );
  }

  function removeTask(localId: string) {
    setTasks((prev) => prev.filter((t) => t.localId !== localId));
  }

  function handlePillarChange(localId: string, pillarId: number | null) {
    const pillar = pillarId ? pillars.find((p) => p.id === pillarId) : null;
    updateTask(localId, {
      pillar_id: pillarId,
      pillar: pillar?.name ?? "",
    });
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposed-tasks-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onDismiss()}
    >
      <div className="modalCard proposedTasksModal">
        <h2 id="proposed-tasks-title" className="modalTitle">
          Review new tasks
        </h2>
        <p className="modalNote">
          {source === "chat"
            ? `The assistant found ${tasks.length} new task${tasks.length === 1 ? "" : "s"} from your chat. Edit anything that looks off, remove what you don't want, then add the rest to your board.`
            : `The Life Agent found ${tasks.length} new task${tasks.length === 1 ? "" : "s"} from your check-in. Edit anything that looks off, remove what you don't want, then add the rest to your board.`}
        </p>

        {tasks.length === 0 ? (
          <p className="sectionHint">All proposed tasks were removed.</p>
        ) : (
          <ul className="proposedTasksList">
            {tasks.map((task) => (
              <li key={task.localId} className="card proposedTaskCard">
                <div className="proposedTaskCardHead">
                  <span className="pill pillNew">New</span>
                  <span className="pill pillSubtle">{task.bucket}</span>
                  <button
                    type="button"
                    className="rankBtn proposedTaskRemoveBtn"
                    onClick={() => removeTask(task.localId)}
                    disabled={saving}
                    aria-label={`Remove ${task.title}`}
                  >
                    ×
                  </button>
                </div>

                <div className="modalField">
                  <label className="modalLabel" htmlFor={`proposed-title-${task.localId}`}>
                    Title
                  </label>
                  <input
                    id={`proposed-title-${task.localId}`}
                    className="invInput"
                    value={task.title}
                    onChange={(e) => updateTask(task.localId, { title: e.target.value })}
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
                    <label className="modalLabel" htmlFor={`proposed-deadline-${task.localId}`}>
                      Deadline
                    </label>
                    <input
                      id={`proposed-deadline-${task.localId}`}
                      className="invInput invInputDate"
                      type="date"
                      value={task.deadline ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateTask(task.localId, {
                          deadline: value && isYyyyMmDd(value) ? value : null,
                        });
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {saveError && (
          <div className="chatErrorBox">
            <strong>Could not save tasks</strong>
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
            {tasks.length === 0 ? "Close" : "Skip all"}
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() =>
              onConfirm(tasks.filter((t) => t.title.trim()))
            }
            disabled={saving || tasks.every((t) => !t.title.trim())}
          >
            {saving
              ? "Adding..."
              : tasks.length === 0
                ? "Done"
                : `Add ${tasks.filter((t) => t.title.trim()).length} task${tasks.filter((t) => t.title.trim()).length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
