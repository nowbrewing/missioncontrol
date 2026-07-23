"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PillarHeaderBar } from "./PillarChip";
import ActionIconButton, { DeleteIcon, EditIcon } from "./ActionIconButton";
import PlanningIdeaModal from "./calendar/PlanningIdeaModal";
import type { PlanningIdeaTask } from "./calendar/PlanningIdeas";
import TaskCardMeta from "./TaskCardMeta";
import TaskDeadlineEditor from "./TaskDeadlineEditor";
import TaskPillarSelect from "./TaskPillarSelect";
import TaskTitleEditor from "./TaskTitleEditor";
import { pillarColorVars } from "../lib/pillar-colors";
import { taskBelongsToPillarGroup } from "../lib/life-admin";
import type { TaskNoteImage } from "../lib/task-note-images";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../lib/pillar-note-fields";

type Task = {
  id: number;
  title: string;
  description: string | null;
  note: string | null;
  note_images?: TaskNoteImage[];
  note_field_values?: PillarNoteFieldValues;
  deadline: string | null;
  completed_at: string | null;
  rank: number;
  pillar_id: number | null;
  milestone_id: number | null;
  schedule_type: string | null;
  window_start: string | null;
};

type Pillar = {
  id: number;
  name: string;
  abbreviation: string | null;
  color: string;
  rank: number;
  note_fields?: PillarNoteFieldDef[];
};

type Milestone = {
  id: number;
  title: string;
  pillar_id: number | null;
  completed_at: string | null;
};

export default function TasksList({
  showCompleted = true,
  groupByPillar = false,
}: {
  showCompleted?: boolean;
  groupByPillar?: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newPillarId, setNewPillarId] = useState<number | null>(null);
  const [pillarDrafts, setPillarDrafts] = useState<
    Record<number, { title: string; deadline: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskModalBusy, setTaskModalBusy] = useState(false);

  const pillarMap = useMemo(
    () => new Map(pillars.map((p) => [p.id, p])),
    [pillars]
  );

  const load = useCallback(async () => {
    const [tasksRes, pillarsRes, milestonesRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/pillars"),
      fetch("/api/milestones"),
    ]);
    const tasksData = await tasksRes.json();
    const pillarsData = await pillarsRes.json();
    const milestonesData = await milestonesRes.json();
    if (tasksData.ok) setTasks(tasksData.tasks);
    if (pillarsData.ok) setPillars(pillarsData.pillars);
    if (milestonesData.ok) setMilestones(milestonesData.milestones);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(pillarId: number | null = newPillarId) {
    const title = newTitle.trim();
    if (!title) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        deadline: newDeadline || null,
        pillar_id: pillarId,
      }),
    });
    setNewTitle("");
    setNewDeadline("");
    await load();
  }

  async function addTaskForPillar(pillarId: number) {
    const draft = pillarDrafts[pillarId] ?? { title: "", deadline: "" };
    const title = draft.title.trim();
    if (!title) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        deadline: draft.deadline || null,
        pillar_id: pillarId,
      }),
    });
    setPillarDrafts((prev) => ({
      ...prev,
      [pillarId]: { title: "", deadline: "" },
    }));
    await load();
  }

  function updatePillarDraft(
    pillarId: number,
    patch: Partial<{ title: string; deadline: string }>
  ) {
    setPillarDrafts((prev) => {
      const current = prev[pillarId] ?? { title: "", deadline: "" };
      return {
        ...prev,
        [pillarId]: { ...current, ...patch },
      };
    });
  }

  async function toggleTask(id: number, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    await load();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await load();
  }

  async function patchTask(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Could not save task");
    }
    return data.task as Task | undefined;
  }

  function applyTaskPatch(id: number, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function updateTitle(id: number, title: string) {
    applyTaskPatch(id, { title });
    try {
      await patchTask(id, { title });
    } catch {
      await load();
      throw new Error("Could not save task title");
    }
  }

  async function updateDeadline(id: number, deadline: string | null) {
    applyTaskPatch(id, { deadline });
    try {
      await patchTask(id, { deadline });
    } catch {
      await load();
    }
  }

  async function updatePillar(id: number, pillarId: number | null) {
    const task = tasks.find((t) => t.id === id);
    let milestoneId = task?.milestone_id ?? null;
    if (milestoneId && pillarId) {
      const ms = milestones.find((m) => m.id === milestoneId);
      if (ms && ms.pillar_id !== pillarId) milestoneId = null;
    }
    applyTaskPatch(id, { pillar_id: pillarId, milestone_id: milestoneId });
    try {
      await patchTask(id, {
        pillar_id: pillarId,
        ...(milestoneId !== task?.milestone_id ? { milestone_id: milestoneId } : {}),
      });
    } catch {
      await load();
    }
  }

  async function updateNote(
    id: number,
    change: {
      note: string | null;
      note_images: TaskNoteImage[];
      note_field_values: PillarNoteFieldValues;
    }
  ) {
    applyTaskPatch(id, {
      note: change.note,
      note_images: change.note_images,
      note_field_values: change.note_field_values,
    });
    try {
      await patchTask(id, {
        note: change.note,
        note_images: change.note_images,
        note_field_values: change.note_field_values,
      });
    } catch {
      await load();
      throw new Error("Could not save task note");
    }
  }

  const editingTask =
    editingTaskId == null ? null : (tasks.find((t) => t.id === editingTaskId) ?? null);

  const editingIdea: PlanningIdeaTask | null = editingTask
    ? {
        id: editingTask.id,
        title: editingTask.title,
        note: editingTask.note ?? null,
        note_images: editingTask.note_images ?? [],
        note_field_values: editingTask.note_field_values ?? {},
        deadline: editingTask.deadline,
        completed_at: editingTask.completed_at,
        pillar_id: editingTask.pillar_id,
        is_idea: 0,
      }
    : null;

  async function saveEditingTask(patch: {
    title: string;
    note: string | null;
    note_images: TaskNoteImage[];
    note_field_values: PillarNoteFieldValues;
    deadline: string | null;
    pillar_id: number | null;
    completed?: boolean;
  }) {
    if (!editingTask) return;
    setTaskModalBusy(true);
    try {
      if (patch.title !== editingTask.title) {
        await updateTitle(editingTask.id, patch.title);
      }
      if ((patch.pillar_id ?? null) !== (editingTask.pillar_id ?? null)) {
        await updatePillar(editingTask.id, patch.pillar_id);
      }
      const noteChanged =
        (patch.note ?? null) !== (editingTask.note ?? null) ||
        JSON.stringify(patch.note_images ?? []) !==
          JSON.stringify(editingTask.note_images ?? []) ||
        JSON.stringify(patch.note_field_values ?? {}) !==
          JSON.stringify(editingTask.note_field_values ?? {});
      if (noteChanged) {
        await updateNote(editingTask.id, {
          note: patch.note,
          note_images: patch.note_images,
          note_field_values: patch.note_field_values,
        });
      }
      if ((patch.deadline ?? null) !== (editingTask.deadline ?? null)) {
        await updateDeadline(editingTask.id, patch.deadline);
      }
      if (patch.completed !== undefined) {
        const wasCompleted = !!editingTask.completed_at;
        if (patch.completed !== wasCompleted) {
          await toggleTask(editingTask.id, patch.completed);
        }
      }
    } finally {
      setTaskModalBusy(false);
    }
  }

  async function deleteEditingTask() {
    if (!editingTask) return;
    if (!window.confirm(`Delete "${editingTask.title}"? This cannot be undone.`)) {
      return;
    }
    setTaskModalBusy(true);
    try {
      await deleteTask(editingTask.id);
      setEditingTaskId(null);
    } finally {
      setTaskModalBusy(false);
    }
  }

  const visible = showCompleted ? tasks : tasks.filter((t) => !t.completed_at);

  if (loading) return <p className="subtitle">Loading tasks...</p>;

  function renderTask(task: Task) {
    const pillar = task.pillar_id ? pillarMap.get(task.pillar_id) : null;
    return (
      <li
        key={task.id}
        className={`taskRow ${task.completed_at ? "taskRowDone" : ""} ${pillar ? "taskRowColored" : ""}`}
        style={pillar ? pillarColorVars(pillar.color) : undefined}
        title={pillar?.name}
      >
        <div className="taskCardRowTop">
          <label className="taskCheck">
            <input
              type="checkbox"
              checked={!!task.completed_at}
              onChange={(e) => toggleTask(task.id, e.target.checked)}
            />
          </label>
          <TaskTitleEditor
            title={task.title}
            completed={!!task.completed_at}
            className="taskCardTitle"
            onChange={(title) => updateTitle(task.id, title)}
          />
          <ActionIconButton
            className="taskCardEditBtn"
            label={`Edit task: ${task.title}`}
            onClick={() => setEditingTaskId(task.id)}
          >
            <EditIcon />
          </ActionIconButton>
          <TaskDeadlineEditor
            deadline={task.deadline}
            overdue={!!task.deadline && isOverdue(task.deadline, task.completed_at)}
            onChange={(deadline) => updateDeadline(task.id, deadline)}
          />
        </div>
        <div className="taskCardRowBottom">
          <TaskCardMeta
            pillars={pillars}
            milestones={milestones}
            pillarId={task.pillar_id}
            milestoneId={task.milestone_id}
            scheduleType={task.schedule_type}
            compact
            editable={false}
          />
          <div className="taskCardActions">
            <ActionIconButton
              label="Delete task"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                  void deleteTask(task.id);
                }
              }}
              variant="danger"
            >
              <DeleteIcon />
            </ActionIconButton>
          </div>
        </div>
      </li>
    );
  }

  const modal = editingIdea ? (
    <PlanningIdeaModal
      idea={editingIdea}
      pillars={pillars}
      open
      busy={taskModalBusy}
      onClose={() => setEditingTaskId(null)}
      onSave={saveEditingTask}
      onDelete={deleteEditingTask}
    />
  ) : null;

  if (groupByPillar && pillars.length > 0) {
    const grouped = pillars.map((pillar, idx) => ({
      pillar,
      rank: idx + 1,
      tasks: visible.filter((t) => taskBelongsToPillarGroup(t, pillar)),
    }));

    return (
      <div className="sections">
        <div className="inlineForm">
          <input
            className="invInput"
            placeholder="New chore or task"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addTask()}
          />
          <TaskPillarSelect
            pillars={pillars}
            value={newPillarId}
            onChange={setNewPillarId}
          />
          <input
            className="invInput invInputDate"
            type="date"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            title="Deadline (optional)"
          />
          <button type="button" className="outlineButton" onClick={() => void addTask()}>
            Add
          </button>
        </div>

        {grouped.map(({ pillar, rank, tasks: pillarTasks }) => {
          const draft = pillarDrafts[pillar.id] ?? { title: "", deadline: "" };
          return (
            <section
              key={pillar.id}
              className="section taskPillarGroup"
              style={pillarColorVars(pillar.color)}
            >
              <PillarHeaderBar name={pillar.name} color={pillar.color} rank={rank} />
              <div className="inlineForm taskPillarAddForm">
                <input
                  className="invInput"
                  placeholder={`Add task to ${pillar.name}`}
                  value={draft.title}
                  onChange={(e) =>
                    updatePillarDraft(pillar.id, { title: e.target.value })
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && void addTaskForPillar(pillar.id)
                  }
                />
                <input
                  className="invInput invInputDate"
                  type="date"
                  value={draft.deadline}
                  onChange={(e) =>
                    updatePillarDraft(pillar.id, { deadline: e.target.value })
                  }
                  title="Deadline (optional)"
                />
                <button
                  type="button"
                  className="outlineButton"
                  onClick={() => void addTaskForPillar(pillar.id)}
                  disabled={!draft.title.trim()}
                >
                  Add
                </button>
              </div>
              {pillarTasks.length > 0 ? (
                <ul className="taskList">{pillarTasks.map(renderTask)}</ul>
              ) : (
                <p className="sectionHint">No tasks in this pillar yet.</p>
              )}
            </section>
          );
        })}

        {visible.length === 0 && (
          <div className="card">
            <span style={{ opacity: 0.8 }}>No tasks yet — add one above or in a pillar.</span>
          </div>
        )}
        {modal}
      </div>
    );
  }

  return (
    <div className="sections">
      <div className="inlineForm">
        <input
          className="invInput"
          placeholder="New chore or task"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addTask()}
        />
        <input
          className="invInput invInputDate"
          type="date"
          value={newDeadline}
          onChange={(e) => setNewDeadline(e.target.value)}
          title="Deadline (optional)"
        />
        <button type="button" className="outlineButton" onClick={() => void addTask()}>
          Add
        </button>
      </div>

      <ul className="taskList">
        {visible.length === 0 && (
          <li className="card" style={{ listStyle: "none" }}>
            <span style={{ opacity: 0.8 }}>No tasks yet.</span>
          </li>
        )}
        {visible.map(renderTask)}
      </ul>
      {modal}
    </div>
  );
}

function isOverdue(deadline: string, completedAt: string | null) {
  if (completedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return deadline < today;
}
