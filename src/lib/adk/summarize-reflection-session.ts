import { generateGeminiText } from "./gemini-text";
import type { LifeAgentMessage } from "./run-life-agent";
import { formatWeekRangeLabel } from "../reflection-week";

function formatTranscript(messages: LifeAgentMessage[]) {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");
}

export type ReflectionSummary = {
  summary: string;
  wins: string;
  misses: string;
  moving_forward: string;
};

function parseSummaryJson(raw: string): ReflectionSummary | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(body) as {
      summary?: unknown;
      wins?: unknown;
      misses?: unknown;
      moving_forward?: unknown;
    };
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const wins = typeof parsed.wins === "string" ? parsed.wins.trim() : "";
    const misses = typeof parsed.misses === "string" ? parsed.misses.trim() : "";
    const moving_forward =
      typeof parsed.moving_forward === "string" ? parsed.moving_forward.trim() : "";
    if (!summary) return null;
    return { summary, wins, misses, moving_forward };
  } catch {
    return null;
  }
}

export async function summarizeReflectionSession(params: {
  weekMonday: string;
  weekEnd: string;
  messages: LifeAgentMessage[];
}): Promise<ReflectionSummary | null> {
  const messages = params.messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!messages.some((m) => m.role === "user")) return null;

  const range = formatWeekRangeLabel(params.weekMonday, params.weekEnd);
  const transcript = formatTranscript(messages);

  const raw = await generateGeminiText(
    `Summarize this weekly reflection conversation for the user's Mission Control log.

Week reviewed: ${range} (Mon ${params.weekMonday} – Sun ${params.weekEnd})

Write a durable weekly summary the user can revisit months later. Use first person ("I").

Structure the full summary in three sections:

\`\`\`
## Accomplishments
(grouped by pillar — plain list, no task-level commentary)

## Misses
(grouped by pillar)

## Week synthesis
(short paragraph — which pillars had momentum, what slipped, what stayed quiet)

## Moving forward
(1–3 priorities for next week)
\`\`\`

Also return separate short strings for wins (accomplishments), misses, and moving_forward.

Transcript:
${transcript}

Return ONLY JSON:
\`\`\`json
{
  "summary": "Full markdown: Accomplishments by pillar, Misses by pillar, Week synthesis, Moving forward",
  "wins": "...",
  "misses": "...",
  "moving_forward": "..."
}
\`\`\``,
    { retries: 1 }
  );

  return parseSummaryJson(raw);
}
