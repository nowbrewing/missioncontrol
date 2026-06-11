import { reorderGoals } from "./mongodb/store/goals";
import { reorderMilestones } from "./mongodb/store/milestones";
import { reorderPillars } from "./mongodb/store/users";

export async function reorderItems(
  table: "pillars" | "goals" | "milestones",
  userId: number,
  ids: number[]
) {
  if (table === "pillars") await reorderPillars(userId, ids);
  else if (table === "goals") await reorderGoals(userId, ids);
  else if (table === "milestones") await reorderMilestones(userId, ids);
  else throw new Error(`Unsupported table: ${table}`);
}
