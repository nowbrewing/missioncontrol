"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PlanningIdeas from "./PlanningIdeas";
import PlanningIdeaModal from "./PlanningIdeaModal";
import PlanningPillarPicker from "./PlanningPillarPicker";
import PlanningMilestones, { type PlanningMilestone } from "./PlanningMilestones";
import PlanningHabits from "./PlanningHabits";
import PillarNoteFields from "./PillarNoteFields";
import ActionIconButton, { EditIcon } from "../ActionIconButton";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../../lib/pillar-note-fields";
import {
  addMonthsToDate,
  buildMonthGrid,
  dayOfMonthFromIso,
  monthLabelFor,
  monthParamFromDate,
  parseMonthParam,
  todayIsoYyyyMmDd,
  WEEKDAY_LABELS_MON,
} from "../../lib/date";
import { taskBelongsToPillarGroup } from "../../lib/life-admin";
import { isIdeaTask } from "../../lib/task-ideas";
import { pillarColorVars } from "../../lib/pillar-colors";
import {
  PLANNING_TASK_DRAG_MIME,
  readPlanningCalendarDrop,
} from "../../lib/planning-idea-dnd";

type Pillar = {
  id: number;
  name: string;
  abbreviation: string | null;
  color: string;
  rank: number;
  calendar_note: string | null;
  note_fields: PillarNoteFieldDef[];
  note_field_values: PillarNoteFieldValues;
};

type Task = {
  id: number;
  title: string;
  note?: string | null;
  deadline: string | null;
  completed_at: string | null;
  pillar_id: number | null;
  is_idea?: number;
};

export default function PillarCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get("month");
  const pillarParam = searchParams.get("pillar");

  const { year: initialYear, month: initialMonth } = parseMonthParam(monthParam);
  const [viewDate, setViewDate] = useState(() => new Date(initialYear, initialMonth, 1));

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<PlanningMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPillarId, setSelectedPillarId] = useState<number | null>(
    pillarParam ? Number(pillarParam) : null
  );

  const [noteEditing, setNoteEditing] = useState(false);
  const [calendarNoteDraft, setCalendarNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [addingOnDate, setAddingOnDate] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState("");
  const [calendarDropDate, setCalendarDropDate] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [schedulingIdea, setSchedulingIdea] = useState(false);
  const [reschedulingTask, setReschedulingTask] = useState(false);
  const [selectedCalendarTaskId, setSelectedCalendarTaskId] = useState<number | null>(null);
  const [taskModalBusy, setTaskModalBusy] = useState(false);

  const selectedPillar = useMemo(
    () => pillars.find((p) => p.id === selectedPillarId) ?? null,
    [pillars, selectedPillarId]
  );

  const savedCalendarNote = selectedPillar?.calendar_note ?? "";

  const pillarMilestones = useMemo(() => {
    if (!selectedPillarId) return [];
    return milestones.filter((m) => m.pillar_id === selectedPillarId);
  }, [milestones, selectedPillarId]);

  const monthGrid = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const pillarTasks = useMemo(() => {
    if (!selectedPillar) return [];
    return tasks.filter(
      (t) => !isIdeaTask(t) && taskBelongsToPillarGroup(t, selectedPillar)
    );
  }, [tasks, selectedPillar]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of pillarTasks) {
      if (!task.deadline) continue;
      const list = map.get(task.deadline) ?? [];
      list.push(task);
      map.set(task.deadline, list);
    }
    return map;
  }, [pillarTasks]);

  const milestonesByDate = useMemo(() => {
    const map = new Map<string, PlanningMilestone[]>();
    for (const ms of pillarMilestones) {
      if (!ms.target_date) continue;
      const list = map.get(ms.target_date) ?? [];
      list.push(ms);
      map.set(ms.target_date, list);
    }
    return map;
  }, [pillarMilestones]);

  const syncUrl = useCallback(
    (pillarId: number | null, date: Date) => {
      const params = new URLSearchParams();
      if (pillarId != null) params.set("pillar", String(pillarId));
      params.set("month", monthParamFromDate(date.getFullYear(), date.getMonth()));
      router.replace(`/planning?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const load = useCallback(async () => {
    const [pillarsRes, milestonesRes] = await Promise.all([
      fetch("/api/pillars", { cache: "no-store" }),
      fetch("/api/milestones", { cache: "no-store" }),
    ]);
    await fetch("/api/recurring-events/week", { cache: "no-store" });
    const tasksRes = await fetch("/api/tasks", { cache: "no-store" });
    const pillarsData = await pillarsRes.json();
    const tasksData = await tasksRes.json();
    const milestonesData = await milestonesRes.json();
    if (pillarsData.ok) {
      setPillars(
        (pillarsData.pillars ?? []).map((p: Pillar) => ({
          ...p,
          note_fields: p.note_fields ?? [],
          note_field_values: p.note_field_values ?? {},
        }))
      );
    }
    if (tasksData.ok) setTasks(tasksData.tasks);
    if (milestonesData.ok) setMilestones(milestonesData.milestones);
    setLoading(false);
  }, []);

  const upsertTask = useCallback((updated: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      if (!exists) return [...prev, updated];
      return prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
    });
  }, []);

  const removeTask = useCallback((taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedCalendarTaskId((current) => (current === taskId ? null : current));
  }, []);

  const patchTask = useCallback(
    async (taskId: number, body: Record<string, unknown>, optimistic?: Partial<Task>) => {
      if (optimistic) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...optimistic } : t))
        );
      }

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Update failed");
      }
      if (data.task) {
        upsertTask(data.task);
      }
      return data.task as Task | undefined;
    },
    [upsertTask]
  );

  const selectedCalendarTask =
    selectedCalendarTaskId != null
      ? (tasks.find((t) => t.id === selectedCalendarTaskId) ?? null)
      : null;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading || pillars.length === 0) return;

    const fromUrl = pillarParam ? Number(pillarParam) : null;
    const validFromUrl =
      fromUrl != null && Number.isFinite(fromUrl) && pillars.some((p) => p.id === fromUrl);

    if (validFromUrl && selectedPillarId !== fromUrl) {
      setSelectedPillarId(fromUrl);
      return;
    }

    if (selectedPillarId == null || !pillars.some((p) => p.id === selectedPillarId)) {
      const first = pillars[0]?.id ?? null;
      setSelectedPillarId(first);
      if (first != null) syncUrl(first, viewDate);
    }
  }, [loading, pillars, pillarParam, selectedPillarId, syncUrl, viewDate]);

  useEffect(() => {
    setNoteEditing(false);
    setCalendarNoteDraft(selectedPillar?.calendar_note ?? "");
  }, [selectedPillar?.id, selectedPillar?.calendar_note]);

  useEffect(() => {
    const parsed = parseMonthParam(monthParam);
    setViewDate(new Date(parsed.year, parsed.month, 1));
  }, [monthParam]);

  async function saveCalendarNote() {
    if (!selectedPillarId) return false;
    setNoteSaving(true);
    try {
      const trimmed = calendarNoteDraft.trim();
      const res = await fetch(`/api/pillars/${selectedPillarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar_note: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        setPillars((prev) =>
          prev.map((p) =>
            p.id === selectedPillarId ? { ...p, calendar_note: trimmed || null } : p
          )
        );
        setNoteEditing(false);
        return true;
      }
      return false;
    } finally {
      setNoteSaving(false);
    }
  }

  function startNoteEdit() {
    setCalendarNoteDraft(savedCalendarNote);
    setNoteEditing(true);
  }

  function cancelNoteEdit() {
    setCalendarNoteDraft(savedCalendarNote);
    setNoteEditing(false);
  }

  function selectPillar(id: number) {
    setSelectedPillarId(id);
    setAddingOnDate(null);
    setAddDraft("");
    syncUrl(id, viewDate);
  }

  function shiftMonth(delta: number) {
    const next = addMonthsToDate(viewDate, delta);
    setViewDate(next);
    syncUrl(selectedPillarId, next);
  }

  async function addTaskOnDate(date: string) {
    const title = addDraft.trim();
    if (!title || selectedPillarId == null) return;

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        deadline: date,
        pillar_id: selectedPillarId,
      }),
    });

    setAddDraft("");
    setAddingOnDate(null);
    await load();
  }

  async function rescheduleTaskOnDate(taskId: number, date: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.deadline === date || reschedulingTask) return;

    setReschedulingTask(true);
    try {
      await patchTask(taskId, { deadline: date }, { deadline: date });
    } catch {
      await load();
    } finally {
      setReschedulingTask(false);
      setCalendarDropDate(null);
      setDraggingTaskId(null);
    }
  }

  async function scheduleIdeaOnDate(ideaId: number, date: string) {
    if (schedulingIdea) return;
    setSchedulingIdea(true);
    try {
      await patchTask(
        ideaId,
        { deadline: date },
        { deadline: date, is_idea: 0 }
      );
    } catch {
      await load();
    } finally {
      setSchedulingIdea(false);
      setCalendarDropDate(null);
    }
  }

  async function saveCalendarTask(
    id: number,
    patch: {
      title: string;
      note: string | null;
      deadline: string | null;
      completed?: boolean;
    }
  ) {
    setTaskModalBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: patch.title,
        note: patch.note,
        deadline: patch.deadline,
      };
      if (patch.completed !== undefined) {
        body.completed = patch.completed;
      }

      await patchTask(id, body, {
        title: patch.title,
        note: patch.note,
        deadline: patch.deadline,
        is_idea: patch.deadline ? 0 : 1,
        ...(patch.completed !== undefined
          ? { completed_at: patch.completed ? new Date().toISOString() : null }
          : {}),
      });
      setSelectedCalendarTaskId(null);
    } finally {
      setTaskModalBusy(false);
    }
  }

  async function deleteCalendarTask(task: Task) {
    const ok = window.confirm(`Delete "${task.title}"?`);
    if (!ok || taskModalBusy) return;
    setTaskModalBusy(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      removeTask(task.id);
    } finally {
      setTaskModalBusy(false);
    }
  }

  async function toggleMilestoneComplete(ms: PlanningMilestone) {
    await fetch(`/api/milestones/${ms.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !ms.completed_at }),
    });
    await load();
  }

  const today = todayIsoYyyyMmDd();

  if (loading) {
    return <p className="sectionHint">Loading planning view…</p>;
  }

  if (pillars.length === 0) {
    return (
      <p className="sectionHint">
        Add at least one pillar in{" "}
        <a href="/settings" className="textLink">
          Settings
        </a>{" "}
        before using Planning.
      </p>
    );
  }

  return (
    <div className="pillarCalendar">
      {selectedPillar && (
        <>
          <div className="planningLayout">
            <div className="planningLayoutCalendar">
            <div className="planningMonthHeader" role="region" aria-label="Month">
              <span className="planningFilterLabel" id="planning-month-label">
                Month
              </span>
              <div
                className="planningMonthNav"
                role="group"
                aria-labelledby="planning-month-label"
              >
                <button
                  type="button"
                  className="outlineButton pillarCalendarNavBtn"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                >
                  ←
                </button>
                <span className="planningMonthLabel">{monthLabelFor(viewDate)}</span>
                <button
                  type="button"
                  className="outlineButton pillarCalendarNavBtn"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                >
                  →
                </button>
              </div>
            </div>

            <section aria-label="Month view">
              <div
                className="pillarCalendarGrid"
                role="grid"
                aria-label={`${monthLabelFor(viewDate)} calendar`}
              >
              {WEEKDAY_LABELS_MON.map((label) => (
                <div key={label} className="pillarCalendarWeekday" role="columnheader">
                  {label}
                </div>
              ))}

              {monthGrid.map((cell) => {
                const dayTasks = tasksByDate.get(cell.date) ?? [];
                const dayMilestones = milestonesByDate.get(cell.date) ?? [];
                const isToday = cell.date === today;
                const isAdding = addingOnDate === cell.date;

                return (
                  <div
                    key={cell.date}
                    className={`pillarCalendarDay ${cell.inMonth ? "" : "pillarCalendarDayOutside"} ${
                      isToday ? "pillarCalendarDayToday" : ""
                    } ${calendarDropDate === cell.date && cell.inMonth ? "pillarCalendarDayDropTarget" : ""}`}
                    role="gridcell"
                    style={pillarColorVars(selectedPillar.color)}
                    onDragOver={(e) => {
                      if (!cell.inMonth) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDragEnter={(e) => {
                      if (!cell.inMonth) return;
                      e.preventDefault();
                      setCalendarDropDate(cell.date);
                    }}
                    onDragLeave={(e) => {
                      if (!cell.inMonth) return;
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setCalendarDropDate((prev) => (prev === cell.date ? null : prev));
                    }}
                    onDrop={(e) => {
                      if (!cell.inMonth) return;
                      e.preventDefault();
                      const drop = readPlanningCalendarDrop(e.dataTransfer);
                      setCalendarDropDate(null);
                      setDraggingTaskId(null);
                      if (!drop) return;
                      if (drop.kind === "idea") {
                        void scheduleIdeaOnDate(drop.id, cell.date);
                      } else {
                        void rescheduleTaskOnDate(drop.id, cell.date);
                      }
                    }}
                  >
                    <div className="pillarCalendarDayHeader">
                      <span className="pillarCalendarDayNum">{dayOfMonthFromIso(cell.date)}</span>
                      {cell.inMonth && (
                        <button
                          type="button"
                          className="pillarCalendarAddBtn"
                          onClick={() => {
                            setAddingOnDate(cell.date);
                            setAddDraft("");
                          }}
                          aria-label={`Add task on ${cell.date}`}
                          title="Add task"
                        >
                          +
                        </button>
                      )}
                    </div>

                    <ul className="pillarCalendarTaskList">
                      {dayMilestones.map((ms) => (
                        <li key={`ms-${ms.id}`}>
                          <button
                            type="button"
                            className={`pillarCalendarMilestone ${ms.completed_at ? "pillarCalendarMilestoneDone" : ""}`}
                            onClick={() => void toggleMilestoneComplete(ms)}
                            title={
                              ms.completed_at
                                ? "Mark milestone incomplete"
                                : "Mark milestone complete"
                            }
                          >
                            ◆ {ms.title}
                          </button>
                        </li>
                      ))}
                      {dayTasks.map((task) => (
                        <li key={task.id}>
                          <button
                            type="button"
                            draggable={!reschedulingTask}
                            className={`pillarCalendarTask ${task.completed_at ? "pillarCalendarTaskDone" : ""} ${draggingTaskId === task.id ? "pillarCalendarTaskDragging" : ""}`}
                            onClick={() => setSelectedCalendarTaskId(task.id)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData(PLANNING_TASK_DRAG_MIME, String(task.id));
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingTaskId(task.id);
                            }}
                            onDragEnd={() => {
                              setDraggingTaskId(null);
                              setCalendarDropDate(null);
                            }}
                            title="Open task · drag to another day"
                          >
                            <span className="pillarCalendarTaskTitle">{task.title}</span>
                            {task.note?.trim() ? (
                              <span className="planningIdeaNoteBadge pillarCalendarTaskNoteBadge">
                                Note
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>

                    {isAdding && cell.inMonth && (
                      <form
                        className="pillarCalendarAddForm"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void addTaskOnDate(cell.date);
                        }}
                      >
                        <input
                          className="invInput pillarCalendarAddInput"
                          value={addDraft}
                          onChange={(e) => setAddDraft(e.target.value)}
                          placeholder="Task title…"
                          autoFocus
                          aria-label={`New task on ${cell.date}`}
                        />
                        <div className="pillarCalendarAddActions">
                          <button type="submit" className="chatSendBtn" disabled={!addDraft.trim()}>
                            Add
                          </button>
                          <button
                            type="button"
                            className="outlineButton"
                            onClick={() => {
                              setAddingOnDate(null);
                              setAddDraft("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
            </section>

            <PlanningIdeas
              pillar={selectedPillar}
              tasks={tasks}
              onChanged={load}
              onTaskUpdated={upsertTask}
              onTaskDeleted={removeTask}
            />
            </div>

          <aside className="planningLayoutSidebar">
            <div className="planningPillarBar" role="region" aria-label="Current pillar">
              <PlanningPillarPicker
                pillars={pillars}
                selectedPillarId={selectedPillarId}
                onSelect={selectPillar}
              />
            </div>

            <section
              className="card pillarCalendarNoteCard"
              style={pillarColorVars(selectedPillar.color)}
            >
              <div className="pillarCalendarNoteHeader">
                <span className="modalLabel">Note to self</span>
                {!noteEditing && (
                  <ActionIconButton
                    label={savedCalendarNote ? "Edit note" : "Add note"}
                    onClick={startNoteEdit}
                  >
                    {savedCalendarNote ? <EditIcon /> : "+"}
                  </ActionIconButton>
                )}
              </div>

              {selectedPillar ? (
                <PillarNoteFields
                  pillarId={selectedPillar.id}
                  fields={selectedPillar.note_fields ?? []}
                  values={selectedPillar.note_field_values ?? {}}
                  onFieldsChange={(fields, values) => {
                    setPillars((prev) =>
                      prev.map((p) =>
                        p.id === selectedPillar.id
                          ? { ...p, note_fields: fields, note_field_values: values }
                          : p
                      )
                    );
                  }}
                  onValuesChange={(values) => {
                    setPillars((prev) =>
                      prev.map((p) =>
                        p.id === selectedPillar.id ? { ...p, note_field_values: values } : p
                      )
                    );
                  }}
                />
              ) : null}

              {noteEditing ? (
                <>
                  <textarea
                    id="pillar-calendar-note"
                    className="chatInput pillarCalendarNoteInput"
                    rows={4}
                    value={calendarNoteDraft}
                    onChange={(e) => setCalendarNoteDraft(e.target.value)}
                    placeholder="Mondays: focus on strategy. Wednesdays: outreach and follow-ups."
                    disabled={noteSaving}
                    autoFocus
                  />
                  <div className="pillarCalendarNoteActions">
                    <button
                      type="button"
                      className="chatSendBtn"
                      onClick={() => void saveCalendarNote()}
                      disabled={noteSaving}
                    >
                      {noteSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="outlineButton"
                      onClick={cancelNoteEdit}
                      disabled={noteSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : savedCalendarNote ? (
                <p className="pillarCalendarNoteText">{savedCalendarNote}</p>
              ) : (
                <p className="sectionHint pillarCalendarNoteEmpty">No note yet.</p>
              )}
            </section>

            <PlanningMilestones
              pillarId={selectedPillar.id}
              pillarName={selectedPillar.name}
              pillarColor={selectedPillar.color}
              milestones={pillarMilestones}
              onChanged={load}
            />

            <PlanningHabits
              pillarId={selectedPillar.id}
              pillarName={selectedPillar.name}
              pillarColor={selectedPillar.color}
              onChanged={load}
            />
          </aside>
        </div>

        <p className="sectionHint pillarCalendarFooterHint">
          ◆ Milestones and tasks show on their target dates. Click a task to open it, or drag to
          another day to reschedule.
        </p>

        {selectedCalendarTask ? (
          <PlanningIdeaModal
            idea={selectedCalendarTask}
            open
            busy={taskModalBusy}
            onClose={() => setSelectedCalendarTaskId(null)}
            onSave={(patch) => saveCalendarTask(selectedCalendarTask.id, patch)}
            onDelete={() => deleteCalendarTask(selectedCalendarTask)}
          />
        ) : null}
        </>
      )}

      {!selectedPillar && (
        <p className="sectionHint">Select a pillar to open the calendar and planning sidebar.</p>
      )}
    </div>
  );
}
