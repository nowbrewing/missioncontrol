"use client";

import { useState } from "react";

type Pillar = {
  id: number;
  name: string;
  color: string;
};

export default function MissionAddTask({
  pillars,
  onAdded,
}: {
  pillars: Pillar[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pillarId, setPillarId] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDeadline("");
    setPillarId("");
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    resetForm();
  }

  async function addTask() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          deadline: deadline || null,
          pillar_id: pillarId ? Number(pillarId) : null,
        }),
      });
      resetForm();
      setOpen(false);
      await onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="outlineButton missionAddTaskBtn"
        onClick={() => setOpen(true)}
      >
        Add task
      </button>

      {open && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-title"
          onClick={(e) => e.target === e.currentTarget && closeDialog()}
        >
          <div className="modalCard">
            <h2 id="add-task-title" className="modalTitle">
              Add a chore or task
            </h2>
            <p className="modalNote">Quick-add something to your list.</p>
            <div className="modalForm">
              <div className="modalField">
                <label className="modalLabel" htmlFor="add-task-title-input">
                  Title
                </label>
                <input
                  id="add-task-title-input"
                  className="invInput"
                  placeholder="What needs doing?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="modalField">
                <label className="modalLabel" htmlFor="add-task-pillar">
                  Pillar
                </label>
                <select
                  id="add-task-pillar"
                  className="invInput missionPillarSelect"
                  value={pillarId}
                  onChange={(e) => setPillarId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">No pillar</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modalField">
                <label className="modalLabel" htmlFor="add-task-deadline">
                  Deadline
                </label>
                <input
                  id="add-task-deadline"
                  className="invInput invInputDate"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="modalActions">
              <button
                type="button"
                className="outlineButton"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={addTask}
                disabled={saving || !title.trim()}
              >
                {saving ? "Adding..." : "Add task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
