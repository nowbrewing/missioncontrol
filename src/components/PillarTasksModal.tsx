"use client";

import Link from "next/link";
import { PillarHeaderBar } from "./PillarChip";
import { taskBelongsToPillarGroup } from "../lib/life-admin";
import { pillarColorVars } from "../lib/pillar-colors";

type Task = {
  id: number;
  title: string;
  deadline: string | null;
  completed_at: string | null;
  pillar_id: number | null;
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
  onClose,
  onToggleTask,
}: {
  pillar: Pillar;
  rank: number;
  tasks: Task[];
  onClose: () => void;
  onToggleTask: (id: number, completed: boolean) => void;
}) {
  const pillarTasks = tasks.filter((t) => taskBelongsToPillarGroup(t, pillar));
  const open = pillarTasks.filter((t) => !t.completed_at);
  const done = pillarTasks.filter((t) => t.completed_at);

  function renderRow(task: Task) {
    const overdue =
      task.deadline && isOverdue(task.deadline, task.completed_at);
    return (
      <li
        key={task.id}
        className={`pillarTasksRow ${task.completed_at ? "taskRowDone" : ""}`}
      >
        <label className="taskCheck">
          <input
            type="checkbox"
            checked={!!task.completed_at}
            onChange={(e) => onToggleTask(task.id, e.target.checked)}
          />
          <span className={task.completed_at ? "taskDone" : ""}>{task.title}</span>
        </label>
        {task.deadline && (
          <span className={`pill pillSubtle ${overdue ? "taskDeadlineOverdue" : ""}`}>
            {task.deadline}
          </span>
        )}
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
