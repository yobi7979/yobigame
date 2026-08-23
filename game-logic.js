// game-logic.js — 순수 로직 모듈 (DOM/브라우저 API 무의존)
// node --test tests/game.test.js 로 검증 가능

// ===== 스테이지 구성 (계획서 2.3절) =====
const CONFIG = {
  STAGES: [
    { time: 120, ratio: { basic: 1, fast: 0, tanky: 0, ranged: 0 }, clearKills: 20, boss: false },
    { time: 150, ratio: { basic: 0.7, fast: 0.3, tanky: 0, ranged: 0 }, clearKills: 30, boss: false },
    { time: 180, ratio: { basic: 0.5, fast: 0.25, tanky: 0.15, ranged: 0.1 }, clearKills: 40, boss: false },
    { time: 180, ratio: { basic: 0.4, fast: 0.25, tanky: 0.2, ranged: 0.15 }, clearKills: 50, boss: false },
    { time: 210, ratio: { basic: 0.35, fast: 0.25, tanky: 0.2, ranged: 0.2 }, clearKills: 60, boss: true }, // miniboss
    { time: 210, ratio: { basic: 0.3, fast: 0.25, tanky: 0.25, ranged: 0.2 }, clearKills: 80, boss: false },
    { time: 240, ratio: { basic: 0.25, fast: 0.25, tanky: 0.25, ranged: 0.25 }, clearKills: 100, boss: false },
    { time: 270, ratio: { basic: 0.2, fast: 0.25, tanky: 0.25, ranged: 0.3 }, clearKills: 0, boss: true }, // final boss
  ],
  ENEMIES: {
    basic:    { hp: 30,  speed: 90,  dmg: 14, xp: 2  },
    fast:     { hp: 15,  speed: 170, dmg: 12, xp: 2  },
    tanky:    { hp: 120, speed: 55,  dmg: 26, xp: 4  },
    ranged:   { hp: 20,  speed: 80,  dmg: 18, xp: 3  },
    miniboss: { hp: 800, speed: 70,  dmg: 30, xp: 30 },
    boss:     { hp: 12000, speed: 70, dmg: 40, xp: 150 },
  },
  SKILLS: {
    fireball: [
      { dmg: 25, cd: 1.5, pierce: 0 },
      { dmg: 35, cd: 1.5, pierce: 0 },
      { dmg: 50, cd: 1.5, pierce: 1 },
      { dmg: 70, cd: 1.5, pierce: 2 },
      { dmg: 100, cd: 1.5, pierce: 3, burn: 3, burnDps: 5 },
    ],
    chainlightning: [
      { dmg: 20, cd: 2, chains: 2 },
      { dmg: 30, cd: 2, chains: 3 },
      { dmg: 45, cd: 1.8, chains: 4 },
      { dmg: 60, cd: 1.8, chains: 5 },
      { dmg: 80, cd: 1.5, chains: 6, slow: 30, slowDur: 2 },
    ],
    shield: [
      { hp: 100, dur: 20 },
      { hp: 150, dur: 20 },
      { hp: 200, dur: 30 },
      { hp: 300, dur: 30, dmgReduce: 20 },
      { hp: 400, dur: 45, dmgReduce: 20 },
    ],
    multishot: [
      { hits: 2 }, { hits: 3 }, { hits: 4 }, { hits: 5 }, { hits: 6 },
    ],
    lifesteal: [
      { pct: 2, killHeal: 0 },
      { pct: 4, killHeal: 0 },
      { pct: 6, killHeal: 2 },
      { pct: 8, killHeal: 3 },
      { pct: 10, killHeal: 5 },
    ],
    slowfield: [
      { pct: 20, radius: 100, cd: 5 },
      { pct: 30, radius: 120, cd: 5 },
      { pct: 40, radius: 140, cd: 4 },
      { pct: 50, radius: 160, cd: 4 },
      { pct: 60, radius: 180, cd: 3 },
    ],
    split: [
      { count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }, { count: 5 },
    ],
    spinblade: [
      { radius: 70, dps: 10 },
      { radius: 85, dps: 15 },
      { radius: 100, dps: 22 },
      { radius: 115, dps: 30 },
      { radius: 130, dps: 40, stun: 1, stunChance: 10 },
    ],
    explosion: [
      { cd: 3, radius: 80, dmg: 40 },
      { cd: 3, radius: 80, dmg: 55 },
      { cd: 3, radius: 100, dmg: 70 },
      { cd: 2.5, radius: 120, dmg: 90 },
      { cd: 2.5, radius: 140, dmg: 120 },
    ],
    speed: [
      { pct: 10 }, { pct: 20 }, { pct: 30 }, { pct: 40 }, { pct: 50 },
    ],
  },
};

const MAX_SKILL_LEVEL = 5;

// ===== 경험치 곡선 =====
// 레벨 n → n+1 에 필요한 XP (베이스 10→5, 절반으로 감속 완화 — 레벨업 가속)
function xpForLevel(n) {
  if (n < 1) return null;
  return Math.round(5 * Math.pow(1.35, n - 1));
}

// 누적 XP → 도달 레벨 (Lv1 시작)
function levelFromXp(totalXp) {
  let level = 1, remain = totalXp;
  while (remain >= xpForLevel(level)) {
    remain -= xpForLevel(level);
    level++;
  }
  return level;
}

// ===== 스테이지 난이도 공식 =====
function spawnInterval(stage) { return Math.max(0.25, 1.2 - stage * 0.1); }
function enemyHpScale(stage) { return 1 + (stage - 1) * 0.35; }
function enemyDmgScale(stage) { return 1 + (stage - 1) * 0.2; }

// ===== 적 타입 가중 랜덤 =====
function rollEnemyType(stage, rand) {
  const st = CONFIG.STAGES[stage - 1];
  const r = rand();
  let cum = 0;
  for (const [type, ratio] of Object.entries(st.ratio)) {
    cum += ratio;
    if (r < cum) return type;
  }
  return 'basic';
}

// ===== 스킬 통계 =====
function skillStats(id, level) {
  if (!id || !level || level < 1 || level > MAX_SKILL_LEVEL) return null;
  const sk = CONFIG.SKILLS[id];
  if (!sk) return null;
  return { id, level, ...sk[level - 1] };
}

// ===== 3택1 스킬 후보 생성 =====
function rollSkillChoices(player, rand) {
  const choices = [];
  const available = Object.keys(CONFIG.SKILLS);

  for (const id of available) {
    const currentLv = player.skills[id] || 0;
    if (currentLv >= MAX_SKILL_LEVEL) continue;
    // split은 fireball 보유 시에만
    if (id === 'split' && !player.skills.fireball) continue;
    const toLevel = currentLv + 1;
    // 미보유 가중 3, 보유(강화) 가중 1
    const weight = currentLv === 0 ? 3 : 1;
    for (let i = 0; i < weight; i++) {
      choices.push({ id, toLevel });
    }
  }

  // 중복 없는 3개 추출
  const result = [];
  const used = new Set();
  while (result.length < 3 && choices.length > 0) {
    const idx = Math.floor(rand() * choices.length);
    const c = choices[idx];
    const key = `${c.id}-${c.toLevel}`;
    if (!used.has(key)) {
      used.add(key);
      result.push(c);
    }
    choices.splice(idx, 1);
  }
  return result;
}

// ===== Mulberry32 PRNG =====
function makeRng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ===== Export =====
if (typeof module !== 'undefined') {
  module.exports = { CONFIG, xpForLevel, levelFromXp, spawnInterval, enemyHpScale, enemyDmgScale, rollEnemyType, skillStats, rollSkillChoices, makeRng };
}
if (typeof window !== 'undefined') {
  window.GameLogic = { CONFIG, xpForLevel, levelFromXp, spawnInterval, enemyHpScale, enemyDmgScale, rollEnemyType, skillStats, rollSkillChoices, makeRng };
}
