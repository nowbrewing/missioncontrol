"use client";

import Link from "next/link";
import { useState } from "react";
import { PillarHeaderBar } from "./PillarChip";
import TaskMilestoneSelect from "./TaskMilestoneSelect";
import { taskBelongsToPillarGroup } from "../lib/life-admin";
import { pillarColorVars } from "../lib/pillar-colors";

type Task = {
  id: number;
  title: string;
  deadline: string | null;
  completed_at: string | null;
  pillar_id: number | null;
  milestone_id: number | null;
};

type Milestone = {
  id: number;
  title: string;
  pillar_id: number | null;
  completed_at?: string | null;
};

type Pillar = {
  id: number;
  name: string;
  color: string;
};

function isOverdue(deadline: string, completedAt: string | null) {
  if (completedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return deadline < today;
}

export default function PillarTasksModal({
  pillar,
  rank,
  tasks,
  milestones,
  onClose,
  onToggleTask,
  onTaskAdded,
}: {
  pillar: Pillar;
  rank: number;
  tasks: Task[];
  milestones: Milestone[];
  onClose: () => void;
  onToggleTask: (id: number, completed: boolean) => void;
  onTaskAdded: () => void | Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newMilestoneId, setNewMilestoneId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const milestoneById = new Map(milestones.map((m) => [m.id, m]));

  const pillarTasks = tasks.filter((t) => taskBelongsToPillarGroup(t, pillar));
  const open = pillarTasks.filter((t) => !t.completed_at);
  const done = pillarTasks.filter((t) => t.completed_at);

  async function addTask() {
    const title = newTitle.trim();
    if (!title || saving) return;

    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          deadline: newDeadline || null,
          pillar_id: pillar.id,
          milestone_id: newMilestoneId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not add task");
      }
      setNewTitle("");
      setNewDeadline("");
      setNewMilestoneId(null);
      await onTaskAdded();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add task");
    } finally {
      setSaving(false);
    }
  }

  function renderRow(task: Task) {
    const overdue =
      task.deadline && isOverdue(task.deadline, task.completed_at);
    const milestone = task.milestone_id
      ? milestoneById.get(task.milestone_id)
      : null;
    return (
      <li
        key={task.id}
        className={`pillarTasksRow ${task.completed_at ? "taskRowDone" : ""}`}
      >
        {(milestone || task.deadline) && (
          <div className="pillarTasksRowLabels">
            {milestone && (
              <span className="pill pillSubtle pillMilestone">{milestone.title}</span>
            )}
            {task.deadline && (
              <span
                className={`pill pillSubtle pillDeadline ${overdue ? "taskDeadlineOverdue" : ""}`}
              >
                {task.deadline}
              </span>
            )}
          </div>
        )}
        <label className="taskCheck">
          <input
            type="checkbox"
            checked={!!task.completed_at}
            onChange={(e) => onToggleTask(task.id, e.target.checked)}
          />
          <span className={task.completed_at ? "taskDone" : ""}>{task.title}</span>
        </label>
      </li>
    );
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`pillar-tasks-title-${pillar.id}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modalCard pillarTasksModal"
        style={pillarColorVars(pillar.color)}
      >
        <PillarHeaderBar name={pillar.name} color={pillar.color} rank={rank} />
        <h2
          id={`pillar-tasks-title-${pillar.id}`}
          className="modalTitle pillarTasksModalTitle"
        >
          Tasks
        </h2>
        <div className="pillarTasksModalBody">
          <div className="pillarTasksAddForm">
            <input
              className="invInput pillarTasksAddTitle"
              placeholder="New task for this pillar"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addTask()}
              disabled={saving}
            />
            <div className="pillarTasksAddMetaRow">
              <TaskMilestoneSelect
                milestones={milestones}
                pillarId={pillar.id}
                value={newMilestoneId}
                onChange={setNewMilestoneId}
                compact
                emptyLabel="Milestone (optional)"
              />
              <input
                className="invInput invInputDate pillarTasksAddDate"
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                title="Deadline (optional)"
                disabled={saving}
              />
            </div>
            <button
              type="button"
              className="outlineButton pillarTasksAddBtn"
              onClick={() => void addTask()}
              disabled={saving || !newTitle.trim()}
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
          {addError ? <p className="chatError">{addError}</p> : null}

          {pillarTasks.length === 0 ? (
            <p className="modalNote">No tasks linked to this pillar yet.</p>
          ) : (
            <div className="pillarTasksSections">
              {open.length > 0 && (
                <section>
                  <p className="modalLabel">Open ({open.length})</p>
                  <ul className="pillarTasksList">{open.map(renderRow)}</ul>
                </section>
              )}
              {done.length > 0 && (
                <section>
                  <p className="modalLabel">Completed ({done.length})</p>
                  <ul className="pillarTasksList">{done.map(renderRow)}</ul>
                </section>
              )}
            </div>
          )}
        </div>
        <div className="modalActions pillarTasksModalActions">
          <Link href="/tasks" className="outlineButton">
            All tasks
          </Link>
          <button type="button" className="chatSendBtn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
