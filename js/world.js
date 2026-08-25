// js/world.js — 월드 — XP 구슬, 아이템 드롭, 스테이지, 파티클, 카메라
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== XP 구슬 =====
function updatePickups(dt) {
  const p = G.player;
  let gained = 0;
  for (const pk of G.pickups) {
    pk.t += dt;
    const d2 = dist2(pk, p);
    if (G.tempBuffs.magnet > 0 && d2 < 400 * 400) { // 자석: XP 구슬도 흡인
      const d = Math.sqrt(d2) || 1;
      pk.x += ((p.x - pk.x) / d) * 350 * dt;
      pk.y += ((p.y - pk.y) / d) * 350 * dt;
    } else if (d2 < PLAYER.xpRadius * PLAYER.xpRadius) {
      const d = Math.sqrt(d2) || 1;
      pk.x += ((p.x - pk.x) / d) * 300 * dt;
      pk.y += ((p.y - pk.y) / d) * 300 * dt;
    }
    if (d2 < 24 * 24) { pk.dead = true; gained += pk.xp; sfxPickup(); }
  }
  G.pickups = G.pickups.filter(pk => !pk.dead);
  if (gained > 0) {
    p.xp += gained;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      G.levelupQueue++;
      sfxLevel();
    }
    if (G.levelupQueue > 0 && G.state === 'playing') openLevelup();
  }
}

// ===== 아이템 드롭 (영구/일시 버프) =====
function updateItems(dt) {
  const p = G.player;
  for (const it of G.items) {
    it.t += dt;
    const d2 = dist2(it, p);
    if (G.tempBuffs.magnet > 0 && d2 < 400 * 400) { // 자석: 흡인
      const d = Math.sqrt(d2) || 1;
      it.x += ((p.x - it.x) / d) * 350 * dt;
      it.y += ((p.y - it.y) / d) * 350 * dt;
    } else if (d2 < 100 * 100) { // 근접 시 자동 흡인
      const d = Math.sqrt(d2) || 1;
      it.x += ((p.x - it.x) / d) * 300 * dt;
      it.y += ((p.y - it.y) / d) * 300 * dt;
    }
    if (d2 < 28 * 28) { applyItem(it.id); it.dead = true; }
  }
  G.items = G.items.filter(it => !it.dead && it.t < 20);  // 20초 후 소멸
}
function applyItem(id) {
  const p = G.player, def = CONFIG.ITEMS[id];
  if (!def) return;
  if (id === 'heart') { p.maxHp += 15; p.hp += 15; }
  else if (id === 'gem') { p.dmgBonus = (p.dmgBonus || 0) + 0.08; }
  else if (id === 'rage') { G.tempBuffs.rage = 8; }
  else if (id === 'haste') { G.tempBuffs.haste = 8; }
  else if (id === 'mend') { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); }
  else if (id === 'magnet') { G.tempBuffs.magnet = 8; }
  G.floaters.push({ x: p.x, y: p.y - 26, txt: def.name, color: def.color, t: 0.9, maxT: 0.9 });
  if (G.floaters.length > 60) G.floaters.shift();
  if (Math.random() < CONFIG.DROP_PICK_CHANCE) { G.levelupQueue++; if (G.state === 'playing') openLevelup(); } // 15% 무료 스킬 선택
}

// ===== 스테이지 / 스폰 / 클리어 =====
function updateStage(dt) {
  const stg = CONFIG.STAGES[G.stage - 1];
  G.stageTime += dt;
  // 적 스폰
  if (G.enemies.length < MAX_ENEMIES) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      G.spawnTimer = spawnInterval(G.stage);
      G.enemies.push(spawnEnemy());
      if (G.stage > 25 && G.enemies.length < MAX_ENEMIES) G.enemies.push(spawnEnemy('miniboss')); // 25스테이지 이후: 일반 몬스터와 1:1 미니보스
    }
  }
  // 보스 소환: 최종보스 즉시 / 미니보스 스테이지 시작 30s 후
  if (stg.boss && !G.boss && !G.bossSpawned && (stg.bossType === 'boss' || G.stageTime >= 30)) {
    G.bossSpawned = true;
    spawnBoss(G.stage);
  }
  // 클리어 판정
  let clear;
  if (stg.boss) {
    // 미니보스: 보스 격파 + 처치 수 도달 / 최종보스: 보스 격파 (clearKills 0)
    clear = G.bossSpawned && !G.boss && (G.kills >= stg.clearKills);
  } else {
    clear = G.kills >= stg.clearKills || G.stageTime >= stg.time; // 타임아웃 백스탑: 00:00 이면 클리어
  }
  if (clear) {
    G.stage++;
    if (G.stage > CONFIG.STAGES.length) { winGame(); return; }
    G.kills = 0; G.stageTime = 0; G.bossSpawned = false;
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + 20);
    G.banner = '스테이지 ' + G.stage; G.bannerT = 1.8;
    G.enemies = G.enemies.filter(e => e.type !== 'boss' && e.type !== 'miniboss');
    G.projectiles = G.projectiles.filter(pr => pr.friendly);
    G.waves.length = 0;
    genDungeon();   // 다음 스테이지 새 던전
    const pc2 = nearestRoomCenter(WORLD.w / 2, WORLD.h / 2);
    G.player.x = pc2.x; G.player.y = pc2.y;
    if (G.companion) { G.companion.x = G.player.x - 45; G.companion.y = G.player.y; }
  }
}

// ===== 파티클 / 이펙트 =====
function updateParticles(dt) {
  // 보스 슬래시 경고 → 판정
  for (const w of G.bossWarnings) {
    w.t -= dt;
    if (w.t <= 0) {
      w.dead = true;
      const p = G.player;
      if (p.invulnTimer <= 0 && dist2(p, w) < (w.r + p.radius) * (w.r + p.radius)) {
        p.invulnTimer = PLAYER.invuln; p.flash = 0.25;
        p.hp -= w.dmg;
        G.shake = Math.min(1, G.shake + 0.4);
      }
    }
  }
  G.bossWarnings = G.bossWarnings.filter(w => !w.dead);
  for (const pt of G.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  G.particles = G.particles.filter(pt => pt.life > 0);
  for (const f of G.floaters) { f.y -= 40 * dt; f.t -= dt; }
  G.floaters = G.floaters.filter(f => f.t > 0);
  for (const s of G.slashes) s.t -= dt;
  G.slashes = G.slashes.filter(s => s.t > 0);
  for (const l of G.lightnings) l.t -= dt;
  G.lightnings = G.lightnings.filter(l => l.t > 0);
  for (const x of G.explosions) x.t -= dt;
  G.explosions = G.explosions.filter(x => x.t > 0);
  for (const s of G.slowfieldFx) s.t -= dt;
  G.slowfieldFx = G.slowfieldFx.filter(s => s.t > 0);
  if (G.bannerT > 0) G.bannerT -= dt;
  G.shake = Math.max(0, G.shake - dt * 2);
}

// ===== 카메라 =====
function updateCamera(dt) {
  const p = G.player;
  const k = 1 - Math.pow(0.001, dt);
  cam.x += (p.x - canvas.width / 2 - cam.x) * k;
  cam.y += (p.y - canvas.height / 2 - cam.y) * k;
  cam.x = clamp(cam.x, 0, Math.max(0, WORLD.w - canvas.width));
  cam.y = clamp(cam.y, 0, Math.max(0, WORLD.h - canvas.height));
  if (G.shake > 0) {
    cam.x += (Math.random() - 0.5) * G.shake * 10;
    cam.y += (Math.random() - 0.5) * G.shake * 10;
  }
}
