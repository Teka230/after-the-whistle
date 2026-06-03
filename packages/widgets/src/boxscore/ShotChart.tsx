import type { ShotPoint } from "@after-the-whistle/core";

export type EfficiencyProfile = {
  entityName: string;
  fg: string | number | null;
  fg3: string | number | null;
  pts: string | number | null;
  ast: string | number | null;
  reb: string | number | null;
  plusMinus: string | number | null;
  minutes: string | number | null;
};

interface Props {
  points: ShotPoint[];
  playerName?: string;
  unavailable?: boolean;
  message?: string;
  efficiencyProfile?: EfficiencyProfile;
}

/** Half-court shot chart (stats.nba.com coords scaled) */
export function ShotChart({
  points,
  playerName,
  unavailable,
  message,
  efficiencyProfile,
}: Props) {
  if (points.length === 0) {
    if (!efficiencyProfile) {
      return (
        <p className="atw-loading">
          {message ?? "Shot chart unavailable."}
        </p>
      );
    }

    const p = efficiencyProfile;
    return (
      <div className="atw-viz atw-efficiency">
        <h4>
          {unavailable ? "Shot chart unavailable" : "Efficiency profile"}
          {playerName || p.entityName ? ` — ${playerName ?? p.entityName}` : ""}
        </h4>
        {message ? <p className="atw-efficiency-note">{message}</p> : null}
        <dl className="atw-efficiency-grid">
          <div>
            <dt>FG</dt>
            <dd>{p.fg ?? "—"}</dd>
          </div>
          <div>
            <dt>3PT</dt>
            <dd>{p.fg3 ?? "—"}</dd>
          </div>
          <div>
            <dt>PTS</dt>
            <dd>{p.pts ?? "—"}</dd>
          </div>
          <div>
            <dt>AST</dt>
            <dd>{p.ast ?? "—"}</dd>
          </div>
          <div>
            <dt>REB</dt>
            <dd>{p.reb ?? "—"}</dd>
          </div>
          <div>
            <dt>+/-</dt>
            <dd>{p.plusMinus ?? "—"}</dd>
          </div>
          {p.minutes != null ? (
            <div>
              <dt>MIN</dt>
              <dd>{p.minutes}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  const w = 280;
  const h = 260;
  const scaleX = (x: number) => ((x + 250) / 500) * w;
  const scaleY = (y: number) => h - (y / 470) * (h - 20);

  return (
    <div className="atw-viz">
      <h4>Shot chart {playerName ? `— ${playerName}` : ""}</h4>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        style={{ maxWidth: w, display: "block" }}
        role="img"
        aria-label="Shot chart"
      >
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          rx={4}
        />
        <path
          d={`M ${w * 0.1} ${h - 10} Q ${w / 2} ${h * 0.55} ${w * 0.9} ${h - 10}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={5}
            fill={p.made ? "#22c55e" : "transparent"}
            stroke={p.made ? "#22c55e" : "#ef4444"}
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  );
}
