import { InMemoryRunner } from "@google/adk";
import { createPartFromText } from "@google/genai";
import { buildLifeAgentSystemContext } from "./build-life-agent-context";
import { CHECK_IN_PROPOSED_TASKS_INSTRUCTION } from "./check-in-prompt";
import { buildPrioritizeInstruction } from "./prioritize-prompt";
import { ensureGenAiEnv } from "./genai-config";
import { lifeAgent, LIFE_AGENT_APP_NAME } from "./life-agent";

export type LifeAgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export function ensureAdkApiKey() {
  ensureGenAiEnv();
}

function formatHistory(history: LifeAgentMessage[]) {
  if (history.length === 0) return "";
  const lines = history.map((m) => {
    const label = m.role === "user" ? "User" : "Life Agent";
    return `${label}: ${m.content}`;
  });
  return `\n\nCONVERSATION SO FAR:\n${lines.join("\n\n")}`;
}

export async function runLifeAgent(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
  checkIn?: boolean;
  prioritize?: boolean;
}): Promise<string> {
  ensureAdkApiKey();

  const runner = new InMemoryRunner({
    agent: lifeAgent,
    appName: LIFE_AGENT_APP_NAME,
  });

  const systemContext = await buildLifeAgentSystemContext(
    params.userId,
    params.planDate
  );
  const historyBlock = formatHistory(params.history ?? []);
  const modeBlock = params.prioritize
    ? `\n\n${buildPrioritizeInstruction(params.planDate)}`
    : params.checkIn
      ? `\n\n${CHECK_IN_PROPOSED_TASKS_INSTRUCTION}`
      : "";
  const prompt = `${systemContext}${historyBlock}${modeBlock}

USER MESSAGE:
${params.message.trim()}`;

  let fullText = "";

  for await (const event of runner.runEphemeral({
    userId: String(params.userId),
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

  return fullText.trim();
}
