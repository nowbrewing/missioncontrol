import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { formatAiUserMessage } from "../../../../src/lib/ai/ai-errors";
import { loadMissionContextBlock, createMissionTools } from "../../../../src/lib/ai/mission-tools";
import { MISSION_SYSTEM_PROMPT } from "../../../../src/lib/ai/mission-prompt";
import {
  assertChatProviderConfigured,
  getAiModel,
} from "../../../../src/lib/ai/provider";
import { requireSessionUser } from "../../../../src/lib/auth";

export const maxDuration = 30;

export async function POST(req: Request) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertChatProviderConfigured();
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI not configured" },
      { status: 500 }
    );
  }

  let messages: UIMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages)) {
      return Response.json({ error: "Invalid messages" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contextBlock = await loadMissionContextBlock(user.id);
  const tools = createMissionTools(user.id);

  const result = streamText({
    model: getAiModel(),
    system: `${MISSION_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    onError: ({ error }) => {
      console.error("[mission/chat]", error);
    },
  });

  return result.toUIMessageStreamResponse({
    onError: formatAiUserMessage,
  });
}
