import type { ProposedCorrection } from "../adk/propose-corrections";
import type { ParsedTaskEdit } from "../adk/parse-chat-task-actions";
import type { ParsedProposedTask } from "../adk/parse-proposed-tasks";
import type { LifeAgentMessage } from "../adk/run-life-agent";

/** Callable skills — tools on the Life Agent orchestrator, not separate agents. */
export type SkillId =
  | "general"
  | "life-pillar"
  | "correction"
  | "create-task"
  | "edit-task";

export type RoutedTarget = SkillId | "direct";

export type SkillContext = {
  userId: number;
  planDate: string;
  message: string;
  history: LifeAgentMessage[];
  generalHandoffSummary?: string | null;
};

export type OrchestratorResult = {
  /** Skill that handled this turn, or "direct" for orchestrator-only reply. */
  routed: RoutedTarget;
  reply: string;
  proposed_tasks: ParsedProposedTask[];
  task_edits: ParsedTaskEdit[];
  correction_proposals: ProposedCorrection[];
};

export const EMPTY_ORCHESTRATOR_RESULT: Omit<OrchestratorResult, "routed" | "reply"> = {
  proposed_tasks: [],
  task_edits: [],
  correction_proposals: [],
};
