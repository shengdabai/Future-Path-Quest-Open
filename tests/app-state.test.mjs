import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const data = JSON.parse(fs.readFileSync(new URL("../data/future-pathways.json", import.meta.url), "utf8"));

function runtime({ saved = null, storageError = false } = {}) {
  const elements = new Map();
  const context = vm.createContext({
    window: { FPQ_DATA: structuredClone(data) },
    structuredClone,
    localStorage: {
      getItem() { return saved; },
      setItem(key, value) {
        if (storageError) throw new Error("Storage unavailable");
        saved = value;
      }
    },
    document: {
      addEventListener() {},
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {
          textContent: "", innerHTML: "", value: "", listeners: {},
          addEventListener(type, listener) { this.listeners[type] = listener; }
        });
        return elements.get(id);
      }
    }
  });
  vm.runInContext(source, context, { filename: "app.js" });
  return {
    run: (code) => vm.runInContext(code, context),
    snapshot: () => JSON.parse(vm.runInContext("JSON.stringify(state)", context)),
    saved: () => saved,
    elements
  };
}

test("malformed history cannot break coach reports or discard valid records", () => {
  const app = runtime();
  app.run(`state = normalizeState({ history: [null, 42, {}, [],
    { actionId: "unknown" }, { actionId: "__proto__" },
    { actionId: DATA.actions[0].id, actionName: "Valid action", stats: null }
  ] }); buildCoachReport();`);
  assert.equal(app.snapshot().history.length, 1);
  assert.equal(app.snapshot().history[0].actionName, "Valid action");
});

test("corrupt local storage recovers usable history at startup", () => {
  const app = runtime({ saved: JSON.stringify({ history: [null], profile: { budget: 0 } }) });
  assert.doesNotThrow(() => app.run("buildCoachReport()"));
  assert.equal(app.snapshot().profile.budget, 0);
});

test("budget zero survives export and reload", () => {
  const app = runtime();
  app.run("state.profile.budget = 0; saveState(); state = loadState();");
  assert.equal(app.snapshot().profile.budget, 0);
});

test("invalid import roots are rejected before replacing existing progress", () => {
  for (const payload of ["null", "[]", "42", '"text"']) {
    const app = runtime();
    app.run("state.xp = 50");
    assert.throws(() => app.run(`state = normalizeState(${payload})`), /JSON/);
    assert.equal(app.snapshot().xp, 50);
  }
});

test("import controls report invalid JSON roots without overwriting saved progress", () => {
  const app = runtime();
  app.run('render = () => {}; bindControls(); $("importInput"); state.xp = 50; saveState();');
  const saved = app.saved();
  for (const payload of ["null", "[]", "42", '"text"', "{"]) {
    app.elements.get("importInput").value = payload;
    app.elements.get("importButton").listeners.click();
    assert.match(app.elements.get("importStatus").textContent, /导入失败/);
    assert.equal(app.snapshot().xp, 50);
    assert.equal(app.saved(), saved);
  }
  app.elements.get("importInput").value = JSON.stringify({ state: { xp: 75, profile: { budget: 0 }, history: [null] } });
  app.elements.get("importButton").listeners.click();
  assert.match(app.elements.get("importStatus").textContent, /导入成功/);
  assert.equal(app.snapshot().xp, 75);
  assert.equal(app.snapshot().profile.budget, 0);
});

test("malformed numeric, log and portfolio fields are safely normalized", () => {
  const app = runtime();
  assert.doesNotThrow(() => app.run(`state = normalizeState({
    stats: { skill: { toString: null } },
    profile: { time: { toString: null }, budget: "0" },
    log: [null, { toString: null }, "Safe log"],
    portfolio: [{ title: { toString: null }, feedback: { toString: null }, url: { toString: null } }]
  }); renderStats(); renderPortfolio(); buildCoachReport();`));
  const state = app.snapshot();
  assert.equal(state.stats.skill, 20);
  assert.equal(state.profile.time, 18);
  assert.equal(state.profile.budget, 0);
  assert.deepEqual(state.log, ["Safe log"]);
  assert.equal(state.portfolio[0].url, "");
});

test("legacy progress still migrates and history remains bounded", () => {
  const app = runtime();
  app.run("state = normalizeState({ week: 9, xp: 240 }); buildCoachReport();");
  assert.equal(app.snapshot().history[0].actionId, "legacy");
  app.run(`state = normalizeState({ history: Array.from({ length: 100 }, () => ({
    actionId: DATA.actions[0].id, actionName: "Action"
  })) });`);
  assert.equal(app.snapshot().history.length, 52);
});

test("imported HTML stays escaped and executable evidence URLs are discarded", () => {
  const app = runtime();
  app.run(`state = normalizeState({
    log: ['<img src=x onerror="alert(1)">'],
    portfolio: [{ title: '<svg onload="alert(1)">', feedback: '<script>alert(1)</script>',
      url: 'javascript:alert(1)' }]
  }); renderPortfolio(); renderStats();`);
  const evidence = app.elements.get("evidenceList").innerHTML;
  assert.ok(evidence.includes("&lt;svg"));
  assert.ok(evidence.includes("&lt;script&gt;"));
  assert.ok(!evidence.includes("href="));
  assert.ok(app.elements.get("eventLog").innerHTML.includes("&lt;img"));
});

test("all XP rewards immediately update level and action history", () => {
  for (const action of ['closeOffer("starter")', "addEvidence()", "applyAction(DATA.actions[0])"]) {
    const app = runtime();
    // Avoid constructing unrelated UI while exercising the actual reward handlers.
    app.run("render = () => {}; state.xp = 99;");
    app.run(action);
    const state = app.snapshot();
    assert.equal(state.level, 2, action);
    if (state.history.length) assert.equal(state.history[0].level, 2);
  }
});

test("storage failure preserves the action and gives an export recovery message", () => {
  const app = runtime({ storageError: true });
  app.run("render = () => {}; state.xp = 99;");
  assert.doesNotThrow(() => app.run('closeOffer("starter")'));
  assert.ok(app.snapshot().revenue > 0);
  assert.match(app.elements.get("importStatus").textContent, /导出/);
  assert.equal(app.saved(), null);
});
