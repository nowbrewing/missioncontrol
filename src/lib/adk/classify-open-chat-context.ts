import { generateGeminiText } from "./gemini-text";
import { parsePillarContext } from "../pillar-context";
import { resolvePillarAbbreviation } from "../pillar-abbreviation";
import type { LifeAgentMessage } from "./run-life-agent";

export type OpenChatContextPlan = {
  lookback_days: number;
  focused_pillar_ids: number[];
};

type PillarRow = {
  id: number;
  name: string;
  abbreviation?: string | null;
  description?: string | null;
};

function conversationText(message: string, history: LifeAgentMessage[]) {
  const recent = history.slice(-6).map((m) => m.content);
  return [...recent, message].join("\n");
}

function heuristicPlan(
  message: string,
  history: LifeAgentMessage[],
  pillars: PillarRow[]
): OpenChatContextPlan {
  const text = conversationText(message, history).toLowerCase();
  let lookback_days = 7;
  if (/\b(past month|last month|this month|30 days)\b/.test(text)) {
    lookback_days = 30;
  } else if (/\b(two weeks|2 weeks|fortnight|couple of weeks|past two weeks)\b/.test(text)) {
    lookback_days = 14;
  } else if (/\b(yesterday|today|last few days|past few days|recently)\b/.test(text)) {
    lookback_days = 3;
  }

  const scores = new Map<number, number>();
  for (const pillar of pillars) {
    let score = 0;
    const name = pillar.name.toLowerCase();
    if (name.length >= 3 && text.includes(name)) score += 3;

    const abbr = resolvePillarAbbreviation(pillar.name, pillar.abbreviation).toLowerCase();
    if (abbr.length >= 2 && new RegExp(`\\b${escapeRegExp(abbr)}\\b`, "i").test(text)) {
      score += 2;
    }

    for (const entry of parsePillarContext(pillar.description)) {
      const snippet = entry.text.toLowerCase().slice(0, 80);
      const token = snippet.split(/[\s,—–-]+/).find((w) => w.length >= 5 && text.includes(w));
      if (token) score += 2;
    }

    if (score > 0) scores.set(pillar.id, score);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const topScore = ranked[0]?.[1] ?? 0;
  const focused_pillar_ids =
    topScore >= 2
      ? ranked.filter(([, s]) => s >= Math.max(2, topScore - 1)).map(([id]) => id)
      : [];

  return { lookback_days, focused_pillar_ids };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseClassificationJson(raw: string): OpenChatContextPlan | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(body) as {
      lookback_days?: unknown;
      focused_pillar_ids?: unknown;
    };
    const lookback_days = Number(parsed.lookback_days);
    const focused_pillar_ids = Array.isArray(parsed.focused_pillar_ids)
      ? parsed.focused_pillar_ids
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!Number.isFinite(lookback_days) || lookback_days < 1 || lookback_days > 60) {
      return null;
    }
    return {
      lookback_days: Math.round(lookback_days),
      focused_pillar_ids,
    };
  } catch {
    return null;
  }
}

export async function planOpenChatContext(params: {
  message: string;
  history: LifeAgentMessage[];
  pillars: PillarRow[];
  planDate: string;
}): Promise<OpenChatContextPlan> {
  const fallback = heuristicPlan(params.message, params.history, params.pillars);
  if (params.pillars.length === 0) return fallback;

  const pillarLines = params.pillars
    .map((p) => {
      const context = parsePillarContext(p.description)
        .map((e) => e.text.slice(0, 100))
        .join("; ");
      return `- id=${p.id} name="${p.name}"${context ? ` notes: ${context}` : ""}`;
    })
    .join("\n");

  const historyBlock = params.history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  try {
    const raw = await generateGeminiText(
      `Classify this Mission Control chat turn for context retrieval.

Planning date: ${params.planDate}

Pillars:
${pillarLines}

Recent conversation:
${historyBlock || "(none)"}

Latest user message:
${params.message}

Return ONLY JSON:
{
  "lookback_days": 7,
  "focused_pillar_ids": [1]
}

Rules:
- lookback_days: 3–30 (how far back daily logs / wins should reach). Use 3 for "today/yesterday", 7 default, 14 for couple weeks, 30 for month-scale reflection.
- focused_pillar_ids: pillar ids the user is clearly thinking about (deep dive, project, life area). Empty array if general chat or cross-pillar.`,
      { retries: 1 }
    );
    const parsed = parseClassificationJson(raw);
    if (!parsed) return fallback;

    const validIds = new Set(params.pillars.map((p) => p.id));
    return {
      lookback_days: parsed.lookback_days,
      focused_pillar_ids: parsed.focused_pillar_ids.filter((id) => validIds.has(id)),
    };
  } catch {
    return fallback;
  }
}
