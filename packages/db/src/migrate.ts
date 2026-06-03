import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "@after-the-whistle/core";
import { openDatabase } from "./connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "schema.sql");
const dbPath = resolveDbPath(process.cwd());

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = openDatabase(dbPath);
const sql = fs.readFileSync(schemaPath, "utf8");
db.exec(sql);
console.log(`Migrated ${dbPath}`);
