"use client";

import {
  PILLAR_COLOR_OPTIONS,
  isLightPillarColor,
  normalizePillarColor,
  pillarColorAriaLabel,
} from "../lib/pillar-colors";

export default function PillarColorPicker({
  value,
  onChange,
  label = "Color",
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const selected = normalizePillarColor(value);

  return (
    <div className="pillarColorPicker">
      <span className="modalLabel">{label}</span>
      <div className="pillarColorSwatches" role="radiogroup" aria-label={label}>
        {PILLAR_COLOR_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          const aria = pillarColorAriaLabel(option);
          const isLight = isLightPillarColor(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={aria}
              title={aria}
              className={`pillarColorSwatch ${isLight ? "pillarColorSwatchLight" : ""} ${isSelected ? "pillarColorSwatchSelected" : ""}`}
              style={{ backgroundColor: option.value }}
              onClick={() => onChange(option.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
