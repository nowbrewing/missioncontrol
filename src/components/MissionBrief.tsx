"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
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
import { useCallback, useEffect, useState, type ReactNode } from "react";
import PillarChip from "./PillarChip";
import TaskCardMeta from "./TaskCardMeta";
import TaskDateLockToggle from "./TaskDateLockToggle";
import TaskDeadlineEditor from "./TaskDeadlineEditor";
import TaskTitleEditor from "./TaskTitleEditor";
import { formatRelativeDateLabel } from "../lib/mission-dates";
import { sortComingUpByDate, type BoardItem } from "../lib/mission-layout";
import type { MissionReflectionDisplay } from "../lib/mission-reflection-display";
import MissionReflection from "./MissionReflection";
import { pillarColorVars } from "../lib/pillar-colors";
import type { MissionMilestone } from "../lib/mission-prioritize";
import type { TaskScheduleMode } from "./TaskScheduleSelect";

const TODAY_LIST = "today-priorities";
const COMING_UP_LIST = "coming-up-next";

export type MissionBoardView = "today" | "week";

function openBoardItems(items: BoardItem[]) {
  return items.filter((i) => i.kind !== "task" || !i.completed_at);
}

function greatJobMessage(
  items: BoardItem[],
  scope: MissionBoardView,
  focusDate: string,
  calendarToday: string
) {
  if (openBoardItems(items).length > 0) return null;
  if (scope === "week") {
    return "Great job! You're all caught up for this week.";
  }
  if (focusDate === calendarToday) {
    return "Great job! Nothing left for today.";
  }
  const label = formatRelativeDateLabel(focusDate, calendarToday);
  return `Great job! Nothing left for ${label.toLowerCase()}.`;
}

function prioritiesSectionTitle(focusDate: string, calendarToday: string) {
  if (focusDate === calendarToday) return "Today's priorities";
  const label = formatRelativeDateLabel(focusDate, calendarToday);
  if (label === "Tomorrow") return "Tomorrow's priorities";
  return `Priorities for ${label}`;
}

type MissionPillar = { id: number; name: string; color: string };

function findContainer(
  id: string,
  todayItems: BoardItem[],
  comingUpItems: BoardItem[]
): string | null {
  if (id === TODAY_LIST || id === COMING_UP_LIST) return id;
  if (todayItems.some((i) => i.key === id)) return TODAY_LIST;
  if (comingUpItems.some((i) => i.key === id)) return COMING_UP_LIST;
  return null;
}

function SortableBoardRow({
  item,
  today,
  pillars,
  milestones,
  listId,
  onToggleTask,
  onDeadlineChange,
  onPillarChange,
  onMilestoneChange,
  onScheduleChange,
  onTitleChange,
  onDeleteTask,
  onDateLockChange,
  onDemoteToWeek,
  onDemoteToFuture,
  onPromoteToToday,
}: {
  item: BoardItem;
  today: string;
  pillars: MissionPillar[];
  milestones: MissionMilestone[];
  listId: string;
  onToggleTask: (id: number, completed: boolean) => void;
  onDeadlineChange: (id: number, deadline: string | null) => void;
  onPillarChange: (id: number, pillarId: number | null) => void;
  onMilestoneChange: (id: number, milestoneId: number | null) => void;
  onScheduleChange: (id: number, mode: TaskScheduleMode) => void;
  onTitleChange: (id: number, title: string) => void | Promise<void>;
  onDeleteTask: (id: number) => void;
  onDateLockChange?: (id: number, locked: boolean, deadline: string | null) => void;
  onDemoteToWeek?: (item: BoardItem) => void;
  onDemoteToFuture?: (item: BoardItem) => void;
  onPromoteToToday?: (item: BoardItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue =
    item.kind === "task" &&
    !!item.date &&
    item.date < today &&
    !item.completed_at;

  return (
    <li
      ref={setNodeRef}
      style={{
        ...style,
        ...(item.pillar_color ? pillarColorVars(item.pillar_color) : {}),
      }}
      className={`comingUpItem boardItem ${isDragging ? "isDragging" : ""} ${item.pillar_color ? "taskRowColored" : ""}`}
    >
      <div className="boardItemLead">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="dragHandle boardDragHandle"
          aria-label={`Drag to reorder: ${item.title}`}
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        {item.kind === "task" ? (
          <label className="boardTaskCheck">
            <input
              type="checkbox"
              checked={!!item.completed_at}
              onChange={(e) => onToggleTask(item.id, e.target.checked)}
            />
          </label>
        ) : null}
      </div>

      <div className="boardItemBody">
        {item.kind === "task" ? (
          <>
            <div className="taskCardRowTop">
              <TaskTitleEditor
                title={item.title}
                completed={!!item.completed_at}
                className="boardItemTitle taskCardTitle"
                onChange={(title) => onTitleChange(item.id, title)}
              />
              <div className="taskDeadlineGroup">
                <TaskDeadlineEditor
                  deadline={item.date}
                  overdue={overdue}
                  onChange={(deadline) => onDeadlineChange(item.id, deadline)}
                />
                {onDateLockChange ? (
                  <TaskDateLockToggle
                    locked={!!item.date_locked}
                    disabled={!item.date && !item.date_locked}
                    onClick={() =>
                      onDateLockChange(item.id, !item.date_locked, item.date)
                    }
                    title={
                      item.date_locked
                        ? `Must be done on ${item.date} only — click to unlock`
                        : item.date
                          ? `Lock to ${item.date} — cannot schedule on other days`
                          : "Set a deadline first"
                    }
                    ariaLabel={
                      item.date_locked
                        ? `Locked to ${item.date ?? "deadline"} — unlock`
                        : item.date
                          ? `Lock task to ${item.date}`
                          : "Lock task to date — set a deadline first"
                    }
                  />
                ) : null}
              </div>
            </div>
            <div className="taskCardRowBottom">
              <TaskCardMeta
                pillars={pillars}
                milestones={milestones}
                pillarId={item.pillar_id ?? null}
                milestoneId={item.milestone_id ?? null}
                scheduleType={item.schedule_type}
                compact
                leading={item.is_new ? <span className="pill pillNew">New</span> : null}
                onPillarChange={(pillarId) => onPillarChange(item.id, pillarId)}
                onMilestoneChange={(milestoneId) => onMilestoneChange(item.id, milestoneId)}
                onScheduleChange={(mode) => onScheduleChange(item.id, mode)}
              />
              <div className="taskCardActions">
                {listId === COMING_UP_LIST && onPromoteToToday ? (
                  <button
                    type="button"
                    className="outlineButton btnCompact boardPromoteBtn"
                    onClick={() => onPromoteToToday(item)}
                    title="Move to Today's priorities"
                  >
                    ↑ Today
                  </button>
                ) : null}
                {listId === TODAY_LIST && onDemoteToWeek ? (
                  <button
                    type="button"
                    className="outlineButton btnCompact boardDemoteBtn"
                    onClick={() => onDemoteToWeek(item)}
                    title="Move to This Week"
                  >
                    ↓ Week
                  </button>
                ) : null}
                {onDemoteToFuture ? (
                  <button
                    type="button"
                    className="outlineButton btnCompact boardDemoteBtn"
                    onClick={() => onDemoteToFuture(item)}
                    title="Remove from mission board — shows again by deadline"
                  >
                    ↓ Later
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rankBtn boardDeleteBtn"
                  onClick={() => {
                    if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                      onDeleteTask(item.id);
                    }
                  }}
                  aria-label={`Delete task: ${item.title}`}
                >
                  ×
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="taskCardRowTop">
              <strong className="boardItemTitle taskCardTitle">{item.title}</strong>
              <span className="pill pillSubtle">
                {formatRelativeDateLabel(item.date, today)}
              </span>
            </div>
            <div className="taskCardRowBottom">
              <div className="taskCardMeta">
                <span className="pill pillMilestone">Milestone</span>
                {item.pillar_name ? (
                  <PillarChip
                    name={item.pillar_name}
                    abbreviation={item.pillar_abbreviation}
                    color={item.pillar_color}
                    compact
                  />
                ) : null}
                {item.milestone_title && (
                  <span className="pill pillSubtle">{item.milestone_title}</span>
                )}
              </div>
              {listId === COMING_UP_LIST && onPromoteToToday ? (
                <div className="taskCardActions">
                  <button
                    type="button"
                    className="outlineButton btnCompact boardPromoteBtn"
                    onClick={() => onPromoteToToday(item)}
                    title="Move to Today's priorities"
                  >
                    ↑ Today
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function BoardList({
  id,
  items,
  today,
  pillars,
  milestones,
  onToggleTask,
  onDeadlineChange,
  onPillarChange,
  onMilestoneChange,
  onScheduleChange,
  onTitleChange,
  onDeleteTask,
  onDateLockChange,
  onDemoteToWeek,
  onDemoteToFuture,
  onPromoteToToday,
  emptyMessage,
  greatJob,
}: {
  id: string;
  items: BoardItem[];
  today: string;
  pillars: MissionPillar[];
  milestones: MissionMilestone[];
  onToggleTask: (id: number, completed: boolean) => void;
  onDeadlineChange: (id: number, deadline: string | null) => void;
  onPillarChange: (id: number, pillarId: number | null) => void;
  onMilestoneChange: (id: number, milestoneId: number | null) => void;
  onScheduleChange: (id: number, mode: TaskScheduleMode) => void;
  onTitleChange: (id: number, title: string) => void | Promise<void>;
  onDeleteTask: (id: number) => void;
  onDateLockChange?: (id: number, locked: boolean, deadline: string | null) => void;
  onDemoteToWeek?: (item: BoardItem) => void;
  onDemoteToFuture?: (item: BoardItem) => void;
  onPromoteToToday?: (item: BoardItem) => void;
  emptyMessage: string;
  greatJob?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const visibleItems = openBoardItems(items);
  const displayItems = visibleItems.length > 0 ? visibleItems : items;

  return (
    <ul
      ref={setNodeRef}
      className={`comingUpList boardDropList ${isOver ? "boardDropListOver" : ""}`}
    >
      <SortableContext items={displayItems.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        {greatJob ? (
          <li className="card boardEmpty missionGreatJob">{greatJob}</li>
        ) : displayItems.length === 0 ? (
          <li className="card boardEmpty">{emptyMessage}</li>
        ) : (
          displayItems.map((item) => (
            <SortableBoardRow
              key={item.key}
              item={item}
              today={today}
              pillars={pillars}
              milestones={milestones}
              listId={id}
              onToggleTask={onToggleTask}
              onDeadlineChange={onDeadlineChange}
              onPillarChange={onPillarChange}
              onMilestoneChange={onMilestoneChange}
              onScheduleChange={onScheduleChange}
              onTitleChange={onTitleChange}
              onDeleteTask={onDeleteTask}
              onDateLockChange={onDateLockChange}
              onDemoteToWeek={id === TODAY_LIST ? onDemoteToWeek : undefined}
              onDemoteToFuture={onDemoteToFuture}
              onPromoteToToday={id === COMING_UP_LIST ? onPromoteToToday : undefined}
            />
          ))
        )}
      </SortableContext>
    </ul>
  );
}

export default function MissionBrief({
  today,
  boardToday,
  boardComingUp,
  pillars,
  milestones,
  reflection,
  view = "today",
  calendarToday,
  headerAction,
  onToggleTask,
  onDeadlineChange,
  onPillarChange,
  onMilestoneChange,
  onScheduleChange,
  onTitleChange,
  onDeleteTask,
  onDateLockChange,
  onLayoutChange,
}: {
  today: string;
  boardToday: BoardItem[];
  boardComingUp: BoardItem[];
  pillars: MissionPillar[];
  milestones: MissionMilestone[];
  reflection?: MissionReflectionDisplay | null;
  view?: MissionBoardView;
  calendarToday?: string;
  headerAction?: ReactNode;
  onToggleTask: (id: number, completed: boolean) => void;
  onDeadlineChange: (id: number, deadline: string | null) => void;
  onPillarChange: (id: number, pillarId: number | null) => void;
  onMilestoneChange: (id: number, milestoneId: number | null) => void;
  onScheduleChange: (id: number, mode: TaskScheduleMode) => void;
  onTitleChange: (id: number, title: string) => void | Promise<void>;
  onDeleteTask: (id: number) => void;
  onDateLockChange?: (id: number, locked: boolean, deadline: string | null) => void;
  onLayoutChange: (today: BoardItem[], comingUp: BoardItem[]) => void;
}) {
  const [todayItems, setTodayItems] = useState(boardToday);
  const [comingUpItems, setComingUpItems] = useState(boardComingUp);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setTodayItems(boardToday);
    setComingUpItems(sortComingUpByDate(boardComingUp));
  }, [boardToday, boardComingUp]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const calendarDay = calendarToday ?? today;

  const persistLayout = useCallback(
    async (
      nextToday: BoardItem[],
      nextComingUp: BoardItem[],
      options?: { todayUserOrdered?: boolean }
    ) => {
      const sortedComingUp = sortComingUpByDate(nextComingUp);
      await fetch("/api/mission/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          today: nextToday,
          coming_up: sortedComingUp,
          layout_date: today,
          ...(options?.todayUserOrdered ? { today_user_ordered: true } : {}),
        }),
      });
      onLayoutChange(nextToday, sortedComingUp);
    },
    [onLayoutChange, today]
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);
    const activeContainer = findContainer(activeKey, todayItems, comingUpItems);
    const overContainer = findContainer(overKey, todayItems, comingUpItems);
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      if (activeContainer === COMING_UP_LIST) return;

      const items = todayItems;
      const oldIndex = items.findIndex((i) => i.key === activeKey);
      const newIndex =
        overKey === activeContainer
          ? items.length - 1
          : items.findIndex((i) => i.key === overKey);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      setTodayItems(reordered);
      persistLayout(reordered, comingUpItems, { todayUserOrdered: true });
      return;
    }

    const source =
      activeContainer === TODAY_LIST ? todayItems : comingUpItems;
    const dest =
      activeContainer === TODAY_LIST ? comingUpItems : todayItems;
    const item = source.find((i) => i.key === activeKey);
    if (!item) return;

    if (
      item.kind === "task" &&
      item.date_locked &&
      item.date === today &&
      activeContainer === TODAY_LIST &&
      overContainer === COMING_UP_LIST
    ) {
      return;
    }

    const nextSource = source.filter((i) => i.key !== activeKey);
    let insertIndex =
      overKey === overContainer
        ? dest.length
        : dest.findIndex((i) => i.key === overKey);
    if (insertIndex < 0) insertIndex = dest.length;

    const nextDest =
      overContainer === COMING_UP_LIST
        ? sortComingUpByDate([...dest, item])
        : (() => {
            const list = [...dest];
            list.splice(insertIndex, 0, item);
            return list;
          })();

    if (activeContainer === TODAY_LIST) {
      setTodayItems(nextSource);
      setComingUpItems(nextDest);
      persistLayout(nextSource, nextDest);
    } else {
      setTodayItems(nextDest);
      setComingUpItems(nextSource);
      persistLayout(nextDest, nextSource, { todayUserOrdered: true });
    }
  }

  const activeItem =
    todayItems.find((i) => i.key === activeId) ||
    comingUpItems.find((i) => i.key === activeId);

  const demoteToWeek = useCallback(
    (item: BoardItem) => {
      if (item.date_locked && item.date === today) {
        window.alert(
          `“${item.title}” is locked to today (${item.date}) and cannot be demoted.`
        );
        return;
      }
      const nextToday = todayItems.filter((i) => i.key !== item.key);
      const nextComingUp = sortComingUpByDate([
        ...comingUpItems.filter((i) => i.key !== item.key),
        item,
      ]);
      setTodayItems(nextToday);
      setComingUpItems(nextComingUp);
      persistLayout(nextToday, nextComingUp);
    },
    [todayItems, comingUpItems, persistLayout, today]
  );

  const promoteToToday = useCallback(
    (item: BoardItem) => {
      if (item.date_locked && item.date && item.date !== today) {
        window.alert(
          `“${item.title}” is locked to ${item.date} and cannot be moved to today.`
        );
        return;
      }
      const nextComingUp = comingUpItems.filter((i) => i.key !== item.key);
      const nextToday = [...todayItems.filter((i) => i.key !== item.key), item];
      setTodayItems(nextToday);
      setComingUpItems(nextComingUp);
      persistLayout(nextToday, nextComingUp);
    },
    [todayItems, comingUpItems, persistLayout, today]
  );

  const demoteToFuture = useCallback(
    (item: BoardItem) => {
      const nextToday = todayItems.filter((i) => i.key !== item.key);
      const nextComingUp = comingUpItems.filter((i) => i.key !== item.key);
      setTodayItems(nextToday);
      setComingUpItems(nextComingUp);
      persistLayout(nextToday, nextComingUp);
    },
    [todayItems, comingUpItems, persistLayout]
  );

  return (
    <div className="missionBrief">
      {view === "today" && (
        <MissionReflection reflection={reflection ?? null} today={today} />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {view === "today" && (
          <section className="section">
            <div className="missionSectionHeader">
              <h2 className="sectionTitle">
                {prioritiesSectionTitle(today, calendarDay)}
              </h2>
              {headerAction}
            </div>
            <p className="sectionHint">
              Drag ⠿ to reorder, use ↓ Week / ↓ Later to demote, or drag items to This Week.
            </p>
            <BoardList
              id={TODAY_LIST}
              items={todayItems}
              today={today}
              pillars={pillars}
              milestones={milestones}
              onToggleTask={onToggleTask}
              onDeadlineChange={onDeadlineChange}
              onPillarChange={onPillarChange}
              onMilestoneChange={onMilestoneChange}
              onScheduleChange={onScheduleChange}
              onTitleChange={onTitleChange}
              onDeleteTask={onDeleteTask}
              onDateLockChange={onDateLockChange}
              onDemoteToWeek={demoteToWeek}
              onDemoteToFuture={demoteToFuture}
              greatJob={greatJobMessage(todayItems, "today", today, calendarDay)}
              emptyMessage="Drag tasks here or use Check In above."
            />
          </section>
        )}

        {view === "week" && (
          <section className="section">
            <h2 className="sectionTitle">This Week</h2>
            <p className="sectionHint">
              Deadlines and milestones this week — use ↑ Today to promote or drag within the list.
            </p>
            <BoardList
              id={COMING_UP_LIST}
              items={comingUpItems}
              today={today}
              pillars={pillars}
              milestones={milestones}
              onToggleTask={onToggleTask}
              onDeadlineChange={onDeadlineChange}
              onPillarChange={onPillarChange}
              onMilestoneChange={onMilestoneChange}
              onScheduleChange={onScheduleChange}
              onTitleChange={onTitleChange}
              onDeleteTask={onDeleteTask}
              onDateLockChange={onDateLockChange}
              onDemoteToFuture={demoteToFuture}
              onPromoteToToday={promoteToToday}
              greatJob={greatJobMessage(comingUpItems, "week", today, calendarDay)}
              emptyMessage="Nothing scheduled for this week yet."
            />
          </section>
        )}

        <DragOverlay>
          {activeItem ? (
            <div
              className="comingUpItem boardItem boardItemOverlay"
              style={activeItem.pillar_color ? pillarColorVars(activeItem.pillar_color) : undefined}
            >
              <span className="dragHandle">⠿</span>
              <strong>{activeItem.title}</strong>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
