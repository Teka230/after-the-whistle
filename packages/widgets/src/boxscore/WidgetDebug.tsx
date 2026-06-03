import { useEffect, useState } from "react";
import {
  isHydrationDebugEnabled,
  logHydrationDebug,
  type HydrationDebugSnapshot,
} from "./hydration-debug.js";

/** Shown while waiting for data — full JSON when localStorage whistle_debug=1 */
export function WidgetDebug({ force }: { force?: boolean }) {
  const [snap, setSnap] = useState<HydrationDebugSnapshot | null>(null);
  const verbose = isHydrationDebugEnabled();

  useEffect(() => {
    setSnap(logHydrationDebug());
    const id = window.setInterval(() => setSnap(logHydrationDebug()), 1500);
    return () => window.clearInterval(id);
  }, []);

  if (!snap) return null;
  if (!verbose && !force) return null;

  return (
    <pre className="atw-debug">
      {JSON.stringify(snap, null, 2)}
    </pre>
  );
}
