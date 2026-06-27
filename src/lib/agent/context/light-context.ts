import { listPillars } from "../../mongodb/store/users";

export type LightPillarRow = {
  id: number;
  name: string;
  rank: number;
  abbreviation: string | null;
};

/** Always-on context for the Life Agent orchestrator — pillars and ranking only. */
export async function buildLightAgentContext(userId: number): Promise<{
  pillars: LightPillarRow[];
  block: string;
}> {
  const pillars = (await listPillars(userId))
    .map((p) => ({
      id: Number(p.id),
      name: String(p.name),
      rank: Number(p.rank),
      abbreviation: p.abbreviation ? String(p.abbreviation) : null,
    }))
    .sort((a, b) => a.rank - b.rank);

  const block = `LIFE PILLARS (ranked):
${pillars.map((p) => `- #${p.rank} id=${p.id} "${p.name}"${p.abbreviation ? ` (${p.abbreviation})` : ""}`).join("\n") || "(none configured)"}`;

  return { pillars, block };
}
