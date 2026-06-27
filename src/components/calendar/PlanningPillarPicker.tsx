"use client";

import { useEffect, useRef, useState } from "react";
import { normalizePillarColor } from "../../lib/pillar-colors";

type Pillar = {
  id: number;
  name: string;
  color: string;
};

type Props = {
  pillars: Pillar[];
  selectedPillarId: number | null;
  onSelect: (id: number) => void;
};

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`planningPillarPickerChevron ${open ? "planningPillarPickerChevronOpen" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function PlanningPillarPicker({ pillars, selectedPillarId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedPillar =
    pillars.find((pillar) => pillar.id === selectedPillarId) ?? pillars[0] ?? null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!selectedPillar) return null;

  return (
    <div className="planningPillarPicker" ref={rootRef}>
      <button
        type="button"
        className="planningPillarPickerTrigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Current pillar: ${selectedPillar.name}. Choose pillar.`}
      >
        <span
          className="planningPillarPickerName"
          style={{ color: normalizePillarColor(selectedPillar.color) }}
        >
          {selectedPillar.name}
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open ? (
        <ul className="planningPillarPickerMenu" role="listbox" aria-label="Choose pillar">
          {pillars.map((pillar) => {
            const isSelected = pillar.id === selectedPillar.id;
            return (
              <li key={pillar.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`planningPillarPickerOption ${isSelected ? "planningPillarPickerOptionSelected" : ""}`}
                  onClick={() => {
                    onSelect(pillar.id);
                    setOpen(false);
                  }}
                >
                  {pillar.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
