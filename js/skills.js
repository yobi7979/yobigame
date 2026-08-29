// js/skills.js — 스킬 — 동료 시스템, 진화 상태효과, 자동 발동
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== 진화 스킬 튜닝 (2026-08-25 플레이테스트: 기본 2스킬 합 대비 압도 + 큰 이펙트 + 광역) =====
const EVO_DMG_MULT = 1.8;   // 진화 데미지 배율 — 기본 설정은 2스킬 합 1.5x → 체감 2.7x. 튜닝 포인트
const EVO_SPLASH = 120;     // 진화 투사체 스플래시 반경(px) — 최종 명중 시 65% 광역 데미지
const EVO_SPIN_RAD = 1.3;   // 진화 스피류(회전형) 반경 배율
// ===== 동료 시스템 =====
const COMP_COLORS = { warrior: '#ff9f43', guardian: '#4dabf7', shadow: '#b197fc' };
function updateCompanion(dt) {
  const c = G.companion;
  if (!c) return;
  const p = G.player;
  const def = CONFIG.COMPANIONS.find(x => x.id === c.id);
  if (!def) return;
  // 추종: 플레이어와 40px 간격 유지
  const dx = p.x - c.x, dy = p.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d > 40) {
    const sp = Math.min(280, d * 6) * dt;
    c.flipX = dx < 0;   // 추종 이동 방향에 맞춰 좌우 반전
    moveWithWalls(c, dx / d * sp, dy / d * sp, c.radius || 12);
  }
  c.atkTimer -= dt; c.ultTimer -= dt;
  c.atkAnimT = Math.max(0, (c.atkAnimT || 0) - dt);
  if (c.id === 'warrior') {
    if (c.atkTimer <= 0) {
      const t = nearestEnemy(c.x, c.y, def.atk.range);
      if (t) {
        c.atkTimer = def.atk.cd;
        c.atkAnimT = ATK_DUR;
        c.flipX = (t.x - c.x) < 0;   // 공격 시 대상 쪽을 바라봄
        G.slashes.push({ x: c.x, y: c.y, angle: Math.atan2(t.y - c.y, t.x - c.x), range: 44, t: 0.16, maxT: 0.16 });
        damageEnemy(t, def.atk.dmg);
      }
    }
    if (c.ultTimer <= 0) {
      const near = G.enemies.filter(e => e.hp > 0 && dist2(e, p) < def.ult.radius * def.ult.radius);
      if (near.length) {
        c.ultTimer = def.ult.cd;
        boom(p.x, p.y, def.ult.radius, 0.3);
        for (const e of near) damageEnemy(e, def.ult.dmg);
        G.floaters.push({ x: p.x, y: p.y - 26, txt: def.ult.label, color: '#ff9f43', t: 0.8, maxT: 0.8 });
      }
    }
  } else if (c.id === 'guardian') {
    c.healTimer -= dt;
    if (c.healTimer <= 0 && p.hp < p.maxHp) {
      c.healTimer = def.heal.cd;
      p.hp = Math.min(p.maxHp, p.hp + def.heal.amount);
      G.floaters.push({ x: p.x, y: p.y - 24, txt: '+' + def.heal.amount, color: '#7ae582', t: 0.8, maxT: 0.8 });
    }
    if (c.ultTimer <= 0) {
      c.ultTimer = def.ult.cd;
      p.shield = Math.max(p.shield, def.ult.shield);
      // 파티클: 기존 G.particles.push 형식 모사 — 파란 링
      G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: .4, maxLife: .4, color: '#4dabf7', size: p.radius + 8, ring: true });
      G.floaters.push({ x: p.x, y: p.y - 24, txt: def.ult.label + ' +' + def.ult.shield, color: '#4dabf7', t: 0.8, maxT: 0.8 });
    }
  } else if (c.id === 'shadow') {
    if (c.atkTimer <= 0) {
      const t = nearestEnemy(c.x, c.y, def.atk.range);
      if (t) {
        c.atkTimer = def.atk.cd;
        c.atkAnimT = ATK_DUR;
        c.flipX = (t.x - c.x) < 0;   // 공격 시 대상 쪽을 바라봄
        const a = Math.atan2(t.y - c.y, t.x - c.x);
        G.knives.push({ x: c.x, y: c.y, vx: Math.cos(a) * def.atk.projSpeed, vy: Math.sin(a) * def.atk.projSpeed, dmg: def.atk.dmg, life: 1.2 });
      }
    }
    if (c.ultTimer <= 0) {
      const t = nearestEnemy(c.x, c.y, def.ult.range);
      if (t) {
        c.ultTimer = def.ult.cd;
        for (let i = 0; i < def.ult.hits; i++) {
          const a = Math.atan2(t.y - c.y, t.x - c.x) + (i - 1) * 0.35;
          G.slashes.push({ x: c.x, y: c.y, angle: a, range: 48, t: 0.16, maxT: 0.16 });
          damageEnemy(t, def.ult.dmg);
        }
        G.floaters.push({ x: p.x, y: p.y - 26, txt: def.ult.label, color: '#b197fc', t: 0.8, maxT: 0.8 });
      }
    }
  }
  // 칼날 투사체
  for (const k of G.knives) {
    k.x += k.vx * dt; k.y += k.vy * dt; k.life -= dt;
    for (const e of G.enemies) {
      if (e.hp > 0 && dist2(e, k) < (e.radius + 5) * (e.radius + 5)) { damageEnemy(e, k.dmg); k.life = 0; break; }
    }
  }
  G.knives = G.knives.filter(k => k.life > 0);
}

// ===== 진화 스킬 상태 적용 (burn/slow/stun/poison/kb) =====
function applyStatus(e, effect, st, skillId) {
  if (!effect || e.hp <= 0) return;
  if (effect === 'burn') { e.burn = st.burn || 3; e.burnDps = st.burnDps || 8; }
  else if (effect === 'slow') { e.slow = Math.max(e.slow, st.slow); e.slowDur = Math.max(e.slowDur || 0, st.slowDur); }
  else if (effect === 'stun') { if (Math.random() * 100 < (st.stunChance || 0)) e.stun = Math.max(e.stun, st.stun || 1); }
  else if (effect === 'poison') { e.poisonDps = Math.max(e.poisonDps || 0, st.poisonDps); e.poisonDur = Math.max(e.poisonDur || 0, st.poisonDur || 3); }
  else if (effect === 'kb') {
    const dd = Math.max(1, Math.hypot(e.x - G.player.x, e.y - G.player.y)), ux = (e.x - G.player.x) / dd, uy = (e.y - G.player.y) / dd;
    e.x = Math.min(WORLD.w, Math.max(0, e.x + ux * (st.kb || 0)));
    e.y = Math.min(WORLD.h, Math.max(0, e.y + uy * (st.kb || 0)));
  }
}

// ===== 스킬 업데이트 (자동 발동) =====
function updateSkills(dt) {
  const p = G.player;
  for (const id in p.skills) {
    const lv = p.skills[id];
    const st = skillStats(id, lv);
    if (!st) continue;
    p.skillTimers[id] = (p.skillTimers[id] === undefined ? 0 : p.skillTimers[id]) - dt * (1 + compAtkSpd()); // 동료 공격속도 — 스킬 쿨에도 적용
    let t = p.skillTimers[id];
    const evo = CONFIG.EVOLUTIONS[id];
    if (evo) {
      if (evo.form === 'spin') {
        p.evoSpinAcc = p.evoSpinAcc || {};
        p.evoSpinAcc[id] = (p.evoSpinAcc[id] || 0) + dt;
        if (p.evoSpinAcc[id] >= (st.tick || 0.4)) {
          p.evoSpinAcc[id] = 0;
          let spinIn = false;
          const spinRad = st.radius * EVO_SPIN_RAD;
          for (const e of G.enemies) {
            if (e.hp <= 0) continue;
            if (dist2(e, p) <= spinRad * spinRad) {
              spinIn = true;
              damageEnemy(e, st.dps * (st.tick || 0.4) * EVO_DMG_MULT * dmgMul(), { skillId: id });
              if (e.hp <= 0) continue;
              if (evo.effect === 'kb') {
                const dd = Math.max(1, Math.sqrt(dist2(e, p))), ux = (e.x - p.x) / dd, uy = (e.y - p.y) / dd;
                e.x = Math.min(WORLD.w, Math.max(0, e.x + ux * st.kb));
                e.y = Math.min(WORLD.h, Math.max(0, e.y + uy * st.kb));
              } else applyStatus(e, evo.effect, st, id);
            }
          }
          spinSfx(spinIn);
        }
      } else if (t <= 0) {
        const e0 = nearestEnemy(p.x, p.y, 450);
        if (e0) {
          t = st.cd;
          playSfx(evo.form === 'aoe' ? 'explosion' : evo.form === 'wave' ? 'tidal' : evo.form === 'chain' ? 'chainlightning' : id.replace('evo_', '').split('_')[0]);
          if (evo.form === 'aoe') {
            boom(e0.x, e0.y, st.radius * 1.4, 0.5);
            for (const e of G.enemies) {
              if (e.hp > 0 && dist2(e, e0) < st.radius * st.radius) {
                damageEnemy(e, st.dmg * EVO_DMG_MULT * dmgMul(), { skillId: id });
                if (e.hp > 0) applyStatus(e, evo.effect, st, id);
              }
            }
          } else if (evo.form === 'wave') {
            G.waves.push({ x: p.x, y: p.y, r: 60, maxR: st.maxR * 1.35, speed: 360, dmg: st.dmg * EVO_DMG_MULT, kb: st.kb || 0, effect: evo.effect, tier: st, skillId: id, hit: new Set() });
          } else if (evo.form === 'chain') {
            const hitList = [e0];
            let cur = e0;
            for (let i = 1; i < st.chains; i++) {
              const next = G.enemies.filter(e => e.hp > 0 && !hitList.includes(e))
                .sort((a, b) => dist2(a, cur) - dist2(b, cur))[0];
              if (!next) break;
              hitList.push(next); cur = next;
            }
            G.lightnings.push({ pts: zapPts([p].concat(hitList)), t: 0.25, maxT: 0.25, skillId: id });
            for (const e of hitList) G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: .2, maxLife: .2, color: '#bde0fe', size: e.radius + 9, ring: true });
            G.shake = Math.min(1, G.shake + 0.15);
            for (const e of hitList) {
              damageEnemy(e, st.dmg * EVO_DMG_MULT * dmgMul(), { skillId: id });
              if (e.hp > 0) applyStatus(e, evo.effect, st, id);
            }
          } else {
            const a = Math.atan2(e0.y - p.y, e0.x - p.x);
            G.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: st.dmg * EVO_DMG_MULT, friendly: true, r: 13, vr: 22, life: 1.5, pierce: st.pierce || 0, burn: st.burn || 0, burnDps: st.burnDps || 0, poisonDps: st.poisonDps || 0, splash: EVO_SPLASH, splashDmg: st.dmg * EVO_DMG_MULT * 0.65, skillId: id });
          }
        }
      }
      p.skillTimers[id] = t;
      continue;
    }
    switch (id) {
      case 'fireball':
        if (t <= 0) {
          const e = nearestEnemy(p.x, p.y, 450);
          if (e) {
            t = st.cd;
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            G.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg: st.dmg, friendly: true, r: 7, life: 1.4, pierce: st.pierce, burn: st.burn || 0, burnDps: st.burnDps || 0, skillId: 'fireball' });
            playSfx('fireball');
          }
        }
        break;
      case 'chainlightning':
        if (t <= 0) {
          const first = nearestEnemy(p.x, p.y, 450);
          if (first) {
            t = st.cd;
            const hitList = [first];
            let cur = first;
            for (let i = 1; i < st.chains; i++) {
              const next = G.enemies.filter(e => e.hp > 0 && !hitList.includes(e))
                .sort((a, b) => dist2(a, cur) - dist2(b, cur))[0];
              if (!next) break;
              hitList.push(next); cur = next;
            }
            G.lightnings.push({ pts: zapPts([p].concat(hitList)), t: 0.2, maxT: 0.2 });
            for (const e of hitList) G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: .2, maxLife: .2, color: '#bde0fe', size: e.radius + 5, ring: true });
            for (const e of hitList) {
              damageEnemy(e, st.dmg * dmgMul(), { skillId: 'chainlightning' });
              if (st.slow && e.hp > 0) { e.slow = Math.max(e.slow, st.slow); e.slowDur = Math.max(e.slowDur || 0, st.slowDur); }
            }
            playSfx('chainlightning');
          }
        }
        break;
      case 'shield':
        if (p.shield <= 0 && t <= 0) {
          p.shield = st.hp; p.shieldDur = st.dur; t = 0.5;
          G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: .4, maxLife: .4, color: '#4dabf7', size: p.radius + 8, ring: true });
          playSfx('shield');
        }
        break;
      case 'slowfield':
        if (t <= 0) {
          t = st.cd;
          let any = false;
          for (const e of G.enemies) {
            if (e.hp > 0 && dist2(e, p) < st.radius * st.radius) {
              e.slow = Math.max(e.slow, st.pct); e.slowDur = Math.max(e.slowDur || 0, 1); any = true;
            }
          }
          if (any) { G.slowfieldFx.push({ x: p.x, y: p.y, r: st.radius, t: 0.3, maxT: 0.3 }); playSfx('slowfield'); }
        }
        break;
      case 'spinblade':
        let spinInB = false;
        for (const e of G.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(e, p) < st.radius * st.radius) {
            spinInB = true;
            damageEnemy(e, st.dps * dt * dmgMul(), { skillId: 'spinblade' });
            if (st.stun && e.hp > 0 && Math.random() < (st.stunChance / 100) * dt * 10) e.stun = Math.max(e.stun, st.stun);
          }
        }
        spinSfx(spinInB);
        break;
      case 'explosion':
        if (t <= 0) {
          let best = null, bestN = -1;
          for (const e of G.enemies) {
            if (e.hp <= 0) continue;
            const n = G.enemies.filter(o => o.hp > 0 && dist2(o, e) < st.radius * st.radius).length;
            if (n > bestN) { bestN = n; best = e; }
          }
          if (best && bestN >= 1) {
            t = st.cd;
            boom(best.x, best.y, st.radius, 0.3);
            playSfx('explosion');
            for (const e of G.enemies) {
              if (e.hp > 0 && dist2(e, best) < st.radius * st.radius) damageEnemy(e, st.dmg * dmgMul(), { skillId: 'explosion' });
            }
          }
        }
        break;
      case 'iceshard':
        if (t <= 0) {
          const e2 = nearestEnemy(p.x, p.y, 450);
          if (e2) {
            t = st.cd;
            const a2 = Math.atan2(e2.y - p.y, e2.x - p.x);
            G.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a2) * 500, vy: Math.sin(a2) * 500, dmg: st.dmg, friendly: true, r: 6, life: 1.6, slow: st.slow || 0, slowDur: st.slowDur || 0, skillId: 'iceshard', color: '#7adfff' });
            playSfx('iceshard');
          }
        }
        break;
      case 'tidal':
        if (t <= 0) {
          t = st.cd;
          G.waves.push({ x: p.x, y: p.y, r: 40, maxR: 260, speed: 320, dmg: st.dmg, kb: st.kb, skillId: 'tidal', hit: new Set() });
          playSfx('tidal');
        }
        break;
      case 'poison':
        if (t <= 0) {
          const e3 = nearestEnemy(p.x, p.y, 450);
          if (e3) {
            t = st.cd;
            const a3 = Math.atan2(e3.y - p.y, e3.x - p.x);
            G.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a3) * 380, vy: Math.sin(a3) * 380, dmg: st.dmg, friendly: true, r: 5, life: 1.8, poisonDps: st.pdps, skillId: 'poison', color: '#6fce58' });
            playSfx('poison');
          }
        }
        break;
      // multishot / lifesteal / speed / power: 패시브 (updatePlayer·dmgMul에서 적용)
    }
    p.skillTimers[id] = t;
  }
}
