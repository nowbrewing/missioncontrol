"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayIsoYyyyMmDd } from "../../lib/date";
import { formatHabitEndLabel } from "../../lib/habit-calendar-horizon";
import type { RecurringWeekItem } from "../../lib/recurring-events";
import {
  DEFAULT_DAILY_DAYS,
  WEEKDAY_LABELS,
  countProgressDone,
  dailyCheckDone,
  dailyTallyTotal,
  defaultCalendarDaysForCount,
  normalizeRecurringKind,
  parseDailyDays,
  countSelectedDays,
  tallyBarFillPercent,
  type CountProgress,
  type DailyCheckProgress,
  type DailyDaysMask,
  type DailyTallyProgress,
  type RecurringKind,
  type RecurringProgress,
} from "../../lib/recurring-week";
import { pillarColorVars } from "../../lib/pillar-colors";
import ActionIconButton, { DeleteIcon, EditIcon } from "../ActionIconButton";

type Habit = {
  id: number;
  title: string;
  kind: string;
  target_count: number;
  daily_days: string | null;
  tally_enabled?: number;
  pillar_id: number | null;
  spawn_task_cards: number;
  end_date: string | null;
  active: number;
};

type Props = {
  pillarId: number;
  pillarName: string;
  pillarColor: string;
  onChanged?: () => void;
};

function habitScheduleLabel(habit: Habit): string {
  const normalized = normalizeRecurringKind(habit.kind, habit.tally_enabled ?? 0);
  if (normalized.kind === "count") {
    return `${habit.target_count || 3}×/week`;
  }
  const days = parseDailyDays(habit.daily_days)
    .map((on, i) => (on ? WEEKDAY_LABELS[i] : null))
    .filter(Boolean)
    .join(" ");
  const schedule = days || "Every day";
  if (normalized.tally_enabled) {
    return habit.target_count > 0 ? `${schedule} · ${habit.target_count}/wk` : `${schedule} · numbers`;
  }
  return schedule;
}

function weekProgressLabel(item: RecurringWeekItem): string {
  if (item.kind === "daily" && item.tally_enabled) {
    const total = dailyTallyTotal(item.progress as DailyTallyProgress);
    if (item.target_count > 0) return `${total} / ${item.target_count}`;
    return String(total);
  }
  if (item.kind === "daily") {
    const done = dailyCheckDone(item.progress as DailyCheckProgress);
    const total = item.daily_days.filter(Boolean).length;
    return `${done}/${total}`;
  }
  const done = countProgressDone(item.progress as CountProgress);
  return `${done}/${item.target_count}`;
}

function CircleToggle({
  checked,
  label,
  onChange,
  isToday,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  isToday?: boolean;
}) {
  return (
    <button
      type="button"
      className={`recurringCircle ${checked ? "recurringCircleChecked" : ""} ${isToday ? "recurringCircleToday" : ""}`}
      onClick={() => onChange(!checked)}
      aria-label={`${label}${checked ? ", done" : ""}`}
      aria-pressed={checked}
    >
      <span className="recurringCircleLabel">{label}</span>
    </button>
  );
}

function HabitDailyCheckRow({
  item,
  today,
  onProgressChange,
}: {
  item: RecurringWeekItem;
  today: string;
  onProgressChange: (progress: RecurringProgress) => void;
}) {
  const progress = item.progress as DailyCheckProgress;

  return (
    <div className="recurringDailyRow">
      {item.week_dates.map((date, i) => {
        if (!item.daily_days[i]) return null;
        return (
          <CircleToggle
            key={date}
            label={WEEKDAY_LABELS[i]}
            checked={!!progress.days[date]}
            isToday={date === today}
            onChange={(checked) => {
              onProgressChange({
                days: { ...progress.days, [date]: checked },
              });
            }}
          />
        );
      })}
    </div>
  );
}

function HabitCountRow({
  item,
  onProgressChange,
}: {
  item: RecurringWeekItem;
  onProgressChange: (progress: RecurringProgress) => void;
}) {
  const progress = item.progress as CountProgress;

  return (
    <div className="recurringCountRow">
      {progress.slots.map((checked, i) => (
        <CircleToggle
          key={i}
          label={String(i + 1)}
          checked={checked}
          onChange={(next) => {
            const slots = [...progress.slots];
            slots[i] = next;
            onProgressChange({ slots });
          }}
        />
      ))}
    </div>
  );
}

function HabitTallyRow({
  item,
  today,
  onProgressChange,
}: {
  item: RecurringWeekItem;
  today: string;
  onProgressChange: (progress: RecurringProgress) => void;
}) {
  const progress = item.progress as DailyTallyProgress;
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const total = dailyTallyTotal(progress);
  const hasTarget = item.target_count > 0;
  const pct = hasTarget ? tallyBarFillPercent(total, item.target_count) : 0;
  const activeCount = activeDate ? (progress.values[activeDate] ?? 0) : 0;

  function setDayValue(date: string, raw: string) {
    const values = { ...progress.values };
    if (raw === "" || raw === "-") {
      delete values[date];
      onProgressChange({ values });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (n === 0) {
      delete values[date];
    } else {
      values[date] = n;
    }
    onProgressChange({ values });
  }

  return (
    <div className="recurringCounterRow">
      <div className="recurringDailyRow">
        {item.week_dates.map((date, i) => {
          if (!item.daily_days[i]) return null;
          const count = progress.values[date] ?? 0;
          const hasValue = count !== 0;
          return (
            <button
              key={date}
              type="button"
              className={`recurringCircle ${hasValue ? "recurringCircleChecked" : ""} ${date === today ? "recurringCircleToday" : ""} ${activeDate === date ? "recurringCircleActive" : ""} ${hasValue ? "recurringCircleHasCount" : ""}`}
              onClick={() => setActiveDate(activeDate === date ? null : date)}
              aria-label={`${WEEKDAY_LABELS[i]}${hasValue ? `, ${count} logged` : ""}`}
              aria-pressed={activeDate === date}
              title={date}
            >
              <span className="recurringCircleLabel">{hasValue ? String(count) : WEEKDAY_LABELS[i]}</span>
            </button>
          );
        })}
      </div>

      {activeDate ? (
        <div className="recurringCounterDayInput">
          <label className="modalLabel" htmlFor={`planning-tally-${item.progress_id}-${activeDate}`}>
            {WEEKDAY_LABELS[item.week_dates.indexOf(activeDate)]} — {activeDate}
          </label>
          <div className="recurringCounterDayInputRow">
            <input
              id={`planning-tally-${item.progress_id}-${activeDate}`}
              type="number"
              className="invInput recurringCounterNumberInput"
              step={1}
              value={activeCount === 0 ? "" : activeCount}
              placeholder="0"
              onChange={(e) => setDayValue(activeDate, e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="outlineButton btnCompact"
              onClick={() => setActiveDate(null)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {hasTarget ? (
        <div className="recurringCounterMeta">
          <span className="recurringCounterValue">
            {total} / {item.target_count}
          </span>
          <div className="recurringCounterBar" aria-hidden>
            <div className="recurringCounterFill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HabitWeekProgress({
  item,
  weekMonday,
  today,
  onProgressChange,
}: {
  item: RecurringWeekItem;
  weekMonday: string;
  today: string;
  onProgressChange: (progress: RecurringProgress) => void;
}) {
  return (
    <div className="planningHabitProgress">
      <p className="planningHabitWeekLabel">
        Week of {weekMonday} (Mon–Sun)
      </p>
      {item.kind === "daily" && item.tally_enabled && (
        <HabitTallyRow item={item} today={today} onProgressChange={onProgressChange} />
      )}
      {item.kind === "daily" && !item.tally_enabled && (
        <HabitDailyCheckRow item={item} today={today} onProgressChange={onProgressChange} />
      )}
      {item.kind === "count" && (
        <HabitCountRow item={item} onProgressChange={onProgressChange} />
      )}
    </div>
  );
}

function DayToggleRow({
  days,
  onChange,
  disabled,
  label,
  hint,
}: {
  days: DailyDaysMask;
  onChange: (days: DailyDaysMask) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="planningHabitDayPicker">
      <span className="modalLabel">{label}</span>
      {hint ? <p className="sectionHint planningHabitTaskHint">{hint}</p> : null}
      <div className="planningHabitDays">
        {WEEKDAY_LABELS.map((dayLabel, i) => (
          <label key={`${dayLabel}-${i}`} className="planningHabitDayToggle">
            <input
              type="checkbox"
              checked={days[i]}
              onChange={(e) => {
                const next = [...days] as DailyDaysMask;
                next[i] = e.target.checked;
                onChange(next);
              }}
              disabled={disabled}
            />
            <span>{dayLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function calendarDaysHint(spawnTaskCards: boolean): string | undefined {
  if (!spawnTaskCards) return undefined;
  return "Drag individual tasks on the calendar to move them to another day.";
}

function validateHabitForm(
  kind: RecurringKind,
  targetCount: string,
  dailyDays: DailyDaysMask,
  spawnTaskCards: boolean
): string | null {
  if (kind !== "count" || !spawnTaskCards) {
    if (spawnTaskCards && countSelectedDays(dailyDays) === 0) {
      return "Pick at least one day for calendar tasks.";
    }
    return null;
  }

  const n = Number(targetCount) || 0;
  if (n < 1 || n > 7) return "Times per week must be between 1 and 7 for calendar habits.";

  const selected = countSelectedDays(dailyDays);
  if (selected !== n) {
    return `Pick exactly ${n} days on the calendar (${selected} selected).`;
  }
  return null;
}

function HabitFormFields({
  title,
  kind,
  targetCount,
  dailyDays,
  spawnTaskCards,
  tallyEnabled,
  endDate,
  calendarRestartFrom,
  onTitleChange,
  onKindChange,
  onTargetCountChange,
  onDailyDaysChange,
  onSpawnTaskCardsChange,
  onTallyEnabledChange,
  onEndDateChange,
  onCalendarRestartFromChange,
  onRegenerateCalendar,
  disabled,
}: {
  title: string;
  kind: RecurringKind;
  targetCount: string;
  dailyDays: DailyDaysMask;
  spawnTaskCards: boolean;
  tallyEnabled: boolean;
  endDate: string;
  calendarRestartFrom: string;
  onTitleChange: (v: string) => void;
  onKindChange: (v: RecurringKind) => void;
  onTargetCountChange: (v: string) => void;
  onDailyDaysChange: (days: DailyDaysMask) => void;
  onSpawnTaskCardsChange: (v: boolean) => void;
  onTallyEnabledChange: (v: boolean) => void;
  onEndDateChange: (v: string) => void;
  onCalendarRestartFromChange: (v: string) => void;
  onRegenerateCalendar?: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="planningHabitFormFields">
      <input
        className="invInput"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Habit name"
        disabled={disabled}
      />
      <select
        className="invInput"
        value={kind}
        onChange={(e) => onKindChange(e.target.value as RecurringKind)}
        disabled={disabled}
      >
        <option value="daily">On specific days</option>
        <option value="count">X times per week</option>
      </select>
      {kind === "count" && (
        <label className="planningHabitCountRow">
          <span className="modalLabel">Times per week</span>
          <input
            type="number"
            min={1}
            max={spawnTaskCards ? 7 : 50}
            className="invInput planningHabitCountInput"
            value={targetCount}
            onChange={(e) => onTargetCountChange(e.target.value)}
            disabled={disabled}
          />
        </label>
      )}
      {kind === "daily" && !spawnTaskCards ? (
        <DayToggleRow
          days={dailyDays}
          onChange={onDailyDaysChange}
          disabled={disabled}
          label="On these days"
        />
      ) : null}
      {kind === "daily" ? (
        <>
          <label className="planningHabitsToggle">
            <input
              type="checkbox"
              checked={tallyEnabled}
              onChange={(e) => onTallyEnabledChange(e.target.checked)}
              disabled={disabled}
            />
            Log a number for each day
          </label>
          {tallyEnabled ? (
            <label className="planningHabitCountRow">
              <span className="modalLabel">Weekly target (optional)</span>
              <input
                type="number"
                className="invInput planningHabitCountInput"
                value={targetCount}
                onChange={(e) => onTargetCountChange(e.target.value)}
                placeholder="Total only"
                disabled={disabled}
              />
              <p className="sectionHint planningHabitTaskHint">
                Tap a day circle to enter a value. Leave target blank to track the week total
                only.
              </p>
            </label>
          ) : null}
        </>
      ) : null}
      <label className="planningHabitsToggle">
        <input
          type="checkbox"
          checked={spawnTaskCards}
          onChange={(e) => onSpawnTaskCardsChange(e.target.checked)}
          disabled={disabled}
        />
        Also create tasks on the calendar each week
      </label>
      {spawnTaskCards ? (
        <>
          <DayToggleRow
            days={dailyDays}
            onChange={onDailyDaysChange}
            disabled={disabled}
            label="Days on calendar"
            hint={
              kind === "count"
                ? `${countSelectedDays(dailyDays)}/${targetCount || "3"} days selected · ${calendarDaysHint(true) ?? ""}`
                : calendarDaysHint(true)
            }
          />
          <label className="planningHabitCountRow">
            <span className="modalLabel">Restart calendar from</span>
            <input
              type="date"
              className="invInput"
              value={calendarRestartFrom}
              onChange={(e) => onCalendarRestartFromChange(e.target.value)}
              disabled={disabled}
            />
            <p className="sectionHint planningHabitTaskHint">
              Clears all calendar tasks for this habit and recreates them from this date with
              numbered labels (e.g. Run (1/3)). Save or use Regenerate below.
            </p>
            {onRegenerateCalendar ? (
              <button
                type="button"
                className="outlineButton"
                onClick={() => void onRegenerateCalendar()}
                disabled={disabled || !calendarRestartFrom}
              >
                Regenerate calendar tasks
              </button>
            ) : null}
          </label>
          <label className="planningHabitCountRow">
            <span className="modalLabel">End date (optional)</span>
            <input
              type="date"
              className="invInput"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              disabled={disabled}
            />
            <p className="sectionHint planningHabitTaskHint">
              {endDate
                ? "Tasks will be created on the calendar through this date."
                : "Leave blank for ongoing — tasks are created 4 weeks ahead and extended when you open Planning."}
            </p>
          </label>
        </>
      ) : kind === "count" ? (
        <p className="sectionHint planningHabitTaskHint">
          Track weekly progress with numbered check-ins — no calendar tasks.
        </p>
      ) : null}
    </div>
  );
}

export default function PlanningHabits({
  pillarId,
  pillarName,
  pillarColor,
  onChanged,
}: Props) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekItems, setWeekItems] = useState<RecurringWeekItem[]>([]);
  const [weekMonday, setWeekMonday] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<RecurringKind>("daily");
  const [newTargetCount, setNewTargetCount] = useState("3");
  const [newDailyDays, setNewDailyDays] = useState<DailyDaysMask>([...DEFAULT_DAILY_DAYS]);
  const [newSpawnTaskCards, setNewSpawnTaskCards] = useState(false);
  const [newTallyEnabled, setNewTallyEnabled] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKind, setEditKind] = useState<RecurringKind>("daily");
  const [editTargetCount, setEditTargetCount] = useState("3");
  const [editDailyDays, setEditDailyDays] = useState<DailyDaysMask>([...DEFAULT_DAILY_DAYS]);
  const [editSpawnTaskCards, setEditSpawnTaskCards] = useState(false);
  const [editTallyEnabled, setEditTallyEnabled] = useState(false);
  const [editEndDate, setEditEndDate] = useState("");
  const [editCalendarRestartFrom, setEditCalendarRestartFrom] = useState("");
  const [busy, setBusy] = useState(false);

  const today = todayIsoYyyyMmDd();

  const load = useCallback(async () => {
    const [habitsRes, weekRes] = await Promise.all([
      fetch("/api/recurring-events"),
      fetch("/api/recurring-events/week"),
    ]);
    const habitsData = await habitsRes.json();
    const weekData = await weekRes.json();
    if (habitsData.ok) setHabits(habitsData.events);
    if (weekData.ok) {
      setWeekItems(weekData.items ?? []);
      setWeekMonday(weekData.week_monday ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pillarHabits = useMemo(
    () => habits.filter((h) => h.pillar_id === pillarId),
    [habits, pillarId]
  );

  const weekByEventId = useMemo(
    () => new Map(weekItems.map((item) => [item.event_id, item])),
    [weekItems]
  );

  const shown = showInactive
    ? pillarHabits
    : pillarHabits.filter((h) => h.active);

  const inactiveCount = pillarHabits.filter((h) => !h.active).length;

  function resetAddForm() {
    setNewTitle("");
    setNewKind("daily");
    setNewTargetCount("3");
    setNewDailyDays([...DEFAULT_DAILY_DAYS]);
    setNewSpawnTaskCards(false);
    setNewTallyEnabled(false);
    setNewEndDate("");
  }

  function buildPayload(
    title: string,
    kind: RecurringKind,
    targetCount: string,
    dailyDays: DailyDaysMask,
    spawnTaskCards: boolean,
    tallyEnabled: boolean,
    endDate: string
  ) {
    const body: Record<string, unknown> = {
      title: title.trim(),
      kind,
      pillar_id: pillarId,
      milestone_id: null,
      spawn_task_cards: spawnTaskCards,
      end_date: endDate.trim() || null,
      daily_days: dailyDays,
      tally_enabled: kind === "daily" && tallyEnabled,
    };
    if (kind === "count") {
      body.target_count = Number(targetCount) || 3;
    } else if (kind === "daily" && tallyEnabled) {
      const parsed = targetCount.trim() === "" ? 0 : Number(targetCount);
      body.target_count = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } else {
      body.target_count = 0;
    }
    return body;
  }

  async function addHabit() {
    const title = newTitle.trim();
    if (!title || busy) return;
    const err = validateHabitForm(newKind, newTargetCount, newDailyDays, newSpawnTaskCards);
    if (err) {
      window.alert(err);
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/recurring-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildPayload(
            title,
            newKind,
            newTargetCount,
            newDailyDays,
            newSpawnTaskCards,
            newTallyEnabled,
            newEndDate
          )
        ),
      });
      resetAddForm();
      setAdding(false);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(habit: Habit) {
    const normalized = normalizeRecurringKind(habit.kind, habit.tally_enabled ?? 0);
    setEditingHabit(habit);
    setEditTitle(habit.title);
    setEditKind(normalized.kind);
    setEditTallyEnabled(normalized.tally_enabled);
    if (normalized.kind === "count") {
      setEditTargetCount(String(habit.target_count || 3));
    } else if (normalized.tally_enabled && habit.target_count > 0) {
      setEditTargetCount(String(habit.target_count));
    } else {
      setEditTargetCount("");
    }
    setEditDailyDays([...parseDailyDays(habit.daily_days)]);
    setEditSpawnTaskCards(!!habit.spawn_task_cards);
    setEditEndDate(habit.end_date ?? "");
    setEditCalendarRestartFrom("");
  }

  function cancelEdit() {
    setEditingHabit(null);
    setEditCalendarRestartFrom("");
  }

  async function regenerateCalendar(habitId: number, fromDate: string) {
    if (!fromDate || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recurring-events/${habitId}/regenerate-calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_date: fromDate }),
      });
      const data = await res.json();
      if (!data.ok) {
        window.alert(data.error || "Could not regenerate calendar tasks");
        return;
      }
      setEditCalendarRestartFrom("");
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editingHabit) return;
    const title = editTitle.trim();
    if (!title || busy) return;
    const err = validateHabitForm(editKind, editTargetCount, editDailyDays, editSpawnTaskCards);
    if (err) {
      window.alert(err);
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/recurring-events/${editingHabit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(
            title,
            editKind,
            editTargetCount,
            editDailyDays,
            editSpawnTaskCards,
            editTallyEnabled,
            editEndDate
          ),
          ...(editCalendarRestartFrom
            ? { calendar_restart_from: editCalendarRestartFrom }
            : {}),
        }),
      });
      cancelEdit();
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(item: RecurringWeekItem, progress: RecurringProgress) {
    setWeekItems((prev) =>
      prev.map((row) =>
        row.progress_id === item.progress_id ? { ...row, progress } : row
      )
    );
    await fetch("/api/recurring-events/week", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        progress_id: item.progress_id,
        event_id: item.event_id,
        kind: item.kind,
        target_count: item.target_count,
        week_monday: item.week_monday,
        spawn_task_cards: item.spawn_task_cards,
        tally_enabled: item.tally_enabled,
        progress,
      }),
    });
  }

  async function toggleActive(habit: Habit) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/recurring-events/${habit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !habit.active }),
      });
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function deleteHabit(habit: Habit) {
    const ok = window.confirm(`Delete habit "${habit.title}"?`);
    if (!ok || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/recurring-events/${habit.id}`, { method: "DELETE" });
      if (editingHabit?.id === habit.id) cancelEdit();
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        className="card planningHabits"
        style={pillarColorVars(pillarColor)}
        aria-label={`Habits for ${pillarName}`}
      >
        <div className="planningHabitsHeader">
          <div className="planningCardHeaderTop">
            <h2 className="planningHabitsTitle">Habits</h2>
            {!adding && !loading && (
              <ActionIconButton
                label="Add habit"
                onClick={() => setAdding(true)}
                disabled={busy}
              >
                +
              </ActionIconButton>
            )}
          </div>
        <p className="sectionHint planningHabitsHint">
          Recurring routines for this pillar — track progress here or on Today. Resets each Monday.
        </p>
          {inactiveCount > 0 && (
            <label className="planningHabitsToggle">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive ({inactiveCount})
            </label>
          )}
        </div>

        {loading ? (
          <p className="sectionHint">Loading habits…</p>
        ) : (
          <ul className="planningHabitList">
            {shown.length === 0 && (
              <li className="milestoneEmpty">
                {pillarHabits.length === 0 ? "No habits yet." : "No active habits."}
              </li>
            )}
            {shown.map((habit) => {
              const weekItem = habit.active ? weekByEventId.get(habit.id) : undefined;

              return (
                <li
                  key={habit.id}
                  className={`planningHabitItem ${!habit.active ? "planningHabitItemInactive" : ""}`}
                >
                  <div className="planningHabitItemMain">
                    <strong>{habit.title}</strong>
                    {weekItem ? (
                      <span className="pill pillSubtle recurringProgressPill">
                        {weekProgressLabel(weekItem)}
                      </span>
                    ) : (
                      <span className="pill pillSubtle">{habitScheduleLabel(habit)}</span>
                    )}
                    {!!habit.spawn_task_cards && (
                      <span className="pill pillSubtle">
                        {formatHabitEndLabel(habit.end_date ?? null)}
                      </span>
                    )}
                    {!!habit.tally_enabled && normalizeRecurringKind(habit.kind, habit.tally_enabled ?? 0).kind === "daily" && (
                      <span className="pill pillSubtle">Numbers</span>
                    )}
                    {!habit.active && <span className="pill pillWarn">Inactive</span>}
                  </div>

                  {weekItem && weekMonday ? (
                    <HabitWeekProgress
                      item={weekItem}
                      weekMonday={weekMonday}
                      today={today}
                      onProgressChange={(progress) => void updateProgress(weekItem, progress)}
                    />
                  ) : null}

                  <div className="planningMilestoneRowActions">
                    <ActionIconButton
                      label={`Edit ${habit.title}`}
                      onClick={() => startEdit(habit)}
                      disabled={busy}
                    >
                      <EditIcon />
                    </ActionIconButton>
                    <button
                      type="button"
                      className="outlineButton planningMilestoneRowBtn"
                      onClick={() => void toggleActive(habit)}
                      disabled={busy}
                    >
                      {habit.active ? "Pause" : "Resume"}
                    </button>
                    <ActionIconButton
                      label={`Delete ${habit.title}`}
                      onClick={() => void deleteHabit(habit)}
                      disabled={busy}
                      variant="danger"
                    >
                      <DeleteIcon />
                    </ActionIconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <div className="planningHabitAddForm">
            <HabitFormFields
              title={newTitle}
              kind={newKind}
              targetCount={newTargetCount}
              dailyDays={newDailyDays}
              spawnTaskCards={newSpawnTaskCards}
              tallyEnabled={newTallyEnabled}
              endDate={newEndDate}
              calendarRestartFrom=""
              onTitleChange={setNewTitle}
              onKindChange={(k) => {
                setNewKind(k);
                if (k === "count") {
                  setNewTallyEnabled(false);
                  setNewTargetCount("3");
                } else {
                  setNewTargetCount("");
                }
              }}
              onTargetCountChange={setNewTargetCount}
              onDailyDaysChange={setNewDailyDays}
              onSpawnTaskCardsChange={(enabled) => {
                setNewSpawnTaskCards(enabled);
                if (enabled && newKind === "count") {
                  setNewDailyDays([
                    ...defaultCalendarDaysForCount(Number(newTargetCount) || 3),
                  ]);
                }
              }}
              onTallyEnabledChange={setNewTallyEnabled}
              onEndDateChange={setNewEndDate}
              onCalendarRestartFromChange={() => {}}
              disabled={busy}
            />
            <div className="planningMilestoneEditActions">
              <button
                type="button"
                className="chatSendBtn"
                onClick={() => void addHabit()}
                disabled={busy || !newTitle.trim()}
              >
                Add
              </button>
              <button
                type="button"
                className="outlineButton"
                onClick={() => {
                  setAdding(false);
                  resetAddForm();
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {editingHabit ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planning-habit-edit-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) cancelEdit();
          }}
        >
          <div className="modalCard">
            <h2 id="planning-habit-edit-title" className="modalTitle">
              Edit habit
            </h2>
            <p className="modalNote">{editingHabit.title}</p>
            <HabitFormFields
              title={editTitle}
              kind={editKind}
              targetCount={editTargetCount}
              dailyDays={editDailyDays}
              spawnTaskCards={editSpawnTaskCards}
              tallyEnabled={editTallyEnabled}
              endDate={editEndDate}
              calendarRestartFrom={editCalendarRestartFrom}
              onTitleChange={setEditTitle}
              onKindChange={(k) => {
                setEditKind(k);
                if (k === "count") {
                  setEditTallyEnabled(false);
                  setEditTargetCount("3");
                } else {
                  setEditTargetCount("");
                }
              }}
              onTargetCountChange={setEditTargetCount}
              onDailyDaysChange={setEditDailyDays}
              onSpawnTaskCardsChange={(enabled) => {
                setEditSpawnTaskCards(enabled);
                if (enabled && editKind === "count") {
                  setEditDailyDays([
                    ...defaultCalendarDaysForCount(Number(editTargetCount) || 3),
                  ]);
                }
              }}
              onTallyEnabledChange={setEditTallyEnabled}
              onEndDateChange={setEditEndDate}
              onCalendarRestartFromChange={setEditCalendarRestartFrom}
              onRegenerateCalendar={() =>
                regenerateCalendar(editingHabit.id, editCalendarRestartFrom)
              }
              disabled={busy}
            />
            <div className="modalActions">
              <button
                type="button"
                className="chatSendBtn"
                onClick={() => void saveEdit()}
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
          </div>
        </div>
      ) : null}
    </>
  );
}
