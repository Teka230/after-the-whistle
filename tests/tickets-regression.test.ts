import test, { before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildToolContract } from "../packages/mcp-server/src/schema-contract.ts";
import { findCachedGameByQuery } from "../packages/mcp-server/src/cache-discovery.ts";
import { normalizeShowGameInput } from "../packages/mcp-server/src/show-game-input.ts";
import { loadGameForDisplay } from "../packages/mcp-server/src/game-loader.ts";
import {
  openDatabase,
  resetDatabaseForTests,
} from "../packages/db/src/connection.ts";
import { nbaTeamDisplayName } from "../packages/providers/src/nba/team-aliases.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "packages/db/src/schema.sql");

let dbPath = "";
let services: Awaited<typeof import("../packages/mcp-server/src/services.ts")>;

before(async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atw-regression-"));
  dbPath = path.join(tmpDir, "after-the-whistle.test.db");
  process.env.AFTER_THE_WHISTLE_DB_PATH = dbPath;

  const db = openDatabase(dbPath);
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  db.close();

  resetDatabaseForTests();
  services = await import("../packages/mcp-server/src/services.ts");
});

beforeEach(() => {
  services.repo.clearAllGames();
});

test("Ticket 1/2: contract exports 8 tools including show_analysis", () => {
  const contract = buildToolContract();
  const names = contract.tools.map((t) => t.name);

  assert.equal(contract.version, "2026-06-02.4");
  assert.equal(names.length, 8);
  assert.ok(names.includes("show_analysis"));
  assert.deepEqual(names, [
    "show_game",
    "show_analysis",
    "get_stat_context",
    "list_suggested_prompts",
    "get_shot_chart",
    "get_momentum",
    "get_player_stints",
    "clear_cache",
  ]);

  const showAnalysis = contract.tools.find(
    (tool) => tool.name === "show_analysis",
  );
  assert.ok(showAnalysis);
  assert.deepEqual(showAnalysis.input_fields, [
    "gameId",
    "query",
    "sport",
    "refresh",
    "clearCache",
    "tone",
    "viewMode",
    "analysisTemplate",
    "focusEntityIds",
    "focusTeamIds",
    "analysis",
  ]);
  assert.deepEqual(showAnalysis.input_schema.viewMode.values, [
    "boxscore_with_analysis",
    "standalone_analysis",
  ]);
  assert.deepEqual(showAnalysis.input_schema.analysisTemplate.values, [
    "player_focus",
    "team_focus",
    "turning_point",
    "match_recap",
    "debate_board",
  ]);
});

test("Ticket 3: contextText headline follows clicked stat (AST/REB/PTS)", () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042400407",
      sport: "basket",
      status: "final",
      startedAt: "2025-06-22",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [
      {
        entityId: "player_sga",
        entityName: "Shai Gilgeous-Alexander",
        teamId: "team_okc",
        stats: {
          pts: 29,
          ast: 12,
          reb: 7,
          fg: "11-21",
          fg3: "3-7",
          ft: "4-4",
          plusMinus: 8,
          min: "38",
        },
      },
    ],
    timeline: [
      {
        order: 1,
        clock: "11:02",
        period: 1,
        periodLabel: "Q1",
        type: "made_shot",
        teamId: "team_okc",
        description: "Shai Gilgeous-Alexander makes pull-up jumper",
        homeScore: 2,
        awayScore: 0,
        actorIds: ["player_sga"],
      },
      {
        order: 2,
        clock: "08:12",
        period: 2,
        periodLabel: "Q2",
        type: "rebound",
        teamId: "team_okc",
        description: "Defensive rebound Shai Gilgeous-Alexander",
        homeScore: 18,
        awayScore: 15,
        actorIds: ["player_sga"],
      },
      {
        order: 3,
        clock: "05:41",
        period: 3,
        periodLabel: "Q3",
        type: "made_shot",
        teamId: "team_okc",
        description: "Jalen Williams makes 3PT (ast: Shai Gilgeous-Alexander)",
        homeScore: 58,
        awayScore: 49,
        actorIds: ["player_sga"],
      },
    ],
    contextBlocks: [
      {
        id: "cb_sga_slice",
        gameId: "basket:0042400407",
        sport: "basket",
        kind: "player_slice",
        label: "Shai Gilgeous-Alexander: 29 pts",
        summaryText: "Legacy summary text",
        entityIds: ["player_sga"],
        period: 4,
        payload: {},
      },
    ],
    momentum: [],
  });

  const common = {
    gameId: "basket:0042400407",
    entityId: "player_sga",
    entityName: "Shai Gilgeous-Alexander",
    teamId: "team_okc",
    tone: "analyst" as const,
  };

  const ast = services.buildStatContextView(
    common.gameId,
    common.entityId,
    common.entityName,
    common.teamId,
    "ast",
    undefined,
    common.tone,
  );
  assert.match(ast.contextText, /### Shai Gilgeous-Alexander: 12 AST/);
  assert.match(ast.uiHeadline, /AST/i);

  const reb = services.buildStatContextView(
    common.gameId,
    common.entityId,
    common.entityName,
    common.teamId,
    "reb",
    undefined,
    common.tone,
  );
  assert.match(reb.contextText, /### Shai Gilgeous-Alexander: 7 REB/);
  assert.match(reb.uiHeadline, /REB/i);

  const pts = services.buildStatContextView(
    common.gameId,
    common.entityId,
    common.entityName,
    common.teamId,
    "pts",
    undefined,
    common.tone,
  );
  assert.match(pts.contextText, /### Shai Gilgeous-Alexander: 29 PTS/);
  assert.match(pts.uiHeadline, /PTS|pts/i);
});

test("Ticket 5: list_suggested_prompts prioritizes bigger Q4 runs over Q1 noise", () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0099999999",
      sport: "basket",
      status: "final",
      startedAt: "2026-01-10",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [
      {
        entityId: "player_a",
        entityName: "Player A",
        teamId: "team_okc",
        stats: { pts: 10 },
      },
    ],
    timeline: [],
    contextBlocks: [
      {
        id: "run_q4_13",
        gameId: "basket:0099999999",
        sport: "basket",
        kind: "scoring_run",
        label: "Run 13-0 (Q4)",
        summaryText: "Q4 killer run",
        entityIds: [],
        period: 4,
        payload: { runPoints: 13, startOrder: 100, endOrder: 110 },
      },
      {
        id: "run_q4_7",
        gameId: "basket:0099999999",
        sport: "basket",
        kind: "scoring_run",
        label: "Run 7-0 (Q4)",
        summaryText: "Second decisive run",
        entityIds: [],
        period: 4,
        payload: { runPoints: 7, startOrder: 120, endOrder: 124 },
      },
      {
        id: "run_q1_4",
        gameId: "basket:0099999999",
        sport: "basket",
        kind: "scoring_run",
        label: "Run 4-0 (Q1)",
        summaryText: "Early noise",
        entityIds: [],
        period: 1,
        payload: { runPoints: 4, startOrder: 1, endOrder: 3 },
      },
    ],
    momentum: [],
  });

  const prompts = services.listSuggestedPrompts("basket:0099999999");
  const labels = prompts.map((p) => p.label);

  const idxQ4_13 = labels.indexOf("Run 13-0 (Q4)");
  const idxQ4_7 = labels.indexOf("Run 7-0 (Q4)");
  const idxQ1_4 = labels.indexOf("Run 4-0 (Q1)");

  assert.ok(idxQ4_13 >= 0);
  assert.ok(idxQ4_7 >= 0);
  assert.ok(idxQ1_4 >= 0);
  assert.ok(idxQ4_13 < idxQ1_4);
  assert.ok(idxQ4_7 < idxQ1_4);
});

test("Ticket 6: text resolver maps OKC/Pacers aliases to basket:0042400407", () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042400407",
      sport: "basket",
      status: "final",
      startedAt: "2025-06-22",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [],
    timeline: [],
    contextBlocks: [],
    momentum: [],
  });

  const a = findCachedGameByQuery(
    services.repo,
    "OKC Pacers 2025-06-22",
    "basket",
  );
  const b = findCachedGameByQuery(
    services.repo,
    "Pacers OKC 2025-06-22",
    "basket",
  );

  assert.equal(a, "basket:0042400407");
  assert.equal(b, "basket:0042400407");
});

test("Ticket 7: team-name fallback normalizes Away/Home to real NBA names", () => {
  const ind = nbaTeamDisplayName({
    abbr: "IND",
    city: "Indiana",
    name: "Away",
    fallbackName: "Indiana Away",
  });
  const okc = nbaTeamDisplayName({
    abbr: "OKC",
    city: "Oklahoma City",
    name: "Home",
    fallbackName: "Oklahoma City Home",
  });

  assert.equal(ind, "Indiana Pacers");
  assert.equal(okc, "Oklahoma City Thunder");
});

test("Ticket 8 hardening: refresh/clearCache aliases normalize correctly", () => {
  const withQueryMarker = normalizeShowGameInput({
    gameId: "basket:0042400407?clearCache=true",
  });
  assert.equal(withQueryMarker.gameId, "basket:0042400407");
  assert.equal(withQueryMarker.refresh, true);

  const withSuffix = normalizeShowGameInput({
    gameId: "basket:0042400407:refresh",
  });
  assert.equal(withSuffix.gameId, "basket:0042400407");
  assert.equal(withSuffix.refresh, true);

  const withQueryText = normalizeShowGameInput({
    query: "okc pacers refresh",
  });
  assert.equal(withQueryText.query, "okc pacers");
  assert.equal(withQueryText.refresh, true);
});

test("Ticket 10: dynamic team-name resolver on cache load corrects bad historical names", async () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042500317",
      sport: "basket",
      status: "final",
      startedAt: "2026-05-30",
      homeTeam: {
        id: "team_1610612760",
        name: "Oklahoma City Home",
        abbreviation: "OKC",
      },
      awayTeam: {
        id: "team_1610612759",
        name: "San Antonio Away",
        abbreviation: "SAS",
      },
      homeScore: 103,
      awayScore: 111,
      league: "NBA",
    },
    boxLines: [],
    timeline: [],
    contextBlocks: [],
    momentum: [],
  });

  const result = await loadGameForDisplay({ gameId: "basket:0042500317" });
  assert.ok(result.ok);
  assert.equal(result.game.homeTeam.name, "Oklahoma City Thunder");
  assert.equal(result.game.awayTeam.name, "San Antonio Spurs");
});

test("Ticket 11: fuzzy player matching resolves to latest game of their team", () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042400407",
      sport: "basket",
      status: "final",
      startedAt: "2025-06-22",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [
      {
        entityId: "player_chet",
        entityName: "Chet Holmgren",
        teamId: "team_okc",
        stats: { pts: 18 },
      },
    ],
    timeline: [],
    contextBlocks: [],
    momentum: [],
  });

  const gameId = findCachedGameByQuery(services.repo, "match de chet holgrem", "basket");
  assert.equal(gameId, "basket:0042400407");
});

test("Ticket 12: single-team query resolves to latest game of that team", () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042400407",
      sport: "basket",
      status: "final",
      startedAt: "2025-06-22",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [],
    timeline: [],
    contextBlocks: [],
    momentum: [],
  });

  const gameId = findCachedGameByQuery(services.repo, "match de thunder", "basket");
  assert.equal(gameId, "basket:0042400407");
});

test("Ticket 13: loadGameForDisplay resolves fuzzy player to cached game id", async () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042400407",
      sport: "basket",
      status: "final",
      startedAt: "2025-06-22",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [
      {
        entityId: "player_chet",
        entityName: "Chet Holmgren",
        teamId: "team_okc",
        stats: { pts: 18 },
      },
    ],
    timeline: [],
    contextBlocks: [],
    momentum: [],
  });

  const result = await loadGameForDisplay({ query: "match de chet holgrem" });
  assert.ok(result.ok);
  assert.equal(result.game.id, "basket:0042400407");
});

test("Ticket 14: loadGameForDisplay resolves single team to latest cached game id", async () => {
  services.repo.saveIngested({
    game: {
      id: "basket:0042400407",
      sport: "basket",
      status: "final",
      startedAt: "2025-06-22",
      homeTeam: {
        id: "team_okc",
        name: "Oklahoma City Thunder",
        abbreviation: "OKC",
      },
      awayTeam: { id: "team_ind", name: "Indiana Pacers", abbreviation: "IND" },
      homeScore: 103,
      awayScore: 91,
      league: "NBA",
    },
    boxLines: [],
    timeline: [],
    contextBlocks: [],
    momentum: [],
  });

  const result = await loadGameForDisplay({ query: "match de thunder" });
  assert.ok(result.ok);
  assert.equal(result.game.id, "basket:0042400407");
});



