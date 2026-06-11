import { generateGeminiText } from "./gemini-text";
import { LIFE_SYNTHESIS_INSTRUCTION } from "./life-synthesis-prompt";
import {
  buildDirectCheckInPrompt,
  buildDirectPrioritizePrompt,
  loadOrchestrationContext,
} from "./build-orchestration-context";
import {
  applyLifeAdminToLayout,
  computeLifeAdminStats,
  type LifeAdminTaskRow,
} from "../life-admin";
import {
  parseSynthesisResult,
  type DayGuide,
  type OrchestrationLayout,
  type OrchestrationReschedule,
  type ParsedProposedTaskFromOrchestration,
} from "./parse-orchestration-result";

export type MissionOrchestrationResult = {
  dayGuide: DayGuide;
  layout: OrchestrationLayout;
  reschedules: OrchestrationReschedule[];
  proposedTasks: ParsedProposedTaskFromOrchestration[];
};

export async function runMissionOrchestration(params: {
  userId: number;
  planDate: string;
  mode: "check_in" | "prioritize";
  brainDump?: string;
}): Promise<MissionOrchestrationResult> {
  const ctx = await loadOrchestrationContext(params.userId, params.planDate);
  const openTaskIds = ctx.openTasks.map((t) => Number(t.id));

  let synthesisRaw: string;

  const directContext =
    params.mode === "check_in"
      ? buildDirectCheckInPrompt(ctx, openTaskIds, params.brainDump ?? "")
      : buildDirectPrioritizePrompt(ctx, openTaskIds);
  synthesisRaw = await generateGeminiText(
    `${LIFE_SYNTHESIS_INSTRUCTION}\n\n${directContext}`
  );

  const parsed = parseSynthesisResult(
    synthesisRaw,
    ctx.pillars,
    openTaskIds,
    ctx.openTasks.map((t) => ({
      id: Number(t.id),
      deadline: t.deadline ? String(t.deadline) : null,
      date_locked: Number(t.date_locked),
    })),
    params.planDate
  );

  const lifeAdminStats = computeLifeAdminStats({
    allTasks: ctx.allTasks.map(toLifeAdminTaskRow),
    pillars: ctx.pillars.map((p) => ({
      id: Number(p.id),
      name: String(p.name),
    })),
    planDate: params.planDate,
    todayTaskIds: parsed.layout.today,
  });

  const layout = applyLifeAdminToLayout(parsed.layout, lifeAdminStats);
  const dayGuide = enrichDayGuideWithLifeAdmin(parsed.dayGuide, lifeAdminStats);

  return {
    dayGuide,
    layout,
    reschedules: parsed.reschedules,
    proposedTasks: params.mode === "check_in" ? parsed.proposedTasks : [],
  };
}

function toLifeAdminTaskRow(t: {
  id: unknown;
  title: unknown;
  deadline: unknown;
  pillar_id?: unknown;
  completed_at?: unknown;
  created_at?: unknown;
}): LifeAdminTaskRow {
  const pillarId = t.pillar_id;
  const normalizedPillarId =
    pillarId == null || pillarId === ""
      ? null
      : Number.isFinite(Number(pillarId)) && Number(pillarId) > 0
        ? Number(pillarId)
        : null;
  return {
    id: Number(t.id),
    title: String(t.title),
    deadline: t.deadline ? String(t.deadline) : null,
    pillar_id: normalizedPillarId,
    completed_at: t.completed_at ? String(t.completed_at) : null,
    created_at: t.created_at ? String(t.created_at) : null,
  };
}

function enrichDayGuideWithLifeAdmin(
  guide: DayGuide,
  stats: ReturnType<typeof computeLifeAdminStats>
): DayGuide {
  if (!stats.nudgeText || guide.flags.length >= 2) return guide;
  if (guide.flags.some((f) => f.toLowerCase().includes("life admin"))) {
    return guide;
  }
  return {
    ...guide,
    flags: [...guide.flags, stats.nudgeText].slice(0, 2),
  };
}
