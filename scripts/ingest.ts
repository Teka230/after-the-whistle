#!/usr/bin/env tsx
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Sport } from "@after-the-whistle/core";
import { gameIdForSport, resolveDbPath } from "@after-the-whistle/core";
import { openDatabase } from "@after-the-whistle/db";
import { GameRepository } from "@after-the-whistle/db";
import { getAdapter, getAdapterForGame } from "@after-the-whistle/providers";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1]!.trim()] = m[2]!.trim();
  }
}

loadEnv();

const dbPath = resolveDbPath(root);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const schemaPath = path.join(root, "packages/db/src/schema.sql");
openDatabase(dbPath).exec(fs.readFileSync(schemaPath, "utf8"));

function parseArgs() {
  const args = process.argv.slice(2);
  let sport: Sport | undefined;
  let game: string | undefined;
  let demo = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sport" && args[i + 1]) sport = args[++i] as Sport;
    else if (args[i] === "--game" && args[i + 1]) game = args[++i];
    else if (args[i] === "--demo") demo = true;
  }

  return { sport, game, demo };
}

async function main() {
  const { sport, game, demo } = parseArgs();

  if (demo) {
    const { seedDemoGames } = await import("../packages/db/src/demo-seed.js");
    seedDemoGames(dbPath);
    console.log("Demo games seeded (basket + foot). No external API calls.");
    return;
  }

  const compositeId =
    game?.includes(":") ? game : sport && game ? gameIdForSport(sport, game) : undefined;

  if (!compositeId) {
    console.error(
      "Usage: pnpm ingest --sport basket|foot --game <external_id>\n       pnpm ingest --game foot:sample:psg_inter_2025\n       pnpm ingest --demo"
    );
    process.exit(1);
  }

  const adapter = compositeId.includes(":")
    ? getAdapterForGame(compositeId)
    : getAdapter(sport!);

  console.log(`Ingesting ${compositeId}...`);
  const data = await adapter.ingest(compositeId);
  const repo = new GameRepository(openDatabase(dbPath));
  repo.saveIngested(data);
  console.log(
    `Saved ${data.game.homeTeam.name} vs ${data.game.awayTeam.name} — ${data.contextBlocks.length} context blocks, ${data.timeline.length} events`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
