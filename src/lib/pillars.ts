import type { Client } from "@libsql/client";
import { ensureLifeSchema } from "../db/life";

export async function userHasPillars(turso: Client, userId: number): Promise<boolean> {
  await ensureLifeSchema(turso);
  const result = await turso.execute({
    sql: `SELECT COUNT(*) AS c FROM pillars WHERE user_id = ?;`,
    args: [userId],
  });
  return Number((result.rows[0] as Record<string, unknown>).c) > 0;
}
