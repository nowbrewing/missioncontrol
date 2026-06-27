import { generateGeminiText } from "./gemini-text";
import type { LifeAgentMessage } from "./run-life-agent";

export type GeneralHandoffResult = {
  worthKeeping: boolean;
  summary: string | null;
  reply: string;
};

function formatTranscript(messages: LifeAgentMessage[]) {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");
}

function parseHandoffJson(raw: string): GeneralHandoffResult | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(body) as {
      worth_keeping?: unknown;
      summary?: unknown;
      reply?: unknown;
    };
    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : null;
    if (!reply) return null;

    const worthKeeping = parsed.worth_keeping === true;
    const summary =
      worthKeeping &&
      typeof parsed.summary === "string" &&
      parsed.summary.trim()
        ? parsed.summary.trim()
        : null;

    return { worthKeeping, summary, reply };
  } catch {
    return null;
  }
}

export async function handoffGeneralChat(params: {
  planDate: string;
  messages: LifeAgentMessage[];
}): Promise<GeneralHandoffResult | null> {
  const messages = params.messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!messages.some((m) => m.role === "user")) return null;

  const transcript = formatTranscript(messages);
  const raw = await generateGeminiText(
    `You are the Mission Control co-pilot. The user switched back from "general" mode (plain AI, no Mission Control persona) to co-pilot mode.

Review this general-mode conversation and decide whether anything is worth carrying forward into the co-pilot thread for life planning, pillars, tasks, or ongoing reflection.

Planning date: ${params.planDate}

General chat transcript:
${transcript}

Worth keeping: life decisions, pillar-related thinking, emotional processing, priorities, commitments, insights they'll want the co-pilot to remember.
Not worth keeping: trivia, unrelated tech help, throwaway questions, content with no tie to their life plan.

Return ONLY JSON:
\`\`\`json
{
  "worth_keeping": true or false,
  "summary": "1-3 sentences of distilled context IF worth_keeping, else null",
  "reply": "One or two warm sentences acknowledging they're back with the co-pilot. If keeping context, briefly say what you'll remember. If discarding, keep it light — no need to explain the discard. Do not use coaching language."
}
\`\`\``,
    { retries: 1 }
  );

  return parseHandoffJson(raw);
}
