// game-logic.js — 순수 로직 모듈 (DOM/브라우저 API 무의존)
// node --test tests/game.test.js 로 검증 가능

// ===== 스테이지 구성 (계획서 2.3절) =====
const CONFIG = {
  // 30 스테이지 — S5/10/15/20/25 미니보스, S30 최종보스 (S1–8은 원 밸런스 유지)
  STAGES: (function buildStages() {
    const N = 30;
    const r2 = x => Math.round(x * 100) / 100;
    const legacy = [
      { time: 120, ratio: { basic: 1, fast: 0, tanky: 0, ranged: 0 }, clearKills: 20 },
      { time: 150, ratio: { basic: 0.7, fast: 0.3, tanky: 0, ranged: 0 }, clearKills: 30 },
      { time: 180, ratio: { basic: 0.5, fast: 0.25, tanky: 0.15, ranged: 0.1 }, clearKills: 40 },
      { time: 180, ratio: { basic: 0.4, fast: 0.25, tanky: 0.2, ranged: 0.15 }, clearKills: 50 },
      { time: 210, ratio: { basic: 0.35, fast: 0.25, tanky: 0.2, ranged: 0.2 }, clearKills: 60, mini: true },
      { time: 210, ratio: { basic: 0.3, fast: 0.25, tanky: 0.25, ranged: 0.2 }, clearKills: 80 },
      { time: 240, ratio: { basic: 0.25, fast: 0.25, tanky: 0.25, ranged: 0.25 }, clearKills: 100 },
      { time: 270, ratio: { basic: 0.2, fast: 0.25, tanky: 0.25, ranged: 0.3 }, clearKills: 100 }, // S8: 최종 제거 → 일반 스테이지
    ];
    const arr = [];
    for (let s = 1; s <= N; s++) {
      const isFinal = s === N;
      const isMini = !isFinal && s % 5 === 0;
      let ratio, time, clearKills, boss = false;
      if (s <= 8) {
        const L = legacy[s - 1];
        ratio = L.ratio; time = L.time; clearKills = L.clearKills;
        boss = !!L.mini;
      } else if (!isFinal) {
        const u = (s - 8) / (N - 9); // s9..s29 → 0.048..1 (S8 밸런스를 유지하며 S29까지 보간)
        const basic = r2(0.2 + (0.1 - 0.2) * u);
        const fast = r2(0.25 + (0.25 - 0.25) * u);
        const tanky = r2(0.25 + (0.3 - 0.25) * u);
        const ranged = r2(1 - basic - fast - tanky); // 합=1 보정
        ratio = { basic, fast, tanky, ranged };
        time = Math.min(300, 240 + s * 5);
        clearKills = 100 + (s - 9) * 5; // s9:105 → s29:200
        boss = isMini;
      } else {
        ratio = { basic: 0.1, fast: 0.25, tanky: 0.3, ranged: 0.35 };
        time = 999; clearKills = 0; boss = true;
      }
      const stg = { time, ratio, clearKills, boss };
      if (boss) stg.bossType = isFinal ? 'boss' : 'miniboss';
      arr.push(stg);
    }
    return arr;
  })(),
  ENEMIES: {
    basic:    { hp: 30,  speed: 90,  dmg: 14, xp: 2  },
    fast:     { hp: 15,  speed: 170, dmg: 12, xp: 2  },
    tanky:    { hp: 120, speed: 55,  dmg: 26, xp: 4  },
    ranged:   { hp: 20,  speed: 80,  dmg: 18, xp: 3  },
    miniboss: { hp: 800, speed: 70,  dmg: 30, xp: 30 },
    boss:     { hp: 12000, speed: 70, dmg: 40, xp: 150 },
  },
  // ===== 아이템 드랍 (아이템별 확률 — 항상 드랍 아님) =====
  // 일반 몬스터: 아이템마다 독립 롤, p = weight/100 × ITEM_DROP_BASE (합계 ≈8%)
  // 미니보스: 확정 1개 / 최종보스: 확정 3개 (가중치 롤)
  ITEM_DROP_BASE: 0.08,
  ITEMS: {
    heart:  { label: '❤',  name: '최대HP+15',        color: '#ff6b9d', weight: 22 },
    gem:    { label: '💎', name: '공격+8% (영구)', color: '#c084fc', weight: 16 },
    rage:   { label: '🔥', name: '데미지 2배 8초',  color: '#ff9f1c', weight: 18 },
    haste:  { label: '👟', name: '이동속도+50% 8초', color: '#4dabf7', weight: 18 },
    mend:   { label: '✚',  name: 'HP 50% 회복',   color: '#69db7c', weight: 16 },
    magnet: { label: '🧲', name: '자석: 아이템 흡인',   color: '#ffd166', weight: 10 },
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
    // 신규 기본 공격 스킬 (얼음/물/독)
    iceshard: [
      { dmg: 25, cd: 1.4 }, { dmg: 35, cd: 1.3 }, { dmg: 45, cd: 1.2 },
      { dmg: 60, cd: 1.1 }, { dmg: 80, cd: 1.0, slow: 40, slowDur: 2 },
    ],
    tidal: [
      { dmg: 25, cd: 2.5, kb: 100 }, { dmg: 35, cd: 2.4, kb: 100 }, { dmg: 45, cd: 2.2, kb: 120 },
      { dmg: 60, cd: 2.0, kb: 120 }, { dmg: 80, cd: 1.8, kb: 140 },
    ],
    poison: [
      { dmg: 20, cd: 1.6, pdps: 8 }, { dmg: 28, cd: 1.5, pdps: 10 }, { dmg: 38, cd: 1.4, pdps: 12 },
      { dmg: 48, cd: 1.3, pdps: 15 }, { dmg: 60, cd: 1.2, pdps: 18 },
    ],
    speed: [
      { pct: 10 }, { pct: 20 }, { pct: 30 }, { pct: 40 }, { pct: 50 },
    ],
    power: [
      { pct: 10 }, { pct: 20 }, { pct: 30 }, { pct: 40 }, { pct: 50 },
    ],
  },
  // ===== 스킬 진화: 21종 (id = 'evo_' + 알파벳 순 페어) =====
  EVOLUTIONS: {
    evo_chainlightning_fireball: { name: '플라즈마 볼트', icon: '🔥⚡', form: 'proj', effect: 'burn', from: ['chainlightning', 'fireball'],
      desc: '270 대미지 · 관통 1 · 번 8/s',
      tiers: [
        { dmg: 270, cd: 1.2, pierce: 1, burn: 3, burnDps: 8 }, { dmg: 338, cd: 1.2, pierce: 2, burn: 3, burnDps: 10 }, { dmg: 405, cd: 1.2, pierce: 3, burn: 3, burnDps: 12 },
      ],
    },
    evo_fireball_poison: { name: '독염', icon: '🔥☠️', form: 'proj', effect: 'poison', from: ['fireball', 'poison'],
      desc: '240 대미지 · 관통 0 · 독 15/s',
      tiers: [
        { dmg: 240, cd: 1.2, pierce: 0, poisonDur: 3, poisonDps: 15 }, { dmg: 300, cd: 1.2, pierce: 1, poisonDur: 3, poisonDps: 20 }, { dmg: 360, cd: 1.2, pierce: 2, poisonDur: 3, poisonDps: 25 },
      ],
    },
    evo_iceshard_poison: { name: '독결', icon: '❄️☠️', form: 'proj', effect: 'poison', from: ['iceshard', 'poison'],
      desc: '210 대미지 · 관통 0 · 독 15/s',
      tiers: [
        { dmg: 210, cd: 1.2, pierce: 0, poisonDur: 3, poisonDps: 15 }, { dmg: 263, cd: 1.2, pierce: 1, poisonDur: 3, poisonDps: 20 }, { dmg: 315, cd: 1.2, pierce: 2, poisonDur: 3, poisonDps: 25 },
      ],
    },
    evo_chainlightning_iceshard: { name: '폭풍결빙', icon: '⚡❄️', form: 'chain', effect: 'slow', from: ['chainlightning', 'iceshard'],
      desc: '240 대미지 · 7연쇄 · 60% 슬로우 2.5s',
      tiers: [
        { dmg: 240, cd: 1.5, chains: 7, slow: 60, slowDur: 2.5 }, { dmg: 300, cd: 1.5, chains: 8, slow: 60, slowDur: 2.5 }, { dmg: 360, cd: 1.5, chains: 9, slow: 60, slowDur: 2.5 },
      ],
    },
    evo_chainlightning_poison: { name: '전기독', icon: '⚡☠️', form: 'chain', effect: 'poison', from: ['chainlightning', 'poison'],
      desc: '210 대미지 · 7연쇄 · 독 15/s',
      tiers: [
        { dmg: 210, cd: 1.5, chains: 7, poisonDur: 3, poisonDps: 15 }, { dmg: 263, cd: 1.5, chains: 8, poisonDur: 3, poisonDps: 20 }, { dmg: 315, cd: 1.5, chains: 9, poisonDur: 3, poisonDps: 25 },
      ],
    },
    evo_fireball_spinblade: { name: '블레이즈 휠', icon: '🔥🌀', form: 'spin', effect: 'burn', from: ['fireball', 'spinblade'],
      desc: '160 DPS · 반경 140 · 번 8/s',
      tiers: [
        { dps: 160, tick: 0.4, radius: 140, burn: 3, burnDps: 8 }, { dps: 200, tick: 0.4, radius: 155, burn: 3, burnDps: 10 }, { dps: 240, tick: 0.4, radius: 170, burn: 3, burnDps: 12 },
      ],
    },
    evo_chainlightning_spinblade: { name: '썬더 휠', icon: '⚡🌀', form: 'spin', effect: 'stun', from: ['chainlightning', 'spinblade'],
      desc: '139 DPS · 반경 140 · 15% 스툰',
      tiers: [
        { dps: 139, tick: 0.4, radius: 140, stun: 1, stunChance: 15 }, { dps: 174, tick: 0.4, radius: 155, stun: 1, stunChance: 20 }, { dps: 208, tick: 0.4, radius: 170, stun: 1, stunChance: 25 },
      ],
    },
    evo_explosion_spinblade: { name: '절멸 회오리', icon: '💥🌀', form: 'spin', effect: 'none', from: ['explosion', 'spinblade'],
      desc: '132 DPS · 반경 150',
      tiers: [
        { dps: 132, tick: 0.4, radius: 150 }, { dps: 165, tick: 0.4, radius: 165 }, { dps: 198, tick: 0.4, radius: 180 },
      ],
    },
    evo_iceshard_spinblade: { name: '서리 검환', icon: '❄️🌀', form: 'spin', effect: 'slow', from: ['iceshard', 'spinblade'],
      desc: '180 DPS · 반경 140 · 50% 슬로우 2s',
      tiers: [
        { dps: 180, tick: 0.4, radius: 140, slow: 50, slowDur: 2 }, { dps: 225, tick: 0.4, radius: 155, slow: 50, slowDur: 2 }, { dps: 270, tick: 0.4, radius: 170, slow: 50, slowDur: 2 },
      ],
    },
    evo_spinblade_tidal: { name: '소용돌이', icon: '🌊🌀', form: 'spin', effect: 'kb', from: ['spinblade', 'tidal'],
      desc: '126 DPS · 반경 140 · 밀어내기 60',
      tiers: [
        { dps: 126, tick: 0.4, radius: 140, kb: 60 }, { dps: 158, tick: 0.4, radius: 155, kb: 80 }, { dps: 189, tick: 0.4, radius: 170, kb: 100 },
      ],
    },
    evo_poison_spinblade: { name: '독검 환', icon: '☠️🌀', form: 'spin', effect: 'poison', from: ['poison', 'spinblade'],
      desc: '144 DPS · 반경 140 · 독 15/s',
      tiers: [
        { dps: 144, tick: 0.4, radius: 140, poisonDur: 3, poisonDps: 15 }, { dps: 180, tick: 0.4, radius: 155, poisonDur: 3, poisonDps: 20 }, { dps: 216, tick: 0.4, radius: 170, poisonDur: 3, poisonDps: 25 },
      ],
    },
    evo_explosion_fireball: { name: '메테오', icon: '☄️🔥', form: 'aoe', effect: 'burn', from: ['explosion', 'fireball'],
      desc: '330 대미지 · 반경 150 · 번 8/s',
      tiers: [
        { dmg: 330, cd: 2.5, radius: 150, burn: 3, burnDps: 8 }, { dmg: 413, cd: 2.5, radius: 170, burn: 3, burnDps: 10 }, { dmg: 495, cd: 2.5, radius: 190, burn: 3, burnDps: 12 },
      ],
    },
    evo_fireball_iceshard: { name: '스팀 버스트', icon: '♨️🌫️', form: 'aoe', effect: 'slow', from: ['fireball', 'iceshard'],
      desc: '270 대미지 · 반경 150 · 50% 슬로우 2.5s',
      tiers: [
        { dmg: 270, cd: 2.2, radius: 150, slow: 50, slowDur: 2.5 }, { dmg: 338, cd: 2.2, radius: 170, slow: 50, slowDur: 2.5 }, { dmg: 405, cd: 2.2, radius: 190, slow: 50, slowDur: 2.5 },
      ],
    },
    evo_chainlightning_explosion: { name: '뇌쇄', icon: '⚡💥', form: 'aoe', effect: 'stun', from: ['chainlightning', 'explosion'],
      desc: '300 대미지 · 반경 150 · 15% 스툰',
      tiers: [
        { dmg: 300, cd: 2.5, radius: 150, stun: 1, stunChance: 15 }, { dmg: 375, cd: 2.5, radius: 170, stun: 1, stunChance: 20 }, { dmg: 450, cd: 2.5, radius: 190, stun: 1, stunChance: 25 },
      ],
    },
    evo_explosion_iceshard: { name: '얼음 초신성', icon: '❄️💥', form: 'aoe', effect: 'slow', from: ['explosion', 'iceshard'],
      desc: '300 대미지 · 반경 150 · 60% 슬로우 2.5s',
      tiers: [
        { dmg: 300, cd: 2.5, radius: 150, slow: 60, slowDur: 2.5 }, { dmg: 375, cd: 2.5, radius: 170, slow: 60, slowDur: 2.5 }, { dmg: 450, cd: 2.5, radius: 190, slow: 60, slowDur: 2.5 },
      ],
    },
    evo_explosion_tidal: { name: '해일 대폭파', icon: '🌊💥', form: 'aoe', effect: 'kb', from: ['explosion', 'tidal'],
      desc: '300 대미지 · 반경 150 · 밀어내기 160',
      tiers: [
        { dmg: 300, cd: 2.5, radius: 150, kb: 160 }, { dmg: 375, cd: 2.5, radius: 170, kb: 200 }, { dmg: 450, cd: 2.5, radius: 190, kb: 240 },
      ],
    },
    evo_explosion_poison: { name: '역병 폭탄', icon: '☠️💥', form: 'aoe', effect: 'poison', from: ['explosion', 'poison'],
      desc: '270 대미지 · 반경 150 · 독 15/s',
      tiers: [
        { dmg: 270, cd: 2.5, radius: 150, poisonDur: 3, poisonDps: 15 }, { dmg: 338, cd: 2.5, radius: 170, poisonDur: 3, poisonDps: 20 }, { dmg: 405, cd: 2.5, radius: 190, poisonDur: 3, poisonDps: 25 },
      ],
    },
    evo_fireball_tidal: { name: '끓는 해일', icon: '🔥🌊', form: 'wave', effect: 'burn', from: ['fireball', 'tidal'],
      desc: '270 대미지 웨이브 · 번 8/s',
      tiers: [
        { dmg: 270, cd: 2.2, maxR: 260, burn: 3, burnDps: 8 }, { dmg: 338, cd: 2.2, maxR: 290, burn: 3, burnDps: 10 }, { dmg: 405, cd: 2.2, maxR: 320, burn: 3, burnDps: 12 },
      ],
    },
    evo_chainlightning_tidal: { name: '전기 해일', icon: '⚡🌊', form: 'wave', effect: 'stun', from: ['chainlightning', 'tidal'],
      desc: '240 대미지 웨이브 · 15% 스툰',
      tiers: [
        { dmg: 240, cd: 2.2, maxR: 260, stun: 1, stunChance: 15 }, { dmg: 300, cd: 2.2, maxR: 290, stun: 1, stunChance: 20 }, { dmg: 360, cd: 2.2, maxR: 320, stun: 1, stunChance: 25 },
      ],
    },
    evo_iceshard_tidal: { name: '서리 해일', icon: '❄️🌊', form: 'wave', effect: 'slow', from: ['iceshard', 'tidal'],
      desc: '240 대미지 웨이브 · 60% 슬로우 2.5s · 밀어내기 60',
      tiers: [
        { dmg: 240, cd: 2.2, maxR: 260, slow: 60, slowDur: 2.5, kb: 60 }, { dmg: 300, cd: 2.2, maxR: 290, slow: 60, slowDur: 2.5, kb: 60 }, { dmg: 360, cd: 2.2, maxR: 320, slow: 60, slowDur: 2.5, kb: 60 },
      ],
    },
    evo_poison_tidal: { name: '역병 물결', icon: '🌊☠️', form: 'wave', effect: 'poison', from: ['poison', 'tidal'],
      desc: '210 대미지 웨이브 · 독 15/s',
      tiers: [
        { dmg: 210, cd: 2.2, maxR: 260, poisonDur: 3, poisonDps: 15 }, { dmg: 263, cd: 2.2, maxR: 290, poisonDur: 3, poisonDps: 20 }, { dmg: 315, cd: 2.2, maxR: 320, poisonDur: 3, poisonDps: 25 },
      ],
    },
  },
  COMPANIONS: [
    {
      id: 'warrior', name: '광전사', icon: '⚔️',
      passive: { dmgPct: 25 },
      atk: { cd: 1.5, range: 130, dmg: 30 },
      ult: { cd: 12, radius: 100, dmg: 80, label: '전쟁의 포효' },
      desc: '공격력 +25%<br>자동공격 30데미지 / 포효: 주변 80데미지',
    },
    {
      id: 'guardian', name: '수호자', icon: '🛡️',
      passive: { maxHp: 50 },
      heal: { cd: 10, amount: 15 },
      ult: { cd: 15, shield: 60, label: '장벽' },
      desc: '최대 체력 +50<br>자동 회복 15 / 장벽: 보호막 60',
    },
    {
      id: 'shadow', name: '그림자', icon: '🗡️',
      passive: { atkSpdPct: 25 },
      atk: { cd: 0.8, range: 160, dmg: 8, projSpeed: 320 },
      ult: { cd: 12, range: 150, hits: 3, dmg: 12, label: '그림자 일격' },
      desc: '공격속도 +25%<br>칼날 8데미지 / 그림자 일격: 3연격 12',
    },
  ],
};

const MAX_SKILL_LEVEL = 5;
const MAX_EVO_LEVEL = 3;
const ATTACK_SKILL_IDS = ['fireball', 'chainlightning', 'spinblade', 'explosion', 'iceshard', 'tidal', 'poison'];

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

// ===== 아이템 드랍 (확률적) =====
// 아이템별 드랍 확률: weight/100 × ITEM_DROP_BASE (0 < p < 1)
function itemDropChance(id) {
  const it = CONFIG.ITEMS[id];
  return it ? it.weight / 100 * CONFIG.ITEM_DROP_BASE : 0;
}
// 가중치 롤 (미니보스/최종보스 확정 드랍용)
function rollItem(rand) {
  rand = rand || Math.random;
  const items = CONFIG.ITEMS;
  const total = Object.values(items).reduce((s, it) => s + it.weight, 0);
  let r = rand() * total;
  for (const id in items) { r -= items[id].weight; if (r < 0) return id; }
  return 'heart';
}

// ===== 스킬 통계 =====
function skillStats(id, level) {
  if (!id || !level || level < 1) return null;
  const sk = CONFIG.SKILLS[id];
  if (sk) {
    if (level > MAX_SKILL_LEVEL) return null;
    return { id, level, ...sk[level - 1] };
  }
  // 진화 스킬: Lv3까지
  const evo = CONFIG.EVOLUTIONS[id];
  if (evo) {
    if (level > MAX_EVO_LEVEL) return null;
    return { id, level, ...evo.tiers[level - 1] };
  }
  return null;
}

// ===== 5택1 스킬 후보 생성 (레벨업 시) =====
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

  // 진화 스킬: 보유 중일 때만 풀에 등장 (Lv3까지)
  for (const id in CONFIG.EVOLUTIONS) {
    const lvl = (player && player.skills && player.skills[id]) || 0;
    if (lvl > 0 && lvl < MAX_EVO_LEVEL) {
      const toLevel = lvl + 1;
      for (let i = 0; i < 3; i++) choices.push({ id, toLevel });
    }
  }

  // 중복 없는 5개 추출
  const result = [];
  const used = new Set();
  while (result.length < 5 && choices.length > 0) {
    const idx = Math.floor(rand() * choices.length);
    const c = choices[idx];
    const key = `${c.id}-${c.toLevel}`;
    if (!used.has(key)) {
      used.add(key);
      result.push(c);
    }
    choices.splice(idx, 1);
  }
  // 심기(스킬 다 최대화)에 후보가 5종 미만이면 템 효과(applyItem)로 항상 5개를 채움
  if (result.length < 5) {
    const fills = Object.keys(CONFIG.ITEMS).slice();
    for (let i = fills.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [fills[i], fills[j]] = [fills[j], fills[i]];
    }
    for (const itemId of fills.slice(0, 5 - result.length)) {
      result.push({ fill: itemId });
    }
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

// ===== 스킬 진화 =====
function evoId(a, b) {
  const [x, y] = [a, b].sort();
  return 'evo_' + x + '_' + y;
}

// Lv5 공격 스킬 페어 → 진화 후보 목록
function evolutionPairs(player) {
  const maxed = ATTACK_SKILL_IDS.filter(id => (player.skills && player.skills[id]) === MAX_SKILL_LEVEL);
  const out = [];
  for (let i = 0; i < maxed.length; i++) for (let j = i + 1; j < maxed.length; j++) {
    const [a, b] = [maxed[i], maxed[j]].sort();
    const evo = CONFIG.EVOLUTIONS['evo_' + a + '_' + b];
    if (evo) out.push({ a, b, id: 'evo_' + a + '_' + b, ...evo });
  }
  return out;
}

// 순수 함수: 두 스킬 삭제 → 진화 스킬 Lv1 추가 (원 객체 불변)
function evolveSkills(player, a, b) {
  const [x, y] = [a, b].sort();
  const id = 'evo_' + x + '_' + y;
  if (!CONFIG.EVOLUTIONS[id]) return player.skills;
  const skills = { ...player.skills };
  delete skills[a]; delete skills[b];
  skills[id] = 1;
  return skills;
}

// 조합 가능 감지: 레벨 무관하게, 다른 소유 스킬과 진화 페어를 이루는 보유 공격 스킬 ID 목록
// (UI에서 색상 구분용 — Lv5 도달 전부터 조합 후보 표시)
function combinableIds(player) {
  const ids = Object.keys((player && player.skills) || {});
  const out = [];
  for (const a of ids) {
    if (!ATTACK_SKILL_IDS.includes(a)) continue;
    if (ids.some(b => b !== a && CONFIG.EVOLUTIONS[evoId(a, b)])) out.push(a);
  }
  return out;
}

// ===== Export =====
const EXPORTS = { CONFIG, MAX_SKILL_LEVEL, MAX_EVO_LEVEL, ATTACK_SKILL_IDS, xpForLevel, levelFromXp, spawnInterval, enemyHpScale, enemyDmgScale, rollEnemyType, itemDropChance, rollItem, skillStats, rollSkillChoices, makeRng, evoId, evolutionPairs, evolveSkills, combinableIds };
if (typeof module !== 'undefined') {
  module.exports = EXPORTS;
}
if (typeof window !== 'undefined') {
  window.GameLogic = EXPORTS;
}
