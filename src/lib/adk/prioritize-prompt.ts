import { agentBucketRulesForPrompt } from "../mission-buckets";

export function buildPrioritizeInstruction(planDate: string) {
  return `

Prioritize mode:
The user did NOT provide a new brain dump or wins. Re-prioritize using ONLY the system context (open tasks, milestones, completion history, routines, and recent logs).

Your job:
- Reflect on current momentum and pillar balance
- Recommend what belongs in Today vs Next 7 days vs Later among EXISTING open items
- Flag overload on Today (max ~3 high-priority items) and suggest demotions if needed
- Do NOT invent or propose new tasks — only reorganize and comment on what already exists
- Never push a due/overdue task to a later date — only the user can postpone when something is already due

${agentBucketRulesForPrompt(planDate)}

Output format:
After your written reflection and plan, output an empty fenced json array for new tasks:

\`\`\`json
[]
\`\`\`

Do not call MCP tools. The user will adjust the board manually.`;
}

/** @deprecated use buildPrioritizeInstruction(planDate) */
export const PRIORITIZE_INSTRUCTION = buildPrioritizeInstruction("today");
