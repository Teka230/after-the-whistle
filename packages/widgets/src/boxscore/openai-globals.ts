import { useSyncExternalStore } from "react";
import { getOpenAiToolOutput, OPENAI_SET_GLOBALS } from "./tool-payload.js";
import type { ShowGamePayload } from "./tool-payload.js";

/** Re-render when ChatGPT pushes new globals into the iframe. */
export function useOpenAiToolOutputPayload(): ShowGamePayload | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      const bump = () => onStoreChange();
      window.addEventListener(OPENAI_SET_GLOBALS, bump, { passive: true });
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        const msg = event.data as { method?: string };
        if (
          msg?.method === "ui/notifications/tool-result" ||
          msg?.method === "ui/notifications/tool-input"
        ) {
          bump();
        }
      };
      window.addEventListener("message", onMessage, { passive: true });
      return () => {
        window.removeEventListener(OPENAI_SET_GLOBALS, bump);
        window.removeEventListener("message", onMessage);
      };
    },
    () => getOpenAiToolOutput(),
    () => null
  );
}
