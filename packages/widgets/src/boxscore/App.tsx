import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  BoxLine,
  Game,
  InsightBundle,
  MomentumPoint,
  ShotPoint,
  StatColumn,
  SuggestedPrompt,
  TeamMatchStats,
  Tone,
  VisualAnalysis,
} from "@after-the-whistle/core";
import { PERSONAS } from "@after-the-whistle/core";
import { BrandHeader } from "./BrandHeader.js";
import { MomentumChart } from "./MomentumChart.js";
import { TeamRunsChart } from "./TeamRunsChart.js";
import { ShotChart, type EfficiencyProfile } from "./ShotChart.js";
import { StatContextPanel, type StatPanelPayload } from "./StatContextPanel.js";
import {
  callToolCompat,
  sendMessageCompat,
  updateModelContext,
  useOpenAiBridge,
} from "./mcp-bridge.js";
import { useOpenAiToolOutputPayload } from "./openai-globals.js";
import {
  getCachedShowGamePayload,
  subscribeShowGamePayload,
  type ShowGamePayload,
} from "./tool-payload.js";
import { WidgetDebug } from "./WidgetDebug.js";

type ToolPayload = ShowGamePayload;
type TeamSide = "home" | "away";
type AnalysisEvidenceRef = NonNullable<
  NonNullable<VisualAnalysis["points"][number]["evidence"]>
>[number];

interface TeamUi {
  id: string;
  name: string;
  abbreviation: string;
  score: number;
  side: TeamSide;
}

interface SignalCard {
  id: string;
  label: string;
  title: string;
  subline: string;
  tone: "star" | "swing" | "collapse";
  line: BoxLine;
}

export function App() {
  const openaiBridge = useOpenAiBridge();
  const globalsPayload = useOpenAiToolOutputPayload();
  const [payload, setPayload] = useState<ToolPayload | null>(() =>
    getCachedShowGamePayload()
  );
  const [tone, setTone] = useState<Tone>("analyst");
  const [loading, setLoading] = useState<string | null>(null);
  const [momentum, setMomentum] = useState<MomentumPoint[]>([]);
  const [shotChart, setShotChart] = useState<{
    points: ShotPoint[];
    name: string;
    unavailable?: boolean;
    message?: string;
    efficiencyProfile?: EfficiencyProfile;
  } | null>(null);
  const [statPanel, setStatPanel] = useState<StatPanelPayload | null>(null);

  const loadMomentum = useCallback(async (gameId: string) => {
    try {
      const result = await callToolCompat("get_momentum", { gameId });
      if (result?.points) {
        setMomentum(result.points as MomentumPoint[]);
      }
    } catch {
      setMomentum([]);
    }
  }, []);

  const applyPayload = useCallback(
    (sc: ToolPayload) => {
      setPayload(sc);
      if (sc.tone) setTone(sc.tone);
      if (sc.game?.id) {
        void loadMomentum(sc.game.id);
      }
    },
    [loadMomentum]
  );

  useEffect(() => subscribeShowGamePayload(applyPayload), [applyPayload]);

  useEffect(() => {
    if (globalsPayload?.game && Array.isArray(globalsPayload.boxLines)) {
      applyPayload(globalsPayload);
    }
  }, [globalsPayload, applyPayload]);

  const handleStatClick = useCallback(
    async (line: BoxLine, statKey: string) => {
      const game = payload?.game;
      if (!game) return;
      const col = payload.statColumns?.find((c) => c.key === statKey);
      if (col && !col.clickable) return;

      setLoading(`${line.entityName} · ${statKey}`);
      setStatPanel(null);
      setShotChart(null);
      try {
        const result = await callToolCompat("get_stat_context", {
          gameId: game.id,
          entityId: line.entityId,
          entityName: line.entityName,
          teamId: line.teamId,
          statKey,
          tone,
        });

        if (!result) return;

        const panel: StatPanelPayload = {
          uiHeadline: String(result.uiHeadline ?? ""),
          contextBlocks: (result.contextBlocks as StatPanelPayload["contextBlocks"]) ?? [],
          timelinePlays: (result.timelinePlays as StatPanelPayload["timelinePlays"]) ?? [],
          relatedFacts: (result.relatedFacts as StatPanelPayload["relatedFacts"]) ?? [],
          click: result.click as StatPanelPayload["click"],
          suggestedPrompt: String(
            (result.click as { suggestedPrompt?: string })?.suggestedPrompt ??
              `Analyze ${line.entityName} (${statKey})`
          ),
          statValue: line.stats[statKey as keyof typeof line.stats] ?? null,
          tone,
          playerStints: result.playerStints as StatPanelPayload["playerStints"],
          stintsSummary: result.stintsSummary as string | undefined,
        };
        setStatPanel(panel);

        const contextText = String(result.contextText ?? "");
        if (contextText) {
          await updateModelContext(
            `[Verified match context — ${line.entityName} / ${statKey}]\n${contextText}\n\n[Persona: ${PERSONAS[tone].label}]`
          );
        }

        if (game.sport === "basket" && ["fg", "fg3", "pts"].includes(statKey)) {
          const sc = await callToolCompat("get_shot_chart", {
            gameId: game.id,
            entityId: line.entityId,
          });
          if (sc) {
            setShotChart({
              points: (sc.points as ShotPoint[]) ?? [],
              name: line.entityName,
              unavailable: Boolean(sc.unavailable),
              message:
                typeof sc.message === "string" ? sc.message : undefined,
              efficiencyProfile: sc.efficiencyProfile as
                | EfficiencyProfile
                | undefined,
            });
          }
        }
      } finally {
        setLoading(null);
      }
    },
    [payload, tone]
  );

  const handlePromptClick = async (p: SuggestedPrompt) => {
    const game = payload?.game;
    if (!game) return;
    setLoading(p.label);
    try {
      const result = await callToolCompat("list_suggested_prompts", {
        gameId: game.id,
        tone,
      });
      const prompts = (result?.prompts as SuggestedPrompt[]) ?? [];
      const match = prompts.find((x) => x.id === p.id) ?? p;
      sendMessageCompat(match.prompt);
    } finally {
      setLoading(null);
    }
  };

  if (!payload?.game || !Array.isArray(payload.boxLines)) {
    const toolInput = openaiBridge?.toolInput as { gameId?: string } | undefined;
    const pending =
      Boolean(toolInput?.gameId) ||
      Boolean(globalsPayload?.game) ||
      Boolean(getCachedShowGamePayload()?.game);
    return (
      <div className="atw-app">
        <BrandHeader />
        <p className="atw-loading">
          {pending
            ? "Loading match data…"
            : "Waiting for match data… run show_game in chat."}
        </p>
        <WidgetDebug force />
        <p className="atw-hint">
          {openaiBridge
            ? `openai · out: ${Object.keys(openaiBridge.toolOutput ?? {}).join(",") || "—"}`
            : "window.openai absent — rebuild widget + refresh connector"}
        </p>
      </div>
    );
  }

  const {
    game,
    boxLines,
    statColumns = [],
    suggestedPrompts = [],
    insightBundle,
    teamStats,
    scoringRuns,
    visualAnalysis,
  } = payload;
  const columns = statColumns.length > 0 ? statColumns : defaultColumns(game.sport);
  const homeTeam = normalizeTeam(game, "home");
  const awayTeam = normalizeTeam(game, "away");
  const teamsById = new Map([
    [homeTeam.id, homeTeam],
    [awayTeam.id, awayTeam],
  ]);
  const teamBoxes = buildTeamBoxes(game, boxLines, homeTeam, awayTeam);
  const signals = buildSignals(game, boxLines);
  const promptChips = buildPromptChips(
    suggestedPrompts,
    signals,
    homeTeam,
    awayTeam
  );
  const sportLabel = game.league ?? (game.sport === "basket" ? "NBA" : "Football");
  const scoreLine = (
    <>
      {awayTeam.abbreviation} {awayTeam.score} @ {homeTeam.abbreviation}{" "}
      {homeTeam.score}
    </>
  );
  const isStandaloneAnalysis =
    visualAnalysis?.viewMode === "standalone_analysis";

  if (visualAnalysis && isStandaloneAnalysis) {
    return (
      <div className={`atw-app atw-app--${game.sport} atw-app--standalone`}>
        <BrandHeader sport={sportLabel} />

        <StandaloneAnalysisView
          analysis={visualAnalysis}
          game={game}
          boxLines={boxLines}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={loading}
          onStatClick={handleStatClick}
        />

        <details className="atw-secondary-boxscore">
          <summary>
            <span>View full boxscore</span>
            <strong>{awayTeam.abbreviation} @ {homeTeam.abbreviation}</strong>
          </summary>
          <div className="atw-boxscores">
            {teamBoxes.map(({ team, lines }) => (
              <TeamBoxScore
                key={team.id}
                team={team}
                lines={lines}
                columns={columns}
                loading={loading}
                onStatClick={handleStatClick}
                teamName={teamsById.get(team.id)?.name ?? team.name}
              />
            ))}
          </div>
        </details>

        {teamStats && game.sport === "foot" && (
          <TeamMatchStatsPanel
            stats={teamStats}
            home={homeTeam}
            away={awayTeam}
          />
        )}

        {game.sport === "basket" && scoringRuns && scoringRuns.length > 0 && (
          <TeamRunsChart
            runs={scoringRuns}
            homeTeamId={homeTeam.id}
            awayTeamId={awayTeam.id}
            homeAbbrev={homeTeam.abbreviation}
            awayAbbrev={awayTeam.abbreviation}
          />
        )}

        {statPanel && (
          <StatContextPanel
            payload={statPanel}
            tone={tone}
            onToneChange={setTone}
            onAskChat={() => {
              if (statPanel.suggestedPrompt) {
                sendMessageCompat(statPanel.suggestedPrompt);
              }
            }}
          />
        )}

        {loading && <p className="atw-loading">Loading… {loading}</p>}

        {momentum.length > 0 && (
          <MomentumChart
            points={momentum}
            homeAbbrev={homeTeam.abbreviation}
            awayAbbrev={awayTeam.abbreviation}
          />
        )}

        {shotChart && (
          <ShotChart
            points={shotChart.points}
            playerName={shotChart.name}
            unavailable={shotChart.unavailable}
            message={shotChart.message}
            efficiencyProfile={shotChart.efficiencyProfile}
          />
        )}

        {insightBundle && (
          <VerifiedFactsPanel insightBundle={insightBundle} />
        )}

        {promptChips.length > 0 && (
          <div className="atw-prompts">
            {promptChips.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePromptClick(p)}
                disabled={loading !== null}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`atw-app atw-app--${game.sport}`}>
      <BrandHeader sport={sportLabel} />

      <GameStoryCard
        game={game}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        scoreLine={scoreLine}
        signals={signals}
      />

      {visualAnalysis && (
        <VisualAnalysisPanel analysis={visualAnalysis} game={game} />
      )}

      {teamStats && game.sport === "foot" && (
        <TeamMatchStatsPanel
          stats={teamStats}
          home={homeTeam}
          away={awayTeam}
        />
      )}

      {signals.length > 0 && (
        <section className="atw-signal-grid" aria-label="Top signals">
          {signals.map((signal) => (
            <button
              key={signal.id}
              type="button"
              className={`atw-signal-card atw-signal-card--${signal.tone}`}
              onClick={() => handleStatClick(signal.line, primarySignalStat(game, signal))}
              disabled={loading !== null}
            >
              <span>{signal.label}</span>
              <strong>{signal.title}</strong>
              <small>{signal.subline}</small>
            </button>
          ))}
        </section>
      )}

      <section className="atw-boxscores" aria-label="Box scores">
        {teamBoxes.map(({ team, lines }) => (
          <TeamBoxScore
            key={team.id}
            team={team}
            lines={lines}
            columns={columns}
            loading={loading}
            onStatClick={handleStatClick}
            teamName={teamsById.get(team.id)?.name ?? team.name}
          />
        ))}
      </section>

      {game.sport === "basket" && scoringRuns && scoringRuns.length > 0 && (
        <TeamRunsChart
          runs={scoringRuns}
          homeTeamId={homeTeam.id}
          awayTeamId={awayTeam.id}
          homeAbbrev={homeTeam.abbreviation}
          awayAbbrev={awayTeam.abbreviation}
        />
      )}

      {statPanel && (
        <StatContextPanel
          payload={statPanel}
          tone={tone}
          onToneChange={setTone}
          onAskChat={() => {
            if (statPanel.suggestedPrompt) {
              sendMessageCompat(statPanel.suggestedPrompt);
            }
          }}
        />
      )}

      {loading && <p className="atw-loading">Loading… {loading}</p>}

      {momentum.length > 0 && (
        <MomentumChart
          points={momentum}
          homeAbbrev={homeTeam.abbreviation}
          awayAbbrev={awayTeam.abbreviation}
        />
      )}

      {shotChart && (
        <ShotChart
          points={shotChart.points}
          playerName={shotChart.name}
          unavailable={shotChart.unavailable}
          message={shotChart.message}
          efficiencyProfile={shotChart.efficiencyProfile}
        />
      )}

      {insightBundle && (
        <VerifiedFactsPanel insightBundle={insightBundle} />
      )}

      {promptChips.length > 0 && (
        <div className="atw-prompts">
          {promptChips.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePromptClick(p)}
              disabled={loading !== null}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VerifiedFactsPanel({ insightBundle }: { insightBundle: InsightBundle }) {
  const facts = dedupeBy(
    insightBundle.facts,
    (fact) => fact.id || `${fact.label}:${fact.value}`
  ).slice(0, 6);
  const insights = dedupeBy(
    insightBundle.insights,
    (insight) => insight.id || insight.title
  ).slice(0, 4);

  if (facts.length === 0 && insights.length === 0) return null;

  return (
    <details className="atw-facts" aria-label="Verified facts">
      <summary>
        <span>Verified facts</span>
        <strong>{insightBundle.facts.length + insightBundle.insights.length} signals</strong>
      </summary>
      {facts.length > 0 && (
        <ul>
          {facts.map((fact) => (
            <li key={fact.id}>
              <strong>{fact.label}</strong>
              <span>{fact.explanation}</span>
            </li>
          ))}
        </ul>
      )}
      {insights.length > 0 && (
        <div className="atw-insights">
          {insights.map((insight) => (
            <span key={insight.id}>{insight.title}</span>
          ))}
        </div>
      )}
    </details>
  );
}

function StandaloneAnalysisView({
  analysis,
  game,
  boxLines,
  homeTeam,
  awayTeam,
  loading,
  onStatClick,
}: {
  analysis: VisualAnalysis;
  game: Game;
  boxLines: BoxLine[];
  homeTeam: TeamUi;
  awayTeam: TeamUi;
  loading: string | null;
  onStatClick: (line: BoxLine, statKey: string) => void;
}) {
  const focusLine = findFocusLine(analysis, boxLines);
  const focusTeam =
    focusLine?.teamId === homeTeam.id
      ? homeTeam
      : focusLine?.teamId === awayTeam.id
        ? awayTeam
        : null;
  const points = analysis.points.slice(0, 6);
  const timeline = analysis.timeline?.slice(0, 6) ?? [];
  const evidenceRefs = collectAnalysisEvidence(analysis).slice(0, 8);
  const confidence =
    typeof analysis.confidence === "number"
      ? clampUiPercent(analysis.confidence)
      : null;
  const template = analysis.analysisTemplate ?? "match_recap";

  return (
    <section
      className={`atw-standalone-analysis atw-standalone-analysis--${template}`}
      aria-label="Standalone visual analysis"
    >
      <div className="atw-standalone-hero">
        <div className="atw-standalone-hero__copy">
          <span className="atw-standalone-kicker">
            {analysisTemplateLabel(template)}
          </span>
          <h2>{analysis.title}</h2>
          <p className="atw-standalone-score">
            {awayTeam.abbreviation} {awayTeam.score} @ {homeTeam.abbreviation}{" "}
            {homeTeam.score}
          </p>
          {analysis.summary ? (
            <p className="atw-standalone-summary">{analysis.summary}</p>
          ) : null}
        </div>

        {focusLine ? (
          <article className="atw-player-focus-card">
            <div className="atw-player-focus-card__top">
              <div>
                <span>{focusTeam?.abbreviation ?? "Focus"}</span>
                <h3>{focusLine.entityName}</h3>
              </div>
              {confidence !== null ? (
                <strong>{confidence}% verified</strong>
              ) : null}
            </div>
            <p>{lineSummary(game, focusLine)}</p>
            <div className="atw-player-focus-card__stats" aria-label="Key stats">
              {standaloneStatKeys(game).map((key) => {
                const value = focusLine.stats[key as keyof BoxLine["stats"]];
                if (value === undefined || value === null || value === "") {
                  return null;
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onStatClick(focusLine, key)}
                    disabled={loading !== null}
                  >
                    <span>{standaloneStatLabel(key)}</span>
                    <strong>{displayStatValue(key, value)}</strong>
                  </button>
                );
              })}
            </div>
          </article>
        ) : null}
      </div>

      <article className="atw-standalone-thesis">
        <span>Main thesis</span>
        <p>{analysis.thesis}</p>
      </article>

      {points.length > 0 ? (
        <div className="atw-standalone-section">
          <div className="atw-standalone-section__head">
            <span>Impact cards</span>
            <strong>{points.length}</strong>
          </div>
          <div className="atw-standalone-impact-grid">
            {points.map((point) => (
              <article
                key={point.id}
                className={`atw-standalone-impact atw-standalone-impact--${point.tone ?? "proof"}`}
              >
                <div>
                  <span>{point.label}</span>
                  {point.value ? <strong>{point.value}</strong> : null}
                </div>
                <p>{point.detail}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="atw-standalone-proof-grid">
        {timeline.length > 0 ? (
          <section className="atw-standalone-section atw-standalone-timeline">
            <div className="atw-standalone-section__head">
              <span>{focusLine ? `${shortPlayerName(focusLine.entityName)} timeline` : "Timeline"}</span>
              <strong>{timeline.length}</strong>
            </div>
            <ol>
              {timeline.map((item) => (
                <li key={item.id}>
                  <span>{periodText(game, item.period)}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="atw-standalone-section atw-standalone-evidence">
          <div className="atw-standalone-section__head">
            <span>Verified proof</span>
            <strong>{evidenceRefs.length || "Core"}</strong>
          </div>
          {evidenceRefs.length > 0 ? (
            <div>
              {evidenceRefs.map((ref) => (
                <span key={`${ref.type}:${ref.id}`}>{ref.label}</span>
              ))}
            </div>
          ) : (
            <p>Boxscore, runs, play-by-play and verified context stay attached to this view.</p>
          )}
        </section>
      </div>

      {analysis.verdict ? (
        <p className="atw-standalone-verdict">{analysis.verdict}</p>
      ) : null}
    </section>
  );
}

function VisualAnalysisPanel({
  analysis,
  game,
}: {
  analysis: VisualAnalysis;
  game: Game;
}) {
  const points = analysis.points.slice(0, 6);
  const timeline = analysis.timeline?.slice(0, 6) ?? [];
  const confidence =
    typeof analysis.confidence === "number"
      ? clampUiPercent(analysis.confidence)
      : null;

  return (
    <section className="atw-analysis" aria-label="Illustrated analysis">
      <div className="atw-analysis__header">
        <div>
          <span className="atw-analysis__kicker">
            {game.sport === "basket" ? "Analyst board" : "Tactical board"}
          </span>
          <h3>{analysis.title}</h3>
        </div>
        {confidence !== null && (
          <div className="atw-analysis__confidence" aria-label={`Confidence ${confidence}%`}>
            <span>{confidence}%</span>
            <i>
              <b style={{ width: `${confidence}%` }} />
            </i>
          </div>
        )}
      </div>

      <p className="atw-analysis__thesis">{analysis.thesis}</p>
      {analysis.summary && (
        <p className="atw-analysis__summary">{analysis.summary}</p>
      )}

      {points.length > 0 && (
        <div className="atw-analysis__points">
          {points.map((point) => {
            const weight =
              typeof point.weight === "number" ? clampUiPercent(point.weight) : 64;
            return (
              <article
                key={point.id}
                className={`atw-analysis-point atw-analysis-point--${point.tone ?? "proof"}`}
              >
                <div className="atw-analysis-point__top">
                  <span>{point.label}</span>
                  {point.value && <strong>{point.value}</strong>}
                </div>
                <p>{point.detail}</p>
                <div className="atw-analysis-point__bar" aria-hidden="true">
                  <i style={{ width: `${weight}%` }} />
                </div>
                {point.evidence && point.evidence.length > 0 && (
                  <div className="atw-analysis-evidence">
                    {point.evidence.slice(0, 2).map((ref) => (
                      <span key={`${point.id}:${ref.type}:${ref.id}`}>
                        {ref.label}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {timeline.length > 0 && (
        <ol className="atw-analysis-timeline" aria-label="Analysis timeline">
          {timeline.map((item) => (
            <li key={item.id}>
              <span className="atw-analysis-timeline__dot" aria-hidden="true" />
              <div>
                <strong>
                  {periodText(game, item.period)}
                  {item.label}
                </strong>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {analysis.verdict && (
        <p className="atw-analysis__verdict">{analysis.verdict}</p>
      )}
    </section>
  );
}

function TeamMatchStatsPanel({
  stats,
  home,
  away,
}: {
  stats: TeamMatchStats;
  home: TeamUi;
  away: TeamUi;
}) {
  const rows: Array<{ label: string; home: string; away: string }> = [];
  const push = (label: string, pair: [number, number] | undefined, fmt = (n: number) => String(n)) => {
    if (!pair) return;
    rows.push({ label, home: fmt(pair[0]), away: fmt(pair[1]) });
  };

  push("Possession", stats.possession, (n) => `${n}%`);
  push("Shots", stats.shots);
  push("On target", stats.shotsOn);
  push("xG", stats.xg, (n) => n.toFixed(1));
  push("Passes", stats.passes);
  if (stats.passAccuracy) {
    rows.push({
      label: "Pass accuracy",
      home: `${stats.passAccuracy[0]}%`,
      away: `${stats.passAccuracy[1]}%`,
    });
  }
  push("Corners", stats.corners);
  push("Fouls", stats.fouls);
  push("Yellow cards", stats.yellowCards);

  if (rows.length === 0) return null;

  return (
    <section className="atw-team-stats" aria-label="Team match statistics">
      <h4>Match stats</h4>
      <div className="atw-team-stats__head">
        <span>{home.abbreviation}</span>
        <span>{away.abbreviation}</span>
      </div>
      <dl className="atw-team-stats__grid">
        {rows.map((row) => (
          <div key={row.label} className="atw-team-stats__row">
            <dt>{row.label}</dt>
            <dd className="atw-team-stats__home">{row.home}</dd>
            <dd className="atw-team-stats__away">{row.away}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function clampUiPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function findFocusLine(analysis: VisualAnalysis, boxLines: BoxLine[]): BoxLine | null {
  const focusIds = analysis.focusEntityIds ?? [];
  for (const id of focusIds) {
    const line = boxLines.find((candidate) => candidate.entityId === id);
    if (line) return line;
  }
  return null;
}

function collectAnalysisEvidence(analysis: VisualAnalysis): AnalysisEvidenceRef[] {
  const seen = new Set<string>();
  const refs: AnalysisEvidenceRef[] = [];
  const add = (ref: AnalysisEvidenceRef) => {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  for (const point of analysis.points) {
    for (const ref of point.evidence ?? []) add(ref);
  }
  for (const item of analysis.timeline ?? []) {
    for (const ref of item.evidence ?? []) add(ref);
  }

  return refs;
}

function analysisTemplateLabel(
  template: NonNullable<VisualAnalysis["analysisTemplate"]>
) {
  if (template === "player_focus") return "Player focus";
  if (template === "team_focus") return "Team focus";
  if (template === "turning_point") return "Turning point";
  if (template === "debate_board") return "Debate board";
  return "Match recap";
}

function standaloneStatKeys(game: Game): string[] {
  if (game.sport === "foot") {
    return ["goals", "assists", "shots", "xg", "rating", "minutes"];
  }
  return ["pts", "reb", "ast", "fg3", "plusMinus", "min"];
}

function standaloneStatLabel(key: string) {
  if (key === "plusMinus") return "+/-";
  if (key === "fg3") return "3PT";
  return key.toUpperCase();
}

function displayStatValue(key: string, value: string | number) {
  if (key === "plusMinus") return plusMinusText(value);
  if (key === "fg3" || key === "fg") return String(value).replace("-", "/");
  return String(value);
}

function periodText(game: Game, period: number | undefined) {
  if (!period) return "";
  return `${game.sport === "basket" ? "Q" : "P"}${period} · `;
}

function GameStoryCard({
  game,
  homeTeam,
  awayTeam,
  scoreLine,
  signals,
}: {
  game: Game;
  homeTeam: TeamUi;
  awayTeam: TeamUi;
  scoreLine: ReactNode;
  signals: SignalCard[];
}) {
  const winner = homeTeam.score >= awayTeam.score ? homeTeam : awayTeam;
  const loser = winner.id === homeTeam.id ? awayTeam : homeTeam;
  const margin = Math.abs(homeTeam.score - awayTeam.score);
  const headline =
    game.sport === "foot"
      ? margin >= 3
        ? `${teamShortName(winner)} dominate. ${teamShortName(loser)} never threatened.`
        : `${teamShortName(winner)} edge it. ${teamShortName(loser)} fall short.`
      : margin >= 15
        ? `${teamShortName(winner)} force the issue. ${teamShortName(loser)} lose the thread.`
        : `${teamShortName(winner)} close it. ${teamShortName(loser)} run out of answers.`;

  return (
    <section className="atw-story-card" aria-label="Game story">
      <div className="atw-story-card__meta">
        <span>{game.status.toUpperCase()}</span>
        <span>{game.league ?? (game.sport === "basket" ? "NBA" : "Football")}</span>
      </div>
      <h2>{scoreLine}</h2>
      <p className="atw-story-card__headline">{headline}</p>
      <p className="atw-story-card__body">{buildStorySentence(signals)}</p>
    </section>
  );
}

function TeamBoxScore({
  team,
  teamName,
  lines,
  columns,
  loading,
  onStatClick,
}: {
  team: TeamUi;
  teamName: string;
  lines: BoxLine[];
  columns: StatColumn[];
  loading: string | null;
  onStatClick: (line: BoxLine, statKey: string) => void;
}) {
  if (lines.length === 0) return null;

  return (
    <section className="atw-team-box">
      <div className="atw-team-box__header">
        <div>
          <h3>{teamShortName(team)} box score</h3>
          <p>{teamName}</p>
        </div>
        <strong>{team.score}</strong>
      </div>
      <div className="atw-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              {columns.map((c) => (
                <th key={c.key}>{c.shortLabel}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.entityId}>
                <td>
                  <strong>{line.entityName}</strong>
                </td>
                {columns.map((col) => {
                  const val = line.stats[col.key];
                  const display =
                    val === undefined || val === null ? "—" : String(val);
                  return (
                    <td key={col.key}>
                      {col.clickable ? (
                        <button
                          type="button"
                          className="stat-btn"
                          onClick={() => onStatClick(line, col.key)}
                          disabled={loading !== null}
                          aria-label={`Ask about ${line.entityName} ${col.label}`}
                        >
                          {display}
                        </button>
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildTeamBoxes(
  game: Game,
  boxLines: BoxLine[],
  homeTeam: TeamUi,
  awayTeam: TeamUi
) {
  const order =
    homeTeam.score >= awayTeam.score
      ? [homeTeam, awayTeam]
      : [awayTeam, homeTeam];

  return order.map((team) => ({
    team,
    lines: boxLines
      .filter((line) => line.teamId === team.id)
      .sort((a, b) => impactScore(game, b) - impactScore(game, a)),
  }));
}

function buildSignals(game: Game, boxLines: BoxLine[]): SignalCard[] {
  if (boxLines.length === 0) return [];

  const sortedByPoints = [...boxLines].sort(
    (a, b) => numberStat(b, "pts") - numberStat(a, "pts")
  );
  const star = sortedByPoints[0];
  const swing = [...boxLines]
    .filter((line) => line.entityId !== star?.entityId)
    .sort((a, b) => numberStat(b, "plusMinus") - numberStat(a, "plusMinus"))[0];
  const collapse = [...boxLines]
    .filter((line) => line.entityId !== star?.entityId && line.entityId !== swing?.entityId)
    .sort((a, b) => numberStat(a, "plusMinus") - numberStat(b, "plusMinus"))[0];

  return [
    star && {
      id: `signal_star_${star.entityId}`,
      label: "Star signal",
      title: star.entityName,
      subline: lineSummary(game, star),
      tone: "star" as const,
      line: star,
    },
    swing && {
      id: `signal_swing_${swing.entityId}`,
      label: "Swing signal",
      title: swing.entityName,
      subline: lineSummary(game, swing),
      tone: "swing" as const,
      line: swing,
    },
    collapse && {
      id: `signal_collapse_${collapse.entityId}`,
      label: "Collapse signal",
      title: collapse.entityName,
      subline: lineSummary(game, collapse),
      tone: "collapse" as const,
      line: collapse,
    },
  ].filter(Boolean) as SignalCard[];
}

function buildPromptChips(
  prompts: SuggestedPrompt[],
  signals: SignalCard[],
  homeTeam: TeamUi,
  awayTeam: TeamUi
): SuggestedPrompt[] {
  const cleaned = dedupePrompts(prompts).map((prompt) => ({
    ...prompt,
    label: editorialPromptLabel(prompt, signals),
  }));

  const hiddenImpactPrompt: SuggestedPrompt = {
    id: "prompt_hidden_impact",
    label: "Who was the hidden impact player?",
    prompt: `Find the hidden impact player in ${awayTeam.name} @ ${homeTeam.name} (${awayTeam.score}-${homeTeam.score}) using only verified box score and context facts.`,
    contextBlockIds: [],
  };

  return dedupeBy(
    [...cleaned.slice(0, 4), hiddenImpactPrompt],
    (p) => normalizePromptLabel(p.label)
  );
}

function editorialPromptLabel(prompt: SuggestedPrompt, signals: SignalCard[]) {
  const impactName = prompt.label.match(/^(.+): verified impact$/i)?.[1];
  if (!impactName) return prompt.label;

  const signal = signals.find((s) => s.title === impactName);
  if (signal?.tone === "collapse") {
    const pm = plusMinusText(signal.line.stats.plusMinus);
    return pm ? `Why did ${shortPlayerName(impactName)} finish ${pm}?` : `Why did ${shortPlayerName(impactName)} struggle?`;
  }
  if (signal?.tone === "swing") {
    return `How did ${shortPlayerName(impactName)} swing the game?`;
  }
  if (signal?.tone === "star") {
    return `Did ${shortPlayerName(impactName)} dominate or stabilize?`;
  }
  return `What was ${shortPlayerName(impactName)}'s real impact?`;
}

function buildStorySentence(signals: SignalCard[]) {
  const [star, swing, collapse] = signals;
  const parts = [];
  if (star) parts.push(`${shortPlayerName(star.title)} leads with ${lineSummaryText(star.line)}`);
  if (swing) parts.push(`${shortPlayerName(swing.title)} posts ${lineSummaryText(swing.line)}`);
  if (collapse) parts.push(`while ${shortPlayerName(collapse.title)} finishes ${lineSummaryText(collapse.line)}`);
  return parts.length > 0
    ? `${parts.join(", ")}.`
    : "The box score is loaded and ready for stat-by-stat context.";
}

function lineSummary(game: Game, line: BoxLine) {
  if (game.sport === "foot") {
    return [
      statText(line, "goals", "goals"),
      statText(line, "assists", "ast"),
      statText(line, "xg", "xG"),
      statText(line, "rating", "rating"),
    ].filter(Boolean).join(" · ");
  }
  return lineSummaryText(line);
}

function lineSummaryText(line: BoxLine) {
  const shotProfile = meaningfulShotLine(line.stats.fg3)
    ? statText(line, "fg3", "3PT", true)
    : statText(line, "fg", "FG", true);
  return [
    statText(line, "pts", "pts"),
    statText(line, "reb", "reb"),
    statText(line, "ast", "ast"),
    shotProfile,
    plusMinusText(line.stats.plusMinus),
  ].filter(Boolean).join(" · ");
}

function statText(line: BoxLine, key: keyof BoxLine["stats"], label: string, shotLine = false) {
  const value = line.stats[key];
  if (value === undefined || value === null || value === "") return "";
  const display = shotLine ? String(value).replace("-", "/") : String(value);
  return `${display} ${label}`;
}

function primarySignalStat(game: Game, signal: SignalCard) {
  if (game.sport === "foot") {
    if (signal.tone === "star") return "goals";
    if (signal.tone === "swing") return "rating";
    return "rating";
  }
  if (signal.tone === "collapse") return "plusMinus";
  if (signal.tone === "swing") return "plusMinus";
  return "pts";
}

function impactScore(game: Game, line: BoxLine) {
  if (game.sport === "foot") {
    return (
      numberStat(line, "minutes") * 0.5 +
      numberStat(line, "rating") * 8 +
      numberStat(line, "goals") * 12 +
      numberStat(line, "assists") * 8 +
      numberStat(line, "xg") * 6
    );
  }
  return (
    numberStat(line, "min") * 0.6 +
    numberStat(line, "pts") * 3 +
    numberStat(line, "reb") * 0.8 +
    numberStat(line, "ast") * 1.2 +
    Math.abs(numberStat(line, "plusMinus")) * 1.6
  );
}

function numberStat(line: BoxLine, key: keyof BoxLine["stats"]) {
  const raw = line.stats[key];
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const parsed = Number(raw.replace("+", "").split(":")[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function plusMinusText(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace("+", ""));
  if (!Number.isFinite(n)) return String(value);
  return n > 0 ? `+${n}` : String(n);
}

function normalizeTeam(game: Game, side: TeamSide): TeamUi {
  const team = side === "home" ? game.homeTeam : game.awayTeam;
  const score = side === "home" ? game.homeScore : game.awayScore;
  const mappedName = game.sport === "basket" ? NBA_TEAM_NAMES[team.abbreviation] : undefined;
  const rawName = team.name.trim();
  const nameLooksInternal =
    /\b(home|away)\b/i.test(rawName) ||
    rawName.toUpperCase() === team.abbreviation.toUpperCase();

  return {
    id: team.id,
    name: nameLooksInternal && mappedName ? mappedName : mappedName ?? rawName,
    abbreviation: team.abbreviation,
    score,
    side,
  };
}

function teamShortName(team: TeamUi) {
  const parts = team.name.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || team.abbreviation;
}

function shortPlayerName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function normalizePromptLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeBy<T>(items: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupePrompts(prompts: SuggestedPrompt[]) {
  const ids = new Set<string>();
  const labels = new Set<string>();
  const out: SuggestedPrompt[] = [];

  for (const prompt of prompts) {
    const id = prompt.id.toLowerCase();
    const label = normalizePromptLabel(prompt.label);
    if (ids.has(id) || labels.has(label)) continue;
    ids.add(id);
    labels.add(label);
    out.push(prompt);
  }

  return out;
}

function meaningfulShotLine(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return false;
  return String(value) !== "0-0" && String(value) !== "0/0";
}

const NBA_TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

function defaultColumns(sport: Game["sport"]): StatColumn[] {
  if (sport === "foot") {
    return [
      { key: "goals", label: "Goals", shortLabel: "G", clickable: true },
      { key: "assists", label: "Assists", shortLabel: "A", clickable: true },
      { key: "shots", label: "Shots", shortLabel: "SH", clickable: true },
      { key: "shotsOn", label: "On target", shortLabel: "SOT", clickable: true },
      { key: "xg", label: "xG", shortLabel: "xG", clickable: true },
      { key: "passes", label: "Passes", shortLabel: "PAS", clickable: true },
      { key: "fouls", label: "Fouls", shortLabel: "F", clickable: true },
      { key: "yellowCards", label: "Yellow", shortLabel: "YC", clickable: true },
      { key: "rating", label: "Rating", shortLabel: "RTG", clickable: true },
      { key: "minutes", label: "Min", shortLabel: "MIN", clickable: true },
    ];
  }
  return [
    { key: "pts", label: "PTS", shortLabel: "PTS", clickable: true },
    { key: "reb", label: "REB", shortLabel: "REB", clickable: true },
    { key: "ast", label: "AST", shortLabel: "AST", clickable: true },
    { key: "fg", label: "FG", shortLabel: "FG", clickable: true },
    { key: "fg3", label: "3PT", shortLabel: "3PT", clickable: true },
    { key: "ft", label: "FT", shortLabel: "FT", clickable: true },
    { key: "stl", label: "STL", shortLabel: "STL", clickable: true },
    { key: "blk", label: "BLK", shortLabel: "BLK", clickable: true },
    { key: "tov", label: "TO", shortLabel: "TO", clickable: true },
    { key: "pf", label: "PF", shortLabel: "PF", clickable: true },
    { key: "plusMinus", label: "+/-", shortLabel: "+/-", clickable: true },
    { key: "min", label: "MIN", shortLabel: "MIN", clickable: true },
  ];
}
