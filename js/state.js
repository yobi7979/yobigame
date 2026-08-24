// js/state.js — 게임 상태 — 상수, G/newRun, 저장소, 유틸
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== 상수 =====
const PLAYER = {
  speed: 220, hp: 120, maxHp: 120,
  atkDmg: 18, atkCd: 0.5, atkRange: 55,
  xpRadius: 60, invuln: 0.3, radius: 14,
};
const WORLD = { w: 2400, h: 1800 };
const ENEMY_COLORS = { basic: '#e63946', fast: '#7ae582', tanky: '#b197fc', ranged: '#4dabf7', miniboss: '#4ade80', boss: '#ff2e63' };
const MAX_ENEMIES = 60;

// ===== 게임 상태 =====
let G = null;
const cam = { x: 0, y: 0 };
const keys = {};
let currentChoices = [];

function newRun() {
  const g = {
    state: 'menu', time: 0, stage: 1,
    player: {
      x: WORLD.w/2, y: WORLD.h/2, radius: 14,
      hp: PLAYER.hp, maxHp: PLAYER.maxHp,
      shield: 0, shieldDur: 0,
      xp: 0, level: 1, dmgBonus: 0,
      skills: { shield: 1 }, atkTimer: 0, invulnTimer: 0, skillTimers: {},
      facing: { x: 1, y: 0 }, flash: 0, trail: [], animT: 0, moving: false,
    },
    enemies: [], projectiles: [], pickups: [], particles: [], slashes: [], floaters: [],
    items: [],
    lightnings: [], explosions: [], slowfieldFx: [], bossWarnings: [], waves: [],
    tempBuffs: { rage: 0, haste: 0, magnet: 0 },
    skillDamage: {},
    levelupQueue: 0, banner: '', bannerT: 0, bossSpawned: false,
    kills: 0, totalKills: 0,
    spawnTimer: 0, boss: null, stageTime: 0, shake: 0,
  };
  // ===== 동료 초기화 =====
  g.companion = {
    id: (CONFIG.COMPANIONS.find(c => c.id === chosenCompId) || CONFIG.COMPANIONS[0]).id,
    x: g.player.x - 45, y: g.player.y,
    atkTimer: 1, healTimer: 8, ultTimer: 10,
  };
  g.knives = [];
  const _gdef = CONFIG.COMPANIONS.find(c => c.id === g.companion.id);
  if (_gdef.passive.maxHp) { g.player.maxHp += _gdef.passive.maxHp; g.player.hp = g.player.maxHp; }
  return g;
}

// ===== 저장소 =====
const Save = {
  key: 'survival_roguelike_best',
  load() { try { return JSON.parse(localStorage.getItem(this.key)) || null; } catch { return null; } },
  save(rec) { try { localStorage.setItem(this.key, JSON.stringify(rec)); } catch {} },
};

// ===== 유틸 =====
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; }
function nearestEnemy(x, y, range) {
  return G.enemies.filter(e => e.hp > 0 && dist2(e, {x,y}) < range*range)
    .sort((a,b) => dist2(a,{x,y}) - dist2(b,{x,y}))[0];
}
