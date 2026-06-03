import { useOpenAiBridge } from "./mcp-bridge.js";

function hasGamePayload(raw: unknown, depth = 0): boolean {
  if (raw == null || typeof raw !== "object" || depth > 6) return false;
  const o = raw as Record<string, unknown>;
  if (o.game && Array.isArray(o.boxLines)) return true;
  for (const key of [
    "structuredContent",
    "showGame",
    "result",
    "mcp_tool_result",
    "call_tool_result",
  ] as const) {
    if (o[key] && hasGamePayload(o[key], depth + 1)) return true;
  }
  return false;
}

export type HydrationDebugSnapshot = {
  hasOpenAi: boolean;
  toolOutputKeys: string[];
  toolInputKeys: string[];
  toolResponseMetadataKeys: string[];
  normalizedOk: boolean;
  initialDataKeys: string[];
};

/** Console + optional on-screen debug (localStorage `whistle_debug=1`). */
export function logHydrationDebug(): HydrationDebugSnapshot {
  const w = window as Window & {
    openai?: Record<string, unknown>;
    __INITIAL_DATA__?: unknown;
  };
  const openai = useOpenAiBridge() as Record<string, unknown> | undefined;
  const toolOutput = openai?.toolOutput;
  const toolInput = openai?.toolInput;
  const toolResponseMetadata = openai?.toolResponseMetadata;
  const initial = w.__INITIAL_DATA__;

  const snap: HydrationDebugSnapshot = {
    hasOpenAi: Boolean(openai),
    toolOutputKeys:
      toolOutput && typeof toolOutput === "object"
        ? Object.keys(toolOutput as object)
        : [],
    toolInputKeys:
      toolInput && typeof toolInput === "object"
        ? Object.keys(toolInput as object)
        : [],
    toolResponseMetadataKeys:
      toolResponseMetadata && typeof toolResponseMetadata === "object"
        ? Object.keys(toolResponseMetadata as object)
        : [],
    normalizedOk:
      hasGamePayload(toolOutput) || hasGamePayload(toolResponseMetadata),
    initialDataKeys:
      initial && typeof initial === "object" ? Object.keys(initial as object) : [],
  };

  console.log("[after-the-whistle] openai", openai);
  console.log("[after-the-whistle] toolOutput", toolOutput);
  console.log("[after-the-whistle] toolInput", toolInput);
  console.log("[after-the-whistle] toolResponseMetadata", toolResponseMetadata);
  console.log("[after-the-whistle] __INITIAL_DATA__", initial);
  console.log("[after-the-whistle] hydration snapshot", snap);

  return snap;
}

export function isHydrationDebugEnabled(): boolean {
  try {
    return localStorage.getItem("whistle_debug") === "1";
  } catch {
    return false;
  }
}
