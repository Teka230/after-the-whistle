import type { Tone } from "@after-the-whistle/core";

type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
};

let rpcId = 1;
const pendingRequests = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

function post(message: JsonRpcMessage) {
  window.parent.postMessage(message, "*");
}

function handleRpcResponse(msg: JsonRpcMessage) {
  if (typeof msg.id !== "number") return;
  const pending = pendingRequests.get(msg.id);
  if (!pending) return;
  pendingRequests.delete(msg.id);
  if (msg.error) pending.reject(new Error(msg.error.message));
  else pending.resolve(msg.result);
}

export function rpcRequest(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = rpcId++;
    pendingRequests.set(id, { resolve, reject });
    post({ jsonrpc: "2.0", id, method, params });
    setTimeout(() => {
      if (!pendingRequests.has(id)) return;
      pendingRequests.delete(id);
      reject(new Error(`${method} timeout`));
    }, 20000);
  });
}

let bridgeInit: Promise<void> | null = null;

/** MCP Apps UI handshake (required for tools/call + notifications in ChatGPT). */
export function ensureMcpUiBridge(): Promise<void> {
  if (bridgeInit) return bridgeInit;

  bridgeInit = (async () => {
    try {
      await rpcRequest("ui/initialize", {
        appInfo: { name: "after-the-whistle-boxscore", version: "2026-05-30.7" },
        appCapabilities: {},
        protocolVersion: "2026-01-26",
      });
      post({
        jsonrpc: "2.0",
        method: "ui/notifications/initialized",
        params: {},
      });
    } catch (err) {
      console.warn("[after-the-whistle] ui/initialize failed", err);
    }
  })();

  return bridgeInit;
}

void ensureMcpUiBridge();

export function subscribeToolResult(
  handler: (structuredContent: Record<string, unknown> | null) => void
) {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const msg = event.data as JsonRpcMessage;
    if (!msg || msg.jsonrpc !== "2.0") return;

    if (typeof msg.id === "number") {
      handleRpcResponse(msg);
      return;
    }

    if (msg.method !== "ui/notifications/tool-result") return;
    const params = msg.params;
    const sc =
      (params?.structuredContent as Record<string, unknown> | undefined) ??
      (params as Record<string, unknown> | undefined);
    handler(sc ?? null);
  };
  window.addEventListener("message", onMessage, { passive: true });
  return () => window.removeEventListener("message", onMessage);
}

export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  await ensureMcpUiBridge();
  const result = (await rpcRequest("tools/call", {
    name,
    arguments: args,
  })) as Record<string, unknown> | undefined;
  const sc = result?.structuredContent ?? result;
  return (sc as Record<string, unknown>) ?? null;
}

export function sendUserMessage(text: string) {
  post({
    jsonrpc: "2.0",
    method: "ui/message",
    params: {
      role: "user",
      content: [{ type: "text", text }],
    },
  });
}

export async function updateModelContext(text: string) {
  await rpcRequest("ui/update-model-context", {
    content: [{ type: "text", text }],
  });
}

/** ChatGPT compatibility layer */
export function useOpenAiBridge() {
  const w = window as Window & {
    openai?: {
      toolInput?: Record<string, unknown>;
      toolOutput?: Record<string, unknown>;
      toolResponseMetadata?: Record<string, unknown>;
      callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      sendFollowUpMessage?: (opts: { prompt: string }) => void;
      setWidgetState?: (s: unknown) => void;
      widgetState?: { tone?: Tone };
    };
  };
  return w.openai;
}

export async function callToolCompat(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const openai = useOpenAiBridge();
  if (openai?.callTool) {
    const result = (await openai.callTool(name, args)) as Record<string, unknown>;
    const sc = result?.structuredContent ?? result;
    return (sc as Record<string, unknown>) ?? null;
  }
  return callTool(name, args);
}

export function sendMessageCompat(text: string) {
  const openai = useOpenAiBridge();
  if (openai?.sendFollowUpMessage) {
    openai.sendFollowUpMessage({ prompt: text });
    return;
  }
  sendUserMessage(text);
}
