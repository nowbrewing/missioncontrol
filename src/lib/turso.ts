/** @deprecated Turso has been replaced by MongoDB. */
export function getTursoClient() {
  return null;
}

/** @deprecated Turso has been replaced by MongoDB. */
export function requireTursoClient(): never {
  throw new Error(
    "Turso is no longer used. Set MONGODB_URI and run npm run sync:mongo if migrating existing data."
  );
}
