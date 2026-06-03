import type { IngestedGameData, TimelineEvent } from "@after-the-whistle/core";
import {
  buildBasketMomentum,
  buildFootMomentum,
  computeBasketContextBlocks,
  computeFootContextBlocks,
  gameIdForSport,
} from "@after-the-whistle/core";
import { openDatabase } from "./connection.js";
import { GameRepository } from "./repository.js";

/** Offline demo data when NBA / API-Football are unavailable */
export function seedDemoGames(dbPath: string): void {
  const repo = new GameRepository(openDatabase(dbPath));

  const basketGame: IngestedGameData = {
    game: {
      id: gameIdForSport("basket", "0022400500"),
      sport: "basket",
      status: "final",
      startedAt: "2025-01-15",
      homeTeam: { id: "team_spurs", name: "San Antonio Spurs", abbreviation: "SAS" },
      awayTeam: { id: "team_lakers", name: "Los Angeles Lakers", abbreviation: "LAL" },
      homeScore: 118,
      awayScore: 109,
      league: "NBA",
    },
    boxLines: [
      {
        entityId: "player_wemby",
        entityName: "Victor Wembanyama",
        teamId: "team_spurs",
        stats: { pts: 28, reb: 14, ast: 5, fg: "11-18", fg3: "2-5", plusMinus: 12, min: "34" },
      },
      {
        entityId: "player_harper",
        entityName: "Dylan Harper",
        teamId: "team_spurs",
        stats: { pts: 14, reb: 3, ast: 7, fg: "5-9", fg3: "1-2", plusMinus: 8, min: "22" },
      },
      {
        entityId: "player_lebron",
        entityName: "LeBron James",
        teamId: "team_lakers",
        stats: { pts: 24, reb: 8, ast: 9, fg: "9-20", fg3: "2-7", plusMinus: -6, min: "36" },
      },
    ],
    timeline: buildDemoBasketTimeline(),
    contextBlocks: [],
    momentum: [],
    shotCharts: {
      player_wemby: [
        { x: 50, y: 100, made: true, period: 1, clock: "10:22" },
        { x: -80, y: 200, made: false, period: 2, clock: "5:11" },
        { x: 120, y: 50, made: true, period: 3, clock: "8:44" },
      ],
    },
  };

  basketGame.contextBlocks = computeBasketContextBlocks(
    basketGame.game,
    basketGame.boxLines,
    basketGame.timeline
  );
  basketGame.momentum = buildBasketMomentum(basketGame.timeline);

  const footGame: IngestedGameData = {
    game: {
      id: gameIdForSport("foot", "1208391"),
      sport: "foot",
      status: "final",
      startedAt: "2025-01-14T20:00:00Z",
      homeTeam: { id: "team_psg", name: "Paris SG", abbreviation: "PSG" },
      awayTeam: { id: "team_om", name: "Marseille", abbreviation: "OM" },
      homeScore: 2,
      awayScore: 1,
      league: "Ligue 1",
    },
    boxLines: [
      {
        entityId: "player_mbappe",
        entityName: "Kylian Mbappe",
        teamId: "team_psg",
        stats: { goals: 1, assists: 1, shots: 5, xg: 0.82, rating: 8.1, minutes: 90 },
      },
      {
        entityId: "player_aubameyang",
        entityName: "Pierre Aubameyang",
        teamId: "team_om",
        stats: { goals: 1, assists: 0, shots: 3, xg: 0.45, rating: 7.2, minutes: 78 },
      },
    ],
    timeline: [
      {
        order: 1,
        clock: "23'",
        period: 1,
        periodLabel: "1st half",
        type: "goal",
        teamId: "team_om",
        description: "Aubameyang — Goal",
        homeScore: 0,
        awayScore: 1,
        actorIds: ["player_aubameyang"],
      },
      {
        order: 2,
        clock: "67'",
        period: 2,
        periodLabel: "2nd half",
        type: "goal",
        teamId: "team_psg",
        description: "Mbappe — Goal (assist: Dembele)",
        homeScore: 1,
        awayScore: 1,
        actorIds: ["player_mbappe"],
      },
      {
        order: 3,
        clock: "89'",
        period: 2,
        periodLabel: "2nd half",
        type: "goal",
        teamId: "team_psg",
        description: "Mbappe — Penalty",
        homeScore: 2,
        awayScore: 1,
        actorIds: ["player_mbappe"],
      },
    ],
    contextBlocks: [],
    momentum: [],
  };

  footGame.contextBlocks = computeFootContextBlocks(
    footGame.game,
    footGame.boxLines,
    footGame.timeline
  );
  footGame.momentum = buildFootMomentum(footGame.game, footGame.timeline);

  repo.saveIngested(basketGame);
  repo.saveIngested(footGame);
}

function buildDemoBasketTimeline(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let h = 0;
  let a = 0;
  const add = (
    order: number,
    period: number,
    clock: string,
    type: string,
    team: "home" | "away",
    desc: string,
    score?: boolean
  ) => {
    if (score) {
      if (team === "home") h += 2;
      else a += 2;
    }
    events.push({
      order,
      clock,
      period,
      periodLabel: `Q${period}`,
      type,
      teamId: team === "home" ? "team_spurs" : "team_lakers",
      description: desc,
      homeScore: h,
      awayScore: a,
      actorIds: desc.includes("Wembanyama")
        ? ["player_wemby"]
        : desc.includes("Harper")
          ? ["player_harper"]
          : desc.includes("LeBron")
            ? ["player_lebron"]
            : [],
    });
  };

  add(1, 1, "11:00", "made_shot", "home", "Wembanyama makes 3PT", true);
  add(2, 1, "9:30", "missed_shot", "away", "LeBron misses layup", false);
  add(3, 2, "8:00", "made_shot", "home", "Harper makes driving layup", true);
  add(4, 2, "4:00", "made_shot", "away", "LeBron makes fadeaway", true);
  add(5, 3, "10:00", "missed_shot", "home", "Wembanyama misses hook", false);
  add(6, 3, "5:00", "made_shot", "home", "Harper makes 3PT — run", true);
  add(7, 3, "4:30", "made_shot", "home", "Wembanyama dunk", true);
  add(8, 4, "2:00", "missed_shot", "home", "Wembanyama misses mid-range", false);
  return events;
}
