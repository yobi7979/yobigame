// js/map.js — 랜덤 던전(미로) 생성 + 벽 충돌
// 월드 2400×1800을 200px 셀 12×9로 분할. Recursive Backtracker + Braid.
// index.html IIFE에서 분리. 최상위 심볼은 스크립트 간 전역 렉시컬 스코프로 공유 (CONFIG 방식).

const MAP = {
  cell: 200, cols: 0, rows: 0, wallT: 40,
  vW: null, hW: null, wallRects: [],
};

// 시드형 의사난수 (테스트 결정성용)
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// vW[c*rows+r]     = 룸(c,r)~(c+1,r) 사이 세로벽 (1=존재)
// hW[c*(rows-1)+r] = 룸(c,r)~(c,r+1) 사이 가로벽
function genDungeon(rand = Math.random) {
  const C = MAP.cell;
  MAP.cols = Math.round(WORLD.w / C);   // 12
  MAP.rows = Math.round(WORLD.h / C);   // 9
  const { cols, rows } = MAP;
  const vW = new Uint8Array((cols - 1) * rows).fill(1);
  const hW = new Uint8Array(cols * (rows - 1)).fill(1);

  // 1) Recursive Backtracker (반복형 DFS) → 완성 미로
  const visited = new Uint8Array(cols * rows);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cc = cur % cols, cr = Math.floor(cur / cols);
    const nexts = [];
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (!visited[nr * cols + nc]) nexts.push([nc, nr]);
    }
    if (!nexts.length) { stack.pop(); continue; }
    const [nc, nr] = nexts[Math.floor(rand() * nexts.length)];
    if (nc === cc + 1) vW[cc * rows + cr] = 0;
    else if (nc === cc - 1) vW[nc * rows + nr] = 0;
    else if (nr === cr + 1) hW[cc * (rows - 1) + cr] = 0;
    else hW[nc * (rows - 1) + nr] = 0;
    visited[nr * cols + nc] = 1;
    stack.push(nr * cols + nc);
  }

  // 2) Braid: 막다른 룸의 추가 벽을 35% 확률로 더 열어 순환 동선 확보
  const BRAID = 0.35;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let open = 0;
    const closed = [];
    if (c < cols - 1) { if (!vW[c * rows + r]) open++; else closed.push(['v', c * rows + r]); }
    if (c > 0)         { if (!vW[(c-1) * rows + r]) open++; else closed.push(['v', (c-1) * rows + r]); }
    if (r < rows - 1)  { if (!hW[c * (rows-1) + r]) open++; else closed.push(['h', c * (rows-1) + r]); }
    if (r > 0)         { if (!hW[c * (rows-1) + (r-1)]) open++; else closed.push(['h', c * (rows-1) + (r-1)]); }
    if (open === 1 && closed.length && rand() < BRAID) {
      const [k, wi] = closed[Math.floor(rand() * closed.length)];
      if (k === 'v') vW[wi] = 0; else hW[wi] = 0;
    }
  }
  // 3) Dead-end removal: open a second exit for every room (no blocked spaces)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let open = 0; const closed = [];
    if (c > 0) { if (!vW[(c-1) * rows + r]) open++; else closed.push(['v', (c-1) * rows + r]); }
    if (c < cols - 1) { if (!vW[c * rows + r]) open++; else closed.push(['v', c * rows + r]); }
    if (r > 0) { if (!hW[c * (rows-1) + (r-1)]) open++; else closed.push(['h', c * (rows-1) + (r-1)]); }
    if (r < rows - 1) { if (!hW[c * (rows-1) + r]) open++; else closed.push(['h', c * (rows-1) + r]); }
    if (open === 1) { const [k, wi] = closed[Math.floor(rand() * closed.length)]; if (k === 'v') vW[wi] = 0; else hW[wi] = 0; }
  }
  // 4) 추가 개방: 남은 닫힌 벽을 45% 확률로 더 열기 (단순한 맵)
  for (let wi = 0; wi < vW.length; wi++) if (vW[wi] && rand() < 0.45) vW[wi] = 0;
  for (let wi = 0; wi < hW.length; wi++) if (hW[wi] && rand() < 0.45) hW[wi] = 0;
  MAP.vW = vW; MAP.hW = hW;

  // 3) 벽 사각형 리스트 (충돌 + 렌더 공용)
  const WT = MAP.wallT, rects = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
    if (vW[c * rows + r]) rects.push({ x: (c+1)*C - WT/2, y: r*C, w: WT, h: C });
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
    if (hW[c * (rows-1) + r]) rects.push({ x: c*C, y: (r+1)*C - WT/2, w: C, h: WT });
  }
  MAP.wallRects = rects;
  return rects;
}

// 원-사각형 겹침 검사
function circleRectOverlap(x, y, r, rc) {
  const nx = Math.max(rc.x, Math.min(x, rc.x + rc.w));
  const ny = Math.max(rc.y, Math.min(y, rc.y + rc.h));
  const dx = x - nx, dy = y - ny;
  return dx*dx + dy*dy < r*r;
}

// 축 분리 이동: 축별 스윕 오버랩(터널링 방지) + 이동 방향 반대 면에서 정지 + 월드 경계 클램프
// 각 축은 "그 축만" 해소해 접촉 중인 다른 축 벽에 오인 밀어내기가 없도록 한다
function moveWithWalls(e, dx, dy, r) {
  const ox = e.x, oy = e.y;
  let x = Math.max(r, Math.min(WORLD.w - r, ox + dx));
  for (const rc of MAP.wallRects) {
    if (e.y + r <= rc.y || e.y - r >= rc.y + rc.h) continue;                         // Y 실제 겹침 없음
    if (Math.max(ox, x) + r <= rc.x || Math.min(ox, x) - r >= rc.x + rc.w) continue; // X 스윕이 벽 미교차
    if (dx > 0) x = Math.min(x, rc.x - r);
    else if (dx < 0) x = Math.max(x, rc.x + rc.w + r);
    else x = (ox < rc.x + rc.w / 2) ? Math.min(x, rc.x - r) : Math.max(x, rc.x + rc.w + r);
  }
  e.x = x;
  let y = Math.max(r, Math.min(WORLD.h - r, oy + dy));
  for (const rc of MAP.wallRects) {
    if (e.x + r <= rc.x || e.x - r >= rc.x + rc.w) continue;
    if (Math.max(oy, y) + r <= rc.y || Math.min(oy, y) - r >= rc.y + rc.h) continue;
    if (dy > 0) y = Math.min(y, rc.y - r);
    else if (dy < 0) y = Math.max(y, rc.y + rc.h + r);
    else y = (oy < rc.y + rc.h / 2) ? Math.min(y, rc.y - r) : Math.max(y, rc.y + rc.h + r);
  }
  e.y = y;
}

function pointInWall(x, y) {
  for (const rc of MAP.wallRects)
    if (x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) return true;
  return false;
}

// 시야 검사: 직선상 20px 간격 샘플링
function hasLOS(x1, y1, x2, y2) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 20));
  for (let i = 1; i < steps; i++) {
    if (pointInWall(x1 + (x2-x1)*i/steps, y1 + (y2-y1)*i/steps)) return false;
  }
  return true;
}

// 플레이어 기준 minDist~maxDist 내 빈 지점 + LOS 확보 (24회 재시도)
function findSpawnPos(minDist, maxDist) {
  const p = G.player;
  const tryPos = () => {
    const a = Math.random() * Math.PI * 2;
    const d = minDist + Math.random() * (maxDist - minDist);
    return {
      x: clamp(p.x + Math.cos(a)*d, 60, WORLD.w - 60),
      y: clamp(p.y + Math.sin(a)*d, 60, WORLD.h - 60),
    };
  };
  for (let i = 0; i < 24; i++) {
    const pos = tryPos();
    if (!pointInWall(pos.x, pos.y) && hasLOS(p.x, p.y, pos.x, pos.y)) return pos;
  }
  for (let i = 0; i < 24; i++) { const pos = tryPos(); if (!pointInWall(pos.x, pos.y)) return pos; }
  return { x: p.x, y: p.y };
}

// 벽 렌더 (가시 영역만)
let wallPattern = null; // wall_tex 기반 패턴 캐시 (로드 완료 시 1회 생성)

// 면 노출 판정: 각 면 중앙의 외부 ~2px 지점에 다른 벽 rect가 없으면 노출면(빈 바닥)
// true = 노출(밝은 테두리), false = 닫힘(인접 벽과 맞닿은 이음, 어두운 테두리)
function wallExposedFaces(rc) {
  const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
  return {
    top: !pointInWall(cx, rc.y - 2),
    bottom: !pointInWall(cx, rc.y + rc.h + 2),
    left: !pointInWall(rc.x - 2, cy),
    right: !pointInWall(rc.x + rc.w + 2, cy),
  };
}

// 테두리 밴드를 다른 벽 rect로 클리핑.
// T자 이음에서는 wall rect가 20px 겹쳐 → 밴드가 인접벽 면을 가로지르는 줄(시임) 방지를 위해
// 다른 벽이 차지하는 부분을 잘라낸 부분 사각형 목록 [x,y,w,h] 반환 (전부 가리면 빈 배열)
function wallEdgeSegments(x1, y1, x2, y2, self) {
  const horiz = (x2 - x1) >= (y2 - y1); // 가로 밴드는 x 축, 세로 밴드는 y 축으로 자름
  let segs = horiz ? [[x1, x2]] : [[y1, y2]];
  for (const o of MAP.wallRects) {
    if (o === self) continue;
    const ix1 = Math.max(x1, o.x), ix2 = Math.min(x2, o.x + o.w);
    const iy1 = Math.max(y1, o.y), iy2 = Math.min(y2, o.y + o.h);
    if (ix2 <= ix1 || iy2 <= iy1) continue;
    const ca = horiz ? ix1 : iy1, cb = horiz ? ix2 : iy2;
    segs = segs.flatMap(([a, b]) => {
      if (cb <= a || ca >= b) return [[a, b]];
      const out = [];
      if (a < ca) out.push([a, ca]);
      if (cb < b) out.push([cb, b]);
      return out;
    });
  }
  return segs.map(([a, b]) => (horiz ? [a, y1, b - a, y2 - y1] : [x1, a, x2 - x1, b - a]));
}

function drawWalls() {
  const xr = cam.x + canvas.width, yr = cam.y + canvas.height;
  const wt = ASSETS.wall_tex;
  // 텍스처 로드 시: createPattern은 카메라 변환 안에서 fillRect하면
  // 패턴이 월드 기점에 바닥과 동일하게 고정됨
  const wp = wt ? (wallPattern || (wallPattern = ctx.createPattern(wt, 'repeat'))) : null;
  const FACE_T = 3; // 노출/이음 테두리 두께
  for (const rc of MAP.wallRects) {
    if (rc.x + rc.w < cam.x || rc.x > xr || rc.y + rc.h < cam.y || rc.y > yr) continue;
    if (!wt) {
      // 미로드 폴백: 기존 절차적 석재 스타일
      ctx.fillStyle = '#232a41';
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      if (rc.w > rc.h) { for (let y = rc.y + 40; y < rc.y + rc.h; y += 40) ctx.fillRect(rc.x, y, rc.w, 2); }
      else { for (let x = rc.x + 40; x < rc.x + rc.w; x += 40) ctx.fillRect(x, rc.y, 2, rc.h); }
      ctx.fillStyle = '#3d4666';
      ctx.fillRect(rc.x, rc.y, rc.w, Math.min(5, rc.h));
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(rc.x, rc.y + rc.h - 5, rc.w, 5);
      ctx.fillRect(rc.x + rc.w - 4, rc.y, 4, rc.h);
      continue;
    }
    // 로드 완료: 텍스처 패턴으로 벽 채우기 (패턴 생성 실패 시 베이스색 폴백)
    ctx.fillStyle = wp || '#232a41';
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
    // 4면: 노출면 → 밝은 테두리 (하이라이트), 닫힌 면 → 어두운 테두리 (이음 그림자)
    // wallEdgeSegments로 인접벽 겹침 부분 클리핑 (T자 이음 시임 방지)
    const f = wallExposedFaces(rc);
    const drawBand = (x1, y1, x2, y2) => {
      for (const [sx, sy, sw, sh] of wallEdgeSegments(x1, y1, x2, y2, rc)) {
        ctx.fillRect(sx, sy, sw, sh);
      }
    };
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    if (!f.top) drawBand(rc.x, rc.y, rc.x + rc.w, rc.y + FACE_T);
    if (!f.bottom) drawBand(rc.x, rc.y + rc.h - FACE_T, rc.x + rc.w, rc.y + rc.h);
    if (!f.left) drawBand(rc.x, rc.y, rc.x + FACE_T, rc.y + rc.h);
    if (!f.right) drawBand(rc.x + rc.w - FACE_T, rc.y, rc.x + rc.w, rc.y + rc.h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    if (f.top) drawBand(rc.x, rc.y, rc.x + rc.w, rc.y + FACE_T);
    if (f.bottom) drawBand(rc.x, rc.y + rc.h - FACE_T, rc.x + rc.w, rc.y + rc.h);
    if (f.left) drawBand(rc.x, rc.y, rc.x + FACE_T, rc.y + rc.h);
    if (f.right) drawBand(rc.x + rc.w - FACE_T, rc.y, rc.x + rc.w, rc.y + rc.h);
  }
}

// 지정 지점에 가장 가까운 룸 중심 (격자선 위 스폰 → 벽 겹침 방지)
function nearestRoomCenter(x, y) {
  const c = Math.min(MAP.cols - 1, Math.max(0, Math.round((x - MAP.cell / 2) / MAP.cell)));
  const r = Math.min(MAP.rows - 1, Math.max(0, Math.round((y - MAP.cell / 2) / MAP.cell)));
  return { x: (c + 0.5) * MAP.cell, y: (r + 0.5) * MAP.cell };
}

const MAP_EXPORTS = { MAP, mulberry32, genDungeon, circleRectOverlap, moveWithWalls, pointInWall, hasLOS, findSpawnPos, drawWalls, wallExposedFaces, nearestRoomCenter };
if (typeof module !== 'undefined') module.exports = MAP_EXPORTS;
