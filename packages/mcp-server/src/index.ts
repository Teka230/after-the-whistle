import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  APP_NAME,
  APP_SLUG,
  APP_TAGLINE,
  MCP_SERVER_ID,
  mcpHttpPath,
  normalizeBasePath,
  resolveDbPath,
} from "@after-the-whistle/core";
import { openDatabase, GameRepository } from "@after-the-whistle/db";
import { registerTools } from "./tools.js";
import { QUOTA_HINTS, submissionChecklist } from "./hardening.js";
import { buildToolContract } from "./schema-contract.js";
import { WHISTLE_MCP_VERSION } from "./version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../../..");
const BASE_PATH = normalizeBasePath(process.env.MCP_BASE_PATH);
const MCP_PATH = mcpHttpPath(process.env.MCP_BASE_PATH);
const STATUS_PATH = BASE_PATH || "/";

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1]!.trim()] = m[2]!.trim();
  }
}

loadEnv();

const dbPath = resolveDbPath(root);
const schemaPath = path.join(root, "packages/db/src/schema.sql");
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
openDatabase(dbPath).exec(fs.readFileSync(schemaPath, "utf8"));

function loadWidgetHtml(): string {
  const candidates = [
    path.join(root, "packages/widgets/dist/boxscore.html"),
    path.join(root, "packages/widgets/dist/src/boxscore/index.html"),
    path.join(root, "packages/widgets/public/boxscore-fallback.html"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "<p>Widget missing — run pnpm --filter @after-the-whistle/widgets build</p>";
}

const widgetHtml = loadWidgetHtml();

type ActiveTransport = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

const transports = new Map<string, ActiveTransport>();

function createAppServer() {
  const server = new McpServer({
    name: MCP_SERVER_ID,
    version: WHISTLE_MCP_VERSION,
  });
  registerTools(server, widgetHtml);
  return server;
}

function sessionIdFromRequest(req: Request): string | undefined {
  const header = req.headers["mcp-session-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]) return header[0].trim();
  return undefined;
}

async function handleMcpPost(req: Request, res: Response) {
  const parsedBody = req.body;
  const sessionId = sessionIdFromRequest(req);
  const existing = sessionId ? transports.get(sessionId) : undefined;

  if (existing) {
    await existing.transport.handleRequest(req, res, parsedBody);
    return;
  }

  if (sessionId) {
    res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Session not found" },
      id: null,
    });
    return;
  }

  if (!isInitializeRequest(parsedBody)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Expected initialize request" },
      id: null,
    });
    return;
  }

  const server = createAppServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (newSessionId) => {
      transports.set(newSessionId, { transport, server });
      console.log(`[mcp] session ${newSessionId}`);
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid && transports.delete(sid)) {
      console.log(`[mcp] session closed ${sid}`);
    }
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
}

async function handleMcpGet(req: Request, res: Response) {
  const sessionId = sessionIdFromRequest(req);
  const existing = sessionId ? transports.get(sessionId) : undefined;
  if (!existing) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await existing.transport.handleRequest(req, res);
}

async function handleMcpDelete(req: Request, res: Response) {
  const sessionId = sessionIdFromRequest(req);
  const existing = sessionId ? transports.get(sessionId) : undefined;
  if (!existing) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await existing.transport.handleRequest(req, res);
}

const renderHostname = process.env.RENDER_EXTERNAL_HOSTNAME?.trim();
const configuredAllowedHosts = (process.env.MCP_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const allowedHosts = [...new Set([renderHostname, ...configuredAllowedHosts].filter(Boolean))] as string[];
const bindHost = process.env.HOST ?? (renderHostname ? "0.0.0.0" : "127.0.0.1");
const app = createMcpExpressApp({
  host: bindHost,
  ...(bindHost === "0.0.0.0" && allowedHosts.length > 0 ? { allowedHosts } : {}),
});

const mcpCors = (_req: Request, res: Response, next: () => void) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, mcp-session-id, mcp-protocol-version, accept, authorization"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  next();
};

app.get(STATUS_PATH, (_req, res) => {
  const repo = new GameRepository();
  const games = repo.findGames(undefined, 10);
  const toolContract = buildToolContract();
  res.json({
    slug: APP_SLUG,
    name: APP_SLUG,
    displayName: APP_NAME,
    tagline: APP_TAGLINE,
    version: WHISTLE_MCP_VERSION,
    schema_version: toolContract.version,
    schema_hash: toolContract.hash,
    tools: toolContract.tools,
    mcp: MCP_PATH,
    games: games.map((g) => ({
      id: g.id,
      label: `${g.awayTeam.abbreviation} ${g.awayScore} @ ${g.homeTeam.abbreviation} ${g.homeScore}`,
      sport: g.sport,
    })),
    quota: QUOTA_HINTS,
    submissionChecklist: submissionChecklist(),
    widgetBuilt: widgetHtml.length > 500,
  });
});

app.options(MCP_PATH, mcpCors, (_req, res) => res.status(204).end());
app.post(MCP_PATH, mcpCors, handleMcpPost);
app.get(MCP_PATH, mcpCors, handleMcpGet);
app.delete(MCP_PATH, mcpCors, handleMcpDelete);

// Hosted platforms inject PORT. MCP_PORT keeps the explicit local override.
const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 8788);
app.listen(port, bindHost, () => {
  const toolContract = buildToolContract();
  console.log(`AFTER_THE_WHISTLE MCP CONTRACT ${toolContract.version} LOADED`);
  console.log(`AFTER_THE_WHISTLE MCP SCHEMA_HASH ${toolContract.hash}`);
  console.log(`After the Whistle MCP http://127.0.0.1:${port}${MCP_PATH}`);
  console.log(`Status http://127.0.0.1:${port}${STATUS_PATH}`);
  if (BASE_PATH) {
    console.log(`HTTP base path ${BASE_PATH}; MCP path ${MCP_PATH}`);
  }
});
