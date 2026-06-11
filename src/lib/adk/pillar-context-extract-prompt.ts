export const PILLAR_CONTEXT_EXTRACT_INSTRUCTION = `You extract NEW ongoing initiatives from a check-in for a life-planning app.

The user may mention projects, goals, or efforts briefly (e.g. "hackathon"). Your job is to identify initiatives that should be remembered as pillar context so future shorthand resolves correctly.

Rules:
- Only return initiatives that are NEW or materially UPDATED vs existing pillar context below.
- Skip one-off errands, generic moods, and tasks that don't need a nickname later.
- Assign each item to exactly one pillar from the user's list.
- Write context as a durable note: what it is, why it matters, key details (1–2 sentences).
- Include a short nickname the user is likely to say again (e.g. "hackathon").
- Do not invent pillars. If nothing qualifies, return an empty array.
- Prefer the brain dump over wins when both mention the same thing.

Respond with ONLY a fenced json block:

\`\`\`json
[
  {
    "pillar": "Career",
    "nickname": "hackathon",
    "context": "Hackathon to learn new skills and boost portfolio for digital consultancy."
  }
]
\`\`\``;
