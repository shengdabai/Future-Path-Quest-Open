import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  throw new Error(message);
};

const data = JSON.parse(read("data/future-pathways.json"));
const html = read("index.html");
const app = read("app.js");

if (data.majors.length !== 10) fail(`Expected 10 majors, got ${data.majors.length}`);
if (data.careers.length !== 10) fail(`Expected 10 careers, got ${data.careers.length}`);
if (data.levels.length !== 10) fail(`Expected 10 levels, got ${data.levels.length}`);
if (data.actions.length < 7) fail("Expected at least 7 life actions");
if (data.events.length < 6) fail("Expected at least 6 events");

const careerIds = new Set(data.careers.map((career) => career.id));
const majorIds = new Set(data.majors.map((major) => major.id));
if (careerIds.size !== data.careers.length) fail("Duplicate career id found");
if (majorIds.size !== data.majors.length) fail("Duplicate major id found");

for (const major of data.majors) {
  for (const careerId of major.careerIds) {
    if (!careerIds.has(careerId)) fail(`Major ${major.id} references missing career ${careerId}`);
  }
}

[
  "styles.css",
  "app.js",
  "data/future-pathways.js"
].forEach((file) => {
  if (!exists(file)) fail(`Missing ${file}`);
  if (!html.includes(file)) fail(`index.html does not reference ${file}`);
});

[
  "coach",
  "coachButton",
  "coachDiagnosis",
  "coachWarnings",
  "coachNextActions",
  "sprintBoard",
  "assets",
  "addEvidenceButton",
  "portfolioList",
  "evidenceList",
  "incomeOffers",
  "roadmap",
  "roadmapGrid",
  "command",
  "commandFocus",
  "commandRisk",
  "commandProof",
  "xpProgress",
  "importButton",
  "importInput",
  "importStatus",
  "decision",
  "decisionGrid",
  "evidenceForm",
  "evidenceTitleInput",
  "evidenceUrlInput",
  "evidenceStatusInput",
  "evidenceFeedbackInput",
  "evidenceFormStatus"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) fail(`Missing DOM id ${id}`);
});

[
  "normalizePortfolio",
  "renderCommand",
  "renderDecisionCard",
  "JSON.parse(payload)",
  "evidenceForm"
].forEach((snippet) => {
  if (!app.includes(snippet)) fail(`Missing app behavior snippet: ${snippet}`);
});

for (const match of app.matchAll(/\$\("([^"]+)"\)/g)) {
  const id = match[1];
  if (!html.includes(`id="${id}"`) && !html.includes(`<template id="${id}"`)) {
    fail(`app.js references missing DOM id ${id}`);
  }
}

new vm.Script(app, { filename: "app.js" });

const generated = read("data/future-pathways.js");
if (!generated.startsWith("window.FPQ_DATA = ")) fail("Generated data JS has wrong shape");
const expectedGenerated = `window.FPQ_DATA = ${JSON.stringify(data, null, 2)};\n`;
if (generated !== expectedGenerated) fail("Generated data JS is out of sync with data/future-pathways.json");

console.log("Validation passed: data, references, and JavaScript syntax are healthy.");
