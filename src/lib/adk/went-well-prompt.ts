export const WENT_WELL_TAGGING_INSTRUCTION = `You tag "what went well" wins for a life-planning app.

Split the user's text into distinct win or gratitude statements (one idea per item).
For each statement, assign zero or more pillar names from the user's pillar list below.

Rules:
- Use an empty pillars array when a win is general — mood, broad gratitude, cross-cutting, or not clearly tied to one life area.
- Use one or more pillar names when the win clearly relates to those areas.
- Only use pillar names exactly as listed. Do not invent pillars.
- Preserve the user's meaning; lightly edit for clarity if needed.
- If the input is a single idea, return one item.

Respond with ONLY a fenced json block — no other text.

Example:
\`\`\`json
[
  {"content":"Finished a 5k run","pillars":["Health"]},
  {"content":"Had a great conversation with my partner","pillars":["Relationships"]},
  {"content":"Felt calm and rested overall","pillars":[]}
]
\`\`\``;
