"use client";

import { useState } from "react";
import { pillarColorVars } from "../../lib/pillar-colors";
import ActionIconButton, { DeleteIcon, EditIcon } from "../ActionIconButton";

export type PlanningMilestone = {
  id: number;
  pillar_id: number | null;
  title: string;
  target_date: string | null;
  completed_at: string | null;
  rank: number;
};

type Props = {
  pillarId: number;
  pillarName: string;
  pillarColor: string;
  milestones: PlanningMilestone[];
  onChanged: () => Promise<void>;
};

export default function PlanningMilestones({
  pillarId,
  pillarName,
  pillarColor,
  milestones,
  onChanged,
}: Props) {
  const [hideCompleted, setHideCompleted] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = hideCompleted
    ? milestones.filter((m) => !m.completed_at)
    : milestones;

  async function addMilestone() {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar_id: pillarId,
          title,
          target_date: newDate || null,
        }),
      });
      setNewTitle("");
      setNewDate("");
      setAdding(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleComplete(ms: PlanningMilestone) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/milestones/${ms.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !ms.completed_at }),
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(ms: PlanningMilestone) {
    setEditingId(ms.id);
    setEditTitle(ms.title);
    setEditDate(ms.target_date ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDate("");
  }

  async function saveEdit(id: number) {
    const title = editTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/milestones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          target_date: editDate || null,
        }),
      });
      cancelEdit();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteMilestone(ms: PlanningMilestone) {
    const ok = window.confirm(`Delete milestone "${ms.title}"?`);
    if (!ok || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/milestones/${ms.id}`, { method: "DELETE" });
      if (editingId === ms.id) cancelEdit();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const completedCount = milestones.filter((m) => m.completed_at).length;

  return (
    <section
      className="card planningMilestones"
      style={pillarColorVars(pillarColor)}
      aria-label={`Milestones for ${pillarName}`}
    >
      <div className="planningMilestonesHeader">
        <div className="planningCardHeaderTop">
          <h2 className="planningMilestonesTitle">Milestones</h2>
          {!adding && (
            <ActionIconButton
              label="Add milestone"
              onClick={() => setAdding(true)}
              disabled={busy}
            >
              +
            </ActionIconButton>
          )}
        </div>
        <p className="sectionHint planningMilestonesHint">
          Track bigger outcomes for this pillar. Target dates appear on the calendar below.
        </p>
        {completedCount > 0 && (
          <label className="planningMilestonesToggle">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed ({completedCount})
          </label>
        )}
      </div>

      <ul className="milestoneList">
        {shown.length === 0 && (
          <li className="milestoneEmpty">
            {milestones.length === 0 ? "No milestones yet." : "No open milestones."}
          </li>
        )}
        {shown.map((ms) =>
          editingId === ms.id ? (
            <li key={ms.id} className="milestoneRow milestoneRowColored planningMilestoneEditRow">
              <input
                className="invInput planningMilestoneEditTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                aria-label="Milestone title"
                disabled={busy}
              />
              <input
                type="date"
                className="invInput invInputDate"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                aria-label="Target date"
                disabled={busy}
              />
              <div className="planningMilestoneEditActions">
                <button
                  type="button"
                  className="chatSendBtn"
                  onClick={() => void saveEdit(ms.id)}
                  disabled={busy || !editTitle.trim()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="outlineButton"
                  onClick={cancelEdit}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li key={ms.id} className="milestoneRow milestoneRowColored">
              <label className="planningMilestoneCheck">
                <input
                  type="checkbox"
                  checked={!!ms.completed_at}
                  onChange={() => void toggleComplete(ms)}
                  disabled={busy}
                  aria-label={`Mark ${ms.title} ${ms.completed_at ? "incomplete" : "complete"}`}
                />
                <span className={ms.completed_at ? "taskDone" : ""}>{ms.title}</span>
              </label>
              {ms.target_date && <span className="pill pillSubtle">{ms.target_date}</span>}
              <div className="planningMilestoneRowActions">
                <ActionIconButton
                  label={`Edit ${ms.title}`}
                  onClick={() => startEdit(ms)}
                  disabled={busy}
                >
                  <EditIcon />
                </ActionIconButton>
                <ActionIconButton
                  label={`Delete ${ms.title}`}
                  onClick={() => void deleteMilestone(ms)}
                  disabled={busy}
                  variant="danger"
                >
                  <DeleteIcon />
                </ActionIconButton>
              </div>
            </li>
          )
        )}
      </ul>

      {adding ? (
        <div className="milestoneAddForm">
          <input
            className="invInput milestoneAddTitleInput"
            placeholder="Milestone title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addMilestone()}
            autoFocus
            disabled={busy}
          />
          <div className="milestoneAddActions">
            <input
              type="date"
              className="invInput invInputDate"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              aria-label="Target date"
              disabled={busy}
            />
            <button
              type="button"
              className="chatSendBtn milestoneAddBtn"
              onClick={() => void addMilestone()}
              disabled={busy || !newTitle.trim()}
            >
              Add
            </button>
            <button
              type="button"
              className="outlineButton"
              onClick={() => {
                setAdding(false);
                setNewTitle("");
                setNewDate("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
