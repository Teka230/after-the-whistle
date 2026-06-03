import path from "node:path";

/** SQLite path: prefers AFTER_THE_WHISTLE_DB_PATH, falls back to legacy DEBRIEF_DB_PATH. */
export function resolveDbPath(root: string): string {
  const fromEnv =
    process.env.AFTER_THE_WHISTLE_DB_PATH ?? process.env.DEBRIEF_DB_PATH;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(root, fromEnv);
  }
  return path.join(root, "data", "after-the-whistle.db");
}
