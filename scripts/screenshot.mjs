import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.BASE_URL || "http://localhost:8787/";
const require = createRequire(import.meta.url);
const bundledModules = process.env.CODEX_NODE_MODULES;
const playwrightEntry = bundledModules ? path.join(bundledModules, "playwright") : "playwright";
const { chromium } = require(playwrightEntry);

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("No local Chrome-compatible browser found. Set CHROME_PATH to run screenshots.");
  return found;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: findChrome()
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(root, "docs", "desktop.png"), fullPage: false });
await page.locator("#command").screenshot({ path: path.join(root, "docs", "command.png") });
await page.locator("#decision").screenshot({ path: path.join(root, "docs", "decision.png") });
await page.locator("#coach").screenshot({ path: path.join(root, "docs", "coach.png") });
await page.locator("#assets").screenshot({ path: path.join(root, "docs", "assets.png") });
await page.locator("#roadmap").screenshot({ path: path.join(root, "docs", "roadmap.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(root, "docs", "mobile.png"), fullPage: false });

await browser.close();
console.log("Screenshots saved to docs/desktop.png, docs/mobile.png, docs/command.png, docs/decision.png, docs/coach.png, docs/assets.png, and docs/roadmap.png");
