import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "data", "future-pathways.json");
const outPath = path.join(root, "data", "future-pathways.js");

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const output = `window.FPQ_DATA = ${JSON.stringify(data, null, 2)};\n`;

fs.writeFileSync(outPath, output, "utf8");
console.log(`Generated ${outPath}`);
