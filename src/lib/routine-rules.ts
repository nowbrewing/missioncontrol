import type { MongoRoutine } from "./mongodb/schemas";

export function routineRulesSuffix(rules: string | null | undefined): string {
  const trimmed = rules?.trim();
  return trimmed ? ` — rules: ${trimmed}` : "";
}

export function formatRoutineForPrompt(
  routine: Pick<MongoRoutine, "tursoId" | "title" | "kind" | "targetFrequency" | "rules">,
  options?: { includeId?: boolean }
): string {
  const idPart = options?.includeId ? `id=${routine.tursoId} ` : "";
  return `- ${idPart}${routine.title} (${routine.kind}, ${routine.targetFrequency}/wk)${routineRulesSuffix(routine.rules)}`;
}
