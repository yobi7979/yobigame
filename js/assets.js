// js/assets.js — 캔버스 + 에셋 로더 + 프레임 애니메이션(drawSprite)
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== Canvas =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

// ===== 에셋 로더 =====
const ASSET_NAMES = ['player','enemy_basic','enemy_fast','enemy_tanky','enemy_ranged','enemy_miniboss','enemy_boss','xp_orb','icon_fireball','icon_chainlightning','icon_shield','icon_multishot','icon_lifesteal','icon_slowfield','icon_split','icon_spinblade','icon_explosion','icon_speed','icon_iceshard','icon_tidal','icon_poison','icon_evo_chainlightning_fireball','icon_evo_fireball_poison','icon_evo_iceshard_poison','icon_evo_chainlightning_iceshard','icon_evo_chainlightning_poison','icon_evo_fireball_spinblade','icon_evo_chainlightning_spinblade','icon_evo_explosion_spinblade','icon_evo_iceshard_spinblade','icon_evo_spinblade_tidal','icon_evo_poison_spinblade','icon_evo_explosion_fireball','icon_evo_fireball_iceshard','icon_evo_chainlightning_explosion','icon_evo_explosion_iceshard','icon_evo_explosion_tidal','icon_evo_explosion_poison','icon_evo_fireball_tidal','icon_evo_chainlightning_tidal','icon_evo_iceshard_tidal','icon_evo_poison_tidal','bg_tile','floor_tex','wall_tex','title_art'];
const ASSETS = {};
let bgPattern = null;
ASSET_NAMES.forEach((name) => {
  const img = new Image();
  img.onload = () => { ASSETS[name] = img; };
  img.src = 'assets/' + name + '.png';
});
function drawAsset(name, x, y, size) {
  const a = ASSETS[name];
  if (!a) return false;
  ctx.drawImage(a, x - size / 2, y - size / 2, size, size);
  return true;
}

// ===== 프레임 애니메이션 (3프레임 시트) =====
// 1 캐릭터당 3프레임. 3개 전부 로드 성공 시에만 활성화, 그 외 정적 에셋 폴백
const ANIM_SPECS = {
  player: { fps: 9 },
  enemy_basic: { fps: 8 },
  enemy_fast: { fps: 12 },
  enemy_tanky: { fps: 5 },
  enemy_ranged: { fps: 7 },
  enemy_miniboss: { fps: 6 },
  enemy_boss: { fps: 6, seq: [0, 1, 2, 1] }, // 날개짓: 순환(팔린드롬) 시퀀스
  comp_warrior: { fps: 6 },
  comp_guardian: { fps: 5 },
  comp_shadow: { fps: 8 },
};
const ANIM = {};
for (const an in ANIM_SPECS) {
  const frames = [];
  let loaded = 0;
  for (let i = 0; i < 3; i++) {
    const img = new Image();
    img.onload = () => { loaded++; frames[i] = img; if (loaded === 3) ANIM[an] = frames; };
    img.src = 'assets/' + an + '_f' + i + '.png';
  }
}
// ===== 공격 애니메이션 (4프레임 시트 / player 6프레임) =====
// 공격 트리거 시 atkAnimT = ATK_DUR 설정 → 0까지 카운트다운. >0 동안 drawSprite가 공격 프레임 우선 렌더.
const ATK_DUR = 0.32;
const ATK_ANIM_NAMES = ['player','enemy_basic','enemy_fast','enemy_tanky','enemy_ranged','enemy_miniboss','enemy_boss','comp_warrior','comp_guardian','comp_shadow'];
const ATK_FRAME_COUNT = { player: 6 };   // 나머지 10종은 4프레임
const ATK_ANIM = {};
for (const an of ATK_ANIM_NAMES) {
  const n = ATK_FRAME_COUNT[an] || 4;
  const frames = [];
  let loaded = 0;
  for (let i = 0; i < n; i++) {
    const img = new Image();
    img.onload = () => { loaded++; frames[i] = img; if (loaded === n) ATK_ANIM[an] = frames; };
    img.src = 'assets/' + an + '_a' + i + '.png';
  }
}
function drawSprite(name, x, y, size, animT, moving, phase, atkAnimT) {
  if (atkAnimT > 0 && ATK_ANIM[name]) {
    const frames = ATK_ANIM[name];
    const t = clamp(atkAnimT / ATK_DUR, 0, 1);
    const idx = Math.min(frames.length - 1, Math.floor((1 - t) * frames.length));
    ctx.drawImage(frames[idx], x - size / 2, y - size / 2, size, size);
    return true;
  }
  const frames = ANIM[name];
  if (frames) {
    const spec = ANIM_SPECS[name];
    const t = (animT || 0) * spec.fps;
    const idx = spec.seq ? spec.seq[Math.floor(t) % spec.seq.length] : Math.floor(t) % frames.length;
    const bob = Math.sin(t * Math.PI + (phase || 0)) * size * (moving ? 0.035 : 0.012);
    ctx.drawImage(frames[idx], x - size / 2, y - size / 2 - bob, size, size);
    return true;
  }
  return drawAsset(name, x, y, size);
}
function iconHtml(id) {
  return ASSETS['icon_' + id]
    ? '<img src="assets/icon_' + id + '.png" style="width:24px;height:24px;vertical-align:middle;margin-right:5px;border-radius:6px">'
    : SKILL_ICONS[id] + ' ';
}
