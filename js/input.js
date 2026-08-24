// js/input.js — 입력 — 키보드 + 터치 조이스틱
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== 입력 =====
addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase();
  if (k === 'r') { startGame(); return; }
  if (G && G.state === 'levelup' && ['1', '2', '3'].includes(k)) { chooseSkill(+k - 1); return; }
  keys[k] = true;
});
addEventListener('keyup', (ev) => { keys[ev.key.toLowerCase()] = false; });

// ===== 터치 컨트롤 (모바일 가상 조이스틱) =====
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
const JOY_R = 70, JOY_DEAD = 12;
function joySetKeys() {
  keys.w = joy.dy < -JOY_DEAD; keys.s = joy.dy > JOY_DEAD;
  keys.a = joy.dx < -JOY_DEAD; keys.d = joy.dx > JOY_DEAD;
}
if (isTouch) {
  addEventListener('touchstart', (e) => {
    if (joy.active || e.target !== canvas) return;
    const r = canvas.getBoundingClientRect();
    const t = e.changedTouches[0];
    joy.active = true; joy.id = t.identifier;
    joy.ox = (t.clientX - r.left) * canvas.width / r.width;
    joy.oy = (t.clientY - r.top) * canvas.height / r.height;
    joy.dx = 0; joy.dy = 0;
    e.preventDefault();
  }, { passive: false });
  addEventListener('touchmove', (e) => {
    if (!joy.active) return;
    const r = canvas.getBoundingClientRect();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier !== joy.id) continue;
      let dx = (t.clientX - r.left) * canvas.width / r.width - joy.ox;
      let dy = (t.clientY - r.top) * canvas.height / r.height - joy.oy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) { dx = dx / len * JOY_R; dy = dy / len * JOY_R; }
      joy.dx = dx; joy.dy = dy;
    }
    joySetKeys();
    e.preventDefault();
  }, { passive: false });
  const joyEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== joy.id) continue;
      joy.active = false; joy.id = -1; joy.dx = 0; joy.dy = 0;
      joySetKeys();
    }
  };
  addEventListener('touchend', joyEnd);
  addEventListener('touchcancel', joyEnd);
}
