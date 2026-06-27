"use client";

import { useCallback, useEffect, useState } from "react";
import ActionIconButton, { DeleteIcon, EditIcon } from "./ActionIconButton";
import TaskPillarSelect from "./TaskPillarSelect";
import {
  DEFAULT_DAILY_DAYS,
  WEEKDAY_LABELS,
  normalizeRecurringKind,
  parseDailyDays,
  type RecurringKind,
} from "../lib/recurring-week";

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
};

type Milestone = {
  id: number;
  title: string;
  pillar_id: number | null;
};

type RecurringEvent = {
  id: number;
  title: string;
  kind: string;
  target_count: number;
  daily_days: string | null;
  tally_enabled?: number;
  pillar_id: number | null;
  milestone_id: number | null;
  spawn_task_cards: number;
  active: number;
  rules?: string | null;
};

type EventFormState = {
  title: string;
  kind: RecurringKind;
  targetCount: string;
  dailyDays: boolean[];
  tallyEnabled: boolean;
  pillarId: number | null;
  milestoneId: number | null;
  spawnTaskCards: boolean;
  rules: string;
};

const KIND_LABELS: Record<RecurringKind, string> = {
  daily: "Daily schedule",
  count: "X times per week",
};

const EMPTY_FORM: EventFormState = {
  title: "",
  kind: "daily",
  targetCount: "",
  dailyDays: [...DEFAULT_DAILY_DAYS],
  tallyEnabled: false,
  pillarId: null,
  milestoneId: null,
  spawnTaskCards: false,
  rules: "",
};

function eventKindLabel(event: RecurringEvent): string {
  const { kind, tally_enabled } = normalizeRecurringKind(
    event.kind,
    event.tally_enabled ?? 0
  );
  if (kind === "daily" && tally_enabled) return "Daily schedule + tally";
  return KIND_LABELS[kind];
}

function formFromEvent(event: RecurringEvent): EventFormState {
  const normalized = normalizeRecurringKind(event.kind, event.tally_enabled ?? 0);
  return {
    title: event.title,
    kind: normalized.kind,
    dailyDays: [...parseDailyDays(event.daily_days)],
    tallyEnabled: normalized.tally_enabled,
    targetCount:
      normalized.kind === "count"
        ? String(event.target_count || 3)
        : normalized.tally_enabled && event.target_count > 0
          ? String(event.target_count)
          : "",
    pillarId: event.pillar_id,
    milestoneId: event.milestone_id,
    spawnTaskCards: !!event.spawn_task_cards,
    rules: event.rules ?? "",
  };
}

function buildEventPayload(form: EventFormState): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: form.title.trim(),
    kind: form.kind,
    daily_days: form.dailyDays,
    pillar_id: form.pillarId,
    milestone_id: form.milestoneId,
    spawn_task_cards: form.spawnTaskCards,
    rules: form.rules.trim() || null,
  };

  if (form.kind === "daily") {
    body.tally_enabled = form.tallyEnabled;
    if (form.tallyEnabled) {
      const parsed = form.targetCount.trim() === "" ? 0 : Number(form.targetCount);
      body.target_count = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } else {
      body.target_count = 0;
    }
  } else {
    body.tally_enabled = false;
    body.target_count = Number(form.targetCount) || 3;
  }

  return body;
}

function EventFormFieldsWithPillars({
  form,
  onChange,
  idPrefix,
  pillars,
  milestones,
}: {
  form: EventFormState;
  onChange: (patch: Partial<EventFormState>) => void;
  idPrefix: string;
  pillars: Pillar[];
  milestones: Milestone[];
}) {
  const filteredMilestones = form.pillarId
    ? milestones.filter((m) => m.pillar_id === form.pillarId)
    : milestones;

  return (
    <>
      <div className="modalField">
        <label className="modalLabel" htmlFor={`${idPrefix}-title`}>
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          className="invInput"
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Morning run, ICT trading, Pull-ups"
        />
      </div>

      <div className="modalField">
        <label className="modalLabel" htmlFor={`${idPrefix}-kind`}>
          Type
        </label>
        <select
          id={`${idPrefix}-kind`}
          className="invInput"
          value={form.kind}
          onChange={(e) => onChange({ kind: e.target.value as RecurringKind })}
        >
          {(Object.keys(KIND_LABELS) as RecurringKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {form.kind === "daily" && (
        <>
          <div className="modalField">
            <span className="modalLabel">Active days</span>
            <div className="recurringDayPicker">
              {WEEKDAY_LABELS.map((label, i) => (
                <label key={i} className="recurringDayToggle">
                  <input
                    type="checkbox"
                    checked={form.dailyDays[i]}
                    onChange={(e) => {
                      const next = [...form.dailyDays];
                      next[i] = e.target.checked;
                      onChange({ dailyDays: next });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="filterToggle">
            <input
              type="checkbox"
              checked={form.tallyEnabled}
              onChange={(e) => onChange({ tallyEnabled: e.target.checked })}
            />
            Track numbers (adds up across the week)
          </label>

          {form.tallyEnabled && (
            <div className="modalField">
              <label className="modalLabel" htmlFor={`${idPrefix}-target`}>
                Weekly target (optional)
              </label>
              <input
                id={`${idPrefix}-target`}
                className="invInput"
                type="number"
                placeholder="Leave blank for total only"
                value={form.targetCount}
                onChange={(e) => onChange({ targetCount: e.target.value })}
              />
              <p className="sectionHint missionIntakeDateHint">
                Leave empty to show the week total only. Values can be negative.
              </p>
            </div>
          )}
        </>
      )}

      {form.kind === "count" && (
        <div className="modalField">
          <label className="modalLabel" htmlFor={`${idPrefix}-count`}>
            Times per week
          </label>
          <input
            id={`${idPrefix}-count`}
            className="invInput"
            type="number"
            min={1}
            max={50}
            value={form.targetCount || "3"}
            onChange={(e) => onChange({ targetCount: e.target.value })}
          />
        </div>
      )}

      <div className="inlineForm recurringSetupTags">
        <TaskPillarSelect
          pillars={pillars}
          value={form.pillarId}
          onChange={(id) => onChange({ pillarId: id, milestoneId: null })}
        />
        <select
          className="invInput missionPillarSelect"
          value={form.milestoneId ?? ""}
          onChange={(e) =>
            onChange({
              milestoneId: e.target.value ? Number(e.target.value) : null,
            })
          }
          aria-label="Milestone (optional)"
        >
          <option value="">No milestone</option>
          {filteredMilestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      <label className="filterToggle">
        <input
          type="checkbox"
          checked={form.spawnTaskCards}
          onChange={(e) => onChange({ spawnTaskCards: e.target.checked })}
        />
        Also create individual task cards each week
      </label>

      <div className="modalField">
        <label className="modalLabel" htmlFor={`${idPrefix}-rules`}>
          Scheduling rules (optional)
        </label>
        <textarea
          id={`${idPrefix}-rules`}
          className="invInput routineRulesInput"
          rows={3}
          value={form.rules}
          onChange={(e) => onChange({ rules: e.target.value })}
          placeholder="e.g. Nudge me if I miss a day. Don't schedule back-to-back unless I'm behind for the week."
        />
        <p className="sectionHint missionIntakeDateHint">
          Guidance for the assistant about this habit only.
        </p>
      </div>
    </>
  );
}

function EventMetaPills({ event }: { event: RecurringEvent }) {
  const normalized = normalizeRecurringKind(event.kind, event.tally_enabled ?? 0);
  return (
    <>
      <span className="pill pillSubtle">{eventKindLabel(event)}</span>
      {normalized.kind === "count" && (
        <span className="pill pillSubtle">{event.target_count}×/week</span>
      )}
      {normalized.kind === "daily" && (
        <span className="pill pillSubtle">
          {parseDailyDays(event.daily_days)
            .map((on, i) => (on ? WEEKDAY_LABELS[i] : null))
            .filter(Boolean)
            .join(" ")}
        </span>
      )}
      {normalized.kind === "daily" && normalized.tally_enabled && (
        <span className="pill pillSubtle">
          {event.target_count > 0 ? `target ${event.target_count}` : "tally only"}
        </span>
      )}
      {!event.active && <span className="pill pillWarn">Inactive</span>}
      {event.rules?.trim() ? (
        <span className="pill pillSubtle" title={event.rules.trim()}>
          has rules
        </span>
      ) : null}
    </>
  );
}

function AddRoutineDialog({
  form,
  saving,
  pillars,
  milestones,
  onChange,
  onSubmit,
  onClose,
}: {
  form: EventFormState;
  saving: boolean;
  pillars: Pillar[];
  milestones: Milestone[];
  onChange: (patch: Partial<EventFormState>) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-routine-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modalCard">
        <h2 id="add-routine-title" className="modalTitle">
          Add routine
        </h2>
        <p className="modalNote">
          Habits and routines that reset every Monday. Track progress on the Mission
          checklist.
        </p>
        <div className="modalForm">
          <EventFormFieldsWithPillars
            form={form}
            onChange={onChange}
            idPrefix="add"
            pillars={pillars}
            milestones={milestones}
          />
        </div>
        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={onSubmit}
            disabled={saving || !form.title.trim()}
          >
            {saving ? "Adding..." : "Add routine"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventListItem({
  event,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  event: RecurringEvent;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`card recurringSetupItem ${!event.active ? "recurringSetupItemInactive" : ""}`}
    >
      <div className="recurringSetupItemMain">
        <strong>{event.title}</strong>
        <EventMetaPills event={event} />
      </div>
      <div className="recurringSetupItemActions">
        <ActionIconButton label={`Edit ${event.title}`} onClick={onEdit}>
          <EditIcon />
        </ActionIconButton>
        <button
          type="button"
          className="outlineButton btnCompact"
          onClick={onToggleActive}
        >
          {event.active ? "Deactivate" : "Reactivate"}
        </button>
        <ActionIconButton
          label={`Delete ${event.title}`}
          onClick={onDelete}
          variant="danger"
        >
          <DeleteIcon />
        </ActionIconButton>
      </div>
    </li>
  );
}

export default function RecurringEventsSetup({
  pillars,
  milestones,
  onChanged,
}: {
  pillars: Pillar[];
  milestones: Milestone[];
  onChanged?: () => void;
}) {
  const [events, setEvents] = useState<RecurringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState<EventFormState>({ ...EMPTY_FORM });
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editForm, setEditForm] = useState<EventFormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/recurring-events");
    const data = await res.json();
    if (data.ok) setEvents(data.events);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetAddForm() {
    setAddForm({ ...EMPTY_FORM, dailyDays: [...DEFAULT_DAILY_DAYS] });
  }

  function closeAddRoutineDialog() {
    if (saving) return;
    setShowAddRoutine(false);
    resetAddForm();
  }

  async function addEvent() {
    if (!addForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/recurring-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEventPayload(addForm)),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not create routine");
      }
      setShowAddRoutine(false);
      resetAddForm();
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  function openEdit(event: RecurringEvent) {
    setEditingId(event.id);
    setEditForm(formFromEvent(event));
  }

  function closeEdit() {
    if (saving) return;
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editForm || editingId == null || !editForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/recurring-events/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEventPayload(editForm)),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not save");
      }
      closeEdit();
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(event: RecurringEvent) {
    await fetch(`/api/recurring-events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !event.active }),
    });
    await load();
    onChanged?.();
  }

  async function removeEvent(id: number, title: string) {
    if (!window.confirm(`Delete "${title}" permanently? This cannot be undone.`)) return;
    await fetch(`/api/recurring-events/${id}`, { method: "DELETE" });
    await load();
    onChanged?.();
  }

  if (loading) {
    return <p className="sectionHint">Loading recurring events...</p>;
  }

  const activeEvents = events.filter((e) => e.active);
  const inactiveEvents = events.filter((e) => !e.active);

  return (
    <div className="recurringSetup">
      <div className="pillarsPageHeader">
        <p className="sectionHint" style={{ margin: 0 }}>
          Habits and routines that reset every Monday. Deactivated items stay saved but
          disappear from the Mission Control checklist.
        </p>
        <button
          type="button"
          className="chatSendBtn"
          onClick={() => setShowAddRoutine(true)}
        >
          Add routine
        </button>
      </div>

      {activeEvents.length > 0 && (
        <section className="section">
          <ul className="recurringSetupList">
            {activeEvents.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                onEdit={() => openEdit(event)}
                onToggleActive={() => toggleActive(event)}
                onDelete={() => removeEvent(event.id, event.title)}
              />
            ))}
          </ul>
        </section>
      )}

      {showInactive && inactiveEvents.length > 0 && (
        <section className="section recurringInactiveSection">
          <ul className="recurringSetupList">
            {inactiveEvents.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                onEdit={() => openEdit(event)}
                onToggleActive={() => toggleActive(event)}
                onDelete={() => removeEvent(event.id, event.title)}
              />
            ))}
          </ul>
        </section>
      )}

      {inactiveEvents.length > 0 && (
        <p className="recurringInactiveToggleWrap">
          <button
            type="button"
            className="recurringInactiveToggle"
            onClick={() => setShowInactive((prev) => !prev)}
            aria-expanded={showInactive}
          >
            {showInactive
              ? "Hide deactivated routines"
              : `Show deactivated routines (${inactiveEvents.length})`}
          </button>
        </p>
      )}

      {events.length === 0 && (
        <div className="card recurringChecklistEmpty">
          <p style={{ margin: 0, opacity: 0.8 }}>
            No routines yet. Click <strong>Add routine</strong> to create your first
            habit.
          </p>
        </div>
      )}

      {showAddRoutine && (
        <AddRoutineDialog
          form={addForm}
          saving={saving}
          pillars={pillars}
          milestones={milestones}
          onChange={(patch) => setAddForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={addEvent}
          onClose={closeAddRoutineDialog}
        />
      )}

      {editingId != null && editForm && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-recurring-title"
          onClick={(e) => e.target === e.currentTarget && closeEdit()}
        >
          <div className="modalCard">
            <h2 id="edit-recurring-title" className="modalTitle">
              Edit habit
            </h2>
            <div className="modalForm">
              <EventFormFieldsWithPillars
                form={editForm}
                onChange={(patch) => setEditForm((prev) => (prev ? { ...prev, ...patch } : prev))}
                idPrefix="edit"
                pillars={pillars}
                milestones={milestones}
              />
            </div>
            <div className="modalActions">
              <button
                type="button"
                className="outlineButton"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={saveEdit}
                disabled={saving || !editForm.title.trim()}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
