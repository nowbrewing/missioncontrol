import { InMemoryRunner } from "@google/adk";
import { createPartFromText } from "@google/genai";
import { z } from "zod";
import { lifeAgent, LIFE_AGENT_APP_NAME } from "./life-agent";

const extractedTaskSchema = z.object({
  title: z.string(),
  pillar: z.string(),
  status: z.string().optional(),
  due_date: z.string().nullable().optional(),
});

const extractedTasksArraySchema = z.array(extractedTaskSchema);

export type ExtractedBrainDumpTask = z.infer<typeof extractedTaskSchema>;

export type BrainDumpAgentResult = {
  summary: string;
  tasks: ExtractedBrainDumpTask[];
};

export function ensureAdkApiKey() {
  if (!process.env.GEMINI_API_KEY?.trim() && process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY.trim();
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) for Google ADK"
    );
  }
  return key;
}

function formatPillarContext(
  pillars: { id: unknown; name: unknown }[],
  planDate: string
) {
  const pillarList = pillars
    .map((p) => `- id=${p.id} name="${p.name}"`)
    .join("\n");

  return `Planning date: ${planDate}

USER PILLARS (assign each task to the closest pillar name):
${pillarList || "(none — use descriptive pillar names)"}`;
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error("Agent response did not contain a JSON task array");
}

function splitSummaryAndJson(fullText: string) {
  const fenceIndex = fullText.search(/```(?:json)?/i);
  const summary =
    fenceIndex >= 0 ? fullText.slice(0, fenceIndex).trim() : fullText.trim();
  return { summary, jsonSource: fullText };
}

export async function runBrainDumpAgent(
  brainDump: string,
  context: {
    pillars: { id: unknown; name: unknown }[];
    planDate: string;
    userId: number;
  }
): Promise<BrainDumpAgentResult> {
  ensureAdkApiKey();

  const runner = new InMemoryRunner({
    agent: lifeAgent,
    appName: LIFE_AGENT_APP_NAME,
  });

  const pillarContext = formatPillarContext(context.pillars, context.planDate);
  const prompt = `${pillarContext}

Brain dump (today):
${brainDump.trim()}`;

  let fullText = "";

  for await (const event of runner.runEphemeral({
    userId: String(context.userId),
    newMessage: {
      role: "user",
      parts: [createPartFromText(prompt)],
    },
  })) {
    const chunk = event.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("");
    if (chunk) fullText += chunk;
  }

  if (!fullText.trim()) {
    throw new Error("Life Agent returned an empty response");
  }

  const { summary, jsonSource } = splitSummaryAndJson(fullText);

  let parsed: unknown;
  try {
    parsed = extractJsonArray(jsonSource);
  } catch {
    throw new Error("Failed to parse task JSON from Life Agent response");
  }

  const tasks = extractedTasksArraySchema.parse(parsed);
  return { summary, tasks };
}

export async function runAdkHealthCheck(): Promise<string> {
  ensureAdkApiKey();

  const runner = new InMemoryRunner({
    agent: lifeAgent,
    appName: LIFE_AGENT_APP_NAME,
  });

  let sample = "";

  for await (const event of runner.runEphemeral({
    userId: "health_check",
    newMessage: {
      role: "user",
      parts: [createPartFromText("Reply with exactly: ok")],
    },
  })) {
    const chunk = event.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("");
    if (chunk) sample += chunk;
  }

  return sample.trim().slice(0, 64) || "(empty)";
}
