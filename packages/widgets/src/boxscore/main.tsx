import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { logHydrationDebug } from "./hydration-debug.js";
import { App } from "./App.js";
import "./styles.css";

logHydrationDebug();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
