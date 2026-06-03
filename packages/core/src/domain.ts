export type Sport = "basket" | "foot";

export type GameStatus = "scheduled" | "live" | "final";

export const TONE_VALUES = ["analyst", "fan", "bar", "pundit", "debate"] as const;
export type Tone = (typeof TONE_VALUES)[number];

export interface TeamRef {
  id: string;
  name: string;
  abbreviation: string;
}

export interface Game {
  id: string;
  sport: Sport;
  status: GameStatus;
  startedAt: string | null;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  homeScore: number;
  awayScore: number;
  season?: string;
  league?: string;
}

export type BasketStatKey =
  | "pts"
  | "reb"
  | "ast"
  | "fg"
  | "fgPct"
  | "fg3"
  | "fg3Pct"
  | "ft"
  | "ftPct"
  | "stl"
  | "blk"
  | "tov"
  | "pf"
  | "plusMinus"
  | "min";

export type FootStatKey =
  | "goals"
  | "assists"
  | "shots"
  | "shotsOn"
  | "xg"
  | "passes"
  | "tackles"
  | "fouls"
  | "yellowCards"
  | "rating"
  | "minutes";

export type StatKey = BasketStatKey | FootStatKey;

export interface EntityRef {
  id: string;
  name: string;
  teamId: string;
}

export interface BoxLine {
  entityId: string;
  entityName: string;
  teamId: string;
  stats: Partial<Record<StatKey, number | string>>;
}

export interface TimelineEvent {
  order: number;
  clock: string;
  period: number;
  periodLabel: string;
  type: string;
  teamId: string | null;
  description: string;
  homeScore: number;
  awayScore: number;
  actorIds: string[];
  metadata?: Record<string, unknown>;
}

export type ContextBlockKind =
  | "scoring_run"
  | "scoring_drought"
  | "lineup_stint"
  | "player_slice"
  | "momentum_swing"
  | "goal_sequence"
  | "xg_swing"
  | "domination_period"
  | "cards_period"
  | "shot_profile"
  | "team_match_stats";

/** Verified team-level match stats (foot). Values indexed [home, away]. */
export interface TeamMatchStats {
  possession?: [number, number];
  shots?: [number, number];
  shotsOn?: [number, number];
  passes?: [number, number];
  passAccuracy?: [number, number];
  xg?: [number, number];
  corners?: [number, number];
  fouls?: [number, number];
  yellowCards?: [number, number];
  saves?: [number, number];
}

export interface ContextBlock {
  id: string;
  gameId: string;
  sport: Sport;
  kind: ContextBlockKind;
  label: string;
  summaryText: string;
  entityIds: string[];
  period?: number;
  payload: Record<string, unknown>;
}

/** Scoring run slice for widget viz (basket). */
export interface ScoringRunView {
  id: string;
  teamId: string;
  teamAbbrev: string;
  runPoints: number;
  period: number;
  periodLabel: string;
  label: string;
  startOrder: number;
  endOrder: number;
}

export type EvidenceRefType = "box_line" | "timeline_event" | "context_block" | "shot_chart";

export interface EvidenceRef {
  type: EvidenceRefType;
  id: string;
  label: string;
}

export interface VerifiedFact {
  id: string;
  gameId: string;
  sport: Sport;
  entityIds: string[];
  teamIds: string[];
  metric: string;
  value: number | string;
  label: string;
  explanation: string;
  evidence: EvidenceRef[];
}

export interface Insight {
  id: string;
  gameId: string;
  sport: Sport;
  title: string;
  angle: "turning_point" | "player_impact" | "shot_profile" | "team_trend" | "discipline" | "general";
  summary: string;
  factIds: string[];
  contextBlockIds: string[];
  suggestedPrompt: string;
}

export interface InsightBundle {
  gameId: string;
  sport: Sport;
  facts: VerifiedFact[];
  insights: Insight[];
  modelInstruction: string;
}

export type AnalysisPointTone = "proof" | "swing" | "risk" | "question";
export type VisualAnalysisViewMode = "boxscore_with_analysis" | "standalone_analysis";
export type VisualAnalysisTemplate =
  | "player_focus"
  | "team_focus"
  | "turning_point"
  | "match_recap"
  | "debate_board";

export interface AnalysisPoint {
  id: string;
  label: string;
  value?: string;
  detail: string;
  weight?: number;
  tone?: AnalysisPointTone;
  evidence?: EvidenceRef[];
}

export interface AnalysisTimelineItem {
  id: string;
  label: string;
  period?: number;
  detail: string;
  weight?: number;
  evidence?: EvidenceRef[];
}

export interface VisualAnalysis {
  viewMode?: VisualAnalysisViewMode;
  analysisTemplate?: VisualAnalysisTemplate;
  title: string;
  thesis: string;
  summary?: string;
  verdict?: string;
  confidence?: number;
  generatedBy?: "model" | "system";
  points: AnalysisPoint[];
  timeline?: AnalysisTimelineItem[];
  focusEntityIds?: string[];
  focusTeamIds?: string[];
}

export interface StatClickContext {
  gameId: string;
  sport: Sport;
  entityId: string;
  entityName: string;
  teamId: string;
  statKey: StatKey;
  period?: number;
  contextBlockIds: string[];
  suggestedPrompt: string;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt: string;
  contextBlockIds: string[];
}

export interface ShotPoint {
  x: number;
  y: number;
  made: boolean;
  period: number;
  clock: string;
}

export interface MomentumPoint {
  order: number;
  clock: string;
  period: number;
  homeScore: number;
  awayScore: number;
  value: number;
  description?: string;
}

/** One on-pitch / on-floor segment with score differential from the player's team perspective. */
export interface PlayerStint {
  stintIndex: number;
  period: number;
  periodLabel: string;
  startClock: string;
  endClock: string;
  startOrder: number;
  endOrder: number;
  scoreStart: { home: number; away: number };
  scoreEnd: { home: number; away: number };
  /** Point differential from this player's team perspective while on floor. */
  differential: number;
  label: string;
}

export interface IngestedGameData {
  game: Game;
  boxLines: BoxLine[];
  timeline: TimelineEvent[];
  contextBlocks: ContextBlock[];
  shotCharts?: Record<string, ShotPoint[]>;
  momentum?: MomentumPoint[];
}

export interface StatColumn {
  key: StatKey;
  label: string;
  shortLabel: string;
  clickable: boolean;
}
