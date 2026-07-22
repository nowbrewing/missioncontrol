"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import ActionIconButton, { DeleteIcon } from "../ActionIconButton";
import { isIdeaTask } from "../../lib/task-ideas";
import { taskBelongsToPillarGroup } from "../../lib/life-admin";
import { PLANNING_IDEA_DRAG_MIME } from "../../lib/planning-idea-dnd";
import PlanningIdeaModal from "./PlanningIdeaModal";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../../lib/pillar-note-fields";

export type PlanningIdeaTask = {
  id: number;
  title: string;
  note?: string | null;
  note_field_values?: PillarNoteFieldValues;
  deadline: string | null;
  completed_at: string | null;
  pillar_id: number | null;
  is_idea?: number;
  rank?: number;
};

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  note_fields?: PillarNoteFieldDef[];
};

type Props = {
  pillar: Pillar;
  pillars: Pillar[];
  tasks: PlanningIdeaTask[];
  onChanged: () => Promise<void>;
  onTaskUpdated?: (task: PlanningIdeaTask) => void;
  onTaskDeleted?: (taskId: number) => void;
};

function sortIdeasForPillar(ideas: PlanningIdeaTask[]) {
  return [...ideas].sort((a, b) => {
    const rankDiff = (a.rank ?? 0) - (b.rank ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return a.id - b.id;
  });
}

function IdeaTile({
  idea,
  busy,
  onOpen,
  onDelete,
}: {
  idea: PlanningIdeaTask;
  busy: boolean;
  onOpen: (id: number) => void;
  onDelete: (idea: PlanningIdeaTask) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idea.id, disabled: busy });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasNote = !!idea.note?.trim();
  const hasFieldValues = Object.values(idea.note_field_values ?? {}).some((v) => v?.trim());

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`planningIdeaTile ${isDragging ? "isDragging" : ""}`}
    >
      <button
        type="button"
        className="planningIdeaTitle planningIdeaCalendarDrag"
        draggable={!busy}
        onDragStart={(e) => {
          e.dataTransfer.setData(PLANNING_IDEA_DRAG_MIME, String(idea.id));
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onOpen(idea.id)}
        title="Open idea — or drag onto the calendar to schedule"
      >
        {idea.title}
      </button>
      {hasNote || hasFieldValues ? <span className="planningIdeaNoteBadge">Note</span> : null}
      <ActionIconButton
        label={`Delete idea: ${idea.title}`}
        onClick={() => void onDelete(idea)}
        disabled={busy}
        variant="danger"
      >
        <DeleteIcon />
      </ActionIconButton>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="dragHandle planningIdeaDragHandle"
        aria-label={`Drag to reorder: ${idea.title}`}
        {...listeners}
        {...attributes}
      >
        ⠿
      </button>
    </li>
  );
}

export default function PlanningIdeas({
  pillar,
  pillars,
  tasks,
  onChanged,
  onTaskUpdated,
  onTaskDeleted,
}: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [orderedIdeas, setOrderedIdeas] = useState<PlanningIdeaTask[]>([]);

  const ideas = useMemo(
    () =>
      sortIdeasForPillar(
        tasks.filter(
          (t) =>
            isIdeaTask(t) &&
            !t.completed_at &&
            taskBelongsToPillarGroup(t, pillar)
        )
      ),
    [tasks, pillar]
  );

  useEffect(() => {
    setOrderedIdeas(ideas);
  }, [ideas]);

  const selectedIdea = orderedIdeas.find((idea) => idea.id === selectedIdeaId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function addIdea() {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          pillar_id: pillar.id,
          is_idea: true,
        }),
      });
      setNewTitle("");
      setAdding(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function saveIdea(
    id: number,
    patch: {
      title: string;
      note: string | null;
      note_field_values: PillarNoteFieldValues;
      deadline: string | null;
      pillar_id: number | null;
    }
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("save failed");
      setSelectedIdeaId(null);
      if (data.task) {
        onTaskUpdated?.(data.task);
      } else {
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteIdea(task: PlanningIdeaTask) {
    const ok = window.confirm(`Delete idea "${task.title}"?`);
    if (!ok || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (selectedIdeaId === task.id) setSelectedIdeaId(null);
      onTaskDeleted?.(task.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedIdeas.findIndex((idea) => idea.id === active.id);
    const newIndex = orderedIdeas.findIndex((idea) => idea.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedIdeas, oldIndex, newIndex);
    setOrderedIdeas(next);

    setBusy(true);
    try {
      const res = await fetch("/api/tasks/ideas/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar_id: pillar.id,
          ids: next.map((idea) => idea.id),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Could not reorder");
      await onChanged();
    } catch {
      setOrderedIdeas(ideas);
    } finally {
      setBusy(false);
    }
  }

  const sortableIds = orderedIdeas.map((idea) => idea.id);

  return (
    <section className="planningIdeas" aria-label={`Ideas for ${pillar.name}`}>
      <div className="planningCardHeaderTop">
        <div>
          <h2 className="planningIdeasTitle">Ideas</h2>
          <p className="sectionHint planningIdeasHint">
            Undated captures — drag a title onto the calendar to schedule, or use ⠿ to rank.
            Click to add notes and a date.
          </p>
        </div>
        {!adding && (
          <ActionIconButton label="Add idea" onClick={() => setAdding(true)} disabled={busy}>
            +
          </ActionIconButton>
        )}
      </div>

      {adding && (
        <form
          className="planningIdeaAddForm"
          onSubmit={(e) => {
            e.preventDefault();
            void addIdea();
          }}
        >
          <input
            className="invInput planningIdeaAddInput"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Capture an idea…"
            autoFocus
            disabled={busy}
          />
          <button type="submit" className="chatSendBtn" disabled={busy || !newTitle.trim()}>
            Add
          </button>
          <button
            type="button"
            className="outlineButton"
            onClick={() => {
              setAdding(false);
              setNewTitle("");
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </form>
      )}

      {orderedIdeas.length === 0 && !adding ? (
        <p className="sectionHint planningIdeasEmpty">No ideas yet for this pillar.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <ul className="planningIdeasList">
              {orderedIdeas.map((idea) => (
                <IdeaTile
                  key={idea.id}
                  idea={idea}
                  busy={busy}
                  onOpen={setSelectedIdeaId}
                  onDelete={deleteIdea}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {selectedIdea ? (
        <PlanningIdeaModal
          idea={selectedIdea}
          pillars={pillars}
          open
          busy={busy}
          onClose={() => setSelectedIdeaId(null)}
          onSave={(patch) => saveIdea(selectedIdea.id, patch)}
          onDelete={() => deleteIdea(selectedIdea)}
        />
      ) : null}
    </section>
  );
}
