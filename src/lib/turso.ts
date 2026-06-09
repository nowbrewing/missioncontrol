import { createClient } from "@libsql/client";

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export function getTursoClient() {
  const url = getEnv("ODB_TURSO_DATABASE_URL") ?? getEnv("TURSO_DATABASE_URL");
  const authToken =
    getEnv("ODB_TURSO_AUTH_TOKEN") ?? getEnv("TURSO_AUTH_TOKEN");
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

export function requireTursoClient() {
  const c = getTursoClient();
  if (!c) {
    throw new Error(
      "Missing required env vars: ODB_TURSO_DATABASE_URL/ODB_TURSO_AUTH_TOKEN (or TURSO_DATABASE_URL/TURSO_AUTH_TOKEN)"
    );
  }
  return c;
}

