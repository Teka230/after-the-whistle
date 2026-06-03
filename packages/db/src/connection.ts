import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { resolveDbPath } from "@after-the-whistle/core";

let shared: Database.Database | null = null;

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function getDatabase(dbPath?: string): Database.Database {
  if (shared) return shared;
  const root = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const resolved =
    dbPath ?? resolveDbPath(root);
  shared = openDatabase(resolved);
  return shared;
}

export function resetDatabaseForTests(): void {
  if (shared) {
    shared.close();
    shared = null;
  }
}
