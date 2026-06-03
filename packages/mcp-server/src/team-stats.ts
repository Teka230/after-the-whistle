import type { ContextBlock, TeamMatchStats } from "@after-the-whistle/core";
import { repo } from "./services.js";

export function extractTeamMatchStats(gameId: string): TeamMatchStats | null {
  const block = repo
    .getContextBlocks(gameId)
    .find((b) => b.kind === "team_match_stats");
  if (!block) return null;
  return block.payload as TeamMatchStats;
}

export function teamStatsFromBlocks(blocks: ContextBlock[]): TeamMatchStats | null {
  const block = blocks.find((b) => b.kind === "team_match_stats");
  if (!block) return null;
  return block.payload as TeamMatchStats;
}
