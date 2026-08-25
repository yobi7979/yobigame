// js/audio.js — Web Audio: 전 코드합성 SFX(밝고 경쾌한 톤) + 칩튠 BGM
// WAV 에셋 불필요. 브라우저 오토플레이 정책 대응: 첫 사용자 입력(pointerdown/keydown) 시에만
// AudioContext 생성. 모든 재생 함수는 ctx가 없어도 안전하게 no-op.

let ACTX = null, MASTER = null, MUSIC_G = null, SFX_MUTED = false;
let MUSIC_ON = true, MUSIC_TIMER = null, MUSIC_STEP = 0, MUSIC_NEXT_T = 0;
let NOISE_BUF = null, SPIN_SRC = null, spinActive = false, spinPending = false, SPIN_BUF = null;
let lastHitSfxT = -1, lastPickupSfxT = -1;
let SFX_VOL = 1;

// ===== BGM: 칩튠 루프 (128 BPM, 8바 C C Am Am F F G G) =====
const BPM = 128, STEP = 60 / BPM / 2; // 8분주 ≈ 0.234s
const PROG = [
  { root: 130.81, chord: [261.63, 329.63, 392.00, 523.25] }, // C
  { root: 130.81, chord: [261.63, 329.63, 392.00, 523.25] }, // C
  { root: 110.00, chord: [220.00, 261.63, 329.63, 440.00] }, // Am
  { root: 110.00, chord: [220.00, 261.63, 329.63, 440.00] }, // Am
  { root: 87.31,  chord: [174.61, 220.00, 261.63, 349.23] }, // F
  { root: 87.31,  chord: [174.61, 220.00, 261.63, 349.23] }, // F
  { root: 98.00,  chord: [196.00, 246.94, 293.66, 392.00] }, // G
  { root: 98.00,  chord: [196.00, 246.94, 293.66, 392.00] }, // G
];
const BASS_PAT = [1, 1, 1.5, 1, 1, 1.5, 1, 1.5]; // 루트/5도 (8분주 퍼커시브)
const LEAD_PAT = [1, 2, 3, 2, 1, 2, 3, 3];       // 코드를 훑는 아르페지오
function musicTone(freq, t, dur, type, vol) {
  const o = ACTX.createOscillator(), g = ACTX.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(MUSIC_G);
  o.start(t); o.stop(t + dur + 0.03);
}
function musicNoise(t, dur, freq, vol) {
  const src = ACTX.createBufferSource(); src.buffer = noiseBuf();
  const f = ACTX.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  const g = ACTX.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(MUSIC_G);
  src.start(t); src.stop(t + dur + 0.03);
}
function scheduleMusicStep(step, t) {
  const bar = PROG[Math.floor(step / 8)], s = step % 8;
  musicTone(bar.root * BASS_PAT[s], t, 0.2, 'triangle', 0.085);
  musicTone(bar.chord[LEAD_PAT[s]], t, 0.16, 'square', 0.028);
  if (s % 2 === 1) musicNoise(t, 0.03, 6000, 0.02); // 오프비트 햇
}
function musicTick() {
  if (!ACTX || !MUSIC_ON) return;
  while (MUSIC_NEXT_T < ACTX.currentTime + 0.4) {
    scheduleMusicStep(MUSIC_STEP, MUSIC_NEXT_T);
    MUSIC_NEXT_T += STEP;
    MUSIC_STEP = (MUSIC_STEP + 1) % (PROG.length * 8);
  }
}
function startMusic() {
  if (!ACTX || MUSIC_TIMER) return;
  MUSIC_NEXT_T = ACTX.currentTime + 0.1;
  MUSIC_TIMER = setInterval(musicTick, 120);
}
function stopMusic() {
  if (MUSIC_TIMER) { clearInterval(MUSIC_TIMER); MUSIC_TIMER = null; }
}
function toggleMusic() {
  MUSIC_ON = !MUSIC_ON;
  if (MUSIC_G && ACTX) MUSIC_G.gain.setTargetAtTime(MUSIC_ON ? 0.9 : 0, ACTX.currentTime, 0.05);
  if (ACTX) { if (MUSIC_ON) startMusic(); else stopMusic(); }
  return MUSIC_ON;
}

// ===== 기본 합성 도구 =====
function noiseBuf() {
  if (!NOISE_BUF) {
    NOISE_BUF = ACTX.createBuffer(1, ACTX.sampleRate, ACTX.sampleRate);
    const d = NOISE_BUF.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return NOISE_BUF;
}
function sfxTone(freq, dur, opt) {
  if (!ACTX || SFX_MUTED) return;
  const { type = 'sine', vol = 0.1, slide = 0, delay = 0 } = opt || {};
  const t0 = ACTX.currentTime + delay;
  const o = ACTX.createOscillator(), g = ACTX.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol * SFX_VOL, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(MASTER);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function sfxNoise(dur, opt) {
  if (!ACTX || SFX_MUTED) return;
  const { vol = 0.08, freq = 1500, q = 1, delay = 0, type = 'bandpass' } = opt || {};
  const t0 = ACTX.currentTime + delay;
  const src = ACTX.createBufferSource(); src.buffer = noiseBuf();
  const f = ACTX.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0);
  if (opt && opt.slide) f.frequency.linearRampToValueAtTime(Math.max(80, freq + opt.slide), t0 + dur);
  f.Q.value = q;
  const g = ACTX.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol * SFX_VOL, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(MASTER);
  src.start(t0); src.stop(t0 + dur + 0.05);
}
// 호환용 일반 blip (구 서명 유지)
function blip(freq, dur, type, vol, slide) { sfxTone(freq, dur, { type, vol, slide }); }

// ===== 스킬 SFX 레시피 (13종) — 밝고 짧은 톤, 경쾌한 feel =====
const SFX_RECIPES = {
  fireball() {
    sfxNoise(0.16, { vol: 0.09, freq: 900, q: 0.8 });
    sfxTone(150, 0.14, { vol: 0.16, slide: -70 });
    sfxTone(1200, 0.05, { type: 'triangle', vol: 0.05, delay: 0.1 });
  },
  chainlightning() {
    sfxTone(1500, 0.035, { type: 'square', vol: 0.06 });
    sfxTone(2100, 0.035, { type: 'square', vol: 0.06, delay: 0.05, slide: -700 });
    sfxTone(900, 0.05, { type: 'square', vol: 0.05, delay: 0.1 });
    sfxNoise(0.06, { vol: 0.03, freq: 4000, delay: 0.02 });
  },
  shield() {
    sfxTone(523.25, 0.08, { vol: 0.08 });
    sfxTone(659.25, 0.08, { vol: 0.08, delay: 0.06 });
    sfxTone(783.99, 0.16, { vol: 0.08, delay: 0.12 });
    sfxTone(1567.98, 0.12, { vol: 0.03, delay: 0.2 });
  },
  multishot() {
    for (let i = 0; i < 3; i++) sfxTone(480 + i * 160, 0.05, { vol: 0.1, slide: 260, delay: i * 0.07 });
  },
  lifesteal() {
    sfxTone(392, 0.09, { vol: 0.1 });
    sfxTone(587.33, 0.16, { vol: 0.1, delay: 0.09 });
  },
  slowfield() {
    sfxTone(987.77, 0.3, { type: 'triangle', vol: 0.06, slide: -500 });
    sfxNoise(0.28, { vol: 0.03, freq: 700, q: 2 });
  },
  split() {
    sfxTone(880, 0.05, { vol: 0.1 });
    sfxTone(1174.66, 0.07, { vol: 0.1, delay: 0.055 });
  },
  spinblade() {
    sfxNoise(0.2, { vol: 0.05, freq: 2500, q: 0.7 });
  },
  explosion() {
    sfxTone(100, 0.32, { vol: 0.2, slide: -55 });
    sfxNoise(0.3, { vol: 0.14, freq: 400, q: 0.6, type: 'lowpass' });
  },
  speed() {
    sfxTone(420, 0.15, { vol: 0.08, slide: 900 });
    sfxNoise(0.12, { vol: 0.04, freq: 3000, q: 1.5, delay: 0.02 });
  },
  iceshard() {
    sfxTone(1567.98, 0.07, { vol: 0.08 });
    sfxTone(2093, 0.11, { vol: 0.05, delay: 0.035 });
    sfxNoise(0.04, { vol: 0.02, freq: 7000, q: 2 });
  },
  tidal() {
    sfxTone(220, 0.38, { type: 'triangle', vol: 0.08, slide: 200 });
    sfxNoise(0.35, { vol: 0.06, freq: 600, q: 0.8 });
    sfxTone(330, 0.2, { type: 'triangle', vol: 0.05, delay: 0.12, slide: 150 });
  },
  poison() {
    sfxTone(220, 0.09, { vol: 0.09, slide: 30 });
    sfxTone(277, 0.09, { vol: 0.08, delay: 0.1, slide: 40 });
    sfxTone(554, 0.04, { vol: 0.04, delay: 0.06 });
  },
};
function playSfx(name, vol) {
  if (!ACTX || SFX_MUTED) return;
  const r = SFX_RECIPES[name];
  if (!r) return;
  const prev = SFX_VOL;
  SFX_VOL = (vol === undefined) ? 1 : vol;
  r();
  SFX_VOL = prev;
}

// ===== spinblade 오라 루프 (적 범위 내일 동안) — 오프라인 합성 루프 버퍼 =====
async function spinBuf() {
  if (SPIN_BUF) return SPIN_BUF;
  const sr = 22050, len = Math.floor(sr * 0.4);
  const oc = new OfflineAudioContext(1, len, sr);
  for (let k = 0; k < 2; k++) {
    const t0 = k * 0.2;
    const src = oc.createBufferSource();
    const buf = oc.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(500, t0);
    f.frequency.exponentialRampToValueAtTime(2500, t0 + 0.1);
    f.frequency.exponentialRampToValueAtTime(500, t0 + 0.2);
    const g = oc.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
    src.connect(f); f.connect(g); g.connect(oc.destination);
    src.start(t0); src.stop(t0 + 0.2);
  }
  SPIN_BUF = await oc.startRendering();
  return SPIN_BUF;
}
function spinSfx(active) {
  spinActive = active;
  if (!ACTX || SFX_MUTED || !active) {
    if (SPIN_SRC) { try { SPIN_SRC.stop(); } catch (e) {} SPIN_SRC = null; }
    return;
  }
  if (SPIN_SRC || spinPending) return;
  spinPending = true;
  spinBuf().then(buf => {
    spinPending = false;
    if (!spinActive || SFX_MUTED || !ACTX) return;
    SPIN_SRC = ACTX.createBufferSource();
    SPIN_SRC.buffer = buf; SPIN_SRC.loop = true;
    const g = ACTX.createGain(); g.gain.value = 0.5;
    SPIN_SRC.connect(g); g.connect(MASTER);
    SPIN_SRC.start();
  }).catch(() => { spinPending = false; });
}

// ===== 코드합성 미세효과음 — 밝고 튀는 톤 =====
function sfxSwing() { // 기본공격 스윙 — 밝은 상승 스와시 (1.5k→3k)
  sfxNoise(0.09, { vol: 0.045, freq: 1500, q: 1.1, slide: 1500 });
}
function sfxHit() { // 적 명중 (45ms 스로틀)
  if (!ACTX) return;
  const now = ACTX.currentTime;
  if (now - lastHitSfxT < 0.045) return;
  lastHitSfxT = now;
  sfxTone(620, 0.045, { type: 'square', vol: 0.05, slide: 260 });
  sfxNoise(0.03, { vol: 0.03, freq: 3000, q: 1 });
}
function sfxHurt() { // 플레이어 피격 — 짧고 맑은 내림
  sfxTone(320, 0.16, { type: 'triangle', vol: 0.12, slide: -140 });
  sfxNoise(0.08, { vol: 0.04, freq: 500, q: 0.8, type: 'lowpass' });
}
function sfxPickup() { // XP 획득 — "딩" (60ms 스로틀)
  if (!ACTX) return;
  const now = ACTX.currentTime;
  if (now - lastPickupSfxT < 0.06) return;
  lastPickupSfxT = now;
  sfxTone(1046.5, 0.05, { vol: 0.08 });
  sfxTone(1567.98, 0.08, { vol: 0.06, delay: 0.035 });
}
function sfxLevel() { // 레벨업 — C-E-G-C 아르페지오 + 반짝임
  const seq = [523.25, 659.25, 783.99, 1046.5];
  seq.forEach((f, i) => sfxTone(f, 0.09, { type: 'triangle', vol: 0.1, delay: i * 0.07 }));
  sfxTone(2093, 0.14, { vol: 0.04, delay: 0.3 });
}

// ===== 초기화 / 음소거 =====
function initAudio() {
  if (ACTX || typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ACTX = new AC();
  MASTER = ACTX.createGain();
  MASTER.gain.value = SFX_MUTED ? 0 : 0.5;
  MASTER.connect(ACTX.destination);
  MUSIC_G = ACTX.createGain();
  MUSIC_G.gain.value = 0.9;
  MUSIC_G.connect(MASTER);
  if (MUSIC_ON) startMusic();
}
function resumeAudio() { if (ACTX && ACTX.state === 'suspended') ACTX.resume(); }
function setSfxMuted(m) {
  SFX_MUTED = !!m;
  if (MASTER) MASTER.gain.value = SFX_MUTED ? 0 : 0.5;
  spinSfx(spinActive);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const _kick = () => { initAudio(); resumeAudio(); };
  window.addEventListener('pointerdown', _kick);
  window.addEventListener('keydown', _kick);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') toggleMusic();
  });
}
