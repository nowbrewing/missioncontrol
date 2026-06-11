"use client";

import { useState } from "react";
import PillarChip from "./PillarChip";
import type { RecurringWeekItem } from "../lib/recurring-events";
import {
  WEEKDAY_LABELS,
  countProgressDone,
  dailyCheckDone,
  dailyTallyTotal,
  type CountProgress,
  type DailyCheckProgress,
  type DailyTallyProgress,
  type RecurringProgress,
} from "../lib/recurring-week";

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

function TallyDayCircle({
  date,
  dayLabel,
  count,
  isToday,
  isActive,
  onClick,
}: {
  date: string;
  dayLabel: string;
  count: number;
  isToday: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const hasValue = count !== 0;
  const display = hasValue ? String(count) : dayLabel;

  return (
    <button
      type="button"
      className={`recurringCircle ${hasValue ? "recurringCircleChecked" : ""} ${isToday ? "recurringCircleToday" : ""} ${isActive ? "recurringCircleActive" : ""} ${hasValue ? "recurringCircleHasCount" : ""}`}
      onClick={onClick}
      aria-label={`${dayLabel}${hasValue ? `, ${count} logged` : ""}`}
      aria-pressed={isActive}
      title={date}
    >
      <span className="recurringCircleLabel">{display}</span>
    </button>
  );
}

function DailyCheckRow({
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

function DailyTallyRow({
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
  const pct = hasTarget ? Math.min(100, (total / item.target_count) * 100) : 0;
  const activeCount = activeDate ? progress.values[activeDate] ?? 0 : 0;

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
          return (
            <TallyDayCircle
              key={date}
              date={date}
              dayLabel={WEEKDAY_LABELS[i]}
              count={progress.values[date] ?? 0}
              isToday={date === today}
              isActive={activeDate === date}
              onClick={() => setActiveDate(activeDate === date ? null : date)}
            />
          );
        })}
      </div>

      {activeDate ? (
        <div className="recurringCounterDayInput">
          <label className="modalLabel" htmlFor={`tally-${item.progress_id}-${activeDate}`}>
            {WEEKDAY_LABELS[item.week_dates.indexOf(activeDate)]} — {activeDate}
          </label>
          <div className="recurringCounterDayInputRow">
            <input
              id={`tally-${item.progress_id}-${activeDate}`}
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

      <div className="recurringCounterMeta">
        <span className="recurringCounterValue">
          {hasTarget ? `${total} / ${item.target_count}` : total}
        </span>
        {hasTarget ? (
          <div className="recurringCounterBar" aria-hidden>
            <div className="recurringCounterFill" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CountRow({
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

function scorecardLabel(item: RecurringWeekItem): string {
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

function RecurringItemRow({
  item,
  today,
  onProgressChange,
}: {
  item: RecurringWeekItem;
  today: string;
  onProgressChange: (progress: RecurringProgress) => void;
}) {
  return (
    <li className="card recurringChecklistItem">
      <div className="recurringChecklistHead">
        <strong className="recurringChecklistTitle">{item.title}</strong>
        {item.pillar_name && (
          <PillarChip
            name={item.pillar_name}
            abbreviation={item.pillar_abbreviation}
            color={item.pillar_color}
            compact
          />
        )}
        {item.milestone_title && (
          <span className="pill pillSubtle">{item.milestone_title}</span>
        )}
        <span className="pill pillSubtle recurringProgressPill">{scorecardLabel(item)}</span>
      </div>

      {item.kind === "daily" && item.tally_enabled && (
        <DailyTallyRow item={item} today={today} onProgressChange={onProgressChange} />
      )}
      {item.kind === "daily" && !item.tally_enabled && (
        <DailyCheckRow item={item} today={today} onProgressChange={onProgressChange} />
      )}
      {item.kind === "count" && <CountRow item={item} onProgressChange={onProgressChange} />}
    </li>
  );
}

export default function MissionWeeklyChecklist({
  items,
  weekMonday,
  today,
  loading,
  onProgressChange,
}: {
  items: RecurringWeekItem[];
  weekMonday: string;
  today: string;
  loading: boolean;
  onProgressChange: (item: RecurringWeekItem, progress: RecurringProgress) => void;
}) {
  if (loading) {
    return (
      <section className="section missionWeeklyChecklist">
        <h2 className="sectionTitle">Weekly checklist</h2>
        <p className="sectionHint">Loading...</p>
      </section>
    );
  }

  return (
    <section className="section missionWeeklyChecklist">
      <h2 className="sectionTitle">Weekly checklist</h2>
      <p className="sectionHint">
        Week of {weekMonday} (Mon–Sun). Resets each Monday.
      </p>

      {items.length === 0 ? (
        <div className="card recurringChecklistEmpty">
          <p style={{ margin: 0, opacity: 0.8 }}>
            No recurring items yet. Add habits and routines on the{" "}
            <strong>Routines</strong> page in the nav bar.
          </p>
        </div>
      ) : (
        <ul className="recurringChecklistList">
          {items.map((item) => (
            <RecurringItemRow
              key={item.progress_id}
              item={item}
              today={today}
              onProgressChange={(progress) => onProgressChange(item, progress)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
