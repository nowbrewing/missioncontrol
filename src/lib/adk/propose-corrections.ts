import { generateGeminiText } from "./gemini-text";
import type { LifeAgentMessage } from "./run-life-agent";
import {
  formatCorpusForPrompt,
  type CorrectionRecord,
  type CorrectionWeekScope,
} from "../correction-records";

export type ProposedCorrection = {
  record_id: string;
  before: string;
  after: string;
  reason: string;
};

function formatTranscript(messages: LifeAgentMessage[]) {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");
}

function parseProposalsJson(raw: string): ProposedCorrection[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(body) as { corrections?: unknown };
    if (!Array.isArray(parsed.corrections)) return [];
    const out: ProposedCorrection[] = [];
    for (const row of parsed.corrections) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      const record_id = typeof item.record_id === "string" ? item.record_id.trim() : "";
      const after = typeof item.after === "string" ? item.after.trim() : "";
      const before = typeof item.before === "string" ? item.before.trim() : "";
      const reason = typeof item.reason === "string" ? item.reason.trim() : "";
      if (!record_id || !after) continue;
      out.push({ record_id, before, after, reason });
    }
    return out;
  } catch {
    return [];
  }
}

export async function proposeCorrections(params: {
  scope: CorrectionWeekScope;
  records: CorrectionRecord[];
  messages: LifeAgentMessage[];
}): Promise<ProposedCorrection[]> {
  const messages = params.messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!messages.some((m) => m.role === "user")) return [];

  const transcript = formatTranscript(messages);
  const corpus = formatCorpusForPrompt(params.records, params.scope);

  const raw = await generateGeminiText(
    `Propose record edits to fix what the user clarified in this correction conversation.

Week scope: Mon ${params.scope.week_monday} through ${params.scope.week_end}

${corpus}

Rules:
- Only propose edits for record_id values that exist in the corpus above.
- "after" must be the full replacement text for that record (not a diff).
- Prefer in-place clarification: add specificity, disambiguate nicknames, state what something is NOT.
- Do not invent record_ids.
- If nothing should change, return an empty corrections array.
- Include "before" (current snippet) and a short "reason" per edit.

Conversation:
${transcript}

Return ONLY JSON:
\`\`\`json
{
  "corrections": [
    {
      "record_id": "pillar:3:0",
      "before": "working on hackathon",
      "after": "Hackathon = Acme API sprint (internal product hackathon, not the charity event)",
      "reason": "Disambiguate hackathon shorthand"
    }
  ]
}
\`\`\``,
    { retries: 1 }
  );

  const proposals = parseProposalsJson(raw);
  const byId = new Map(params.records.map((r) => [r.record_id, r]));

  return proposals.filter((p) => {
    const record = byId.get(p.record_id);
    if (!record) return false;
    if (!p.before) p.before = record.snippet;
    return p.after.trim() !== record.snippet.trim();
  });
}
