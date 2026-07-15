"use client";

import type { PillarNoteFieldDef } from "../../lib/pillar-note-fields";

export default function PillarNoteFieldInput({
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

  if (field.type === "long_text") {
    return (
      <textarea
        className="invInput pillarNoteFieldValueInput pillarNoteFieldLongTextInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value.trim())}
        rows={5}
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
