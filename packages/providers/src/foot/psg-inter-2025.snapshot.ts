/**
 * Verified match data — PSG 5-0 Inter, UCL final 2025-05-31 (Allianz Arena).
 * Sources: FBref match report, ESPN team stats, Footballan event log.
 */
import type { BoxLine, Game, TeamMatchStats, TimelineEvent } from "@after-the-whistle/core";

export const SNAPSHOT_GAME_ID = "foot:sample:psg_inter_2025";
export const SNAPSHOT_API_FIXTURE_HINT = 1361964;

type PlayerRow = {
  entityId: string;
  entityName: string;
  teamId: "psg" | "inter";
  goals?: number;
  assists?: number;
  shots?: number;
  shotsOn?: number;
  xg?: number;
  passes?: number;
  tackles?: number;
  fouls?: number;
  yellowCards?: number;
  rating?: number;
  minutes?: number;
};

const PSG_TEAM = { id: "psg", name: "Paris Saint-Germain", abbreviation: "PSG" };
const INT_TEAM = { id: "inter", name: "Inter Milan", abbreviation: "INT" };

export const SNAPSHOT_GAME: Game = {
  id: SNAPSHOT_GAME_ID,
  sport: "foot",
  status: "final",
  startedAt: "2025-05-31T19:00:00Z",
  homeTeam: PSG_TEAM,
  awayTeam: INT_TEAM,
  homeScore: 5,
  awayScore: 0,
  season: "2024-25",
  league: "UEFA Champions League Final",
};

/** FBref team totals — PSG home, Inter away */
export const SNAPSHOT_TEAM_STATS: TeamMatchStats = {
  possession: [58, 42],
  shots: [23, 8],
  shotsOn: [8, 2],
  passes: [490, 309],
  passAccuracy: [88, 78],
  xg: [3.1, 0.5],
  corners: [4, 6],
  fouls: [13, 7],
  yellowCards: [2, 4],
  saves: [2, 3],
};

const PLAYERS: PlayerRow[] = [
  // PSG — FBref player stats + broadcast ratings where noted
  { entityId: "doue", entityName: "Désiré Doué", teamId: "psg", goals: 2, assists: 1, shots: 4, shotsOn: 3, xg: 0.4, passes: 20, tackles: 1, fouls: 2, yellowCards: 1, rating: 9.6, minutes: 66 },
  { entityId: "dembele", entityName: "Ousmane Dembélé", teamId: "psg", goals: 0, assists: 2, shots: 4, shotsOn: 1, xg: 0.3, passes: 40, tackles: 0, fouls: 0, yellowCards: 0, rating: 8.5, minutes: 90 },
  { entityId: "hakimi", entityName: "Achraf Hakimi", teamId: "psg", goals: 1, assists: 0, shots: 2, shotsOn: 1, xg: 0.6, passes: 72, tackles: 2, fouls: 4, yellowCards: 1, rating: 8.0, minutes: 90 },
  { entityId: "kvara", entityName: "Khvicha Kvaratskhelia", teamId: "psg", goals: 1, assists: 0, shots: 6, shotsOn: 1, xg: 0.8, passes: 17, tackles: 2, fouls: 1, yellowCards: 0, rating: 8.2, minutes: 83 },
  { entityId: "mayulu", entityName: "Senny Mayulu", teamId: "psg", goals: 1, assists: 0, shots: 1, shotsOn: 1, xg: 0.1, passes: 2, tackles: 0, fouls: 0, yellowCards: 0, rating: 7.9, minutes: 7 },
  { entityId: "vitinha", entityName: "Vitinha", teamId: "psg", goals: 0, assists: 1, shots: 0, shotsOn: 0, xg: 0.0, passes: 74, tackles: 2, fouls: 0, yellowCards: 0, rating: 8.8, minutes: 90 },
  { entityId: "fabian", entityName: "Fabián Ruiz", teamId: "psg", goals: 0, assists: 0, shots: 1, shotsOn: 1, xg: 0.0, passes: 49, tackles: 0, fouls: 0, yellowCards: 0, rating: 8.2, minutes: 83 },
  { entityId: "neves_j", entityName: "João Neves", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 54, tackles: 0, fouls: 1, yellowCards: 0, rating: 7.5, minutes: 83 },
  { entityId: "nuno_mendes", entityName: "Nuno Mendes", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 47, tackles: 3, fouls: 1, yellowCards: 0, rating: 7.4, minutes: 77 },
  { entityId: "pacho", entityName: "Willian Pacho", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 33, tackles: 1, fouls: 3, yellowCards: 0, rating: 7.3, minutes: 90 },
  { entityId: "marquinhos", entityName: "Marquinhos", teamId: "psg", goals: 0, assists: 0, shots: 2, shotsOn: 0, xg: 0.2, passes: 44, tackles: 1, fouls: 0, yellowCards: 0, rating: 7.6, minutes: 90 },
  { entityId: "donnarumma", entityName: "Gianluigi Donnarumma", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 20, tackles: 0, fouls: 0, yellowCards: 0, rating: 7.2, minutes: 90 },
  { entityId: "barcola", entityName: "Bradley Barcola", teamId: "psg", goals: 0, assists: 1, shots: 3, shotsOn: 0, xg: 0.7, passes: 12, tackles: 1, fouls: 0, yellowCards: 0, rating: 7.0, minutes: 24 },
  { entityId: "hernandez", entityName: "Lucas Hernández", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 4, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.7, minutes: 13 },
  { entityId: "ramos", entityName: "Gonçalo Ramos", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 0, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.5, minutes: 7 },
  { entityId: "zaire_emery", entityName: "Warren Zaïre-Emery", teamId: "psg", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 2, tackles: 0, fouls: 1, yellowCards: 0, rating: 6.5, minutes: 7 },
  // Inter
  { entityId: "sommer", entityName: "Yann Sommer", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 36, tackles: 0, fouls: 0, yellowCards: 0, rating: 5.9, minutes: 90 },
  { entityId: "bastoni", entityName: "Alessandro Bastoni", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 45, tackles: 1, fouls: 0, yellowCards: 0, rating: 6.2, minutes: 90 },
  { entityId: "acerbi", entityName: "Francesco Acerbi", teamId: "inter", goals: 0, assists: 0, shots: 1, shotsOn: 0, xg: 0.1, passes: 31, tackles: 0, fouls: 0, yellowCards: 1, rating: 6.0, minutes: 90 },
  { entityId: "pavard", entityName: "Benjamin Pavard", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 20, tackles: 1, fouls: 0, yellowCards: 0, rating: 6.3, minutes: 53 },
  { entityId: "dimarco", entityName: "Federico Dimarco", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 14, tackles: 1, fouls: 0, yellowCards: 0, rating: 6.2, minutes: 53 },
  { entityId: "barella", entityName: "Nicolò Barella", teamId: "inter", goals: 0, assists: 0, shots: 2, shotsOn: 0, xg: 0.0, passes: 33, tackles: 3, fouls: 0, yellowCards: 0, rating: 6.9, minutes: 90 },
  { entityId: "calhanoglu", entityName: "Hakan Çalhanoğlu", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 29, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.9, minutes: 69 },
  { entityId: "mkhitaryan", entityName: "Henrikh Mkhitaryan", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 9, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.7, minutes: 61 },
  { entityId: "dumfries", entityName: "Denzel Dumfries", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 17, tackles: 2, fouls: 0, yellowCards: 0, rating: 6.3, minutes: 90 },
  { entityId: "lautaro", entityName: "Lautaro Martínez", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 21, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.3, minutes: 90 },
  { entityId: "thuram", entityName: "Marcus Thuram", teamId: "inter", goals: 0, assists: 0, shots: 2, shotsOn: 1, xg: 0.2, passes: 14, tackles: 1, fouls: 0, yellowCards: 1, rating: 6.3, minutes: 90 },
  { entityId: "zalewski", entityName: "Nicola Zalewski", teamId: "inter", goals: 0, assists: 0, shots: 2, shotsOn: 1, xg: 0.1, passes: 7, tackles: 0, fouls: 0, yellowCards: 1, rating: 6.2, minutes: 37 },
  { entityId: "carlos_augusto", entityName: "Carlos Augusto", teamId: "inter", goals: 0, assists: 0, shots: 1, shotsOn: 0, xg: 0.1, passes: 9, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.2, minutes: 29 },
  { entityId: "asllani", entityName: "Kristjan Asllani", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 9, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.3, minutes: 21 },
  { entityId: "bisseck", entityName: "Yann Bisseck", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 1, tackles: 0, fouls: 0, yellowCards: 0, rating: 6.3, minutes: 8 },
  { entityId: "darmian", entityName: "Matteo Darmian", teamId: "inter", goals: 0, assists: 0, shots: 0, shotsOn: 0, xg: 0.0, passes: 14, tackles: 2, fouls: 0, yellowCards: 0, rating: 6.2, minutes: 29 },
];

export const SNAPSHOT_BOX_LINES: BoxLine[] = PLAYERS.map((p) => ({
  entityId: p.entityId,
  entityName: p.entityName,
  teamId: p.teamId,
  stats: {
    goals: p.goals ?? 0,
    assists: p.assists ?? 0,
    shots: p.shots ?? 0,
    shotsOn: p.shotsOn ?? 0,
    xg: p.xg ?? 0,
    passes: p.passes ?? 0,
    tackles: p.tackles ?? 0,
    fouls: p.fouls ?? 0,
    yellowCards: p.yellowCards ?? 0,
    rating: p.rating,
    minutes: p.minutes ?? 0,
  },
}));

export const SNAPSHOT_TIMELINE: TimelineEvent[] = [
  { order: 1, clock: "8'", period: 1, periodLabel: "1st Half", type: "chance", teamId: "psg", description: "Doué and Dembélé efforts saved by Sommer", homeScore: 0, awayScore: 0, actorIds: ["doue", "dembele"] },
  { order: 2, clock: "12'", period: 1, periodLabel: "1st Half", type: "goal", teamId: "psg", description: "GOAL PSG — Hakimi turns in from close range after Doué square pass (1-0)", homeScore: 1, awayScore: 0, actorIds: ["hakimi", "doue"] },
  { order: 3, clock: "18'", period: 1, periodLabel: "1st Half", type: "shot", teamId: "inter", description: "Thuram header from Dimarco cross — wide of the post", homeScore: 1, awayScore: 0, actorIds: ["thuram", "dimarco"] },
  { order: 4, clock: "20'", period: 1, periodLabel: "1st Half", type: "goal", teamId: "psg", description: "GOAL PSG — Doué finishes counter, deflected past Sommer off Dimarco (2-0)", homeScore: 2, awayScore: 0, actorIds: ["doue", "dembele"] },
  { order: 5, clock: "35'", period: 1, periodLabel: "1st Half", type: "chance", teamId: "inter", description: "Thuram wins aerial duel with Kvaratskhelia — header over the bar", homeScore: 2, awayScore: 0, actorIds: ["thuram"] },
  { order: 6, clock: "45'", period: 1, periodLabel: "1st Half", type: "halftime", teamId: null, description: "Half time — Paris Saint-Germain 2-0 Inter Milan", homeScore: 2, awayScore: 0, actorIds: [] },
  { order: 7, clock: "53'", period: 2, periodLabel: "2nd Half", type: "substitution", teamId: "inter", description: "Substitution Inter: Pavard off, Bisseck on; Dimarco off, Zalewski on", homeScore: 2, awayScore: 0, actorIds: ["pavard", "bisseck", "dimarco", "zalewski"] },
  { order: 8, clock: "54'", period: 2, periodLabel: "2nd Half", type: "shot", teamId: "inter", description: "Çalhanoğlu strike from distance — clips the crossbar", homeScore: 2, awayScore: 0, actorIds: ["calhanoglu"] },
  { order: 9, clock: "56'", period: 2, periodLabel: "2nd Half", type: "card", teamId: "inter", description: "Yellow card — Zalewski: tripping", homeScore: 2, awayScore: 0, actorIds: ["zalewski"], metadata: { cardType: "yellow" } },
  { order: 10, clock: "62'", period: 2, periodLabel: "2nd Half", type: "substitution", teamId: "inter", description: "Substitution Inter: Mkhitaryan off, Carlos Augusto on; Bisseck off, Darmian on", homeScore: 2, awayScore: 0, actorIds: ["mkhitaryan", "carlos_augusto", "bisseck", "darmian"] },
  { order: 11, clock: "63'", period: 2, periodLabel: "2nd Half", type: "goal", teamId: "psg", description: "GOAL PSG — Doué slots home after Vitinha through-ball (3-0)", homeScore: 3, awayScore: 0, actorIds: ["doue", "vitinha"] },
  { order: 12, clock: "65'", period: 2, periodLabel: "2nd Half", type: "card", teamId: "psg", description: "Yellow card — Doué: unsportsmanlike conduct", homeScore: 3, awayScore: 0, actorIds: ["doue"], metadata: { cardType: "yellow" } },
  { order: 13, clock: "66'", period: 2, periodLabel: "2nd Half", type: "substitution", teamId: "psg", description: "Substitution PSG: Doué off, Barcola on", homeScore: 3, awayScore: 0, actorIds: ["doue", "barcola"] },
  { order: 14, clock: "69'", period: 2, periodLabel: "2nd Half", type: "card", teamId: "inter", description: "Yellow card — Thuram: tripping", homeScore: 3, awayScore: 0, actorIds: ["thuram"], metadata: { cardType: "yellow" } },
  { order: 15, clock: "70'", period: 2, periodLabel: "2nd Half", type: "substitution", teamId: "inter", description: "Substitution Inter: Çalhanoğlu off, Asllani on", homeScore: 3, awayScore: 0, actorIds: ["calhanoglu", "asllani"] },
  { order: 16, clock: "71'", period: 2, periodLabel: "2nd Half", type: "card", teamId: "inter", description: "Yellow card — Acerbi: roughing", homeScore: 3, awayScore: 0, actorIds: ["acerbi"], metadata: { cardType: "yellow" } },
  { order: 17, clock: "73'", period: 2, periodLabel: "2nd Half", type: "goal", teamId: "psg", description: "GOAL PSG — Kvaratskhelia finishes low after Dembélé pass (4-0)", homeScore: 4, awayScore: 0, actorIds: ["kvara", "dembele"] },
  { order: 18, clock: "78'", period: 2, periodLabel: "2nd Half", type: "substitution", teamId: "psg", description: "Substitution PSG: Mendes off, Hernández on", homeScore: 4, awayScore: 0, actorIds: ["nuno_mendes", "hernandez"] },
  { order: 19, clock: "84'", period: 2, periodLabel: "2nd Half", type: "substitution", teamId: "psg", description: "Substitution PSG: Ruiz off, Mayulu on; Neves off, Zaïre-Emery on; Kvaratskhelia off, Ramos on", homeScore: 4, awayScore: 0, actorIds: ["fabian", "mayulu", "neves_j", "zaire_emery", "kvara", "ramos"] },
  { order: 20, clock: "87'", period: 2, periodLabel: "2nd Half", type: "goal", teamId: "psg", description: "GOAL PSG — Mayulu smashes in off the post after Barcola tee-up (5-0)", homeScore: 5, awayScore: 0, actorIds: ["mayulu", "barcola"] },
  { order: 21, clock: "90+1'", period: 2, periodLabel: "2nd Half", type: "card", teamId: "psg", description: "Yellow card — Hakimi: foul", homeScore: 5, awayScore: 0, actorIds: ["hakimi"], metadata: { cardType: "yellow" } },
  { order: 22, clock: "90+3'", period: 2, periodLabel: "2nd Half", type: "final_whistle", teamId: null, description: "Full time — Paris Saint-Germain 5-0 Inter Milan. PSG are Champions of Europe.", homeScore: 5, awayScore: 0, actorIds: [] },
];