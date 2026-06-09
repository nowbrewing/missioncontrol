import type { Client } from "@libsql/client";

export async function reorderItems(
  turso: Client,
  table: string,
  userId: number,
  ids: number[]
) {
  for (let i = 0; i < ids.length; i++) {
    await turso.execute({
      sql: `UPDATE ${table} SET rank = ? WHERE id = ? AND user_id = ?;`,
      args: [i, ids[i], userId],
    });
  }
}
