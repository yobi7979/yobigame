// js/entities.js — 엔티티 — 스폰/데미지/플레이어/적AI/투사체/링웨이브
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== 스폰 =====
function spawnEnemy(forceType) {
  const stage = G.stage;
  const type = forceType || rollEnemyType(stage, Math.random);
  const base = CONFIG.ENEMIES[type];
  const scale = enemyHpScale(stage);
  const sp = findSpawnPos(450, 750);   // LOS 확인 지점, 범위 내 빈 공간 fallback
  const e = {
    type, x: sp.x, y: sp.y,
    hp: Math.round(base.hp * scale), maxHp: Math.round(base.hp * scale),
    speed: base.speed, dmg: Math.round(base.dmg * enemyDmgScale(stage)),
    xp: base.xp, radius: type === 'tanky' ? 20 : type === 'miniboss' ? 30 : 13,
    slow: 0, stun: 0, hitFlash: 0,
    shootTimer: (type === 'ranged' || type === 'miniboss' || type === 'boss') ? 1 : 0,
    animT: Math.random() * 2, phase: Math.random() * 6.28,
  };
  return e;
}

function spawnBoss(stage) {
  const bt = CONFIG.STAGES[stage - 1].bossType; // 'miniboss' | 'boss'
  const base = CONFIG.ENEMIES[bt];
  const sp = findSpawnPos(500, 700);
  const e = {
    type: bt,
    x: sp.x, y: sp.y,
    hp: base.hp * enemyHpScale(stage), maxHp: base.hp * enemyHpScale(stage),
    speed: base.speed, dmg: base.dmg * enemyDmgScale(stage),
    xp: base.xp, radius: bt === 'miniboss' ? 30 : 44,
    slow: 0, stun: 0, hitFlash: 0, shootTimer: 2,
    animT: 0, phase: Math.random() * 6.28,
  };
  G.boss = e;
  G.enemies.push(e);
}

// ===== 데미지 =====
// power 패시브: 전체 데미지 배율 (근접 + 스킬 직접 피해) + 광전사 패시브
function dmgMul() {
  let m = 1;
  if (G && G.player) {
    m += G.player.dmgBonus || 0;
    if (G.player.skills.power) {
      const s = skillStats('power', G.player.skills.power);
      if (s) m += s.pct / 100;
    }
  }
  if (G && G.companion) {
    const cd = CONFIG.COMPANIONS.find(c => c.id === G.companion.id);
    if (cd && cd.passive.dmgPct) m += cd.passive.dmgPct / 100;
  }
  if (G && G.tempBuffs && G.tempBuffs.rage > 0) m *= 2;
  return m;
}
// 그림자 패시브: 근접 공격속도 증가율
function compAtkSpd() {
  if (!G || !G.companion) return 0;
  const cd = CONFIG.COMPANIONS.find(c => c.id === G.companion.id);
  return cd && cd.passive.atkSpdPct ? cd.passive.atkSpdPct / 100 : 0;
}
function damageEnemy(e, dmg, opts = {}) {
  e.hp -= dmg;
  if (opts.skillId) G.skillDamage[opts.skillId] = (G.skillDamage[opts.skillId] || 0) + dmg;
  e.hitFlash = 0.1;
  if (opts.stun) e.stun = Math.max(e.stun, opts.stun);
  // 데미지 숫자
  if (dmg >= 1) {
    G.floaters.push({ x: e.x + (Math.random()-.5)*16, y: e.y - e.radius - 8, txt: Math.round(dmg), color: opts.fromMelee ? '#ffffff' : '#ffd166', t: 0.7, maxT: 0.7 });
    if (G.floaters.length > 60) G.floaters.shift();
  }
  // 흡혈
  const ls = G.player.skills.lifesteal;
  if (ls && opts.fromMelee) {
    const st = skillStats('lifesteal', ls);
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + Math.round(dmg * st.pct / 100));
  }
  if (e.hp <= 0) {
    // 처치 이펙트: 스파크 + 확산 링
    for (let i = 0; i < (e.type === 'boss' ? 50 : 14); i++) {
      G.particles.push({
        x: e.x, y: e.y, vx: (Math.random()-.5)*260, vy: (Math.random()-.5)*260,
        life: .4 + Math.random()*.3, maxLife: .7, color: e.type === 'boss' ? '#ffd166' : (Math.random() < .5 ? '#e63946' : '#ff9f43'), size: 2 + Math.random()*2.5,
      });
    }
    G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: .3, maxLife: .3, color: e.type === 'boss' ? '#ffd166' : '#e63946', size: e.radius + 6, ring: true });
    if (e.type === 'boss' || e.type === 'miniboss') G.boss = null; // S5: 미니보스 사후에도 참조 해제 (진행 막힘 방지)
    G.kills++; G.totalKills++;
    const lsK = G.player.skills.lifesteal;
    if (lsK) { const stK = skillStats('lifesteal', lsK); if (stK && stK.killHeal) G.player.hp = Math.min(G.player.maxHp, G.player.hp + stK.killHeal); }
    const crit = Math.random() < (e.type === 'miniboss' ? 0.50 : 0.10); // 미니보스: 50% / 일반: 10% → 5배 XP 구슬
    const xpVal = crit ? e.xp * 5 : e.xp;
    if (e.type === 'miniboss') {
      // 미니보스: 3개 XP 구슬 분산 드롭
      const per = Math.ceil(xpVal / 3);
      for (let i = 0; i < 3; i++) {
        G.pickups.push({ x: e.x + (Math.random() - .5) * 120, y: e.y + (Math.random() - .5) * 120, xp: per, r: per >= 20 ? 10 : 5, t: 0, crit });
      }
    } else {
      G.pickups.push({ x: e.x, y: e.y, xp: xpVal, r: xpVal >= 20 ? 10 : 5, t: 0, crit });
    }
    // ===== 아이템 드롭 =====
    if (e.type === 'boss' || e.type === 'miniboss') {
      const n = e.type === 'boss' ? 3 : 1;
      const seen = new Set();
      for (let i = 0; i < n; i++) {
        let id, tries = 0;
        do { id = rollItem(); tries++; } while (e.type === 'boss' && seen.has(id) && tries < 6);
        seen.add(id);
        G.items.push({ id, x: e.x + (Math.random() - 0.5) * 50, y: e.y + (Math.random() - 0.5) * 50, t: 0 });
      }
    } else {
      for (const id in CONFIG.ITEMS) {
        if (Math.random() < itemDropChance(id)) {
          G.items.push({ id, x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 30, t: 0 });
        }
      }
    }
    G.shake = Math.min(1, G.shake + (e.type === 'boss' ? 0.5 : 0.1));
  }
}

// ===== 플레이어 업데이트 =====
function updatePlayer(dt) {
  const p = G.player;
  let dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  p.moving = !!(dx || dy);
  p.animT = p.moving ? p.animT + dt : 0;
  if (dx || dy) {
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    p.facing = { x: dx, y: dy };
    const spd = PLAYER.speed * (1 + (p.skills.speed ? skillStats('speed', p.skills.speed).pct : 0) / 100) * (G.tempBuffs.haste > 0 ? 1.5 : 1);
    moveWithWalls(p, dx * spd * dt, dy * spd * dt, PLAYER.radius);
  }
  // 이동 트레일
  p.trail.push({ x: p.x, y: p.y });
  if (p.trail.length > 8) p.trail.shift();
  p.atkTimer -= dt;
  p.invulnTimer -= dt;
  p.flash = Math.max(0, p.flash - dt);
  if (p.shield > 0) { p.shieldDur -= dt; if (p.shieldDur <= 0) p.shield = 0; }

  // 근접 자동공격
  if (p.atkTimer <= 0) {
    const hits = p.skills.multishot ? skillStats('multishot', p.skills.multishot).hits : 1;
    const range = PLAYER.atkRange + (p.skills.multishot && p.skills.multishot >= 3 ? 10 : 0) + p.radius;
    const targets = G.enemies.filter(e => e.hp > 0 && dist2(e, p) < range * range)
      .sort((a, b) => dist2(a, p) - dist2(b, p)).slice(0, 1);
    if (targets.length) {
      const cdMul = p.skills.multishot ? (p.skills.multishot >= 4 ? 0.9 : 1) * (p.skills.multishot >= 5 ? 0.9 : 1) : 1;
      p.atkTimer = PLAYER.atkCd * cdMul / hits * (1 - compAtkSpd());
      for (const t of targets) {
        for (let i = 0; i < hits; i++) damageEnemy(t, PLAYER.atkDmg * (i === 0 ? 1 : 0.5) * dmgMul(), { fromMelee: true });
        G.particles.push({ x: t.x, y: t.y, vx: (Math.random()-.5)*80, vy: (Math.random()-.5)*80, life: .12, maxLife: .12, color: '#fff', size: 4 });
      }
      // 슬래시 이펙트
      const a = Math.atan2(targets[0].y - p.y, targets[0].x - p.x);
      G.slashes.push({ x: p.x, y: p.y, angle: a, range, t: 0.16, maxT: 0.16 });
    }
  }
}

// ===== 적 업데이트 (AI 4종 + 보스) =====
function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    // 연소
    if (e.burn > 0) {
      e.burn -= dt;
      damageEnemy(e, e.burnDps * dt);
      if (e.hp <= 0) continue;
    }
    // 독 (poison)
    if (e.poisonDur > 0) {
      e.poisonDur -= dt;
      if (e.poisonDur > 0) damageEnemy(e, e.poisonDps * dt, { skillId: 'poison' });
      if (e.hp <= 0) continue;
    }
    // 스톤
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.animT = (e.animT || 0) + dt;
    // 감속
    let mul = 1;
    if (e.slowDur > 0) { e.slowDur -= dt; mul = 1 - e.slow / 100; if (e.slowDur <= 0) e.slow = 0; }
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    let mx = 0, my = 0;
    const spd = e.speed * mul;
    switch (e.type) {
      case 'basic': mx = nx; my = ny; break;
      case 'fast': {
        const wob = Math.sin(G.time * 4 + e.x * 0.01 + e.y * 0.01) * 0.5;
        mx = nx + -ny * wob; my = ny + nx * wob;
        const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
        break;
      }
      case 'tanky': mx = nx; my = ny; break;
      case 'ranged':
        if (d < 150) { mx = -nx; my = -ny; }
        else if (d > 250) { mx = nx; my = ny; }
        else { mx = -ny * 0.6; my = nx * 0.6; }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 400) {
          e.shootTimer = 1.5;
          G.projectiles.push({ x: e.x, y: e.y, vx: nx * 260, vy: ny * 260, dmg: e.dmg, friendly: false, r: 5, life: 3 });
        }
        break;
      case 'miniboss':
        mx = nx; my = ny;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 2;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + G.time;
            G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, dmg: e.dmg, friendly: false, r: 6, life: 4 });
          }
        }
        break;
      case 'boss':
        mx = nx; my = ny;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 2;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + G.time * 0.7;
            G.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, dmg: e.dmg * 0.6, friendly: false, r: 6, life: 4 });
          }
        }
        if (e.slashTimer === undefined) e.slashTimer = 3;
        e.slashTimer -= dt;
        if (e.slashTimer <= 0) {
          e.slashTimer = 3;
          G.bossWarnings.push({ x: p.x, y: p.y, r: 120, t: 0.5, maxT: 0.5, dmg: e.dmg });
        }
        break;
    }
    // 보스 텔레포트: 플레이어로부터 멀어지면 쿨타임 후 가까이 순간이동
    if (e.type === 'boss' || e.type === 'miniboss') {
      if (e.teleCd === undefined) e.teleCd = 1.5;
      e.teleCd -= dt;
      if (e.teleCd <= 0 && d > 480) {
        let spot = null;
        for (let i = 0; i < 24 && !spot; i++) {
          const a = Math.random() * Math.PI * 2, r = 200 + Math.random() * 60;
          const tx = p.x + Math.cos(a) * r, ty = p.y + Math.sin(a) * r;
          if (tx < 40 || tx > WORLD.w - 40 || ty < 40 || ty > WORLD.h - 40) continue;
          if (pointInWall(tx, ty)) continue;
          let bad = false;
          for (const o of G.enemies) if (o !== e && o.hp > 0 && (o.x - tx) ** 2 + (o.y - ty) ** 2 < 14400) { bad = true; break; }
          if (!bad) spot = { x: tx, y: ty };
        }
        if (spot) {
          for (let i = 0; i < 10; i++) G.particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, life: .35, maxLife: .35, color: '#b07cff', size: 3 });
          for (let i = 0; i < 10; i++) G.particles.push({ x: spot.x, y: spot.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, life: .35, maxLife: .35, color: '#b07cff', size: 3 });
          e.x = spot.x; e.y = spot.y; e.teleCd = 5;
          G.shake = Math.min(1, G.shake + 0.15);
        } else e.teleCd = 1;
      }
    }
    moveWithWalls(e, mx * spd * dt, my * spd * dt, e.radius);
    // 충돌 데미지
    const rr = e.radius + p.radius;
    if (d < rr && p.invulnTimer <= 0) {
      p.invulnTimer = PLAYER.invuln;
      p.flash = 0.2;
      let dmg = e.dmg;
      if (p.shield > 0) {
        const sh = p.skills.shield ? skillStats('shield', p.skills.shield) : null;
        if (sh && sh.dmgReduce) dmg *= (1 - sh.dmgReduce / 100);
        p.shield = Math.max(0, p.shield - dmg);
        if (p.shield === 0) p.shieldDur = 0;
      } else p.hp -= dmg;
      G.shake = Math.min(1, G.shake + 0.2);
      for (let i = 0; i < 6; i++) G.particles.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .5) * 150, life: .3, maxLife: .3, color: '#e63946', size: 3 });
    }
  }
  G.enemies = G.enemies.filter(e => e.hp > 0);
}

// ===== 투사체 업데이트 =====
function updateProjectiles(dt) {
  const p = G.player;
  for (const pr of G.projectiles) {
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    if (pr.life <= 0) { pr.dead = true; continue; }
    if (pr.x < 0 || pr.x > WORLD.w || pr.y < 0 || pr.y > WORLD.h) { pr.dead = true; continue; }
    if (pointInWall(pr.x, pr.y)) { pr.dead = true; continue; }   // 벽 충돌: 투사체 소멸
    if (pr.friendly) {
      for (const e of G.enemies) {
        if (e.hp <= 0 || (pr.hitSet && pr.hitSet.has(e))) continue;
        const rr = e.radius + pr.r;
        if (dist2(e, pr) < rr * rr) {
          damageEnemy(e, pr.dmg * dmgMul(), pr.skillId ? { skillId: pr.skillId } : {});
          sfxHit();
          if (pr.burn && e.hp > 0) { e.burn = pr.burn; e.burnDps = pr.burnDps; }
          if (pr.slow && e.hp > 0) { e.slow = Math.max(e.slow, pr.slow); e.slowDur = Math.max(e.slowDur || 0, pr.slowDur); }
          if (pr.poisonDps && e.hp > 0) { e.poisonDps = Math.max(e.poisonDps || 0, pr.poisonDps); e.poisonDur = Math.max(e.poisonDur || 0, 3); }
          const sp = p.skills.split ? skillStats('split', p.skills.split) : null;
          if (sp && !pr.noSplit) {
            const base = Math.atan2(pr.vy, pr.vx);
            for (let i = 0; i < sp.count; i++) {
              const a = base + (i - (sp.count - 1) / 2) * 0.5;
              G.projectiles.push({ x: pr.x, y: pr.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: pr.dmg * 0.5, friendly: true, r: 4, life: 1, noSplit: true });
            }
          }
          if (pr.pierce > 0) { pr.pierce--; if (!pr.hitSet) pr.hitSet = new Set(); pr.hitSet.add(e); }
          else { pr.dead = true; }
          if (pr.dead) break;
        }
      }
    } else {
      const rr = p.radius + pr.r;
      if (dist2(p, pr) < rr * rr && p.invulnTimer <= 0) {
        pr.dead = true;
        p.invulnTimer = PLAYER.invuln; p.flash = 0.2;
        sfxHurt();
        let dmg = pr.dmg;
        if (p.shield > 0) {
          const sh = p.skills.shield ? skillStats('shield', p.skills.shield) : null;
          if (sh && sh.dmgReduce) dmg *= (1 - sh.dmgReduce / 100);
          p.shield = Math.max(0, p.shield - dmg);
        } else p.hp -= dmg;
        G.shake = Math.min(1, G.shake + 0.15);
      }
    }
  }
  G.projectiles = G.projectiles.filter(pr => !pr.dead);
}

// ===== 링 웨이브 (tidal / 진화 해일류) =====
function updateWaves(dt) {
  for (const w of G.waves) {
    w.r += w.speed * dt;
    for (const e of G.enemies) {
      if (e.hp <= 0 || w.hit.has(e)) continue;
      const d = Math.hypot(e.x - w.x, e.y - w.y);
      if (d < w.r && d > w.r - 60) {
        w.hit.add(e);
        damageEnemy(e, w.dmg * dmgMul(), { skillId: w.skillId });
        if (e.hp > 0 && w.kb) {
          const dd = Math.max(1, d), ux = (e.x - w.x) / dd, uy = (e.y - w.y) / dd;
          e.x += ux * w.kb; e.y += uy * w.kb;
          moveWithWalls(e, 0, 0, e.radius);   // 벽 밀어내기 해소
        }
        if (w.effect) applyStatus(e, w.effect, w.tier, w.skillId);
      }
    }
  }
  G.waves = G.waves.filter(w => w.r < w.maxR);
}
