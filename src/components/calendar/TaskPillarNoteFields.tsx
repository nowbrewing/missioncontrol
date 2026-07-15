"use client";

import { useEffect, useState } from "react";
import PillarNoteFieldInput from "./PillarNoteFieldInput";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../../lib/pillar-note-fields";

export default function TaskPillarNoteFields({
  fields,
  values,
  disabled,
  onChange,
}: {
  fields: PillarNoteFieldDef[];
  values: PillarNoteFieldValues;
  disabled?: boolean;
  onChange: (values: PillarNoteFieldValues) => void;
}) {
  const [localValues, setLocalValues] = useState<PillarNoteFieldValues>(values);

  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  if (fields.length === 0) return null;

  function updateValue(fieldId: string, raw: string) {
    const next = { ...localValues };
    if (!raw) {
      delete next[fieldId];
    } else {
      next[fieldId] = raw;
    }
    setLocalValues(next);
    onChange(next);
  }

  return (
    <div className="modalField taskPillarNoteFields">
      <span className="modalLabel">Custom fields</span>
      <dl className="pillarNoteFieldsList">
        {fields.map((field) => (
          <div key={field.id} className="pillarNoteFieldRow">
            <dt className="pillarNoteFieldLabel">{field.label}</dt>
            <dd className="pillarNoteFieldValue">
              <PillarNoteFieldInput
                field={field}
                value={localValues[field.id] ?? ""}
                disabled={disabled}
                onChange={(value) => updateValue(field.id, value)}
              />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
