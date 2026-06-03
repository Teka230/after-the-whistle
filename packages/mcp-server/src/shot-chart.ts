import { parseGameId } from "@after-the-whistle/core";
import type { ShotPoint } from "@after-the-whistle/core";
import { basketAdapter } from "@after-the-whistle/providers";
import { repo } from "./services.js";

export type EfficiencyProfile = {
  entityId: string;
  entityName: string;
  fg: string | number | null;
  fg3: string | number | null;
  pts: string | number | null;
  ast: string | number | null;
  reb: string | number | null;
  plusMinus: string | number | null;
  minutes: string | number | null;
};

export type ShotChartPayload = {
  points: ShotPoint[];
  entityId: string;
  gameId: string;
  unavailable?: boolean;
  message?: string;
  efficiencyProfile?: EfficiencyProfile;
  source?: "cache" | "live";
};

function buildEfficiencyProfile(
  gameId: string,
  entityId: string
): EfficiencyProfile | undefined {
  const line = repo.getBoxLines(gameId).find((l) => l.entityId === entityId);
  if (!line) return undefined;
  const s = line.stats;
  return {
    entityId,
    entityName: line.entityName,
    fg: s.fg ?? null,
    fg3: s.fg3 ?? null,
    pts: s.pts ?? null,
    ast: s.ast ?? null,
    reb: s.reb ?? null,
    plusMinus: s.plusMinus ?? null,
    minutes: s.min ?? s.minutes ?? null,
  };
}

export async function resolveShotChart(
  gameId: string,
  entityId: string
): Promise<ShotChartPayload> {
  let points = repo.getShotChart(gameId, entityId);
  if (points.length > 0) {
    return { points, entityId, gameId, source: "cache" };
  }

  const { sport } = parseGameId(gameId);
  const playerId = entityId.replace(/^player_/, "");
  if (sport === "basket" && /^\d+$/.test(playerId)) {
    try {
      points = await basketAdapter.fetchShotChart!(gameId, entityId);
      if (points.length > 0) {
        return { points, entityId, gameId, source: "live" };
      }
    } catch {
      // fall through to efficiency profile
    }
  }

  const efficiencyProfile = buildEfficiencyProfile(gameId, entityId);
  return {
    points: [],
    entityId,
    gameId,
    unavailable: true,
    message: efficiencyProfile
      ? `Shot chart unavailable for ${efficiencyProfile.entityName} — showing efficiency profile.`
      : "No shot chart or box score line for this player.",
    efficiencyProfile,
  };
}
