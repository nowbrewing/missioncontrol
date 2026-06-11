import { generateGeminiText } from "./gemini-text";
import { planOpenChatContext } from "./classify-open-chat-context";
import { pillarIdsForLogText } from "../daily-log-pillar-tags";
import { appendDailyLogEntry } from "../daily-log-entries";
import { ASSISTANT_CHAT_LOG_KIND } from "../assistant-chat-log";
import { listPillars } from "../mongodb/store/users";
import type { LifeAgentMessage } from "./run-life-agent";

function formatTranscript(messages: LifeAgentMessage[]) {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");
}

function parseSummaryJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(body) as { summary?: unknown };
    if (typeof parsed.summary === "string" && parsed.summary.trim()) {
      return parsed.summary.trim();
    }
  } catch {
    // fall through
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function summarizeAndSaveChatSession(params: {
  userId: number;
  planDate: string;
  messages: LifeAgentMessage[];
}): Promise<{ summary: string; pillar_ids: number[]; entry_id: number } | null> {
  const messages = params.messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!messages.some((m) => m.role === "user")) return null;

  const pillars = await listPillars(params.userId);
  const pillarRows = pillars.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    abbreviation: p.abbreviation ? String(p.abbreviation) : null,
    description: p.description ? String(p.description) : null,
  }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const plan = await planOpenChatContext({
    message: lastUser?.content ?? messages[messages.length - 1]!.content,
    history: messages.slice(0, -1),
    pillars: pillarRows,
    planDate: params.planDate,
  });

  const transcript = formatTranscript(messages);
  const raw = await generateGeminiText(
    `Summarize this Mission Control assistant chat for the user's daily log.

Planning date: ${params.planDate}
Pillars that may apply: ${
      plan.focused_pillar_ids.length
        ? plan.focused_pillar_ids
            .map((id) => pillarRows.find((p) => p.id === id)?.name ?? id)
            .join(", ")
        : "general / cross-pillar"
    }

Write 2–5 sentences in first person ("I") capturing:
- What the user was thinking through or working on
- Any clarity, decisions, or open threads worth remembering later
- Tone: factual notes for future-you, not a transcript

Do NOT list every message. Skip small talk.

Transcript:
${transcript}

Return ONLY JSON:
\`\`\`json
{ "summary": "..." }
\`\`\``,
    { retries: 1 }
  );

  const summary = parseSummaryJson(raw);
  if (!summary) return null;

  const pillar_ids = await pillarIdsForLogText(summary, pillars);
  const entry = await appendDailyLogEntry(
    params.userId,
    params.planDate,
    ASSISTANT_CHAT_LOG_KIND,
    summary,
    pillar_ids
  );

  return { summary, pillar_ids, entry_id: entry.id };
}
