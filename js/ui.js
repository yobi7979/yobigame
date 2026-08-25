// js/ui.js — UI — DOM 참조, 이펙트 헬퍼, 모달, 시작/재시작
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== DOM 참조 =====
const hudEl = document.getElementById('hud');
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const xpFill = document.getElementById('xpFill');
const xpText = document.getElementById('xpText');
const lvlText = document.getElementById('lvlText');
const stageInfo = document.getElementById('stageInfo');
const timer = document.getElementById('timer');
const killsEl = document.getElementById('kills');
const buffsEl = document.getElementById('buffs');
const atkPct = document.getElementById('atkPct');
const atkSpdPct = document.getElementById('atkSpdPct');
const bossBar = document.getElementById('bossBar');
const bossFill = document.getElementById('bossFill');
const bossHpText = document.getElementById('bossHpText');
const bossName = document.getElementById('bossName');
const skillsEl = document.getElementById('skills');
const evolveBtn = document.getElementById('evolveBtn');
const evolveModal = document.getElementById('evolveModal');
const evolveChoicesEl = document.getElementById('evolveChoices');
let currentEvoPairs = [];
const startModal = document.getElementById('startModal');
const levelupModal = document.getElementById('levelupModal');
const skillChoices = document.getElementById('skillChoices');
const gameoverModal = document.getElementById('gameoverModal');
const goStats = document.getElementById('goStats');
const winModal = document.getElementById('winModal');
const winStats = document.getElementById('winStats');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const winRestartBtn = document.getElementById('winRestartBtn');

const SKILL_ICONS = { fireball: '🔥', chainlightning: '⚡', shield: '🛡️', multishot: '🗡️', lifesteal: '🩸', slowfield: '❄️', split: '✳️', spinblade: '🌀', explosion: '💥', speed: '💨', power: '💪', iceshard: '❄️', tidal: '🌊', poison: '☠️', evo_chainlightning_fireball: '🔥⚡', evo_fireball_poison: '🔥☠️', evo_iceshard_poison: '❄️☠️', evo_chainlightning_iceshard: '⚡❄️', evo_chainlightning_poison: '⚡☠️', evo_fireball_spinblade: '🔥🌀', evo_chainlightning_spinblade: '⚡🌀', evo_explosion_spinblade: '💥🌀', evo_iceshard_spinblade: '❄️🌀', evo_spinblade_tidal: '🌊🌀', evo_poison_spinblade: '☠️🌀', evo_explosion_fireball: '☄️🔥', evo_fireball_iceshard: '♨️🌫️', evo_chainlightning_explosion: '⚡💥', evo_explosion_iceshard: '❄️💥', evo_explosion_tidal: '🌊💥', evo_explosion_poison: '☠️💥', evo_fireball_tidal: '🔥🌊', evo_chainlightning_tidal: '⚡🌊', evo_iceshard_tidal: '❄️🌊', evo_poison_tidal: '🌊☠️' };
const SKILL_NAMES = { fireball: '파이어볼', chainlightning: '체인 라이트닝', shield: '시ールド', multishot: '멀티샷', lifesteal: '라이프스틸', slowfield: '슬로필드', split: '스플릿', spinblade: '스핀 블레이드', explosion: '익스플로전', speed: '이동 속도', power: '데미지 강화', iceshard: '아이스 샤드', tidal: '틸 웨이브', poison: '베놈 디아드', evo_chainlightning_fireball: '플라즈마 볼트', evo_fireball_poison: '독염', evo_iceshard_poison: '독결', evo_chainlightning_iceshard: '폭풍결빙', evo_chainlightning_poison: '전기독', evo_fireball_spinblade: '블레이즈 휠', evo_chainlightning_spinblade: '썬더 휠', evo_explosion_spinblade: '절멸 회오리', evo_iceshard_spinblade: '서리 검환', evo_spinblade_tidal: '소용돌이', evo_poison_spinblade: '독검 환', evo_explosion_fireball: '메테오', evo_fireball_iceshard: '스팀 버스트', evo_chainlightning_explosion: '뇌쇄', evo_explosion_iceshard: '얼음 초신성', evo_explosion_tidal: '해일 대폭파', evo_explosion_poison: '역병 폭탄', evo_fireball_tidal: '끓는 해일', evo_chainlightning_tidal: '전기 해일', evo_iceshard_tidal: '서리 해일', evo_poison_tidal: '역병 물결' };
function skillDescLine(id, st) {
  switch (id) {
    case 'fireball': return st.dmg + ' 데미지 / ' + st.cd + '초' + (st.pierce ? ' / 관통 ' + st.pierce : '') + (st.burn ? ' / 지속 피해' : '');
    case 'chainlightning': return st.dmg + ' 데미지 / ' + st.chains + '개 체인' + (st.slow ? ' / ' + st.slow + '% 슬로우' : '');
    case 'shield': return st.hp + ' 보호막 / ' + st.dur + '초' + (st.dmgReduce ? ' / 피해 -' + st.dmgReduce + '%' : '');
    case 'multishot': return '근접 공격 ' + st.hits + '회';
    case 'lifesteal': return '격 hit 시 ' + st.pct + '% 흡혈' + (st.killHeal ? ' / 처치 시 +' + st.killHeal : '');
    case 'slowfield': return '반경 ' + st.radius + ' / ' + st.pct + '% 슬로우 / ' + st.cd + '초';
    case 'split': return '격 hit 시 ' + st.count + '개로 분열';
    case 'spinblade': return '반경 ' + st.radius + ' / ' + st.dps + ' DPS' + (st.stun ? ' / 스툰' : '');
    case 'explosion': return '반경 ' + st.radius + ' / ' + st.dmg + ' 데미지 / ' + st.cd + '초';
    case 'speed': return '이동 속도 +' + st.pct + '%';
    case 'power': return '전체 공격력 +' + st.pct + '%';
    case 'iceshard': return st.dmg + ' 대미지 · CD ' + st.cd + '초' + (st.slow ? ' · 적 ' + st.slow + '% 슬로우 ' + st.slowDur + '초' : '');
    case 'tidal': return st.dmg + ' 대미지 웨이브 · 적 밀어내기 ' + st.kb + 'px';
    case 'poison': return st.dmg + ' 대미지 · 독 ' + st.pdps + '/s 지속 피해';
  }
  return evoDescLine(id, st);
}
function evoDescLine(id, st) {
  if (!CONFIG.EVOLUTIONS[id] || !st) return '';
  const parts = [SKILL_NAMES[id] || id];
  if (st.dmg) parts.push(st.dmg + ' 대미지');
  if (st.dps) parts.push(st.dps + ' DPS');
  if (st.radius) parts.push('반경 ' + st.radius);
  if (st.cd) parts.push('CD ' + st.cd + '초');
  if (st.pierce) parts.push('관통 ' + st.pierce);
  if (st.chains) parts.push(st.chains + '개 체인');
  if (st.burnDps) parts.push('번 ' + st.burnDps + '/s');
  if (st.poisonDps) parts.push('독 ' + st.poisonDps + '/s');
  if (st.slow) parts.push(st.slow + '% 슬로우 ' + st.slowDur + '초');
  if (st.stunChance) parts.push('스툰 ' + st.stunChance + '%');
  if (st.kb) parts.push('밀어내기 ' + st.kb + 'px');
  return parts.join(' · ');
}

// ===== 이펙트 헬퍼 =====
// 폭발: 이펙트 + 스파크 파티클 + 화면 진동
function boom(x, y, r, shake) {
  G.explosions.push({ x, y, r, t: 0.4, maxT: 0.4 });
  const n = Math.max(12, Math.floor(r / 4));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 280;
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.35, maxLife: 0.65, color: Math.random() < 0.5 ? '#ffb347' : '#ff5d2e', size: 2 + Math.random() * 3 });
  }
  if (shake) G.shake = Math.min(1, G.shake + shake);
}
// 체인 라이트닝: 꺾인 세그먼트 경로 생성 (번개 느낌)
function zapPts(list) {
  let pts = [list[0]];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    for (let j = 1; j <= 4; j++) {
      const t = j / 4, end = j === 4;
      pts.push({ x: a.x + (b.x - a.x) * t + (end ? 0 : (Math.random() - .5) * 26), y: a.y + (b.y - a.y) * t + (end ? 0 : (Math.random() - .5) * 26) });
    }
  }
  return pts;
}

// ===== 레벨업 모달 =====
function openLevelup() {
  currentChoices = rollSkillChoices(G.player, Math.random);
  if (!currentChoices.length) { G.levelupQueue = 0; G.state = 'playing'; return; } // 전 스킬 최대치 시 모달 없이 재진행
  G.state = 'levelup';
  skillChoices.innerHTML = currentChoices.map((c, i) => {
    if (c.fill) {
      const it = CONFIG.ITEMS[c.fill];
      return '<div class="skill-choice" data-i="' + i + '"><div class="name">' + it.label + ' ' + it.name + '</div>' +
        '<div class="desc">템 효과 (스킬 최대치 도달 시 보정)</div></div>';
    }
    const st = skillStats(c.id, c.toLevel);
    const lvLabel = c.toLevel === 1 ? ' (NEW)' : ' Lv' + (c.toLevel - 1) + '→' + c.toLevel;
    return '<div class="skill-choice" data-i="' + i + '">' +
      '<div class="name">' + iconHtml(c.id) + SKILL_NAMES[c.id] + lvLabel + '</div>' +
      '<div class="desc">' + (st ? skillDescLine(c.id, st) : '') + '</div></div>';
  }).join('');
  levelupModal.classList.remove('hidden');
}
function chooseSkill(i) {
  const c = currentChoices[i];
  if (!c || G.state !== 'levelup') return;
  if (c.fill) {
    applyItem(c.fill); // 후보 부족 시 채우는 템 효과 (heart/gem/mend/rage/haste/magnet)
  } else {
    G.player.skills[c.id] = c.toLevel;
    G.player.skillTimers[c.id] = 0;
    playSfx(c.id);
  }
  G.levelupQueue--;
  levelupModal.classList.add('hidden');
  if (G.levelupQueue > 0) openLevelup();
  else G.state = 'playing';
}
skillChoices.addEventListener('click', (ev) => {
  const card = ev.target.closest('.skill-choice');
  if (card) chooseSkill(+card.dataset.i);
});

// ===== 기록 / 종료 / 승리 =====
function fmtTime(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function recordStats() {
  const best = Save.load() || { stage: 0, level: 0, kills: 0 };
  const cur = { stage: G.stage, level: G.player.level, kills: G.totalKills, time: Math.floor(G.time) };
  const isRecord = cur.stage > (best.stage || 0) || cur.level > (best.level || 0) || cur.kills > (best.kills || 0);
  if (isRecord) {
    Save.save({
      stage: Math.max(best.stage || 0, cur.stage),
      level: Math.max(best.level || 0, cur.level),
      kills: Math.max(best.kills || 0, cur.kills),
    });
  }
  return { cur, best, isRecord };
}
function statsHtml({ cur, best, isRecord }) {
  const badge = isRecord ? '<div style="color:#ffd166;font-weight:bold;margin-bottom:10px">🏆 신기록 달성!</div>' : '';
  return badge +
    '<div class="stat">스테이지 <span>' + cur.stage + ' (최고 ' + (best.stage || 0) + ')</span></div>' +
    '<div class="stat">레벨 <span>' + cur.level + ' (최고 ' + (best.level || 0) + ')</span></div>' +
    '<div class="stat">처치 <span>' + cur.kills + ' (최고 ' + (best.kills || 0) + ')</span></div>' +
    '<div class="stat">잔존 시간 <span>' + fmtTime(cur.time) + '</span></div>';
}
function gameOver() {
  if (G.state === 'gameover') return;
  G.state = 'gameover';
  goStats.innerHTML = statsHtml(recordStats());
  gameoverModal.classList.remove('hidden');
  hudEl.style.display = 'none';
  document.getElementById('compChip').style.display = 'none';
}
function winGame() {
  if (G.state === 'win') return;
  G.state = 'win';
  winStats.innerHTML = statsHtml(recordStats());
  winModal.classList.remove('hidden');
  hudEl.style.display = 'none';
  document.getElementById('compChip').style.display = 'none';
}

// ===== 동료 선택 =====
let chosenCompId = localStorage.getItem('rogue_comp') || 'warrior';
const compCardsEl = document.getElementById('compCards');
function renderCompCards() {
  compCardsEl.innerHTML = '';
  for (const c of CONFIG.COMPANIONS) {
    const d = document.createElement('div');
    d.className = 'comp-card' + (c.id === chosenCompId ? ' selected' : '');
    d.innerHTML = '<div class="comp-icon">' + c.icon + '</div><div class="comp-name">' + c.name + '</div><div class="comp-desc">' + c.desc + '</div>';
    d.addEventListener('click', () => {
      chosenCompId = c.id;
      localStorage.setItem('rogue_comp', c.id);
      renderCompCards();
    });
    compCardsEl.appendChild(d);
  }
}
renderCompCards();

// ===== 시작 / 재시작 =====
// ===== 스킬 진화 모달 =====
function evDesc(ev) {
  const st = skillStats(ev.id, 1);
  let s = evoDescLine(ev.id, st);
  if (st && st.maxR) s += ' · 범위 ' + st.maxR;
  return s;
}
function openEvolve() {
  if (G.state !== 'playing') return;
  currentEvoPairs = evolutionPairs(G.player);
  if (!currentEvoPairs.length) return;
  G.state = 'evolve'; // 루프가 'playing'일 때만 업데이트 → 자동 일시정지
  evolveChoicesEl.innerHTML = currentEvoPairs.map((ev, i) =>
    '<div class="skill-choice evo-pair" data-i="' + i + '">' +
    '<div class="name">' + iconHtml(ev.a) + ' + ' + iconHtml(ev.b) + ' → ' + iconHtml(ev.id) + ' ' + ev.name + '</div>' +
    '<div class="desc">' + evDesc(ev) + '</div></div>').join('');
  evolveChoicesEl.querySelectorAll('.evo-pair').forEach(el => el.onclick = () => chooseEvolve(+el.dataset.i));
  evolveModal.classList.remove('hidden');
}
function chooseEvolve(i) {
  const ev = currentEvoPairs[i];
  if (!ev) return;
  G.player.skills = evolveSkills(G.player, ev.a, ev.b);
  G.player.skillTimers[ev.id] = 0;
  playSfx(ev.a);
  evolveModal.classList.add('hidden');
  G.state = 'playing';
  updateHUD();
}
document.getElementById('evolveBackBtn').onclick = () => { evolveModal.classList.add('hidden'); G.state = 'playing'; };
evolveBtn.onclick = () => openEvolve();
function startGame() {
  G = newRun();
  G.state = 'playing';
  const _cd = CONFIG.COMPANIONS.find(x => x.id === G.companion.id);
  const _chip = document.getElementById('compChip');
  _chip.textContent = _cd.icon + ' ' + _cd.name;
  _chip.style.display = 'block';
  G.banner = '스테이지 1'; G.bannerT = 1.8;
  startModal.classList.add('hidden');
  gameoverModal.classList.add('hidden');
  winModal.classList.add('hidden');
  levelupModal.classList.add('hidden');
  evolveModal.classList.add('hidden');
  lastSkillKey = '##';
}
function backToMenu() {
  G = newRun();                    // 전체 리셋 (newRun이 state 'menu' 설정)
  lastSkillKey = '##';             // 스킬바 재빌드 트리거
  skillsEl.innerHTML = '';
  skillsEl.prepend(evolveBtn);
  hudEl.style.display = 'none';
  bossBar.style.display = 'none';
  document.getElementById('compChip').style.display = 'none';
  gameoverModal.classList.add('hidden');
  winModal.classList.add('hidden');
  levelupModal.classList.add('hidden');
  evolveModal.classList.add('hidden');
  startModal.classList.remove('hidden');
  renderCompCards();               // 저장된 선택(localStorage) 하이라이트 재생성
}
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', backToMenu);
winRestartBtn.addEventListener('click', backToMenu);
