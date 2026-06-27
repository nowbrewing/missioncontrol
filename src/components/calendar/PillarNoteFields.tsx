"use client";

import { useEffect, useState } from "react";
import ActionIconButton, { DeleteIcon } from "../ActionIconButton";
import {
  displayPillarNoteFieldValue,
  newPillarNoteFieldId,
  sanitizePillarNoteFieldDefs,
  type PillarNoteFieldDef,
  type PillarNoteFieldType,
  type PillarNoteFieldValues,
} from "../../lib/pillar-note-fields";

type DraftField = {
  id: string;
  label: string;
  type: PillarNoteFieldType;
  optionsText: string;
};

function defsToDraft(fields: PillarNoteFieldDef[]): DraftField[] {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    optionsText: (field.options ?? []).join("\n"),
  }));
}

function draftToDefs(drafts: DraftField[]): PillarNoteFieldDef[] {
  return sanitizePillarNoteFieldDefs(
    drafts.map((draft) => {
      const def: PillarNoteFieldDef = {
        id: draft.id,
        label: draft.label.trim(),
        type: draft.type,
      };
      if (draft.type === "select") {
        def.options = draft.optionsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      }
      return def;
    })
  );
}

function PillarNoteFieldsManagerModal({
  fields,
  saving,
  onSave,
  onClose,
}: {
  fields: PillarNoteFieldDef[];
  saving: boolean;
  onSave: (fields: PillarNoteFieldDef[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftField[]>(() => defsToDraft(fields));

  useEffect(() => {
    setDrafts(defsToDraft(fields));
  }, [fields]);

  function updateDraft(index: number, patch: Partial<DraftField>) {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      { id: newPillarNoteFieldId(), label: "", type: "text", optionsText: "" },
    ]);
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pillar-note-fields-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modalCard pillarNoteFieldsModal">
        <h2 id="pillar-note-fields-title" className="modalTitle">
          Custom fields
        </h2>
        <p className="modalNote">
          Add fields that only appear on this pillar&apos;s planning note — dropdowns, text, or
          numbers (e.g. Theme, Style for TikTok).
        </p>

        <div className="pillarNoteFieldsDraftList">
          {drafts.length === 0 ? (
            <p className="sectionHint">No custom fields yet.</p>
          ) : (
            drafts.map((draft, index) => (
              <div key={draft.id} className="pillarNoteFieldDraft">
                <div className="pillarNoteFieldDraftTop">
                  <input
                    className="invInput"
                    value={draft.label}
                    onChange={(e) => updateDraft(index, { label: e.target.value })}
                    placeholder="Field label"
                    disabled={saving}
                  />
                  <select
                    className="invInput"
                    value={draft.type}
                    onChange={(e) =>
                      updateDraft(index, { type: e.target.value as PillarNoteFieldType })
                    }
                    disabled={saving}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown</option>
                  </select>
                  <ActionIconButton
                    label="Remove field"
                    onClick={() => removeDraft(index)}
                    disabled={saving}
                    variant="danger"
                  >
                    <DeleteIcon />
                  </ActionIconButton>
                </div>
                {draft.type === "select" ? (
                  <textarea
                    className="chatInput pillarNoteFieldOptionsInput"
                    rows={3}
                    value={draft.optionsText}
                    onChange={(e) => updateDraft(index, { optionsText: e.target.value })}
                    placeholder={"Option one\nOption two\nOption three"}
                    disabled={saving}
                  />
                ) : null}
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          className="outlineButton"
          onClick={addDraft}
          disabled={saving || drafts.length >= 12}
        >
          Add field
        </button>

        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => void onSave(draftToDefs(drafts))}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save fields"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldValueInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: PillarNoteFieldDef;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select
        className="invInput pillarNoteFieldValueInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select…</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        className="invInput pillarNoteFieldValueInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value.trim())}
        disabled={disabled}
      />
    );
  }

  return (
    <input
      type="text"
      className="invInput pillarNoteFieldValueInput"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(e.target.value.trim())}
      disabled={disabled}
    />
  );
}

export default function PillarNoteFields({
  pillarId,
  fields,
  values,
  onFieldsChange,
  onValuesChange,
}: {
  pillarId: number;
  fields: PillarNoteFieldDef[];
  values: PillarNoteFieldValues;
  onFieldsChange: (fields: PillarNoteFieldDef[], values: PillarNoteFieldValues) => void;
  onValuesChange: (values: PillarNoteFieldValues) => void;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [savingDefs, setSavingDefs] = useState(false);
  const [savingValues, setSavingValues] = useState(false);
  const [localValues, setLocalValues] = useState<PillarNoteFieldValues>(values);

  useEffect(() => {
    setLocalValues(values);
  }, [values, pillarId]);

  async function saveFieldDefs(nextFields: PillarNoteFieldDef[]) {
    setSavingDefs(true);
    try {
      const res = await fetch(`/api/pillars/${pillarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_fields: nextFields }),
      });
      const data = await res.json();
      if (!data.ok) return;

      const res2 = await fetch("/api/pillars");
      const pillarsData = await res2.json();
      const pillar = pillarsData.pillars?.find((p: { id: number }) => p.id === pillarId);
      if (pillar) {
        onFieldsChange(pillar.note_fields ?? [], pillar.note_field_values ?? {});
      } else {
        onFieldsChange(nextFields, localValues);
      }
      setManagerOpen(false);
    } finally {
      setSavingDefs(false);
    }
  }

  async function persistValues(nextValues: PillarNoteFieldValues) {
    setSavingValues(true);
    try {
      const res = await fetch(`/api/pillars/${pillarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_field_values: nextValues }),
      });
      const data = await res.json();
      if (data.ok) {
        onValuesChange(nextValues);
        return true;
      }
      return false;
    } finally {
      setSavingValues(false);
    }
  }

  async function updateValue(fieldId: string, raw: string) {
    const next = { ...localValues };
    if (!raw) {
      delete next[fieldId];
    } else {
      next[fieldId] = raw;
    }
    setLocalValues(next);
    await persistValues(next);
  }

  return (
    <>
      <div className="pillarNoteFieldsSection">
        <div className="pillarNoteFieldsSectionHeader">
          <span className="modalLabel">Custom fields</span>
          <button
            type="button"
            className="outlineButton btnCompact pillarNoteFieldsManageBtn"
            onClick={() => setManagerOpen(true)}
            disabled={savingDefs || savingValues}
          >
            {fields.length > 0 ? "Manage fields" : "Add fields"}
          </button>
        </div>

        {fields.length > 0 ? (
          <dl className="pillarNoteFieldsList">
            {fields.map((field) => (
              <div key={field.id} className="pillarNoteFieldRow">
                <dt className="pillarNoteFieldLabel">{field.label}</dt>
                <dd className="pillarNoteFieldValue">
                  <FieldValueInput
                    field={field}
                    value={localValues[field.id] ?? ""}
                    disabled={savingValues}
                    onChange={(value) => void updateValue(field.id, value)}
                  />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="sectionHint pillarNoteFieldsEmpty">
            No custom fields for this pillar yet.
          </p>
        )}

        {fields.length > 0 && !managerOpen ? (
          <p className="sectionHint pillarNoteFieldsSavedHint" aria-live="polite">
            {savingValues ? "Saving…" : "Values save automatically."}
          </p>
        ) : null}
      </div>

      {managerOpen ? (
        <PillarNoteFieldsManagerModal
          fields={fields}
          saving={savingDefs}
          onSave={saveFieldDefs}
          onClose={() => !savingDefs && setManagerOpen(false)}
        />
      ) : null}
    </>
  );
}