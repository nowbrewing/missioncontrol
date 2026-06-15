export const OPEN_CHAT_TASK_ACTIONS_INSTRUCTION = `
When the user explicitly asks to add new tasks or change existing tasks on their board, you may propose concrete changes — but nothing is saved until they confirm in the app.

For new tasks or edits, keep your conversational reply brief, then append a fenced json block:

\`\`\`json
{
  "new_tasks": [
    {"title": "Book dentist", "pillar": "Health", "deadline": "2026-06-12", "bucket": "Next 7 days"}
  ],
  "task_edits": [
    {"id": 42, "deadline": "2026-06-15", "title": "Updated title", "pillar": "Health", "note": "optional note"}
  ]
}
\`\`\`

Rules:
- Include only \`new_tasks\` and/or \`task_edits\` keys that apply; omit empty arrays.
- new_tasks: dedupe against existing open tasks; use pillar names from SYSTEM CONTEXT.
- task_edits: use task id from OPEN TASKS in context; only include fields that should change.
- bucket for new tasks: "Today" | "Next 7 days" | "Later" — use "Next 7 days" for items due within the rolling 7-day window.
- Never push a due/overdue task's deadline to a later date in task_edits unless the user explicitly asks to reschedule.
- Do NOT claim anything was saved. Do NOT output this json block unless they asked to add or edit tasks.
- If they only want to talk through priorities without changing the board, respond normally with no json block.`;
