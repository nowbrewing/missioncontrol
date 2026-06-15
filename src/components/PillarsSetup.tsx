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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PillarColorDot from "./PillarColorDot";
import PillarColorPicker from "./PillarColorPicker";
import PillarContextField from "./PillarContextField";
import PillarTasksModal from "./PillarTasksModal";
import { DEFAULT_PILLAR_COLOR, pillarColorVars } from "../lib/pillar-colors";
import { taskBelongsToPillarGroup } from "../lib/life-admin";
import {
  appendPillarContext,
  latestPillarContextSnippet,
  parsePillarContext,
  removePillarContextAt,
  serializePillarContext,
} from "../lib/pillar-context";

import {
  defaultPillarAbbreviation,
  normalizePillarAbbreviationInput,
} from "../lib/pillar-abbreviation";

type Pillar = {
  id: number;
  name: string;
  description: string | null;
  abbreviation: string | null;
  color: string;
  rank: number;
};

type Milestone = {
  id: number;
  pillar_id: number | null;
  title: string;
  target_date: string | null;
  rank: number;
  completed_at: string | null;
};

type Task = {
  id: number;
  title: string;
  deadline: string | null;
  completed_at: string | null;
  pillar_id: number | null;
  milestone_id: number | null;
};

function DragHandle({
  setActivatorNodeRef,
  listeners,
  attributes,
  label,
}: {
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
  label: string;
}) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="dragHandle"
      aria-label={label}
      {...listeners}
      {...attributes}
    >
      ⠿
    </button>
  );
}

type MilestoneDialog =
  | { action: "toggle"; id: number; title: string; completed: boolean }
  | { action: "delete"; id: number; title: string };

function AddPillarDialog({
  name,
  description,
  color,
  saving,
  onNameChange,
  onDescriptionChange,
  onColorChange,
  onSubmit,
  onClose,
}: {
  name: string;
  description: string;
  color: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-pillar-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modalCard">
        <h2 id="add-pillar-title" className="modalTitle">
          Add a pillar
        </h2>
        <p className="modalNote">
          Life areas you are focusing on — career, health, relationships, etc.
        </p>
        <div className="modalForm">
          <div className="modalField">
            <label className="modalLabel" htmlFor="new-pillar-name">
              Name
            </label>
            <input
              id="new-pillar-name"
              className="invInput"
              placeholder="e.g. Health & Fitness"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="modalField">
            <label className="modalLabel" htmlFor="new-pillar-desc">
              Starting context
            </label>
            <p className="sectionHint pillarContextHint">
              Optional first note — you can keep stacking more after creating the pillar.
            </p>
            <textarea
              id="new-pillar-desc"
              className="chatInput"
              rows={2}
              placeholder="What does this area mean to you right now?"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              disabled={saving}
            />
          </div>
          <PillarColorPicker value={color} onChange={onColorChange} />
        </div>
        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={onSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? "Adding..." : "Add pillar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestoneActionDialog({
  dialog,
  onConfirm,
  onCancel,
}: {
  dialog: MilestoneDialog;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDelete = dialog.action === "delete";
  const isComplete = dialog.action === "toggle" && dialog.completed;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <h2 className="modalTitle">
          {isDelete
            ? "Delete milestone?"
            : isComplete
              ? "Mark milestone complete?"
              : "Mark milestone incomplete?"}
        </h2>
        <p className="modalNote">
          {isDelete
            ? `Delete "${dialog.title}"? This cannot be undone.`
            : isComplete
              ? `Mark "${dialog.title}" as done?`
              : `Uncheck "${dialog.title}" and mark it as not done?`}
        </p>
        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="chatSendBtn" onClick={onConfirm}>
            {isDelete ? "Delete" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function visibleMilestones(list: Milestone[], hideCompleted: boolean) {
  if (!hideCompleted) return list;
  return list.filter((m) => !m.completed_at);
}

function SortableMilestoneRow({
  milestone,
  index,
  pillarColor,
  onRequestToggle,
  onRequestDelete,
}: {
  milestone: Milestone;
  index: number;
  pillarColor: string;
  onRequestToggle: (id: number, title: string, completed: boolean) => void;
  onRequestDelete: (id: number, title: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `milestone-${milestone.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={{ ...style, ...pillarColorVars(pillarColor) }}
      className={`milestoneRow milestoneRowColored ${isDragging ? "isDragging" : ""}`}
    >
      <DragHandle
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
        label={`Drag to reorder milestone: ${milestone.title}`}
      />
      <span className="rankBadge rankBadgeSmall">{index + 1}</span>
      <label className="taskCheck">
        <input
          type="checkbox"
          checked={!!milestone.completed_at}
          readOnly
          onClick={(e) => {
            e.preventDefault();
            onRequestToggle(milestone.id, milestone.title, !milestone.completed_at);
          }}
        />
        <span className={milestone.completed_at ? "taskDone" : ""}>{milestone.title}</span>
      </label>
      {milestone.target_date && (
        <span className="pill pillSubtle">{milestone.target_date}</span>
      )}
      <button
        type="button"
        className="rankBtn milestoneDeleteBtn"
        onClick={() => onRequestDelete(milestone.id, milestone.title)}
        aria-label={`Delete milestone: ${milestone.title}`}
      >
        ×
      </button>
    </li>
  );
}

function SortablePillarCard({
  pillar,
  index,
  collapsed,
  onToggleCollapse,
  pillarMilestones,
  onNameBlur,
  onAbbreviationBlur,
  onAppendContext,
  onRemoveContextEntry,
  onColorChange,
  onAddMilestone,
  onRequestMilestoneToggle,
  onRequestMilestoneDelete,
  onMilestoneDragEnd,
  hideCompleted,
  newMilestone,
  newMilestoneDate,
  onNewMilestoneChange,
  onNewMilestoneDateChange,
  taskCount,
  onShowTasks,
}: {
  pillar: Pillar;
  index: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  pillarMilestones: Milestone[];
  onNameBlur: (id: number, name: string) => void;
  onAbbreviationBlur: (id: number, abbreviation: string) => void;
  onAppendContext: (id: number, text: string) => void;
  onRemoveContextEntry: (id: number, index: number) => void;
  onColorChange: (id: number, color: string) => void;
  onAddMilestone: (pillarId: number) => void;
  onRequestMilestoneToggle: (id: number, title: string, completed: boolean) => void;
  onRequestMilestoneDelete: (id: number, title: string) => void;
  onMilestoneDragEnd: (pillarId: number, event: DragEndEvent) => void;
  hideCompleted: boolean;
  newMilestone: string;
  newMilestoneDate: string;
  onNewMilestoneChange: (value: string) => void;
  onNewMilestoneDateChange: (value: string) => void;
  taskCount: number;
  onShowTasks: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `pillar-${pillar.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const shownMilestones = visibleMilestones(pillarMilestones, hideCompleted);
  const completedHidden = hideCompleted
    ? pillarMilestones.filter((m) => m.completed_at).length
    : 0;
  const milestoneIds = shownMilestones.map((m) => `milestone-${m.id}`);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [contextExpanded, setContextExpanded] = useState(false);
  const [addContextOpen, setAddContextOpen] = useState(false);
  const contextCount = parsePillarContext(pillar.description).length;

  return (
    <section
      ref={setNodeRef}
      style={{ ...style, ...pillarColorVars(pillar.color) }}
      className={`section pillarCard pillarCardColored ${isDragging ? "isDragging" : ""} ${collapsed ? "pillarCardCollapsed" : ""}`}
    >
      <div className="pillarHeader pillarHeaderColored">
        <DragHandle
          setActivatorNodeRef={setActivatorNodeRef}
          listeners={listeners}
          attributes={attributes}
          label={`Drag to reorder pillar: ${pillar.name}`}
        />
        <div className="pillarHeaderMain">
          <span className="rankBadge">#{index + 1}</span>
          <input
            key={pillar.name}
            className="pillarNameInput"
            defaultValue={pillar.name}
            aria-label="Pillar name"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (!next) {
                e.target.value = pillar.name;
                return;
              }
              if (next !== pillar.name) onNameBlur(pillar.id, next);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          {collapsed && latestPillarContextSnippet(pillar.description) && (
            <span className="pillarCollapsedHint">
              {latestPillarContextSnippet(pillar.description)}
            </span>
          )}
          {collapsed && taskCount > 0 && (
            <span className="pill pillSubtle">
              {taskCount} task{taskCount === 1 ? "" : "s"}
            </span>
          )}
          {collapsed && shownMilestones.length > 0 && (
            <span className="pill pillSubtle">
              {shownMilestones.length} milestone{shownMilestones.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            className="btnCompact outlineButton pillarHeaderTasksBtn"
            onClick={onShowTasks}
          >
            Tasks{taskCount > 0 ? ` (${taskCount})` : ""}
          </button>
        )}
        <button
          type="button"
          className="collapseBtn"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${pillar.name}` : `Collapse ${pillar.name}`}
        >
          <span className={`collapseChevron ${collapsed ? "" : "collapseChevronOpen"}`}>
            ▸
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="pillarBody">
          <div className="pillarMetaRow">
            <PillarColorDot
              value={pillar.color}
              onChange={(color) => onColorChange(pillar.id, color)}
            />
            <input
              id={`pillar-abbr-${pillar.id}`}
              className="invInput pillarAbbrInline"
              defaultValue={pillar.abbreviation ?? ""}
              placeholder={defaultPillarAbbreviation(pillar.name)}
              maxLength={8}
              aria-label="Pillar abbreviation"
              title={`Shown on task rows. Blank uses ${defaultPillarAbbreviation(pillar.name)}.`}
              onBlur={(e) => onAbbreviationBlur(pillar.id, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <button
              type="button"
              className="btnCompact outlineButton pillarMetaBtn"
              onClick={onShowTasks}
            >
              Tasks{taskCount > 0 ? ` (${taskCount})` : ""}
            </button>
            <button
              type="button"
              className="btnCompact outlineButton pillarMetaBtn"
              onClick={() => setContextExpanded((prev) => !prev)}
              aria-expanded={contextExpanded}
              aria-controls={`pillar-context-stack-${pillar.id}`}
            >
              Context
              {contextCount > 0 ? ` (${contextCount})` : ""}
              <span
                className={`collapseChevron collapseChevronSm ${contextExpanded ? "collapseChevronOpen" : ""}`}
              >
                ▸
              </span>
            </button>
            <button
              type="button"
              className="btnCompact outlineButton pillarMetaBtn"
              onClick={() => setAddContextOpen(true)}
            >
              Add
            </button>
          </div>

          <PillarContextField
            inputId={`pillar-desc-${pillar.id}`}
            stackId={`pillar-context-stack-${pillar.id}`}
            description={pillar.description}
            onAppend={(text) => onAppendContext(pillar.id, text)}
            onRemoveEntry={(index) => onRemoveContextEntry(pillar.id, index)}
            compact
            stackExpanded={contextExpanded}
            addDialogOpen={addContextOpen}
            onAddDialogOpenChange={setAddContextOpen}
          />

          <div className="milestonesSection milestonesSectionColored">
            <div className="milestonesTitleRow">
              <h3 className="milestonesTitle">Milestones</h3>
              {completedHidden > 0 && (
                <span className="pill pillSubtle">
                  {completedHidden} completed hidden
                </span>
              )}
            </div>
            <p className="sectionHint" style={{ marginTop: 0 }}>
              Drag the ⠿ handle to reorder. Long-press on mobile.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => onMilestoneDragEnd(pillar.id, e)}
            >
              <SortableContext items={milestoneIds} strategy={verticalListSortingStrategy}>
                <ul className="milestoneList">
                  {shownMilestones.length === 0 && (
                    <li className="milestoneEmpty">
                      {pillarMilestones.length === 0
                        ? "No milestones yet."
                        : "No open milestones."}
                    </li>
                  )}
                  {shownMilestones.map((ms, mIdx) => (
                    <SortableMilestoneRow
                      key={ms.id}
                      milestone={ms}
                      index={mIdx}
                      pillarColor={pillar.color}
                      onRequestToggle={onRequestMilestoneToggle}
                      onRequestDelete={onRequestMilestoneDelete}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            <div className="milestoneAddForm">
              <input
                className="invInput milestoneAddTitleInput"
                placeholder="Add milestone"
                value={newMilestone}
                onChange={(e) => onNewMilestoneChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddMilestone(pillar.id)}
              />
              <div className="milestoneAddActions">
                <input
                  className="invInput invInputDate"
                  type="date"
                  title="Deadline (optional)"
                  value={newMilestoneDate}
                  onChange={(e) => onNewMilestoneDateChange(e.target.value)}
                />
                <button
                  type="button"
                  className="outlineButton milestoneAddBtn"
                  onClick={() => onAddMilestone(pillar.id)}
                >
                  Add milestone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function PillarsSetup({ onboarding = false }: { onboarding?: boolean }) {
  const router = useRouter();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksModalPillarId, setTasksModalPillarId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [newPillar, setNewPillar] = useState("");
  const [newPillarDescription, setNewPillarDescription] = useState("");
  const [newPillarColor, setNewPillarColor] = useState<string>(DEFAULT_PILLAR_COLOR);
  const [newMilestones, setNewMilestones] = useState<Record<number, string>>({});
  const [newMilestoneDates, setNewMilestoneDates] = useState<Record<number, string>>({});
  const [hideCompleted, setHideCompleted] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState<MilestoneDialog | null>(null);
  const [showAddPillar, setShowAddPillar] = useState(false);
  const [addingPillar, setAddingPillar] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    const [pillarsRes, tasksRes] = await Promise.all([
      fetch("/api/pillars"),
      fetch("/api/tasks"),
    ]);
    const data = await pillarsRes.json();
    const tasksData = await tasksRes.json();
    if (data.ok) {
      setPillars(data.pillars);
      setMilestones(data.milestones);
    }
    if (tasksData.ok) setTasks(tasksData.tasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetAddPillarForm() {
    setNewPillar("");
    setNewPillarDescription("");
    setNewPillarColor(DEFAULT_PILLAR_COLOR);
  }

  function closeAddPillarDialog() {
    if (addingPillar) return;
    setShowAddPillar(false);
    resetAddPillarForm();
  }

  async function addPillar() {
    const name = newPillar.trim();
    if (!name || addingPillar) return;
    setAddingPillar(true);
    try {
      await fetch("/api/pillars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newPillarDescription.trim()
            ? serializePillarContext([
                { at: new Date().toISOString().slice(0, 10), text: newPillarDescription.trim() },
              ])
            : null,
          color: newPillarColor,
        }),
      });
      resetAddPillarForm();
      setShowAddPillar(false);
      await load();
    } finally {
      setAddingPillar(false);
    }
  }

  async function updatePillarAbbreviation(id: number, abbreviation: string) {
    const next = normalizePillarAbbreviationInput(abbreviation);
    const prev = pillars.find((p) => p.id === id)?.abbreviation ?? null;
    const res = await fetch(`/api/pillars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ abbreviation: next }),
    });
    if (res.ok) {
      setPillars((prevPillars) =>
        prevPillars.map((p) => (p.id === id ? { ...p, abbreviation: next } : p))
      );
    } else {
      setPillars((prevPillars) =>
        prevPillars.map((p) => (p.id === id ? { ...p, abbreviation: prev } : p))
      );
    }
  }

  async function updatePillarName(id: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const prevName = pillars.find((p) => p.id === id)?.name;
    const res = await fetch(`/api/pillars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setPillars((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
      );
    } else if (prevName) {
      setPillars((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: prevName } : p))
      );
    }
  }

  async function appendPillarContextEntry(id: number, text: string) {
    const pillar = pillars.find((p) => p.id === id);
    if (!pillar) return;
    const next = appendPillarContext(pillar.description, text);
    await fetch(`/api/pillars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: next }),
    });
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description: next } : p))
    );
  }

  async function removePillarContextEntry(id: number, index: number) {
    const pillar = pillars.find((p) => p.id === id);
    if (!pillar) return;
    const next = removePillarContextAt(pillar.description, index);
    await fetch(`/api/pillars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: next }),
    });
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description: next } : p))
    );
  }

  async function updatePillarColor(id: number, color: string) {
    const prevColor = pillars.find((p) => p.id === id)?.color;
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color } : p))
    );
    const res = await fetch(`/api/pillars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    if (!res.ok) {
      setPillars((prev) =>
        prev.map((p) => (p.id === id ? { ...p, color: prevColor ?? p.color } : p))
      );
    }
  }

  async function persistPillarOrder(next: Pillar[]) {
    setPillars(next);
    await fetch("/api/pillars/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    });
  }

  function handlePillarDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pillars.findIndex((p) => `pillar-${p.id}` === active.id);
    const newIndex = pillars.findIndex((p) => `pillar-${p.id}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    void persistPillarOrder(arrayMove(pillars, oldIndex, newIndex));
  }

  async function addMilestone(pillarId: number) {
    const title = newMilestones[pillarId]?.trim();
    if (!title) return;
    await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pillar_id: pillarId,
        title,
        target_date: newMilestoneDates[pillarId] || null,
      }),
    });
    setNewMilestones((prev) => ({ ...prev, [pillarId]: "" }));
    setNewMilestoneDates((prev) => ({ ...prev, [pillarId]: "" }));
    await load();
  }

  async function persistMilestoneOrder(pillarId: number, next: Milestone[]) {
    setMilestones((prev) => {
      const others = prev.filter((m) => m.pillar_id !== pillarId);
      return [...others, ...next];
    });
    await fetch("/api/milestones/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((m) => m.id) }),
    });
  }

  function handleMilestoneDragEnd(pillarId: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const all = milestones.filter((m) => m.pillar_id === pillarId);
    const visible = visibleMilestones(all, hideCompleted);
    const oldIndex = visible.findIndex((m) => `milestone-${m.id}` === active.id);
    const newIndex = visible.findIndex((m) => `milestone-${m.id}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedVisible = arrayMove(visible, oldIndex, newIndex);
    const completed = all.filter((m) => m.completed_at);
    const next = hideCompleted ? [...reorderedVisible, ...completed] : reorderedVisible;
    void persistMilestoneOrder(pillarId, next);
  }

  function requestMilestoneToggle(id: number, title: string, completed: boolean) {
    setMilestoneDialog({ action: "toggle", id, title, completed });
  }

  function requestMilestoneDelete(id: number, title: string) {
    setMilestoneDialog({ action: "delete", id, title });
  }

  function taskCountForPillar(pillar: Pillar) {
    return tasks.filter((t) => taskBelongsToPillarGroup(t, pillar)).length;
  }

  async function togglePillarTask(id: number, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed_at: completed ? new Date().toISOString() : null }
          : t
      )
    );
  }

  async function confirmMilestoneAction() {
    if (!milestoneDialog) return;
    const dialog = milestoneDialog;
    setMilestoneDialog(null);

    if (dialog.action === "delete") {
      await fetch(`/api/milestones/${dialog.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/milestones/${dialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: dialog.completed }),
      });
    }
    await load();
  }

  function toggleCollapse(pillarId: number) {
    setCollapsed((prev) => ({ ...prev, [pillarId]: !prev[pillarId] }));
  }

  function toggleAllCollapse() {
    const allCollapsed =
      pillars.length > 0 && pillars.every((pillar) => collapsed[pillar.id]);
    if (allCollapsed) {
      setCollapsed({});
      return;
    }
    setCollapsed(Object.fromEntries(pillars.map((pillar) => [pillar.id, true])));
  }

  function finishOnboarding() {
    router.push("/mission");
    router.refresh();
  }

  if (loading) return <p className="subtitle">Loading pillars...</p>;

  const pillarIds = pillars.map((p) => `pillar-${p.id}`);
  const allCollapsed =
    pillars.length > 0 && pillars.every((pillar) => collapsed[pillar.id]);
  const tasksModalPillar =
    tasksModalPillarId != null
      ? pillars.find((p) => p.id === tasksModalPillarId)
      : null;
  const tasksModalPillarRank = tasksModalPillar
    ? pillars.findIndex((p) => p.id === tasksModalPillar.id) + 1
    : 0;

  return (
    <div className="sections">
      {onboarding && (
        <div className="card onboardingBanner">
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Start with 3–5 pillars that matter most to you right now. Add milestones
            with optional deadlines for each. Drag the ⠿ handles to reorder — long-press
            on mobile. Collapse cards to scan your list. You can change all of this
            anytime.
          </p>
        </div>
      )}

      <div className="pillarsPageHeader">
        <h2 className="sectionTitle" style={{ margin: 0 }}>
          Your pillars
        </h2>
        <div className="pillarsPageHeaderActions">
          <Link href="/tasks" className="outlineButton">
            All tasks
          </Link>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => setShowAddPillar(true)}
          >
            Add pillar
          </button>
        </div>
      </div>

      {pillars.length > 0 && (
        <div className="pillarsToolbar">
          <p className="sectionHint reorderHint">
            Drag ⠿ to reorder pillars. Tap ▸ to collapse or expand a card.
          </p>
          <div className="pillarsToolbarActions">
            <button
              type="button"
              className="outlineButton"
              onClick={toggleAllCollapse}
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
            <label className="filterToggle">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
              />
              Hide completed milestones
            </label>
          </div>
        </div>
      )}

      {pillars.length === 0 && (
        <div className="card">
          <p style={{ margin: 0, opacity: 0.8 }}>
            No pillars yet. Click <strong>Add pillar</strong> to create your first life
            focus area.
          </p>
        </div>
      )}

      {showAddPillar && (
        <AddPillarDialog
          name={newPillar}
          description={newPillarDescription}
          color={newPillarColor}
          saving={addingPillar}
          onNameChange={setNewPillar}
          onDescriptionChange={setNewPillarDescription}
          onColorChange={setNewPillarColor}
          onSubmit={addPillar}
          onClose={closeAddPillarDialog}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handlePillarDragEnd}
      >
        <SortableContext items={pillarIds} strategy={verticalListSortingStrategy}>
          {pillars.map((pillar, pIdx) => (
            <SortablePillarCard
              key={pillar.id}
              pillar={pillar}
              index={pIdx}
              collapsed={!!collapsed[pillar.id]}
              onToggleCollapse={() => toggleCollapse(pillar.id)}
              pillarMilestones={milestones.filter((m) => m.pillar_id === pillar.id)}
              onNameBlur={updatePillarName}
              onAbbreviationBlur={updatePillarAbbreviation}
              onAppendContext={appendPillarContextEntry}
              onRemoveContextEntry={removePillarContextEntry}
              onColorChange={updatePillarColor}
              onAddMilestone={addMilestone}
              onRequestMilestoneToggle={requestMilestoneToggle}
              onRequestMilestoneDelete={requestMilestoneDelete}
              onMilestoneDragEnd={handleMilestoneDragEnd}
              hideCompleted={hideCompleted}
              newMilestone={newMilestones[pillar.id] || ""}
              newMilestoneDate={newMilestoneDates[pillar.id] || ""}
              onNewMilestoneChange={(v) =>
                setNewMilestones((prev) => ({ ...prev, [pillar.id]: v }))
              }
              onNewMilestoneDateChange={(v) =>
                setNewMilestoneDates((prev) => ({ ...prev, [pillar.id]: v }))
              }
              taskCount={taskCountForPillar(pillar)}
              onShowTasks={() => setTasksModalPillarId(pillar.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {tasksModalPillar && (
        <PillarTasksModal
          pillar={tasksModalPillar}
          rank={tasksModalPillarRank}
          tasks={tasks}
          milestones={milestones}
          onClose={() => setTasksModalPillarId(null)}
          onToggleTask={(id, completed) => void togglePillarTask(id, completed)}
          onTaskAdded={load}
        />
      )}

      {onboarding && pillars.length > 0 && (
        <div className="onboardingActions">
          <button type="button" className="chatSendBtn" onClick={finishOnboarding}>
            Continue to Mission Control
          </button>
        </div>
      )}

      {milestoneDialog && (
        <MilestoneActionDialog
          dialog={milestoneDialog}
          onConfirm={() => void confirmMilestoneAction()}
          onCancel={() => setMilestoneDialog(null)}
        />
      )}
    </div>
  );
}
