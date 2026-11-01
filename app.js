const DATA = window.FPQ_DATA;

const STORAGE_KEY = "future-pathway-quest-state-v1";
const STATE_SCHEMA_VERSION = 3;
const VALID_TRAITS = ["tech", "business", "people", "data", "green", "health"];
const VALID_EVIDENCE_STATUSES = ["draft", "published", "validated", "paid"];

const defaultState = {
  schemaVersion: STATE_SCHEMA_VERSION,
  selectedMajorId: "ai-data-science",
  selectedCareerId: "ai-solutions-architect",
  week: 1,
  xp: 0,
  level: 1,
  stats: {
    skill: 20,
    network: 16,
    capital: 18,
    energy: 72,
    health: 78,
    reputation: 10,
    financial: 12,
    ai: 16,
    resilience: 20
  },
  profile: {
    stage: "student",
    time: 18,
    risk: 6,
    budget: 25,
    traits: ["tech", "business", "data"]
  },
  history: [],
  portfolio: [],
  revenue: 0,
  lastCoachWeek: 0,
  log: ["系统启动：选择一个专业或职业，开始第一周行动。"]
};

let state = loadState();

const els = {};

function $(id) {
  return document.getElementById(id);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function listItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function nonnegativeNumber(value, field, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field}必须是有限非负数`);
  return number;
}

function normalizeState(raw) {
  raw = raw && typeof raw === "object" ? raw : {};
  const base = structuredClone(defaultState);
  const revenue = nonnegativeNumber(raw.revenue, "收入");
  const xp = nonnegativeNumber(raw.xp, "经验值");
  const lastCoachWeek = Math.min(520, Math.floor(nonnegativeNumber(raw.lastCoachWeek, "教练周次")));
  const selectedMajorId = DATA.majors.some((major) => major.id === raw.selectedMajorId)
    ? raw.selectedMajorId
    : base.selectedMajorId;
  const selectedCareerId = DATA.careers.some((career) => career.id === raw.selectedCareerId)
    ? raw.selectedCareerId
    : base.selectedCareerId;
  const profile = {
    ...base.profile,
    ...(raw.profile || {})
  };
  profile.stage = ["student", "early", "builder", "operator"].includes(profile.stage) ? profile.stage : base.profile.stage;
  profile.time = clamp(Number(profile.time) || base.profile.time, 5, 50);
  profile.risk = clamp(Number(profile.risk) || base.profile.risk, 1, 10);
  profile.budget = clamp(Number(profile.budget) || base.profile.budget, 0, 100);
  profile.traits = Array.isArray(profile.traits)
    ? profile.traits.filter((trait) => VALID_TRAITS.includes(trait))
    : base.profile.traits;
  if (!profile.traits.length) profile.traits = base.profile.traits;

  let history = Array.isArray(raw.history) ? raw.history : [];
  const stats = Object.fromEntries(
    Object.entries({ ...base.stats, ...(raw.stats || {}) })
      .map(([key, value]) => [key, clamp(Number(value) || 0)])
  );
  if (!history.length && (Number(raw.week) > 1 || Number(raw.xp) > 0)) {
    history = [{
      week: Math.max(1, Number(raw.week || 2) - 1),
      actionId: "legacy",
      actionName: "旧版本行动记录",
      eventTitle: null,
      stats,
      xp,
      level: Number(raw.level || 1)
    }];
  }

  return {
    ...base,
    ...raw,
    schemaVersion: STATE_SCHEMA_VERSION,
    selectedMajorId,
    selectedCareerId,
    week: clamp(Number(raw.week) || base.week, 1, 520),
    xp,
    level: clamp(Number(raw.level) || base.level, 1, 10),
    stats,
    profile,
    history: history.slice(0, 52),
    portfolio: normalizePortfolio(raw.portfolio),
    revenue,
    lastCoachWeek,
    log: Array.isArray(raw.log) ? raw.log : base.log
  };
}

function normalizePortfolio(rawPortfolio) {
  const allProofs = new Set(DATA.careers.flatMap((career) => career.proof));
  return Array.isArray(rawPortfolio)
    ? rawPortfolio
      .filter((item) => item && typeof item === "object")
      .slice(0, 30)
      .map((item, index) => {
        const proof = allProofs.has(item.proof) ? item.proof : DATA.careers[0].proof[index % DATA.careers[0].proof.length];
        const status = VALID_EVIDENCE_STATUSES.includes(item.status) ? item.status : "draft";
        return {
          week: clamp(Number(item.week) || 1, 1, 520),
          title: String(item.title || `作品证据 ${index + 1}`).slice(0, 80),
          proof,
          careerId: DATA.careers.some((career) => career.id === item.careerId) ? item.careerId : defaultState.selectedCareerId,
          url: normalizeUrl(item.url),
          feedback: String(item.feedback || "").slice(0, 180),
          status
        };
      })
    : [];
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text.slice(0, 240) : "";
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function traitBoost(item) {
  const text = [
    item.id,
    item.name,
    item.signal,
    item.mission,
    ...(item.coreSkills || []),
    ...(item.bestFor || [])
  ].join(" ").toLowerCase();

  const boosts = {
    tech: ["software", "ai", "人工智能", "机器人", "cyber", "security", "programming", "automation"],
    business: ["product", "manager", "创业", "business", "finance", "运营", "商业"],
    people: ["care", "nurse", "teacher", "education", "社交", "照护", "教育", "沟通"],
    data: ["data", "statistics", "model", "risk", "数据", "统计", "精算"],
    green: ["energy", "climate", "environmental", "solar", "wind", "绿色", "能源", "气候"],
    health: ["health", "nurse", "clinical", "医疗", "健康", "护理"]
  };

  return state.profile.traits.reduce((score, trait) => {
    const matched = boosts[trait].some((keyword) => text.includes(keyword));
    return score + (matched ? 6 : 0);
  }, 0);
}

function scoreItem(item) {
  const riskFit = state.profile.risk >= 7 ? item.entrepreneurship * 0.1 : item.resilience * 0.1;
  const timePenalty = item.difficulty > state.profile.time + 55 ? 8 : 0;
  const budgetFit = state.profile.budget > 45 ? 4 : item.difficulty < 82 ? 3 : 0;
  const stageBoost = state.profile.stage === "operator" ? item.entrepreneurship * 0.05 : 0;
  const base =
    item.demand * 0.25 +
    item.income * 0.16 +
    item.aiLeverage * 0.17 +
    item.resilience * 0.18 +
    item.entrepreneurship * 0.12 +
    (100 - item.difficulty) * 0.05;

  return Math.round(clamp(base + riskFit + budgetFit + stageBoost + traitBoost(item) - timePenalty));
}

function sortedMajors() {
  return [...DATA.majors].sort((a, b) => scoreItem(b) - scoreItem(a));
}

function sortedCareers() {
  const selectedMajor = DATA.majors.find((major) => major.id === state.selectedMajorId);
  const preferred = new Set(selectedMajor?.careerIds || []);
  return [...DATA.careers].sort((a, b) => {
    const bScore = scoreItem(b) + (preferred.has(b.id) ? 8 : 0);
    const aScore = scoreItem(a) + (preferred.has(a.id) ? 8 : 0);
    return bScore - aScore;
  });
}

function scoreBar(label, value) {
  const template = $("scoreBarTemplate").content.cloneNode(true);
  template.querySelector("span").textContent = label;
  template.querySelector("meter").value = value;
  return template;
}

function renderScores(container, item) {
  container.innerHTML = "";
  [
    ["需求", item.demand],
    ["收入", item.income],
    ["AI 杠杆", item.aiLeverage],
    ["抗波动", item.resilience],
    ["创业性", item.entrepreneurship]
  ].forEach(([label, value]) => container.appendChild(scoreBar(label, value)));
}

function renderMajors() {
  els.majorList.innerHTML = "";
  sortedMajors().forEach((major, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `major-card ${major.id === state.selectedMajorId ? "active" : ""}`;
    button.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <span>
        <h3>${escapeHtml(major.name)}</h3>
        <p>${escapeHtml(major.signal)}</p>
        <span class="tag-row">${major.coreSkills.slice(0, 5).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</span>
      </span>
      <span class="score-stack"></span>
    `;
    renderScores(button.querySelector(".score-stack"), major);
    button.addEventListener("click", () => {
      state.selectedMajorId = major.id;
      state.selectedCareerId = major.careerIds[0] || state.selectedCareerId;
      state.log.unshift(`锁定专业：${major.name}`);
      commit();
    });
    els.majorList.appendChild(button);
  });
}

function renderCareers() {
  els.careerList.innerHTML = "";
  const selectedMajor = DATA.majors.find((major) => major.id === state.selectedMajorId);
  const preferred = new Set(selectedMajor?.careerIds || []);

  sortedCareers().forEach((career, index) => {
    const fit = clamp(scoreItem(career) + (preferred.has(career.id) ? 8 : 0));
    const card = document.createElement("article");
    card.className = "career-card";
    card.innerHTML = `
      <div class="career-topline">
        <div>
          <p class="eyebrow">Career Role</p>
          <h3>${escapeHtml(career.name)}</h3>
        </div>
        <button class="fit-badge" type="button">${fit} 适配</button>
      </div>
      <p>${escapeHtml(career.mission)}</p>
      <div class="score-stack"></div>
      <ul class="proof-list">${listItems(career.proof)}</ul>
      <p><strong>风险：</strong>${escapeHtml(career.risk)}</p>
    `;
    renderScores(card.querySelector(".score-stack"), career);
    card.querySelector("button").addEventListener("click", () => {
      state.selectedCareerId = career.id;
      state.log.unshift(`目标职业切换为：${career.name}`);
      commit();
    });
    els.careerList.appendChild(card);
  });
}

function renderQuestMap() {
  els.questMap.innerHTML = "";
  DATA.levels.forEach((level) => {
    const node = document.createElement("article");
    node.className = "quest-node";
    if (level.level < state.level) node.classList.add("complete");
    if (level.level === state.level) node.classList.add("current");
    node.innerHTML = `
      <span>Lv.${level.level}</span>
      <h3>${escapeHtml(level.name)}</h3>
      <p>${escapeHtml(level.goal)}</p>
      <p><strong>解锁：</strong>${escapeHtml(level.unlock)}</p>
    `;
    els.questMap.appendChild(node);
  });
}

function renderActions() {
  els.actionGrid.innerHTML = "";
  DATA.actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-card";
    button.innerHTML = `
      <strong>${escapeHtml(action.name)}</strong>
      <p>${escapeHtml(action.description)}</p>
      <span>${escapeHtml(effectText(action.effects))}</span>
    `;
    button.addEventListener("click", () => applyAction(action));
    els.actionGrid.appendChild(button);
  });
}

function buildWeeklyCommand() {
  const report = buildCoachReport();
  const career = selectedCareer();
  const weakest = weakestStats()[0];
  const proofGap = career.proof.find((proof) => !state.portfolio.some((item) => item.proof === proof));
  const xpInLevel = state.level >= 10 ? 100 : state.xp % 100;
  const risk =
    state.stats.energy < 25
      ? "能量偏低，本周先恢复再冲刺。"
      : state.stats.capital < 20
        ? "资本偏低，控制消费并尝试小额变现。"
        : state.stats.reputation < 35
          ? "公开证据不足，本周优先发布作品或复盘。"
          : "状态健康，适合推进更高难度任务。";

  return {
    focus: report.nextActions[0],
    reason: `最低资源是「${statName(weakest.key)}」${Math.round(weakest.value)} 点；当前目标是「${career.name}」。`,
    risk,
    proof: proofGap || "核心证据已补齐",
    proofMeta: proofGap ? "保存作品链接和反馈后，路线建议会自动更新。" : "下一步提高报价、反馈质量和交付难度。",
    xpInLevel,
    xpLabel: state.level >= 10 ? "已到 Lv.10" : `${xpInLevel} / 100 XP`
  };
}

function renderCommand() {
  const command = buildWeeklyCommand();
  $("commandFocus").textContent = command.focus;
  $("commandReason").textContent = command.reason;
  $("commandRisk").textContent = command.risk;
  $("commandProof").textContent = command.proof;
  $("commandProofMeta").textContent = command.proofMeta;
  $("xpLabel").textContent = command.xpLabel;
  $("xpProgress").value = command.xpInLevel;
}

function effectText(effects) {
  return Object.entries(effects)
    .map(([key, value]) => `${statName(key)} ${value > 0 ? "+" : ""}${value}`)
    .join(" / ");
}

function statName(key) {
  const names = {
    skill: "技能",
    network: "社交",
    capital: "资本",
    energy: "能量",
    health: "健康",
    reputation: "声望",
    financial: "财商",
    ai: "AI",
    resilience: "韧性",
    xp: "经验"
  };
  return names[key] || key;
}

function applyEffects(effects) {
  Object.entries(effects).forEach(([key, value]) => {
    if (key === "xp") {
      state.xp = Math.max(0, state.xp + value);
      return;
    }
    state.stats[key] = clamp((state.stats[key] || 0) + value);
  });
}

function applyAction(action) {
  let event = null;
  if (state.stats.energy <= 8 && action.id !== "rest") {
    state.log.unshift("能量过低：本周必须先恢复，否则行动收益会下降。");
    applyEffects({ energy: -2, health: -2, xp: 1 });
  } else {
    applyEffects(action.effects);
    state.log.unshift(`第 ${state.week} 周行动：${action.name}。${action.description}`);
  }

  event = pickEvent(action.id, state.week);
  if (event) {
    applyEffects(event.effects);
    state.log.unshift(`事件：${event.title}。${event.text}`);
  }

  recordHistory(action, event);
  state.week += 1;
  state.level = clamp(1 + Math.floor(state.xp / 100), 1, 10);
  maybeAutoCoach();
  if (state.level === 10 && state.stats.reputation > 70 && state.stats.capital > 60) {
    state.log.unshift("通关条件达成：你已经形成职业、社交、收入、投资和消费的复利系统。");
  }
  commit();
}

function recordHistory(action, event) {
  state.history.unshift({
    week: state.week,
    actionId: action.id,
    actionName: action.name,
    eventTitle: event?.title || null,
    stats: { ...state.stats },
    xp: state.xp,
    level: state.level
  });
  state.history = state.history.slice(0, 52);
}

function maybeAutoCoach() {
  const completedWeek = state.week - 1;
  if (completedWeek > 0 && completedWeek % 4 === 0 && state.lastCoachWeek !== completedWeek) {
    const report = buildCoachReport();
    state.lastCoachWeek = completedWeek;
    state.log.unshift(`AI 教练复盘：${report.diagnosis} 下一步先做「${report.nextActions[0]}」。`);
  }
}

function pickEvent(actionId, week) {
  const hash = [...actionId].reduce((sum, char) => sum + char.charCodeAt(0), 0) + week * 17;
  if (hash % 3 !== 0) return null;
  return DATA.events[hash % DATA.events.length];
}

function selectedCareer() {
  return DATA.careers.find((career) => career.id === state.selectedCareerId) || DATA.careers[0];
}

function selectedMajor() {
  return DATA.majors.find((major) => major.id === state.selectedMajorId) || DATA.majors[0];
}

function buildCoachReport() {
  const recent = state.history.slice(0, 4);
  const career = selectedCareer();
  const current = DATA.levels.find((item) => item.level === state.level) || DATA.levels[0];
  const actionCounts = recent.reduce((counts, item) => {
    counts[item.actionId] = (counts[item.actionId] || 0) + 1;
    return counts;
  }, {});
  const weakest = weakestStats();
  const warnings = buildWarnings(actionCounts, weakest);
  const nextActions = buildNextActions(current, career, actionCounts, weakest);
  const mainAction = recent[0]?.actionName || "尚未开始";
  const diagnosis =
    state.stats.energy < 25
      ? "能量透支，短期先保节奏"
      : state.stats.capital < 25
        ? "资本不足，需要尽快做小额变现"
        : state.stats.skill < 45
          ? "技能底座仍薄，先补可交付能力"
          : state.stats.reputation < 45
            ? "作品和公开证明不足"
            : "路径健康，可以提高市场难度";

  return {
    diagnosis,
    summary: `最近 ${recent.length || 0} 次行动以「${mainAction}」为主。当前主线是「${current.name}」，目标职业是「${career.name}」。最低资源是「${statName(weakest[0].key)}」，下一阶段要把学习成果变成可展示、可报价、可复用的证据。`,
    warnings,
    nextActions
  };
}

function weakestStats() {
  return ["skill", "network", "capital", "energy", "reputation", "financial"]
    .map((key) => ({ key, value: state.stats[key] || 0 }))
    .sort((a, b) => a.value - b.value);
}

function buildWarnings(actionCounts, weakest) {
  const warnings = [];
  if (!state.history.length) warnings.push("还没有行动记录：先完成 1 次深度学习或做作品。");
  if ((actionCounts["build-project"] || 0) === 0) warnings.push("最近 4 次没有做作品：学习成果缺少可验证证据。");
  if ((actionCounts.earn || 0) === 0 && state.level >= 3) warnings.push("已经进入作品阶段，但还没有变现动作。");
  if ((actionCounts.social || 0) === 0) warnings.push("社交协作不足：未来机会通常来自弱连接和真实反馈。");
  if (state.stats.energy < 30) warnings.push("能量低于 30：继续冲刺会让学习收益下降。");
  if (state.stats.capital < 20) warnings.push("资本低于 20：需要控制消费并设计低价服务包。");
  warnings.push(`当前最低资源是「${statName(weakest[0].key)}」：这是下一轮优先补的短板。`);
  return warnings.slice(0, 4);
}

function buildNextActions(current, career, actionCounts, weakest) {
  const tasks = [];
  const weakestKey = weakest[0].key;

  if (weakestKey === "energy" || state.stats.energy < 30) {
    tasks.push("安排 1 次恢复能量，保证下周至少 3 天高质量学习。");
  }
  if (weakestKey === "skill" || state.stats.skill < 45) {
    tasks.push(`围绕「${career.name}」做 1 个 2 小时可演示小作品。`);
  }
  if (weakestKey === "network" || (actionCounts.social || 0) === 0) {
    tasks.push("联系 5 个目标行业的人，问一个具体问题并记录反馈。");
  }
  if (weakestKey === "capital" || state.stats.capital < 35) {
    tasks.push("设计一个 299 元入门服务包，并发给 10 个潜在客户。");
  }
  if (state.stats.reputation < 45) {
    tasks.push(`公开发布一条证据：${career.proof[0]}。`);
  }
  tasks.push(current.quests[0]);
  tasks.push(`补齐职业证明：${career.proof[state.portfolio.length % career.proof.length]}。`);

  return [...new Set(tasks)].slice(0, 3);
}

function renderCoach() {
  const report = buildCoachReport();
  $("coachDiagnosis").textContent = report.diagnosis;
  $("coachSummary").textContent = report.summary;
  $("coachWarnings").innerHTML = listItems(report.warnings);
  $("coachNextActions").innerHTML = listItems(report.nextActions);
  renderSprintBoard(report.nextActions);
}

function renderSprintBoard(nextActions) {
  const career = selectedCareer();
  const sprint = [
    ["第 1 周", nextActions[0] || "完成一次深度学习。"],
    ["第 2 周", `做出一个和「${career.name}」相关的最小作品。`],
    ["第 3 周", "找 5 个人要反馈，整理成公开复盘。"],
    ["第 4 周", "把作品包装成服务包，完成 1 次报价或模拟成交。"]
  ];
  $("sprintBoard").innerHTML = sprint.map(([week, task]) => `
    <article class="sprint-step">
      <span>${escapeHtml(week)}</span>
      <p>${escapeHtml(task)}</p>
    </article>
  `).join("");
}

function renderPortfolio() {
  const career = selectedCareer();
  $("portfolioIntro").textContent = `目标「${career.name}」需要把能力变成证据，而不是只停留在学习记录。`;
  $("portfolioList").innerHTML = career.proof.map((proof, index) => {
    const done = state.portfolio.some((item) => item.proof === proof);
    return `<li><strong>${done ? "已证明" : "待证明"}：</strong>${escapeHtml(proof)}</li>`;
  }).join("");

  $("evidenceList").innerHTML = state.portfolio.length
    ? state.portfolio.slice(0, 8).map((item) => `
      <div class="evidence-item">
        <div class="evidence-topline">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(statusName(item.status))}</span>
        </div>
        <span>第 ${escapeHtml(item.week)} 周 / ${escapeHtml(item.proof)}</span>
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开作品链接</a>` : ""}
        ${item.feedback ? `<p>${escapeHtml(item.feedback)}</p>` : ""}
      </div>
    `).join("")
    : `<div class="empty-state">还没有资产。点击“添加本周证据”，把当前任务沉淀成作品记录。</div>`;
}

function statusName(status) {
  const names = {
    draft: "草稿",
    published: "已发布",
    validated: "有反馈",
    paid: "已变现"
  };
  return names[status] || names.draft;
}

function renderIncomeModel() {
  const career = selectedCareer();
  const offers = buildOffers(career);
  $("incomeOffers").innerHTML = offers.map((offer) => `
    <button class="offer-button" type="button" data-offer="${offer.id}">
      <strong>${escapeHtml(offer.name)}</strong>
      <span>${escapeHtml(offer.priceLabel)}</span>
      <p>${escapeHtml(offer.promise)}</p>
    </button>
  `).join("");
  $("incomeSummary").textContent = `累计模拟收入：${formatMoney(state.revenue)}。当前资本 ${Math.round(state.stats.capital)}，声望 ${Math.round(state.stats.reputation)}。`;

  document.querySelectorAll(".offer-button").forEach((button) => {
    button.addEventListener("click", () => closeOffer(button.dataset.offer));
  });
}

function renderRoadmap() {
  const career = selectedCareer();
  const major = selectedMajor();
  const weakest = weakestStats()[0];
  const proofGap = career.proof.filter((proof) => !state.portfolio.some((item) => item.proof === proof));
  const recommendations = [
    {
      title: "90 天主线",
      items: [
        `第 1-30 天：围绕「${major.name}」补基础，并做 1 个和「${career.name}」直接相关的小作品。`,
        "第 31-60 天：公开作品、拿反馈、联系 20 个真实从业者或潜在客户。",
        "第 61-90 天：把最强作品包装成服务包，完成 3 次报价或 1 次真实交付。"
      ]
    },
    {
      title: "当前最优下一步",
      items: [
        `优先补「${statName(weakest.key)}」，当前只有 ${Math.round(weakest.value)} 点。`,
        proofGap.length ? `先补齐证据：${proofGap[0]}。` : "职业证据已经成型，下一步提高报价和交付难度。",
        state.stats.energy < 35 ? "先恢复能量，再做高强度冲刺。" : "本周可以做一次作品或报价冲刺。"
      ]
    },
    {
      title: "系统升级建议",
      items: [
        "接入真实招聘和项目需求数据，按地区、行业、薪资动态修正评分。",
        "加入 AI 教练自然语言复盘，把每 4 周行动转成可执行周计划。",
        "加入作品链接和客户反馈字段，让资产仓库变成真正作品集。"
      ]
    }
  ];

  $("roadmapGrid").innerHTML = recommendations.map((group) => `
    <article class="roadmap-card">
      <h3>${escapeHtml(group.title)}</h3>
      <ul>${listItems(group.items)}</ul>
    </article>
  `).join("");
}

function buildOffers(career) {
  const starter = 299 + state.level * 80 + Math.round(state.stats.reputation * 4);
  const sprint = 1999 + Math.round(state.stats.skill * 18 + state.stats.ai * 14);
  const retainer = 4999 + Math.round(state.stats.reputation * 52 + state.stats.network * 36);
  return [
    {
      id: "starter",
      name: "入门诊断包",
      price: starter,
      priceLabel: formatMoney(starter),
      promise: `为客户拆解一个「${career.name}」相关问题，交付 1 页行动建议。`
    },
    {
      id: "sprint",
      name: "两周作品冲刺",
      price: sprint,
      priceLabel: formatMoney(sprint),
      promise: "交付一个可演示原型、复盘文档和下一步路线。"
    },
    {
      id: "retainer",
      name: "月度增长顾问",
      price: retainer,
      priceLabel: formatMoney(retainer),
      promise: "每周复盘、任务拆解、自动化流程和作品资产迭代。"
    }
  ];
}

function formatMoney(value) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function closeOffer(offerId) {
  const offer = buildOffers(selectedCareer()).find((item) => item.id === offerId);
  if (!offer) return;
  state.revenue += offer.price;
  applyEffects({
    capital: offerId === "starter" ? 6 : offerId === "sprint" ? 12 : 18,
    reputation: offerId === "starter" ? 3 : offerId === "sprint" ? 7 : 11,
    network: offerId === "retainer" ? 6 : 2,
    xp: offerId === "starter" ? 12 : offerId === "sprint" ? 24 : 36,
    energy: offerId === "retainer" ? -10 : -6
  });
  state.log.unshift(`模拟成交：${offer.name}，收入 ${offer.priceLabel}。`);
  commit();
}

function addEvidence(details = {}) {
  const career = selectedCareer();
  const current = DATA.levels.find((item) => item.level === state.level) || DATA.levels[0];
  const proof = career.proof[state.portfolio.length % career.proof.length];
  const status = VALID_EVIDENCE_STATUSES.includes(details.status) ? details.status : "draft";
  state.portfolio.unshift({
    week: state.week,
    title: String(details.title || `${current.name}证据 ${state.portfolio.length + 1}`).slice(0, 80),
    proof,
    careerId: career.id,
    url: normalizeUrl(details.url),
    feedback: String(details.feedback || "").slice(0, 180),
    status
  });
  state.portfolio = state.portfolio.slice(0, 30);
  applyEffects({
    reputation: status === "paid" ? 8 : status === "validated" ? 6 : 4,
    capital: status === "paid" ? 5 : 0,
    xp: status === "paid" ? 18 : status === "validated" ? 14 : 10
  });
  state.log.unshift(`新增作品资产：${proof}${details.url ? "，已记录链接" : ""}。`);
  commit();
}

function renderMission() {
  const current = DATA.levels.find((item) => item.level === state.level) || DATA.levels[0];
  $("missionTitle").textContent = current.name;
  $("missionGoal").textContent = current.goal;
  $("missionQuests").innerHTML = listItems(current.quests);
}

function renderStats() {
  const topCareer = DATA.careers.find((career) => career.id === state.selectedCareerId);
  $("levelLabel").textContent = `Lv.${state.level}`;
  $("targetCareerLabel").textContent = topCareer?.name || "未选择";
  $("weeklyStateLabel").textContent = state.stats.energy < 25 ? "需要恢复" : state.xp > 0 ? "推进中" : "准备行动";
  $("weekNumber").textContent = state.week;

  [
    ["skill", "skillScore", "skillProgress"],
    ["network", "networkScore", "networkProgress"],
    ["capital", "capitalScore", "capitalProgress"],
    ["energy", "energyScore", "energyProgress"]
  ].forEach(([key, scoreId, progressId]) => {
    $(scoreId).textContent = Math.round(state.stats[key]);
    $(progressId).value = state.stats[key];
  });

  $("eventLog").innerHTML = listItems(state.log.slice(0, 8));
}

function renderProfile() {
  $("stageInput").value = state.profile.stage;
  $("timeInput").value = state.profile.time;
  $("riskInput").value = state.profile.risk;
  $("budgetInput").value = state.profile.budget;
  $("timeValue").textContent = `${state.profile.time} 小时`;
  $("riskValue").textContent = `${state.profile.risk} / 10`;
  $("budgetValue").textContent = `${state.profile.budget} 点`;

  document.querySelectorAll(".trait").forEach((button) => {
    button.classList.toggle("active", state.profile.traits.includes(button.dataset.trait));
  });
}

function renderDecisionCard() {
  const major = selectedMajor();
  const career = selectedCareer();
  const adjacentMajors = sortedMajors()
    .filter((item) => item.id !== major.id)
    .slice(0, 2)
    .map((item) => item.name);
  const adjacentCareers = sortedCareers()
    .filter((item) => item.id !== career.id)
    .slice(0, 2)
    .map((item) => item.name);
  const cards = [
    {
      title: "学生自测",
      items: [
        ...(major.bestFor || []).slice(0, 2),
        `能否接受「${career.dayInLife?.[0] || "长期练习"}」这类日常任务。`,
        `30 天内做出：${major.firstProjects?.[0] || career.proof[0]}。`
      ]
    },
    {
      title: "家长视角",
      items: [
        `先支持时间和环境，而不是只催结果：每周 ${state.profile.time} 小时是当前预算。`,
        `关注风险：${career.risk}`,
        "用作品、访谈和反馈判断方向，不只看专业名称。"
      ]
    },
    {
      title: "30 天验证",
      className: "action",
      items: [
        major.firstProjects?.[0] || "做一个最小作品。",
        `补一项职业证明：${career.proof[0]}。`,
        "找 5 个从业者、老师或潜在客户问同一个具体问题。"
      ]
    },
    {
      title: "换路信号",
      className: "warning",
      items: [
        "连续 30 天无法完成最小行动，先降低难度或换相邻方向。",
        `如果不适应「${career.dayInLife?.[1] || "重复训练"}」，优先尝试 ${adjacentCareers[0] || "相邻职业"}。`,
        `可切换方向：${[...adjacentMajors, ...adjacentCareers].slice(0, 3).join(" / ")}。`
      ]
    }
  ];

  $("decisionGrid").innerHTML = cards.map((card) => `
    <article class="decision-card ${card.className || ""}">
      <h3>${escapeHtml(card.title)}</h3>
      <ul>${listItems(card.items)}</ul>
    </article>
  `).join("");
}

function bindProfile() {
  $("stageInput").addEventListener("change", (event) => {
    state.profile.stage = event.target.value;
    commit();
  });

  [
    ["timeInput", "time", "timeValue", " 小时"],
    ["riskInput", "risk", "riskValue", " / 10"],
    ["budgetInput", "budget", "budgetValue", " 点"]
  ].forEach(([inputId, key, labelId, suffix]) => {
    $(inputId).addEventListener("input", (event) => {
      state.profile[key] = Number(event.target.value);
      $(labelId).textContent = `${state.profile[key]}${suffix}`;
      saveState();
      renderMajors();
      renderCareers();
    });
  });

  document.querySelectorAll(".trait").forEach((button) => {
    button.addEventListener("click", () => {
      const trait = button.dataset.trait;
      if (state.profile.traits.includes(trait)) {
        state.profile.traits = state.profile.traits.filter((item) => item !== trait);
      } else {
        state.profile.traits.push(trait);
      }
      commit();
    });
  });
}

function bindControls() {
  $("resetButton").addEventListener("click", () => {
    state = structuredClone(defaultState);
    commit();
  });

  $("coachButton").addEventListener("click", () => {
    const report = buildCoachReport();
    state.lastCoachWeek = state.week - 1;
    state.log.unshift(`手动复盘：${report.diagnosis}。`);
    commit();
  });

  $("addEvidenceButton").addEventListener("click", addEvidence);

  $("evidenceForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addEvidence({
      title: $("evidenceTitleInput").value.trim(),
      url: $("evidenceUrlInput").value.trim(),
      status: $("evidenceStatusInput").value,
      feedback: $("evidenceFeedbackInput").value.trim()
    });
    $("evidenceTitleInput").value = "";
    $("evidenceUrlInput").value = "";
    $("evidenceFeedbackInput").value = "";
    $("evidenceStatusInput").value = "draft";
    $("evidenceFormStatus").textContent = "证据已保存。";
  });

  $("exportButton").addEventListener("click", async () => {
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      selectedMajor: DATA.majors.find((major) => major.id === state.selectedMajorId)?.name,
      selectedCareer: DATA.careers.find((career) => career.id === state.selectedCareerId)?.name,
      state
    }, null, 2);
    $("importInput").value = payload;

    try {
      await navigator.clipboard.writeText(payload);
      state.log.unshift("进度已复制到剪贴板。");
      $("importStatus").textContent = "进度已复制，也已放入下方文本框。";
    } catch {
      state.log.unshift("浏览器不允许写入剪贴板；你仍可在控制台读取 localStorage。");
      $("importStatus").textContent = "浏览器不允许写入剪贴板，进度已放入下方文本框。";
    }
    commit();
  });

  $("importButton").addEventListener("click", () => {
    const payload = $("importInput").value.trim();
    if (!payload) {
      $("importStatus").textContent = "请先粘贴进度 JSON。";
      return;
    }

    try {
      const parsed = JSON.parse(payload);
      const nextState = parsed && typeof parsed === "object" && parsed.state ? parsed.state : parsed;
      state = normalizeState(nextState);
      state.log.unshift("进度导入成功。");
      $("importStatus").textContent = "进度导入成功。";
      commit();
    } catch (error) {
      $("importStatus").textContent = `导入失败：${error instanceof SyntaxError ? "JSON 格式不正确" : error.message}。`;
    }
  });
}

function commit() {
  saveState();
  render();
}

function render() {
  renderProfile();
  renderStats();
  renderCommand();
  renderDecisionCard();
  renderMajors();
  renderCareers();
  renderQuestMap();
  renderMission();
  renderCoach();
  renderPortfolio();
  renderIncomeModel();
  renderRoadmap();
}

function boot() {
  [
    "majorList",
    "careerList",
    "questMap",
    "actionGrid"
  ].forEach((id) => {
    els[id] = $(id);
  });

  if (!DATA) {
    document.body.innerHTML = "<main><h1>数据未加载</h1><p>请确认 data/future-pathways.js 存在。</p></main>";
    return;
  }

  bindProfile();
  bindControls();
  renderActions();
  render();
}

document.addEventListener("DOMContentLoaded", boot);
