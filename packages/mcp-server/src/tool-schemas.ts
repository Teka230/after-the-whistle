import { z } from "zod";
import { TONE_VALUES } from "@after-the-whistle/core";

const toneSchema = z.enum(TONE_VALUES);
const analysisViewModeSchema = z.enum([
  "boxscore_with_analysis",
  "standalone_analysis",
]);
const analysisTemplateSchema = z.enum([
  "player_focus",
  "team_focus",
  "turning_point",
  "match_recap",
  "debate_board",
]);

/** Explicit z.object — stable JSON Schema for MCP tools/list (ChatGPT connector). */
export const showGameInputSchema = z.object({
  gameId: z
    .string()
    .optional()
    .describe("Composite ID e.g. basket:0022400500 or bare NBA id"),
  query: z
    .string()
    .optional()
    .describe(
      "Team/match search. Append 'refresh' to bypass cache (e.g. 'psg inter refresh'). Sport hints: basket, foot, soccer."
    ),
  sport: z
    .enum(["basket", "foot"])
    .optional()
    .describe("Sport when discovering by query"),
  refresh: z
    .boolean()
    .optional()
    .describe(
      "Force re-fetch from provider, bypassing SQLite cache. Use after sample data updates or to refresh live/final box stats."
    ),
  clearCache: z
    .boolean()
    .optional()
    .describe(
      "Alias for refresh. When true, clear the cached game before re-fetching; useful when the separate clear_cache tool is not visible in the host."
    ),
  tone: toneSchema.optional().describe("Persona for suggested prompts and stat context"),
});

export type ShowGameInput = z.infer<typeof showGameInputSchema>;

const evidenceRefSchema = z.object({
  type: z
    .enum(["box_line", "timeline_event", "context_block", "shot_chart"])
    .describe("Verified evidence type backing this analysis item"),
  id: z.string().describe("Evidence id from the box score, timeline, or context block"),
  label: z.string().describe("Short human-readable evidence label"),
});

const analysisPointSchema = z.object({
  id: z.string().optional(),
  label: z.string().describe("Compact label for the visual card"),
  value: z.string().optional().describe("Optional metric or short value"),
  detail: z.string().describe("One verified analytical claim"),
  weight: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Visual importance from 0 to 100"),
  tone: z.enum(["proof", "swing", "risk", "question"]).optional(),
  evidence: z.array(evidenceRefSchema).optional(),
});

const analysisTimelineItemSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  period: z.number().optional(),
  detail: z.string(),
  weight: z.number().min(0).max(100).optional(),
  evidence: z.array(evidenceRefSchema).optional(),
});

export const visualAnalysisSchema = z.object({
  viewMode: analysisViewModeSchema
    .optional()
    .describe("Preferred widget layout for this analysis"),
  analysisTemplate: analysisTemplateSchema
    .optional()
    .describe("Specialized visual template for the analysis"),
  title: z.string().describe("Analysis title shown in the widget"),
  thesis: z.string().describe("Main analytical thesis"),
  summary: z.string().optional().describe("Short supporting summary"),
  verdict: z.string().optional().describe("Bottom-line conclusion"),
  confidence: z.number().min(0).max(100).optional(),
  points: z
    .array(analysisPointSchema)
    .min(1)
    .max(6)
    .describe("Visual proof cards. Use verified facts only."),
  timeline: z.array(analysisTimelineItemSchema).max(6).optional(),
  focusEntityIds: z.array(z.string()).optional(),
  focusTeamIds: z.array(z.string()).optional(),
});

export type VisualAnalysisInput = z.infer<typeof visualAnalysisSchema>;

export const showAnalysisInputSchema = showGameInputSchema.extend({
  viewMode: analysisViewModeSchema
    .optional()
    .describe(
      "Use standalone_analysis when the user asks for a dedicated UI, otherwise boxscore_with_analysis."
    ),
  analysisTemplate: analysisTemplateSchema
    .optional()
    .describe(
      "Use player_focus for a player-centered UI, team_focus for a team angle, turning_point for a key sequence, match_recap for recap, debate_board for argument comparison."
    ),
  focusEntityIds: z
    .array(z.string())
    .optional()
    .describe("Primary player/entity ids for standalone analysis templates"),
  focusTeamIds: z
    .array(z.string())
    .optional()
    .describe("Primary team ids for standalone analysis templates"),
  analysis: visualAnalysisSchema.describe(
    "Structured analysis to display visually. Claims must be anchored in verified match data."
  ),
});

export const getStatContextInputSchema = z.object({
  gameId: z.string(),
  entityId: z.string(),
  entityName: z.string(),
  teamId: z.string(),
  statKey: z.string(),
  period: z.number().optional(),
  tone: toneSchema.optional(),
});

export const listSuggestedPromptsInputSchema = z.object({
  gameId: z.string(),
  tone: toneSchema.optional(),
});

export const getShotChartInputSchema = z.object({
  gameId: z.string(),
  entityId: z.string(),
});

export const getMomentumInputSchema = z.object({
  gameId: z.string(),
});

export const getPlayerStintsInputSchema = z.object({
  gameId: z.string(),
  entityId: z.string(),
  entityName: z.string().optional(),
  teamId: z.string(),
});

export const clearCacheInputSchema = z.object({
  gameId: z
    .string()
    .optional()
    .describe(
      "Composite game id e.g. basket:0042500316. Omit to wipe the entire SQLite cache."
    ),
});

export const TOOL_INPUT_SCHEMAS = {
  show_game: showGameInputSchema,
  show_analysis: showAnalysisInputSchema,
  get_stat_context: getStatContextInputSchema,
  list_suggested_prompts: listSuggestedPromptsInputSchema,
  get_shot_chart: getShotChartInputSchema,
  get_momentum: getMomentumInputSchema,
  get_player_stints: getPlayerStintsInputSchema,
  clear_cache: clearCacheInputSchema,
} as const;
