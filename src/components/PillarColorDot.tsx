"use client";

import { useEffect, useRef, useState } from "react";
import {
  PILLAR_COLOR_OPTIONS,
  isLightPillarColor,
  normalizePillarColor,
  pillarColorAriaLabel,
} from "../lib/pillar-colors";

export default function PillarColorDot({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = normalizePillarColor(value);
  const isLight = isLightPillarColor(selected);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="pillarColorDotWrap" ref={wrapRef}>
      <button
        type="button"
        className={`pillarColorDot ${isLight ? "pillarColorDotLight" : ""}`}
        style={{ backgroundColor: selected }}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Change pillar color"
        aria-expanded={open}
        aria-haspopup="listbox"
      />
      {open && (
        <div className="pillarColorDotMenu" role="listbox" aria-label="Pillar color">
          {PILLAR_COLOR_OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            const aria = pillarColorAriaLabel(option);
            const optionLight = isLightPillarColor(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={aria}
                title={aria}
                className={`pillarColorSwatch pillarColorSwatchCompact ${optionLight ? "pillarColorSwatchLight" : ""} ${isSelected ? "pillarColorSwatchSelected" : ""}`}
                style={{ backgroundColor: option.value }}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
