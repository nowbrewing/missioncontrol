import { LIFE_ADMIN_PILLAR_NAME, findLifeAdminPillar } from "./life-admin";
import {
  getMaxPillarRank,
  insertPillar,
  listPillars,
} from "./mongodb/store/users";

/** Ensures Life Admin pillar exists for misc errands. */
export async function ensureLifeAdminSetup(userId: number): Promise<void> {
  const pillars = await listPillars(userId);
  if (findLifeAdminPillar(pillars)) return;

  const rank = (await getMaxPillarRank(userId)) + 1;
  await insertPillar(userId, {
    name: LIFE_ADMIN_PILLAR_NAME,
    description: "Small errands and loose ends — knock them out when you can.",
    abbreviation: "ADMIN",
    color: "#D87093",
    rank,
  });
}
