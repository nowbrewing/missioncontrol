import type {
  MissionReflectionSnapshot,
  MissionLayoutRef,
} from "./mission-layout";
import type { MissionMilestone, MissionTask } from "./mission-prioritize";

export type ReflectionBucketItem = {
  kind: "task" | "milestone";
  id: number;
  title: string;
  date: string | null;
};

export type MissionReflectionDisplay = {
  reflection: string;
  kickoff: string | null;
  rest_of_day: string | null;
  flags: string[];
  buckets: {
    today: ReflectionBucketItem[];
    tomorrow: ReflectionBucketItem[];
    this_week: ReflectionBucketItem[];
    later: ReflectionBucketItem[];
  };
  generated_at: string | null;
};

function resolveRef(
  ref: MissionLayoutRef,
  taskById: Map<number, MissionTask>,
  milestoneById: Map<number, MissionMilestone>
): ReflectionBucketItem | null {
  if (ref.kind === "task") {
    const task = taskById.get(ref.id);
    if (!task || task.completed_at) return null;
    return {
      kind: "task",
      id: task.id,
      title: task.title,
      date: task.deadline,
    };
  }
  const milestone = milestoneById.get(ref.id);
  if (!milestone || milestone.completed_at) return null;
  return {
    kind: "milestone",
    id: milestone.id,
    title: milestone.title,
    date: milestone.target_date,
  };
}

export function buildReflectionDisplay(
  snapshot: MissionReflectionSnapshot | undefined,
  tasks: MissionTask[],
  milestones: MissionMilestone[]
): MissionReflectionDisplay | null {
  if (!snapshot) return null;

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const milestoneById = new Map(milestones.map((m) => [m.id, m]));

  const resolveBucket = (refs: MissionLayoutRef[]) =>
    refs
      .map((r) => resolveRef(r, taskById, milestoneById))
      .filter((x): x is ReflectionBucketItem => x != null);

  return {
    reflection: snapshot.reflection,
    kickoff: snapshot.kickoff ?? null,
    rest_of_day: snapshot.rest_of_day ?? null,
    flags: snapshot.flags,
    buckets: {
      today: resolveBucket(snapshot.buckets.today),
      tomorrow: resolveBucket(snapshot.buckets.tomorrow),
      this_week: resolveBucket(snapshot.buckets.this_week),
      later: resolveBucket(snapshot.buckets.later),
    },
    generated_at: snapshot.generated_at,
  };
}
