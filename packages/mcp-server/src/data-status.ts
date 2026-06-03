import { repo } from "./services.js";

export type DataSource = "cache" | "fresh_ingest";
export type DataCompleteness = "rich" | "partial" | "minimal";

export function resolveDataStatus(
  gameId: string,
  ingested: boolean
): { source: DataSource; dataCompleteness: DataCompleteness } {
  const timeline = repo.getTimeline(gameId);
  const boxLines = repo.getBoxLines(gameId);
  const contextBlocks = repo.getContextBlocks(gameId);

  let dataCompleteness: DataCompleteness = "minimal";
  if (timeline.length >= 10 && boxLines.length >= 10 && contextBlocks.length >= 5) {
    dataCompleteness = "rich";
  } else if (timeline.length >= 3 && boxLines.length >= 2) {
    dataCompleteness = "partial";
  }

  return {
    source: ingested ? "fresh_ingest" : "cache",
    dataCompleteness,
  };
}
