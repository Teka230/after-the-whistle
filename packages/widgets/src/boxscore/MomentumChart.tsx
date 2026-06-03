import { useState } from "react";
import type { MomentumPoint } from "@after-the-whistle/core";
import { getTeamColor } from "./nbaColors.js";

interface Props {
  points: MomentumPoint[];
  homeAbbrev?: string;
  awayAbbrev?: string;
}

export function MomentumChart({ points, homeAbbrev = "HOME", awayAbbrev = "AWAY" }: Props) {
  const [hovered, setHovered] = useState<{
    x: number;
    y: number;
    point: MomentumPoint;
    index: number;
  } | null>(null);

  if (points.length < 2) {
    return <p className="atw-loading">Momentum unavailable.</p>;
  }

  const width = 320;
  const height = 80;
  const pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, -5);
  const max = Math.max(...values, 5);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
    return { x, y, point: p, index: i };
  });

  const zeroY = height - pad - ((0 - min) / range) * (height - pad * 2);
  const homeColor = getTeamColor(homeAbbrev, "var(--home)");
  const awayColor = getTeamColor(awayAbbrev, "var(--away)");

  return (
    <div className="atw-viz atw-momentum-container" style={{ position: "relative" }}>
      <div className="atw-runs-heading">
        <h4>Momentum ({homeAbbrev} − {awayAbbrev})</h4>
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
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, display: "block", overflow: "visible" }}
        role="img"
        aria-label="Momentum curve"
        onMouseLeave={() => setHovered(null)}
      >
        <line
          x1={pad}
          y1={zeroY}
          x2={width - pad}
          y2={zeroY}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {coords.slice(1).map((point, index) => {
          const previous = coords[index]!;
          const segmentValue = (previous.point.value + point.point.value) / 2;
          const stroke = segmentValue >= 0 ? homeColor : awayColor;
          return (
            <line
              key={`${previous.x}:${point.x}`}
              x1={previous.x}
              y1={previous.y}
              x2={point.x}
              y2={point.y}
              stroke={stroke}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          );
        })}

        {hovered && (
          <line
            x1={hovered.x}
            y1={0}
            x2={hovered.x}
            y2={height}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="2 2"
            pointerEvents="none"
          />
        )}

        {hovered && (
          <circle
            cx={hovered.x}
            cy={hovered.y}
            r="4.5"
            fill={hovered.point.value >= 0 ? homeColor : awayColor}
            stroke="var(--bg)"
            strokeWidth="1.5"
            pointerEvents="none"
          />
        )}

        {coords.map((c, i) => {
          const rectWidth = Math.max(4, (width - pad * 2) / points.length);
          const rx = c.x - rectWidth / 2;
          return (
            <rect
              key={i}
              x={rx}
              y={0}
              width={rectWidth}
              height={height}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(c)}
              onMouseMove={() => setHovered(c)}
            />
          );
        })}
      </svg>

      {hovered && (
        <div
          className="atw-momentum-tooltip"
          style={{
            position: "absolute",
            left: `${(hovered.x / width) * 100}%`,
            top: "50%",
            transform: `translate(${hovered.x > width * 0.65 ? "-105%" : "5%"}, -50%)`,
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          <div className="atw-momentum-tooltip__head">
            <span className="atw-tooltip-clock">
              {hovered.point.period <= 4 ? `Q${hovered.point.period}` : `OT${hovered.point.period - 4}`} {hovered.point.clock}
            </span>
            <span className="atw-tooltip-score">
              {hovered.point.awayScore} − {hovered.point.homeScore}
            </span>
          </div>
          <div className="atw-momentum-tooltip__value">
            {hovered.point.value > 0 ? (
              <span style={{ color: homeColor }}>+{hovered.point.value} {homeAbbrev}</span>
            ) : hovered.point.value < 0 ? (
              <span style={{ color: awayColor }}>+{Math.abs(hovered.point.value)} {awayAbbrev}</span>
            ) : (
              <span>Tied</span>
            )}
          </div>
          {hovered.point.description && (
            <div className="atw-momentum-tooltip__desc">
              {hovered.point.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
