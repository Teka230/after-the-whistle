import { SAMPLE_DATA_REVISION, SAMPLE_GAME_ID } from "./foot/sample-adapter.js";

const SAMPLE_DATA_REVISIONS: Record<string, string> = {
  [SAMPLE_GAME_ID]: SAMPLE_DATA_REVISION,
};

export function sampleDataIsStale(
  gameId: string,
  ingestedAt: string | null
): boolean {
  const revision = SAMPLE_DATA_REVISIONS[gameId];
  if (!revision) return false;
  if (!ingestedAt) return true;
  const ingestedMs = Date.parse(ingestedAt.replace(" ", "T"));
  const revisionMs = Date.parse(`${revision}T00:00:00Z`);
  return Number.isFinite(ingestedMs) && ingestedMs < revisionMs;
}
