export const CHECK_IN_PROPOSED_TASKS_INSTRUCTION = `

Check-in scope:
The user message contains only their brain dump for today. Wins and gratitude from "what went well" are saved separately and are NOT included — do not try to match them against open tasks or completion history.

Check-in output format:
After your written reflection and plan, output a fenced json block listing ONLY newly identified tasks from the brain dump (skip duplicates of existing open tasks). If there are no new tasks, output an empty array.

Each task object must have:
- title (string)
- pillar (string — use a pillar name from SYSTEM CONTEXT)
- deadline (YYYY-MM-DD string or null)
- bucket ("Today" | "Next 7 days" | "Later")

Example:
\`\`\`json
[{"title":"Book dentist","pillar":"Health","deadline":"2026-06-12","bucket":"Next 7 days"}]
\`\`\`

Do not call MCP tools during this check-in. The user will review and confirm new tasks in the app first.`;
