import type {
  ContextBlock,
  PlayerStint,
  StatClickContext,
  TimelineEvent,
  Tone,
  VerifiedFact,
} from "@after-the-whistle/core";
import { PERSONAS, FOOT_PERSONAS, TONE_ORDER } from "@after-the-whistle/core";

export type StatPanelPayload = {
  uiHeadline: string;
  contextBlocks: ContextBlock[];
  timelinePlays: TimelineEvent[];
  relatedFacts: VerifiedFact[];
  click: StatClickContext;
  suggestedPrompt?: string;
  statValue?: string | number | null;
  tone?: Tone;
  playerStints?: PlayerStint[];
  stintsSummary?: string;
};

const KIND_LABEL: Record<string, string> = {
  scoring_run: "Run",
  scoring_drought: "Drought",
  player_slice: "Player",
  lineup_stint: "Lineup",
  goal_sequence: "Goal chain",
  domination_period: "Domination",
  momentum_swing: "Swing",
};

export function StatContextPanel({
  payload,
  tone,
  onToneChange,
  onAskChat,
}: {
  payload: StatPanelPayload;
  tone: Tone;
  onToneChange: (tone: Tone) => void;
  onAskChat: () => void;
}) {
  const { click, uiHeadline, contextBlocks, timelinePlays, relatedFacts, playerStints } =
    payload;
  const personas = click.sport === "foot" ? FOOT_PERSONAS : PERSONAS;
  const isFoot = click.sport === "foot";
  const stintsTitle = isFoot ? "On-pitch timeline" : "On-floor timeline";
  const stintsTotalLabel = isFoot ? "Total on-pitch" : "Total on-floor";
  const stintRowPrefix = isFoot ? "Segment" : "Stint";

  return (
    <section className="atw-stat-panel" aria-label="Stat breakdown">
      <header className="atw-stat-panel__head">
        <p className="atw-stat-panel__kicker">
          {click.entityName} · <strong>{click.statKey}</strong>
          {payload.statValue != null ? ` · ${payload.statValue}` : ""}
        </p>
        <h2 className="atw-stat-panel__title">{uiHeadline}</h2>
      </header>

      {relatedFacts.length > 0 && (
        <div className="atw-stat-panel__facts">
          {relatedFacts.map((f) => (
            <div key={f.id} className="atw-fact-chip">
              <span className="atw-fact-chip__label">{f.label}</span>
              <span>{f.explanation}</span>
            </div>
          ))}
        </div>
      )}

      {playerStints && playerStints.length > 0 && (
        <div className="atw-stat-panel__stints">
          <h3>{stintsTitle}</h3>
          <ul className="atw-stints-list">
            {playerStints.map((stint) => (
              <li key={stint.stintIndex} className="atw-stint-row">
                <span className="atw-stint-row__label">
                  {stintRowPrefix} {stint.stintIndex} · {stint.label}
                </span>
                <span
                  className={
                    stint.differential >= 0
                      ? "atw-stint-row__diff atw-stint-row__diff--pos"
                      : "atw-stint-row__diff atw-stint-row__diff--neg"
                  }
                >
                  {stint.differential >= 0 ? "+" : ""}
                  {stint.differential}
                </span>
              </li>
            ))}
          </ul>
          <p className="atw-stints-total">
            {stintsTotalLabel}:{" "}
            {playerStints.reduce((sum, s) => sum + s.differential, 0) >= 0 ? "+" : ""}
            {playerStints.reduce((sum, s) => sum + s.differential, 0)}
          </p>
        </div>
      )}

      {contextBlocks.length > 0 && (
        <div className="atw-stat-panel__blocks">
          {contextBlocks.map((block) => (
            <article key={block.id} className="atw-context-card">
              <span className="atw-context-card__kind">
                {KIND_LABEL[block.kind] ?? block.kind}
              </span>
              <h3>{block.label}</h3>
              <pre className="atw-context-card__body">{block.summaryText}</pre>
            </article>
          ))}
        </div>
      )}

      {timelinePlays.length > 0 && (
        <div className="atw-stat-panel__timeline">
          <h3>Play-by-play</h3>
          <ol>
            {timelinePlays.map((e) => (
              <li key={`${e.order}-${e.clock}`}>
                <span className="atw-timeline__clock">
                  {e.periodLabel} {e.clock}
                </span>
                <span className="atw-timeline__score">
                  {e.awayScore}-{e.homeScore}
                </span>
                <span>{e.description}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <footer className="atw-stat-panel__actions">
        <div className="atw-tone" role="group" aria-label="Commentary tone">
          {TONE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              data-tone={t}
              className={tone === t ? "active" : ""}
              onClick={() => onToneChange(t)}
            >
              {personas[t].label}
            </button>
          ))}
        </div>
        <button type="button" className="atw-primary-btn" onClick={onAskChat}>
          Debrief in chat
        </button>
      </footer>
    </section>
  );
}
