// js/main.js — 메인 — 게임 루프 + 초기화
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== 게임 루프 =====
let last = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
  last = t;
  if (!G) return;
  if (G.state === 'playing') {
    G.time += dt;
    for (const k of ['rage','haste','magnet']) G.tempBuffs[k] = Math.max(0, G.tempBuffs[k] - dt);
    updateSkills(dt);
    updatePlayer(dt);
    updateCompanion(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateWaves(dt);
    updatePickups(dt);
    updateItems(dt);
    updateStage(dt);
    if (G.player.hp <= 0 && G.state === 'playing') gameOver();
  }
  if (G.state === 'playing' || G.state === 'levelup' || G.state === 'menu') updateParticles(dt);
  if (G.state === 'playing') updateCamera(dt);
  render();
}

// ===== 초기화 =====
G = newRun();
globalThis.__game = {
  get state() { return G ? G.state : null; },
  get run() { return G; },
  start: startGame,
  chooseSkill: chooseSkill,
  drawSprite,
  // 렌더 훅 — test_render_smoke.js가 render() 실제 호출을 검증하기 위함
  render, updateCamera, updateParticles, updateHUD,
  // 시뮬레이션 훅 — headless 동작 검증 (테스트용)
  updatePlayer, updateEnemies, updateProjectiles, updateWaves, updateStage, updateCompanion, spawnEnemy, spawnBoss,
};
requestAnimationFrame(loop);
