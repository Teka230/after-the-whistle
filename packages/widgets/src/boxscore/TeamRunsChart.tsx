import type { ScoringRunView } from "@after-the-whistle/core";
import { getTeamColor } from "./nbaColors.js";

type RuntimeScoringRun = ScoringRunView & {
  payload?: Record<string, unknown>;
  points?: unknown;
  value?: unknown;
  runTeam?: unknown;
  teamAbbreviation?: unknown;
};

interface Props {
  runs: RuntimeScoringRun[];
  homeTeamId: string;
  awayTeamId: string;
  homeAbbrev: string;
  awayAbbrev: string;
}

function finitePoints(value: unknown): number | null {
  const points = typeof value === "number" ? value : Number(value);
  return Number.isFinite(points) && points > 0 ? points : null;
}

function pointsFromLabel(label: unknown): number | null {
  if (typeof label !== "string") return null;
  const match = label.match(/(?:run\s+|\+)(\d+(?:\.\d+)?)(?:-0|\s*pts?)/i);
  return match ? finitePoints(match[1]) : null;
}

function runPoints(run: RuntimeScoringRun): number {
  return (
    finitePoints(run.runPoints) ??
    finitePoints(run.payload?.runPoints) ??
    finitePoints(run.points) ??
    finitePoints(run.value) ??
    pointsFromLabel(run.label) ??
    1
  );
}

function runTeamId(run: RuntimeScoringRun): string {
  return String(run.teamId || run.runTeam || run.payload?.runTeam || "");
}

function runTeamAbbrev(run: RuntimeScoringRun): string {
  return String(run.teamAbbrev || run.teamAbbreviation || "");
}

function runPeriodLabel(run: RuntimeScoringRun): string {
  if (run.periodLabel) return run.periodLabel;
  const match = run.label.match(/\((Q\d+|OT\d+)\)/i);
  return match?.[1] ?? "";
}

function readableTextColor(color: string): "#0f1115" | "#ffffff" {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#0f1115" : "#ffffff";
}

function runSide(
  run: { teamId: string; teamAbbrev: string },
  homeTeamId: string,
  homeAbbrev: string
): "home" | "away" {
  if (run.teamId === homeTeamId) return "home";
  if (run.teamAbbrev && run.teamAbbrev === homeAbbrev) return "home";
  return "away";
}

export function TeamRunsChart({
  runs,
  homeTeamId,
  awayTeamId,
  homeAbbrev,
  awayAbbrev,
}: Props) {
  const normalizedRuns = runs.map((run) => ({
    raw: run,
    points: runPoints(run),
    teamId: runTeamId(run),
    teamAbbrev: runTeamAbbrev(run),
    periodLabel: runPeriodLabel(run),
  }));

  if (normalizedRuns.length === 0) {
    return (
      <div className="atw-viz atw-runs-chart">
        <h4>Scoring sequences</h4>
        <p className="atw-loading">No consecutive scoring sequences found.</p>
      </div>
    );
  }

  const maxPoints = Math.max(...normalizedRuns.map((r) => r.points), 1);
  const homeColor = getTeamColor(homeAbbrev, "var(--home)");
  const awayColor = getTeamColor(awayAbbrev, "var(--away)");

  return (
    <div className="atw-viz atw-runs-chart">
      <div className="atw-runs-heading">
        <h4>Scoring sequences · scoring flow</h4>
        <div className="atw-runs-legend" aria-hidden="true">
          <span>
            <i style={{ backgroundColor: awayColor }} />
            {awayAbbrev}
          </span>
          <span>
            <i style={{ backgroundColor: homeColor }} />
            {homeAbbrev}
          </span>
        </div>
      </div>
      <p className="atw-runs-caption">
        Every consecutive scoring stretch — width = volume, height = points, tug-of-war layout
      </p>
      <div
        className="atw-runs-timeline atw-runs-timeline--unified"
        role="img"
        aria-label="Scoring sequences match timeline"
      >
        <div className="atw-runs-lane__track atw-runs-lane__track--unified" aria-hidden={normalizedRuns.length === 0}>
          {normalizedRuns.map((run, index) => {
            const side = runSide(run, homeTeamId, homeAbbrev);
            const height = 12 + (run.points / maxPoints) * 48;
            const sideAbbrev =
              run.teamAbbrev ||
              (run.teamId === homeTeamId
                ? homeAbbrev
                : run.teamId === awayTeamId
                  ? awayAbbrev
                  : "");
            const teamColor =
              side === "home"
                ? getTeamColor(sideAbbrev, homeColor)
                : getTeamColor(sideAbbrev, awayColor);
            const textColor = readableTextColor(teamColor);
            const label = run.raw.label || `+${run.points} pts`;
            
            return (
              <div
                key={run.raw.id || `${run.teamId}:${index}`}
                className={`atw-runs-segment atw-runs-segment--${side}`}
                style={{
                  flexGrow: run.points,
                  flexShrink: 1,
                  flexBasis: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
                title={`${sideAbbrev || side}: ${label}${run.periodLabel ? ` · ${run.periodLabel}` : ""}`}
              >
                <div
                  className="atw-runs-bar"
                  style={{
                    height: `${height}px`,
                    backgroundColor: teamColor,
                    position: "absolute",
                    left: 0,
                    right: 0,
                    ...(side === "home" ? { bottom: "50%" } : { top: "50%" }),
                  }}
                >
                  <span className="atw-runs-segment__pts" style={{ color: textColor }}>
                    {run.points}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
