import { fetchScoreboard } from "../packages/providers/dist/nba/stats-api.js";
import { parseNaturalGameQuery } from "../packages/providers/dist/query-parse.js";
import { searchBasketScoreboardAdvanced } from "../packages/providers/dist/nba/scoreboard-search.js";
import { discoverGame } from "../packages/providers/dist/discover.js";

const now = new Date("2026-05-29T12:00:00");
const out = [];

for (const q of [
  "Spurs OKC yesterday",
  "San Antonio Spurs Oklahoma City Thunder 2026-05-28",
  "Thunder Spurs 2026-05-28",
]) {
  const p = parseNaturalGameQuery(q, now);
  out.push({ q, parsed: p });
}

for (const date of ["2026-05-28", "05/28/2026"]) {
  try {
    const rows = await fetchScoreboard(date);
    out.push({ date, rowCount: rows.length, sample: rows.slice(0, 5) });
  } catch (e) {
    out.push({ date, error: e.message });
  }
}

try {
  const search = await searchBasketScoreboardAdvanced({
    dates: ["2026-05-28"],
    teamAbbrs: ["SAS", "OKC"],
    rawQuery: "Spurs OKC",
    limit: 8,
  });
  out.push({ search });
} catch (e) {
  out.push({ searchError: e.message, stack: e.stack });
}

for (const q of ["Spurs OKC yesterday", "Thunder Spurs 2026-05-28"]) {
  try {
    const d = await discoverGame({ query: q });
    out.push({ discover: q, result: d });
  } catch (e) {
    out.push({ discover: q, error: e.message });
  }
}

import { writeFileSync } from "node:fs";
writeFileSync(
  new URL("../debug-scoreboard-out.json", import.meta.url),
  JSON.stringify(out, null, 2)
);
