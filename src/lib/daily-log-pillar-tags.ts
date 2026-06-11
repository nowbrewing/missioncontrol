import { tagWentWellStatements } from "./adk/run-went-well-tagger";

/** Infer pillar tags for a full log blob — keeps one entry, merges pillar matches. */
export async function pillarIdsForLogText(
  text: string,
  pillars: { id: unknown; name: unknown }[]
): Promise<number[]> {
  const tagged = await tagWentWellStatements(text, pillars);
  return [...new Set(tagged.flatMap((s) => s.pillar_ids))].sort((a, b) => a - b);
}
