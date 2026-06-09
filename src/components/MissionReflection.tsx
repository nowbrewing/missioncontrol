"use client";

import { formatRelativeDateLabel } from "../lib/mission-dates";
import type { MissionReflectionDisplay } from "../lib/mission-reflection-display";

function BucketList({
  label,
  items,
  today,
}: {
  label: string;
  items: MissionReflectionDisplay["buckets"]["today"];
  today: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="missionReflectionBucket">
      <h3 className="missionReflectionBucketTitle">{label}</h3>
      <ul className="missionReflectionList">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="missionReflectionItem">
            <span>{item.title}</span>
            {item.date && (
              <span className="missionReflectionDate">
                {formatRelativeDateLabel(item.date, today)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MissionReflection({
  reflection,
  today,
}: {
  reflection: MissionReflectionDisplay | null;
  today: string;
}) {
  if (!reflection) return null;

  const hasBuckets =
    reflection.buckets.today.length > 0 ||
    reflection.buckets.tomorrow.length > 0 ||
    reflection.buckets.this_week.length > 0 ||
    reflection.buckets.later.length > 0;

  return (
    <div className="card missionReflection">
      <p className="missionReflectionText">{reflection.reflection}</p>

      {hasBuckets && (
        <div className="missionReflectionBuckets">
          <BucketList label="Today" items={reflection.buckets.today} today={today} />
          <BucketList label="Tomorrow" items={reflection.buckets.tomorrow} today={today} />
          <BucketList label="This week" items={reflection.buckets.this_week} today={today} />
          <BucketList label="Later" items={reflection.buckets.later} today={today} />
        </div>
      )}

      {reflection.flags.length > 0 && (
        <div className="missionReflectionFlags">
          <h3 className="missionReflectionFlagsTitle">Flags</h3>
          <ul className="missionReflectionFlagList">
            {reflection.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
