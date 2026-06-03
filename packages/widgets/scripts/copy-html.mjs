import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(dir, "../dist");
const src = path.join(dist, "src/boxscore/index.html");
const alt = path.join(dist, "boxscore/index.html");
const alt2 = path.join(dist, "index.html");
const target = path.join(dist, "boxscore.html");

const from = [src, alt, alt2].find((p) => fs.existsSync(p));
if (from) {
  fs.copyFileSync(from, target);
  console.log(`Copied widget → ${target}`);
}
