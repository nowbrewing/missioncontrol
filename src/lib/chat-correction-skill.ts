import type { ProposedCorrection } from "./adk/propose-corrections";

export type CorrectionChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export async function loadCorrectionKickoff(planDate: string) {
  const res = await fetch(
    `/api/correction/context?plan_date=${encodeURIComponent(planDate)}`
  );
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Could not load correction context");
  }
  return {
    kickoff: String(data.kickoff),
    week_label: String(data.week_label),
  };
}

export async function sendCorrectionChatMessage(
  planDate: string,
  message: string,
  history: CorrectionChatTurn[]
) {
  const res = await fetch("/api/correction/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      plan_date: planDate,
      history,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Chat failed");
  }
  return String(data.reply);
}

export async function proposeCorrectionsFromMessages(
  planDate: string,
  messages: CorrectionChatTurn[]
): Promise<ProposedCorrection[]> {
  const res = await fetch("/api/correction/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_date: planDate,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Could not propose corrections");
  }
  return (data.corrections ?? []) as ProposedCorrection[];
}

export async function applyProposedCorrections(
  corrections: ProposedCorrection[]
): Promise<number> {
  const res = await fetch("/api/correction/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ corrections }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Apply failed");
  }
  return Number(data.saved ?? corrections.length);
}
