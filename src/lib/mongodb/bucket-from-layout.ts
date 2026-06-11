import type { MissionLayout } from "../mission-layout";
import { parseMissionLayout } from "../mission-layout";
import type { TaskBucket } from "./schemas";

type BucketKey = "today" | "tomorrow" | "this_week" | "later";

const BUCKET_MAP: Record<BucketKey, TaskBucket> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "Week",
  later: "Later",
};

function assignRefs(
  map: Map<number, TaskBucket>,
  refs: { kind: string; id: number }[],
  bucket: TaskBucket
) {
  for (const ref of refs) {
    if (ref.kind === "task") {
      map.set(ref.id, bucket);
    }
  }
}

/** Derive per-task buckets from the latest daily_logs.mission_layout JSON. */
export function buildTaskBucketMap(rawLayout: string | null | undefined): Map<number, TaskBucket> {
  const map = new Map<number, TaskBucket>();
  const layout = parseMissionLayout(rawLayout);
  if (!layout) return map;

  const reflection = layout.reflection?.buckets;
  if (reflection) {
    for (const key of Object.keys(BUCKET_MAP) as BucketKey[]) {
      assignRefs(map, reflection[key], BUCKET_MAP[key]);
    }
    return map;
  }

  assignRefs(map, layout.today, "Today");
  assignRefs(map, layout.coming_up, "Week");
  assignRefs(map, layout.later ?? [], "Later");
  return map;
}

export function parseLayout(raw: string | null | undefined): MissionLayout | null {
  return parseMissionLayout(raw);
}
