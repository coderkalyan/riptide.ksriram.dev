#!/usr/bin/env node
// Launch the real Riptide Electron app and capture a screenshot
// into src/assets/riptide-hero.png.
//
// Requires: ../riptide built (pnpm build in that repo) so dist/main, dist/renderer,
// and dist/native are present. Vulkan/WebGPU flags are set by riptide's main process.

import { _electron as electron } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RIPTIDE = resolve(__dirname, "../../riptide");
const OUT = resolve(__dirname, "../src/assets/riptide-hero.png");

for (const p of [
  "dist/main/index.js",
  "dist/renderer/index.html",
  "dist/native/riptide.node",
]) {
  if (!existsSync(resolve(RIPTIDE, p))) {
    console.error(`Missing ${p} in ${RIPTIDE}. Run \`pnpm build\` there first.`);
    process.exit(1);
  }
}

const electronBin = resolve(RIPTIDE, "node_modules/electron/dist/electron");
if (!existsSync(electronBin)) {
  console.error(`Electron binary not found at ${electronBin}`);
  process.exit(1);
}

const app = await electron.launch({
  executablePath: electronBin,
  cwd: RIPTIDE,
  args: [RIPTIDE],
  env: { ...process.env, ELECTRON_DISABLE_SANDBOX: "1" },
});

const win = await app.firstWindow();
await win.waitForLoadState("domcontentloaded");
await win.waitForSelector("#gpu", { timeout: 15000 });

// Give the WebGPU pipeline time to build + paint a couple of frames.
await win.waitForFunction(
  () => {
    const c = document.querySelector("#gpu");
    return c && c.clientWidth > 0 && c.clientHeight > 0;
  },
  { timeout: 10000 },
);
await win.waitForTimeout(1500);

await win.screenshot({ path: OUT, type: "png" });
console.log(`Wrote ${OUT}`);

await app.close();
