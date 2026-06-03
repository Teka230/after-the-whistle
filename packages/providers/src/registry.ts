import type { Sport, SportAdapter } from "@after-the-whistle/core";
import { parseGameId } from "@after-the-whistle/core";
import { basketAdapter } from "./nba/basket-adapter.js";
import { footAdapter } from "./foot/foot-adapter.js";
import { SampleFootAdapter } from "./foot/sample-adapter.js";

const sampleFootAdapter = new SampleFootAdapter();

export function getAdapter(sport: Sport): SportAdapter {
  if (sport === "foot") return footAdapter;
  if (sport === "basket") return basketAdapter;
  throw new Error(`No adapter for sport: ${sport}`);
}

export function getAdapterForGame(gameId: string): SportAdapter {
  const { sport, externalId } = parseGameId(gameId);
  if (sport === "foot") {
    if (externalId.startsWith("sample:")) {
      return sampleFootAdapter;
    }
    return footAdapter;
  }
  return getAdapter(sport);
}

export { basketAdapter, footAdapter, sampleFootAdapter };
