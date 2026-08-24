// js/audio.js — Web Audio SFX: 스킬 13종(assets/sfx/*.wav) + 코드합성 미세효과음
// 브라우저 오토플레이 정책 대응: 첫 사용자 입력(pointerdown/keydown) 시에만 AudioContext 생성.
// 모든 재생 함수는 ctx가 없어도 안전하게 no-op.
const SFX_NAMES = ['fireball','chainlightning','shield','multishot','lifesteal','slowfield','split','spinblade','explosion','speed','iceshard','tidal','poison'];
const SFX = {};
let ACTX = null, MASTER = null, SFX_MUTED = false, SPIN_SRC = null, spinActive = false;
let lastHitSfxT = -1, lastPickupSfxT = -1;
function initAudio() {
  if (ACTX || typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ACTX = new AC();
  MASTER = ACTX.createGain();
  MASTER.gain.value = SFX_MUTED ? 0 : 0.5;
  MASTER.connect(ACTX.destination);
  for (const n of SFX_NAMES) {
    (async () => {
      try {
        const r = await fetch('assets/sfx/' + n + '.wav');
        if (!r.ok) return;
        SFX[n] = await ACTX.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* wav 부재 → 조용히 스킵 */ }
    })();
  }
}
function resumeAudio() { if (ACTX && ACTX.state === 'suspended') ACTX.resume(); }
function setSfxMuted(m) {
  SFX_MUTED = !!m;
  if (MASTER) MASTER.gain.value = SFX_MUTED ? 0 : 0.5;
  spinSfx(spinActive);
}
function playSfx(name, vol) {
  if (!ACTX || SFX_MUTED) return;
  const buf = SFX[name];
  if (!buf) return;
  const src = ACTX.createBufferSource();
  src.buffer = buf;
  const g = ACTX.createGain();
  g.gain.value = (vol === undefined ? 1 : vol);
  src.connect(g); g.connect(MASTER);
  src.start();
}
// ===== spinblade 오라 루프 (적 범위 내일 동안) =====
function spinSfx(active) {
  spinActive = active;
  if (!ACTX || SFX_MUTED) {
    if (SPIN_SRC) { try { SPIN_SRC.stop(); } catch (e) {} SPIN_SRC = null; }
    return;
  }
  if (active && !SPIN_SRC && SFX.spinblade) {
    SPIN_SRC = ACTX.createBufferSource();
    SPIN_SRC.buffer = SFX.spinblade;
    SPIN_SRC.loop = true;
    const g = ACTX.createGain(); g.gain.value = 0.45;
    SPIN_SRC.connect(g); g.connect(MASTER);
    SPIN_SRC.start();
  } else if (!active && SPIN_SRC) {
    try { SPIN_SRC.stop(); } catch (e) {}
    SPIN_SRC = null;
  }
}
// ===== 코드합성 미세효과음 (에셋 불필요) =====
function blip(freq, dur, type, vol, slide) {
  if (!ACTX || SFX_MUTED) return;
  const t0 = ACTX.currentTime;
  const o = ACTX.createOscillator(), g = ACTX.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol || 0.1, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(MASTER);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function sfxHit() { // 적 명중 (45ms 스로틀)
  if (!ACTX) return;
  const now = ACTX.currentTime;
  if (now - lastHitSfxT < 0.045) return;
  lastHitSfxT = now;
  blip(240, 0.07, 'square', 0.07, -140);
}
function sfxHurt() { blip(140, 0.18, 'sawtooth', 0.14, -70); } // 플레이어 피격
function sfxPickup() { // XP 획득 (60ms 스로틀)
  if (!ACTX) return;
  const now = ACTX.currentTime;
  if (now - lastPickupSfxT < 0.06) return;
  lastPickupSfxT = now;
  blip(700, 0.09, 'sine', 0.09, 380);
}
function sfxLevel() { blip(440, 0.4, 'triangle', 0.14, 220); } // 레벨업
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const _kick = () => { initAudio(); resumeAudio(); };
  window.addEventListener('pointerdown', _kick);
  window.addEventListener('keydown', _kick);
}
