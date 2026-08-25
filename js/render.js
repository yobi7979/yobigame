// js/render.js — 렌더 — 캔버스 렌더링 + HUD
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).
// ===== 렌더 =====
let floorPattern = null;
let floorPatternTex = false; // true = floor_pattern이 ASSETS.floor_tex 기반으로 빌드됨
function buildFloorPattern() {
  // floor_tex 로드 완료: 1024→512 스케일 캔버스로 패턴 (시ーム리스)
  if (ASSETS.floor_tex) {
    const t = document.createElement('canvas');
    t.width = 512; t.height = 512;
    t.getContext('2d').drawImage(ASSETS.floor_tex, 0, 0, 512, 512);
    return t;
  }
  // 미로드 폴백: 기존 절차적 400×400
  const c = document.createElement('canvas');
  c.width = 400; c.height = 400;
  const f = c.getContext('2d');
  const colors = ['#161a27', '#141722', '#171b29', '#151826'];
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const x = tx * 100, y = ty * 100;
      f.fillStyle = colors[(tx * 3 + ty) % 4];
      f.fillRect(x, y, 100, 100);
      // 그루트: 타일 경계 2px 선
      f.strokeStyle = '#101320'; f.lineWidth = 2;
      f.strokeRect(x + 1, y + 1, 98, 98);
      // 타일 상단 1px 하이라이트
      f.fillStyle = 'rgba(255,255,255,0.02)';
      f.fillRect(x, y, 100, 1);
    }
  }
  // 스펙클 ~30개 (결정적: i*137%400, i*89%400, 1-2px)
  f.fillStyle = 'rgba(255,255,255,0.015)';
  for (let i = 0; i < 30; i++) {
    const size = (i % 2) + 1;
    f.fillRect((i * 137) % 400, (i * 89) % 400, size, size);
  }
  return c;
}
function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!G) return;
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  // 배경: 바닥 패턴 — floor_tex 로드 시 텍스처, 미로드 시 절차적 폴백.
  // 텍스처가 늦게 로드되면 1회만 재빌드 (패턴의 월드 좌표 고정 메커니즘은 그대로)
  if (!floorPattern || (ASSETS.floor_tex && !floorPatternTex)) {
    floorPattern = ctx.createPattern(buildFloorPattern(), 'repeat');
    floorPatternTex = !!ASSETS.floor_tex;
  }
  ctx.fillStyle = floorPattern;
  ctx.fillRect(cam.x - 512, cam.y - 512, canvas.width + 1024, canvas.height + 1024);
  // 월드 경계
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,209,102,0.25)';
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
  // 던전 벽
  drawWalls();
  // 슬로필드 이펙트
  for (const s of G.slowfieldFx) {
    ctx.strokeStyle = 'rgba(122,229,130,' + (s.t / s.maxT * 0.5) + ')';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
  }
  // 폭발 이펙트
  for (const x of G.explosions) {
    const k = 1 - x.t / x.maxT;
    ctx.fillStyle = 'rgba(255,150,50,' + (x.t / x.maxT * 0.35) + ')';
    ctx.beginPath(); ctx.arc(x.x, x.y, x.r * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
  }
  // 보스 슬래시 경고
  for (const w of G.bossWarnings) {
    ctx.fillStyle = 'rgba(230,57,70,' + (0.12 + 0.15 * Math.sin(G.time * 20)) + ')';
    ctx.strokeStyle = 'rgba(230,57,70,0.7)';
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // XP 구슬
  for (const pk of G.pickups) {
    const pulse = 1 + 0.1 * Math.sin(G.time * 5 + pk.x * 0.05 + pk.y * 0.03);
    if (pk.crit) {
      // 5배 XP 구슬: 금색 글로우 + "5x" 라벨
      const s = 20 * pulse;
      ctx.save();
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 16;
      const grad = ctx.createRadialGradient(pk.x, pk.y, 2, pk.x, pk.y, s);
      grad.addColorStop(0, '#fff7d6'); grad.addColorStop(0.55, '#ffd166'); grad.addColorStop(1, 'rgba(255,170,40,0.2)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText('5x', pk.x, pk.y - s - 3);
    } else if (!drawAsset('xp_orb', pk.x, pk.y, (pk.xp >= 20 ? 22 : 14) * pulse)) {
      ctx.fillStyle = pk.xp >= 20 ? '#ffd166' : '#7ae582';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 아이템 드롭 (영구/일시 버프)
  for (const it of G.items) {
    const def = CONFIG.ITEMS[it.id];
    const y = it.y + Math.sin(it.t * 3) * 3;         // 위아래 붐
    ctx.fillStyle = def.color + '33';                // 글로우 (color는 #rrggbb 6자리 확인됨)
    ctx.beginPath(); ctx.arc(it.x, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(it.x, y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.label, it.x, y + 1);
  }
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  // 적 (애니메이션 프레임 / 정적 에셋 폴백 → 원 폴백)
  for (const e of G.enemies) {
    if (!drawSprite('enemy_' + e.type, e.x, e.y, e.radius * 2, e.animT || 0, true, e.phase)) {
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : ENEMY_COLORS[e.type];
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
    } else if (e.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
    }
    if (e.slow > 0) { ctx.strokeStyle = 'rgba(122,229,130,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
    if (e.type !== 'basic' || e.hp < e.maxHp) {
      const w = e.radius * 2, ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
      ctx.fillStyle = e.type === 'boss' ? '#e63946' : '#f4a261'; ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * ratio, 4);
    }
  }
  // 탄
  for (const pr of G.projectiles) {
    if (pr.friendly) {
      if (pr.vr) {
        // 진화 스킬: 대형 글로우 (흰 코어 → 보라 가장자리)
        const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, pr.vr);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, pr.color || '#c084fc');
        g.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.vr, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,170,60,0.3)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r + 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = pr.color || '#ffab2e';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 링 웨이브
  for (const w of G.waves) {
    if (CONFIG.EVOLUTIONS[w.skillId]) {
      // 진화 웨이브: 두꺼운 보라 이중 링 (확장될수록 옅어짐)
      const a = Math.max(0.25, 1 - w.r / w.maxR);
      ctx.strokeStyle = 'rgba(168,85,247,' + (0.3 + a * 0.45) + ')'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + a * 0.5) + ')'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(90,200,250,0.7)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // 체인 라이트닝
  for (const l of G.lightnings) {
    const a = l.t / l.maxT;
    const path = () => { ctx.beginPath(); l.pts.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); }); };
    if (l.skillId && CONFIG.EVOLUTIONS[l.skillId]) {
      path(); ctx.strokeStyle = 'rgba(168,85,247,' + (a * 0.7) + ')'; ctx.lineWidth = 9; ctx.stroke();
      path(); ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 3; ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(125,211,252,' + a + ')';
      ctx.lineWidth = 2;
      path(); ctx.stroke();
    }
  }
  // 플레이어
  const p = G.player;
  // 트레일
  for (let i = 0; i < p.trail.length; i++) {
    const tr = p.trail[i];
    ctx.fillStyle = 'rgba(255,255,255,' + (i / p.trail.length * 0.15) + ')';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, p.radius * (i / p.trail.length), 0, Math.PI * 2); ctx.fill();
  }
  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(77,171,247,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2); ctx.stroke();
  }
  // 스핀 블레이드 링
  const sb = p.skills.spinblade ? skillStats('spinblade', p.skills.spinblade) : null;
  if (sb) {
    ctx.strokeStyle = 'rgba(200,190,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(p.x, p.y, sb.radius, G.time * 3, G.time * 3 + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  // 진화 스피닝 링
  for (const id in p.skills) {
    const evoR = CONFIG.EVOLUTIONS[id];
    if (!evoR || evoR.form !== 'spin') continue;
    const sst = skillStats(id, p.skills[id]);
    if (!sst) continue;
    const rr = sst.radius + Math.sin(G.time * 4) * 4;   // 펄스
    ctx.strokeStyle = 'rgba(168,85,247,0.75)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(216,180,254,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([12, 6]);
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, -G.time * 2.5, -G.time * 2.5 + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  const psz = p.radius * 2.6;
  if (!drawSprite('player', p.x, p.y, psz, p.animT || 0, p.moving, 0)) {
    ctx.fillStyle = p.flash > 0 ? '#ff8899' : '#ffffff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
  }
  if (p.flash > 0) {
    ctx.fillStyle = 'rgba(255,80,100,0.45)';
    ctx.beginPath(); ctx.arc(p.x, p.y, psz / 2, 0, Math.PI * 2); ctx.fill();
  }
  // 이동 방향
  ctx.strokeStyle = p.flash > 0 ? '#ff8899' : '#ffd166'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * (p.radius + 6), p.y + Math.sin(p.angle) * (p.radius + 6)); ctx.stroke();
  // 칼날 (동료)
  for (const k of G.knives) {
    const a = Math.atan2(k.vy, k.vx);
    ctx.strokeStyle = '#b197fc'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(k.x - Math.cos(a) * 7, k.y - Math.sin(a) * 7);
    ctx.lineTo(k.x + Math.cos(a) * 7, k.y + Math.sin(a) * 7); ctx.stroke();
  }
  // 동료
  if (G.companion) {
    const c = G.companion;
    const cdef = CONFIG.COMPANIONS.find(x => x.id === c.id);
    const cdrawn = drawSprite('comp_' + c.id, c.x, c.y, 26, G.time, true, 1);
    if (!cdrawn) {
      ctx.fillStyle = COMP_COLORS[c.id] || '#ffffff';
      ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cdef ? cdef.icon : '❔', c.x, c.y);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }
  // 스래시
  for (const s of G.slashes) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (s.t / s.maxT * 0.8) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.range || 46, s.angle - 0.8, s.angle + 0.8); ctx.stroke();
  }
  // 파티클
  for (const pt of G.particles) {
    const a = pt.life / pt.maxLife;
    ctx.globalAlpha = a;
    if (pt.ring) {
      ctx.strokeStyle = pt.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // 데미지 숫자
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.min(1, f.t / f.maxT * 2);
    ctx.fillStyle = f.color;
    ctx.fillText(String(f.txt), f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawMinimap();
  // 스테이지 배너
  if (G.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, G.bannerT / 0.4);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 48px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.banner, canvas.width / 2, canvas.height / 2 - 60);
    ctx.globalAlpha = 1;
  }
  // 터치 조이스틱 (화면 좌표)
  if (joy.active) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_R, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(joy.ox + joy.dx, joy.oy + joy.dy, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  updateHUD();
}

// ===== 미니맵 =====
function drawMinimap() {
  if (G.state !== 'playing' && G.state !== 'levelup') return;
  const s = canvas.width < 640 ? 7 : 10, pad = 6, bx = 10, by = canvas.width < 640 ? 84 : 58;
  const mw = MAP.cols * s, mh = MAP.rows * s;
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(bx, by, mw + pad * 2, mh + pad * 2);
  ctx.strokeStyle = '#3a4260'; ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, mw + pad * 2, mh + pad * 2);
  const ox = bx + pad, oy = by + pad, sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.fillStyle = '#3d4666';
  for (const rc of MAP.wallRects) ctx.fillRect(ox + rc.x * sx, oy + rc.y * sy, Math.max(2, rc.w * sx), Math.max(2, rc.h * sy));
  if (G.companion) { ctx.fillStyle = '#4d9fff'; ctx.beginPath(); ctx.arc(ox + G.companion.x * sx, oy + G.companion.y * sy, 2, 0, Math.PI * 2); ctx.fill(); }
  for (const e of G.enemies) { ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(ox + e.x * sx, oy + e.y * sy, e.type === 'boss' ? 2.5 : 1.5, 0, Math.PI * 2); ctx.fill(); }
  const p = G.player;
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ox + p.x * sx, oy + p.y * sy, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ox + p.x * sx, oy + p.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
}

// ===== HUD =====
let lastSkillKey = '';
let skillDmgEls = {};
function fmtDmg(n) {
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return (n / 1e3).toFixed(1) + 'K';
  return (n / 1e6).toFixed(1) + 'M';
}
function updateHUD() {
  const p = G.player;
  hudEl.style.display = (G.state === 'playing' || G.state === 'levelup') ? 'flex' : 'none';
  hpFill.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
  hpText.textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp + (p.shield > 0 ? ' (+' + Math.ceil(p.shield) + ')' : '');
  xpFill.style.width = Math.min(100, p.xp / xpForLevel(p.level) * 100) + '%';
  xpText.textContent = Math.floor(p.xp) + ' / ' + xpForLevel(p.level);
  lvlText.textContent = p.level;
  const stg = CONFIG.STAGES[G.stage - 1];
  stageInfo.textContent = '스테이지 ' + G.stage + '/' + CONFIG.STAGES.length;
  const remain = Math.max(0, stg.time - G.stageTime);
  timer.textContent = Math.floor(remain / 60) + ':' + String(Math.floor(remain % 60)).padStart(2, '0');
  killsEl.textContent = stg.boss
    ? (G.bossSpawned ? (G.boss ? '👹 보스전  ' : '✔  ') : '보스 대기  ') + G.kills + '/' + stg.clearKills
    : G.kills + '/' + stg.clearKills;
  const act = [];
  if (G.tempBuffs.rage > 0) act.push('🔥' + Math.ceil(G.tempBuffs.rage));
  if (G.tempBuffs.haste > 0) act.push('👟' + Math.ceil(G.tempBuffs.haste));
  if (G.tempBuffs.magnet > 0) act.push('🧲' + Math.ceil(G.tempBuffs.magnet));
  buffsEl.textContent = act.join('  ');
  if (G.boss && G.boss.hp > 0) {
    bossBar.style.display = 'block';
    bossName.textContent = G.boss.type === 'boss' ? '👹 BOSS' : '👹 MINI BOSS';
    bossFill.style.width = Math.max(0, G.boss.hp / G.boss.maxHp * 100) + '%';
    bossHpText.textContent = Math.ceil(G.boss.hp) + ' / ' + Math.round(G.boss.maxHp);
  } else bossBar.style.display = 'none';
  const key = Object.entries(p.skills).map(([k, v]) => k + v).join(',');
  if (key !== lastSkillKey) {
    lastSkillKey = key;
    skillDmgEls = {};
    const combo = new Set(combinableIds(p)); // Lv5 무관 조합 가능 스킬
    skillsEl.innerHTML = Object.entries(p.skills).map(([k, v]) => {
      const cb = combo.has(k);
      return '<div class="skill-icon' + (cb ? ' combinable' : '') + '" title="' + SKILL_NAMES[k] + ' Lv' + v + (cb ? ' · 조합 가능' : '') + '">' + iconHtml(k) +
      '<span style="position:absolute;bottom:2px;right:4px;font-size:10px;color:#ffd166">' + v + '</span>' +
      '<span class="skill-dmg"></span></div>';
    }).join('');
    skillsEl.prepend(evolveBtn); // innerHTML 재빌드로 버튼 소실 방지
    const ids = Object.keys(p.skills);
    skillsEl.querySelectorAll('.skill-dmg').forEach((el, i) => { skillDmgEls[ids[i]] = el; });
  }
  for (const k in G.skillDamage) {
    const el = skillDmgEls[k];
    if (el) {
      const s = fmtDmg(G.skillDamage[k]);
      if (el.textContent !== s) el.textContent = s;
    }
  }
  evolveBtn.classList.toggle('hidden', G.state !== 'playing' || evolutionPairs(G.player).length === 0);
}
