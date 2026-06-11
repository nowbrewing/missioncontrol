import { getMongoDb } from "../client";
import { nextLegacyId } from "../ids";
import { COLLECTIONS, type MongoSession } from "../schemas";
import { findUserById, toUserRow, type UserRow } from "./users";

export async function createSession(tursoUserId: number, token: string, expiresAt: Date) {
  const user = await findUserById(tursoUserId);
  if (!user?._id) throw new Error("User not found");

  const db = await getMongoDb();
  const tursoId = await nextLegacyId("session");
  const doc: MongoSession = {
    tursoId,
    userId: user._id,
    tursoUserId,
    token,
    expiresAt,
    createdAt: new Date(),
  };
  await db.collection<MongoSession>(COLLECTIONS.sessions).insertOne(doc);
}

export async function deleteSession(token: string) {
  const db = await getMongoDb();
  await db.collection<MongoSession>(COLLECTIONS.sessions).deleteOne({ token });
}

export async function getSessionUser(token: string): Promise<UserRow | null> {
  const db = await getMongoDb();
  const session = await db.collection<MongoSession>(COLLECTIONS.sessions).findOne({
    token,
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const user = await findUserById(session.tursoUserId);
  if (!user) return null;
  return toUserRow(user);
}
