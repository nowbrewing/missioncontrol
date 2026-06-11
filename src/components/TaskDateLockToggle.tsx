"use client";

export default function TaskDateLockToggle({
  locked,
  disabled,
  onClick,
  title,
  ariaLabel,
}: {
  locked: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className={`taskDateLockBtn ${locked ? "taskDateLockBtnLocked" : ""}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={locked}
      aria-label={ariaLabel}
    >
      <svg
        className="taskDateLockIcon"
        viewBox="0 0 20 20"
        width={20}
        height={20}
        aria-hidden="true"
      >
        <rect
          className="taskDateLockFrame"
          x="3"
          y="3"
          width="14"
          height="14"
          rx="3"
          ry="3"
        />
        {locked ? (
          <g className="taskDateLockGlyph">
            <path d="M7 9V7.5a3 3 0 1 1 6 0V9" />
            <rect x="6.25" y="9" width="7.5" height="5.5" rx="1" />
          </g>
        ) : null}
      </svg>
    </button>
  );
}
