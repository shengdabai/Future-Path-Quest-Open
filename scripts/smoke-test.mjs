import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const bundledModules = process.env.CODEX_NODE_MODULES;
const playwrightEntry = bundledModules ? path.join(bundledModules, "playwright") : "playwright";
const { chromium } = require(playwrightEntry);
const baseUrl = process.env.BASE_URL || "http://localhost:8787/";

const launchOptions = { headless: true };
if (process.env.CHROME_PATH) launchOptions.executablePath = process.env.CHROME_PATH; // 默认用 Playwright 自带 Chromium

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

const fail = (message) => {
  throw new Error(message);
};

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.getByRole("button", { name: /^深度学习/ }).click();
await page.getByRole("button", { name: "生成复盘" }).click();
await page.getByRole("button", { name: "添加本周证据" }).click();
await page.getByPlaceholder("例如：AI 工作流审计报告 v1").fill("AI 工作流审计报告 v1");
await page.getByPlaceholder("https://...").fill("https://example.com/fpq-evidence");
await page.locator("#evidenceStatusInput").selectOption("validated");
await page.getByPlaceholder("记录老师、从业者、客户或同伴反馈").fill("老师建议继续补真实访谈样本。");
await page.getByRole("button", { name: "保存证据" }).click();
await page.getByRole("button", { name: /^入门诊断包/ }).click();

let bodyText = await page.locator("body").innerText();
if (!bodyText.includes("第 2 周")) fail("Week did not advance after action");
if (!bodyText.includes("已证明")) fail("Evidence was not added");
if (!bodyText.includes("AI 工作流审计报告 v1")) fail("Evidence form title was not saved");
if (!bodyText.includes("老师建议继续补真实访谈样本")) fail("Evidence feedback was not saved");
if (bodyText.includes("累计模拟收入：¥0")) fail("Offer close did not update simulated revenue");
if (!bodyText.includes("下一周最该做")) fail("Coach recommendations did not render");
if (!bodyText.includes("更佳发展路线建议")) fail("Roadmap recommendations did not render");
if (!bodyText.includes("家庭决策卡")) fail("Family decision card did not render");

const exportedState = await page.evaluate(() => localStorage.getItem("future-pathway-quest-state-v1"));
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.locator("#importInput").fill(JSON.stringify({ state: JSON.parse(exportedState) }));
await page.getByRole("button", { name: "导入进度" }).click();
bodyText = await page.locator("body").innerText();
if (!bodyText.includes("进度导入成功")) fail("Import status did not report success");
if (!bodyText.includes("AI 工作流审计报告 v1")) fail("Imported progress did not restore evidence");
if (bodyText.includes("累计模拟收入：¥0")) fail("Imported progress did not restore simulated revenue");

if (errors.length) fail(`Console errors found: ${errors.join("; ")}`);

await page.goto(pathToFileURL(path.join(process.cwd(), "index.html")).href, { waitUntil: "load" });
const fileText = await page.locator("body").innerText();
if (!fileText.includes("4 周复盘与下一步行动")) fail("file:// mode did not render coach module");
if (!fileText.includes("服务包报价模拟")) fail("file:// mode did not render income module");
if (!fileText.includes("更佳发展路线建议")) fail("file:// mode did not render roadmap module");

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("future-pathway-quest-state-v1", JSON.stringify({
    selectedMajorId: "missing-major",
    selectedCareerId: "missing-career",
    week: "9",
    xp: "240",
    stats: { skill: "bad", capital: 999 },
    profile: { traits: "not-array", risk: 99, time: -1 }
  }));
});
await page.reload({ waitUntil: "networkidle" });
const recoveredText = await page.locator("body").innerText();
if (!recoveredText.includes("AI 解决方案架构师")) fail("Corrupt state did not recover to default career");
if (!recoveredText.includes("更佳发展路线建议")) fail("Corrupt state recovery broke roadmap rendering");

await browser.close();
console.log("Smoke test passed: action, coach, evidence, and income flows work.");
