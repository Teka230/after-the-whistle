import type {
  BoxLine,
  Game,
  InsightBundle,
  StatColumn,
  SuggestedPrompt,
  TeamMatchStats,
  Tone,
  ScoringRunView,
  VisualAnalysis,
} from "@after-the-whistle/core";
import {
  callTool,
  callToolCompat,
  ensureMcpUiBridge,
  subscribeToolResult,
  useOpenAiBridge,
} from "./mcp-bridge.js";
import { logHydrationDebug } from "./hydration-debug.js";

export interface ShowGamePayload {
  game?: Game;
  boxLines?: BoxLine[];
  statColumns?: StatColumn[];
  suggestedPrompts?: SuggestedPrompt[];
  insightBundle?: InsightBundle;
  teamStats?: TeamMatchStats | null;
  scoringRuns?: ScoringRunView[] | null;
  scoringRunsTimelineMax?: number;
  visualAnalysis?: VisualAnalysis;
  tone?: Tone;
  error?: string;
}

type OpenAiBridge = {
  toolOutput?: unknown;
  toolInput?: unknown;
  toolResponseMetadata?: unknown;
};

let cachedPayload: ShowGamePayload | null = null;

export function getCachedShowGamePayload(): ShowGamePayload | null {
  return cachedPayload ?? getOpenAiToolOutput();
}

function isShowGameShape(o: Record<string, unknown>): boolean {
  return Boolean(o.game) && Array.isArray(o.boxLines);
}

/** Unwrap ChatGPT / MCP tool result shapes into show_game payload. */
export function normalizeShowGamePayload(raw: unknown, depth = 0): ShowGamePayload | null {
  if (raw == null || depth > 8) return null;
  if (typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  if (o.error && !o.game) return null;

  if (isShowGameShape(o)) {
    return o as ShowGamePayload;
  }

  const nested: unknown[] = [
    o.structuredContent,
    o.showGame,
    o.data,
    o.payload,
    o.result,
    o.mcp_tool_result,
    o.mcpToolResult,
    o.call_tool_result,
    o.callToolResult,
  ];

  const meta = o._meta;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    nested.push(m.showGame, m.structuredContent);
  }

  const trm = o.toolResponseMetadata;
  if (trm && typeof trm === "object") {
    nested.push(trm);
  }

  for (const item of nested) {
    if (item == null || item === raw) continue;
    if (typeof item === "object") {
      const inner = item as Record<string, unknown>;
      if (inner.structuredContent) {
        const fromSc = normalizeShowGamePayload(inner.structuredContent, depth + 1);
        if (fromSc?.game) return fromSc;
      }
      const hit = normalizeShowGamePayload(item, depth + 1);
      if (hit?.game) return hit;
    }
  }

  return null;
}

function extractFromToolResultParams(
  params: Record<string, unknown> | undefined
): unknown {
  if (!params) return null;
  if (params.structuredContent) return params.structuredContent;
  if (params.showGame) return params.showGame;
  const meta = params._meta;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    if (m.showGame) return m.showGame;
    if (m.game && m.boxLines) return m;
  }
  return params;
}

export function readToolInput(): Record<string, unknown> | null {
  const input = useOpenAiBridge()?.toolInput;
  if (input && typeof input === "object") {
    return input as Record<string, unknown>;
  }
  return null;
}

export function getOpenAiToolOutput(): ShowGamePayload | null {
  const openai = useOpenAiBridge() as OpenAiBridge | undefined;
  if (!openai) return null;

  const candidates = [
    openai.toolOutput,
    openai.toolResponseMetadata,
    (openai.toolOutput as Record<string, unknown> | undefined)?.result,
    (openai.toolResponseMetadata as Record<string, unknown> | undefined)
      ?.mcp_tool_result,
    (openai.toolResponseMetadata as Record<string, unknown> | undefined)
      ?.call_tool_result,
    (openai.toolResponseMetadata as Record<string, unknown> | undefined)
      ?.mcpToolResult,
    (openai.toolResponseMetadata as Record<string, unknown> | undefined)
      ?.callToolResult,
  ];

  for (const raw of candidates) {
    const payload = normalizeShowGamePayload(raw);
    if (payload?.game) return payload;
  }

  return null;
}

export const OPENAI_SET_GLOBALS = "openai:set_globals";

/** Active fetch — does not rely on passive toolOutput alone. */
export async function fetchShowGameViaToolCall(
  args?: Record<string, unknown>
): Promise<ShowGamePayload | null> {
  await ensureMcpUiBridge();
  const input = args ?? readToolInput();
  const callArgs: Record<string, unknown> = { ...input };
  if (!callArgs.gameId && !callArgs.query) {
    const cached = getCachedShowGamePayload();
    if (cached?.game?.id) callArgs.gameId = cached.game.id;
  }
  if (!callArgs.gameId && !callArgs.query) return null;

  try {
    const openai = useOpenAiBridge();
    const raw = openai?.callTool
      ? await callToolCompat("show_game", callArgs)
      : await callTool("show_game", callArgs);
    return normalizeShowGamePayload(raw);
  } catch (err) {
    console.warn("[after-the-whistle] fetchShowGameViaToolCall failed", err);
    return null;
  }
}

function applyIfValid(
  handler: (payload: ShowGamePayload) => void,
  raw: unknown
): boolean {
  const payload = normalizeShowGamePayload(raw);
  if (payload?.game && Array.isArray(payload.boxLines)) {
    cachedPayload = payload;
    handler(payload);
    return true;
  }
  return false;
}

/**
 * Subscribe to all channels that hydrate show_game data into the widget.
 */
export function subscribeShowGamePayload(
  handler: (payload: ShowGamePayload) => void
): () => void {
  const tryApply = (raw: unknown, source: string) => {
    if (applyIfValid(handler, raw)) {
      console.log(`[after-the-whistle] hydrated via ${source}`);
    }
  };

  const bootstrap = async () => {
    logHydrationDebug();

    const immediate = getOpenAiToolOutput();
    if (immediate) tryApply(immediate, "sync toolOutput");

    const cached = getCachedShowGamePayload();
    if (cached?.game) tryApply(cached, "module cache");

    const input = readToolInput();
    const queryParams = new URLSearchParams(window.location.search);
    const urlGameId = queryParams.get("gameId") || queryParams.get("game_id");
    const urlQuery = queryParams.get("query") || queryParams.get("q");
    const urlSport = queryParams.get("sport") || queryParams.get("s");

    const mergedInput = {
      ...input,
      ...(urlGameId ? { gameId: urlGameId } : {}),
      ...(urlQuery ? { query: urlQuery } : {}),
      ...(urlSport ? { sport: urlSport } : {}),
    };

    if (mergedInput.gameId || mergedInput.query) {
      const pulled = await fetchShowGameViaToolCall(mergedInput);
      if (pulled) tryApply(pulled, "tools/call show_game");
    }
  };

  void bootstrap();

  const onSetGlobals = (event: Event) => {
    const detail = (event as CustomEvent<{ globals?: OpenAiBridge }>).detail;
    const globals = detail?.globals;
    tryApply(globals?.toolOutput, "openai:set_globals toolOutput");
    tryApply(globals?.toolResponseMetadata, "openai:set_globals toolResponseMetadata");
    const fresh = getOpenAiToolOutput();
    if (fresh) tryApply(fresh, "openai:set_globals normalized");
  };
  window.addEventListener(OPENAI_SET_GLOBALS, onSetGlobals, { passive: true });

  const unsubRpc = subscribeToolResult((sc) => {
    tryApply(sc, "ui/notifications/tool-result (structuredContent)");
  });

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const msg = event.data as {
      jsonrpc?: string;
      method?: string;
      params?: Record<string, unknown>;
    };
    if (msg?.jsonrpc !== "2.0" || !msg.method) return;

    if (msg.method === "ui/notifications/tool-result") {
      tryApply(
        extractFromToolResultParams(msg.params),
        "ui/notifications/tool-result"
      );
      return;
    }

    if (msg.method === "ui/notifications/tool-input") {
      void fetchShowGameViaToolCall(msg.params).then((p) => {
        if (p) tryApply(p, "tool-input → tools/call");
      });
    }
  };
  window.addEventListener("message", onMessage, { passive: true });

  return () => {
    window.removeEventListener(OPENAI_SET_GLOBALS, onSetGlobals);
    window.removeEventListener("message", onMessage);
    unsubRpc();
  };
}
