import { createHash } from "node:crypto";
import { TOOL_INPUT_SCHEMAS } from "./tool-schemas.js";

/** Bump when tool input fields change — helps verify connector refresh. */
export const TOOL_SCHEMA_VERSION = "2026-06-02.4";

type ToolMeta = {
  name: keyof typeof TOOL_INPUT_SCHEMAS;
  title: string;
  description: string;
};

const TOOL_META: ToolMeta[] = [
  {
    name: "show_game",
    title: "Show game [V2]",
    description:
      "Load a match and render the interactive box score widget in ChatGPT.",
  },
  {
    name: "show_analysis",
    title: "Show illustrated analysis",
    description:
      "Render a model-authored analysis board, including standalone analysis-first templates.",
  },
  {
    name: "get_stat_context",
    title: "Clicked stat context",
    description: "Called by the widget when a stat is clicked.",
  },
  {
    name: "list_suggested_prompts",
    title: "Discussion chips",
    description: "Suggested questions based on match anomalies.",
  },
  {
    name: "get_shot_chart",
    title: "Player shot chart",
    description: "Basketball shot chart for a player.",
  },
  {
    name: "get_momentum",
    title: "Momentum curve",
    description: "Score / momentum over time.",
  },
  {
    name: "get_player_stints",
    title: "Player on-floor stints",
    description:
      "On-pitch/on-floor stints with score differential (NBA +/- or football goals).",
  },
  {
    name: "clear_cache",
    title: "Clear SQLite cache",
    description:
      "Delete cached match data for one game or the entire database.",
  },
];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

function zodKind(schema: unknown): string {
  const def = (schema as { _def?: { typeName?: string; type?: string } })?._def;
  return def?.typeName ?? def?.type ?? "unknown";
}

function summarizeZod(schema: unknown): Record<string, unknown> {
  let current = schema as {
    _def?: {
      checks?: Array<Record<string, unknown>>;
      innerType?: unknown;
      type?: unknown;
      typeName?: string;
      values?: unknown;
    };
  };
  let optional = false;

  while (
    zodKind(current) === "ZodOptional" ||
    zodKind(current) === "ZodDefault"
  ) {
    optional = true;
    current = current._def?.innerType as typeof current;
  }

  const kind = zodKind(current);
  const summary: Record<string, unknown> = { kind, optional };
  const def = current?._def;

  if (kind === "ZodEnum" && Array.isArray(def?.values)) {
    summary.values = def.values;
  }
  if (kind === "ZodArray" && def?.type) {
    summary.items = summarizeZod(def.type);
  }

  return summary;
}

export function summarizeInputSchema(inputSchema: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(inputSchema).map(([name, schema]) => [
      name,
      summarizeZod(schema),
    ]),
  );
}

export function buildToolContract() {
  const tools = TOOL_META.map((meta) => {
    const zodSchema = TOOL_INPUT_SCHEMAS[meta.name];
    const inputSchema = zodSchema.shape as Record<string, unknown>;
    return {
      name: meta.name,
      title: meta.title,
      description: meta.description,
      input_fields: Object.keys(inputSchema),
      input_schema: summarizeInputSchema(inputSchema),
    };
  });

  const payload = {
    version: TOOL_SCHEMA_VERSION,
    tools,
  };

  return {
    ...payload,
    hash: createHash("sha256").update(stableStringify(payload)).digest("hex"),
  };
}
