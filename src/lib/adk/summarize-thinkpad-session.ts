import { generateGeminiText } from "./gemini-text";
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

export async function summarizeThinkpadSession(params: {
  planDate: string;
  messages: LifeAgentMessage[];
}): Promise<string | null> {
  const messages = params.messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!messages.some((m) => m.role === "user")) return null;

  const transcript = formatTranscript(messages);
  const raw = await generateGeminiText(
    `Summarize this Thinkpad brainstorming session for the user to save as notes.

Planning date: ${params.planDate}

Write a concise note (3–8 sentences or short bullet list) capturing:
- Key ideas, decisions, and conclusions from the session
- Open questions or next steps worth remembering
- Skip filler and back-and-forth pleasantries

Use neutral third person or "Notes:" style — not first-person diary voice.

Transcript:
${transcript}

Return ONLY JSON:
\`\`\`json
{ "summary": "..." }
\`\`\``,
    { retries: 1 }
  );

  return parseSummaryJson(raw);
}
