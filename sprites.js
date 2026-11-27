/* 합동 비서실 — 픽셀 스프라이트 & 오피스 맵 드로잉
 * 모든 좌표는 논리 픽셀(480 x 290) 기준. 캔버스는 SCALE 배율로 확대해 그립니다.
 */

export const LOGICAL_W = 480;
export const LOGICAL_H = 290;
export const SCALE = 2;

export const SPRITE_W = 30;
export const SPRITE_H = 36;

export const PALETTE = {
  ink: '#141210',
  ink2: '#332e29',
  gray: '#6a635a',
  gray2: '#9b9287',
  line: '#c6bdae',
  paper: '#f7f3e9',
  paper2: '#eee8da',
  floor: '#e9e2d2',
  floor2: '#e1d9c6',
  light: '#fbf8f0',
};

export const CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/* 자음 몸통: 7x7 격자. 눈·입은 글자마다 빈 자리에 맞춰 지정합니다. */
const LETTERS = {
  'ㄱ': { g: ['#######', '......#', '......#', '......#', '......#', '......#', '......#'], eyes: [[1, 2], [4, 2]], mouth: [2, 4] },
  'ㄴ': { g: ['#......', '#......', '#......', '#......', '#......', '#......', '#######'], eyes: [[2, 1], [4, 1]], mouth: [3, 3] },
  'ㄷ': { g: ['#######', '#......', '#......', '#......', '#......', '#......', '#######'], eyes: [[2, 1], [4, 1]], mouth: [3, 3] },
  'ㄹ': { g: ['#######', '......#', '#######', '#......', '#......', '#......', '#######'], eyes: [[1, 1], [4, 1]], mouth: [2, 4] },
  'ㅁ': { g: ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.'], eyes: [[1, 2], [4, 2]], mouth: [2, 4] },
  'ㅂ': { g: ['#.....#', '#.....#', '#######', '#.....#', '#.....#', '#.....#', '#.....#'], eyes: [[1, 1], [4, 1]], mouth: [2, 4] },
  'ㅅ': { g: ['...#...', '..#....', '..#.#..', '.#...#.', '.#...#.', '#.....#', '#.....#'], eyes: [[1, 2], [5, 2]], mouth: [2, 4] },
  'ㅇ': { g: ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.'], eyes: [[1, 2], [4, 2]], mouth: [2, 4] },
  'ㅈ': { g: ['#######', '....#..', '...#...', '..#....', '.#.....', '.#.....', '#......'], eyes: [[1, 2], [5, 2]], mouth: [2, 4] },
  'ㅊ': { g: ['...#...', '#######', '....#..', '...#...', '..#....', '.#.....', '#......'], eyes: [[1, 3], [5, 3]], mouth: [2, 5] },
  'ㅋ': { g: ['#######', '.....#.', '.....#.', '.....#.', '#######', '.....#.', '.....#.'], eyes: [[1, 1], [4, 1]], mouth: [2, 5] },
  'ㅌ': { g: ['#######', '#......', '#######', '#......', '#######', '#......', '#######'], eyes: [[2, 1], [4, 1]], mouth: [2, 3] },
  'ㅍ': { g: ['#.....#', '#.....#', '#######', '#.....#', '#.....#', '#######', '...#...'], eyes: [[1, 1], [4, 1]], mouth: [2, 4] },
  'ㅎ': { g: ['..###..', '....#..', '...#...', '#######', '.#...#.', '#.....#', '#.....#'], eyes: [[1, 2], [5, 2]], mouth: [2, 4] },
};

export const ZONES = {
  desk: { x: 12, y: 28, w: 208, h: 114, tag: '데스크 · 작업 존', key: 'desk' },
  meeting: { x: 232, y: 28, w: 236, h: 114, tag: '회의실', key: 'meeting' },
  lounge: { x: 12, y: 158, w: 208, h: 120, tag: '라운지 · 휴게실', key: 'lounge' },
  board: { x: 232, y: 158, w: 236, h: 120, tag: '공지 화이트보드', key: 'board' },
};

const SLOTS = {
  desk: [[30, 40], [86, 40], [142, 40], [30, 96], [86, 96], [142, 96]],
  meeting: [[276, 40], [322, 40], [368, 40], [276, 100], [322, 100], [368, 100]],
  lounge: [[34, 176], [92, 176], [150, 176], [34, 224]],
  away: [[150, 224], [186, 236]],
  board: [[250, 190]],
};

export function zoneForStatus(status) {
  if (status === 'meeting') return 'meeting';
  if (status === 'idle') return 'lounge';
  if (status === 'away') return 'away';
  return 'desk';
}

export function slotFor(status, index) {
  const z = zoneForStatus(status);
  const list = SLOTS[z] || SLOTS.desk;
  const base = list[index % list.length];
  const wrap = Math.floor(index / list.length);
  return [base[0] + (wrap % 2) * 6, base[1] - wrap * 5];
}

/* ---------- 기본 그리기 도구 ---------- */
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function frame(ctx, x, y, w, h, color, t = 2) {
  px(ctx, x, y, w, t, color);
  px(ctx, x, y + h - t, w, t, color);
  px(ctx, x, y, t, h, color);
  px(ctx, x + w - t, y, t, h, color);
}

function tiles(ctx, x, y, w, h, a, b, size = 12) {
  for (let ty = y; ty < y + h; ty += size) {
    for (let tx = x; tx < x + w; tx += size) {
      const odd = (Math.floor((tx - x) / size) + Math.floor((ty - y) / size)) % 2 === 1;
      px(ctx, tx, ty, Math.min(size, x + w - tx), Math.min(size, y + h - ty), odd ? b : a);
    }
  }
}

/* ---------- 오피스 맵 바탕 ---------- */
export function drawOfficeBase(ctx) {
  // 바닥 전체
  px(ctx, 0, 0, LOGICAL_W, LOGICAL_H, PALETTE.paper2);
  tiles(ctx, 0, 0, LOGICAL_W, LOGICAL_H, PALETTE.floor, PALETTE.floor2, 16);

  // 외곽 벽
  frame(ctx, 0, 0, LOGICAL_W, LOGICAL_H, PALETTE.ink, 4);
  px(ctx, 4, 4, LOGICAL_W - 8, 2, PALETTE.line);

  for (const key of ['desk', 'meeting', 'lounge', 'board']) {
    const z = ZONES[key];
    px(ctx, z.x, z.y, z.w, z.h, PALETTE.paper);
    tiles(ctx, z.x + 2, z.y + 2, z.w - 4, z.h - 4, PALETTE.floor, PALETTE.floor2, 12);
    frame(ctx, z.x, z.y, z.w, z.h, PALETTE.ink, 2);
    // 모서리 픽셀 장식
    px(ctx, z.x - 2, z.y - 2, 4, 4, PALETTE.ink);
    px(ctx, z.x + z.w - 2, z.y - 2, 4, 4, PALETTE.ink);
    px(ctx, z.x - 2, z.y + z.h - 2, 4, 4, PALETTE.ink);
    px(ctx, z.x + z.w - 2, z.y + z.h - 2, 4, 4, PALETTE.ink);
  }

  drawDesks(ctx);
  drawMeeting(ctx);
  drawLounge(ctx);
  drawBoard(ctx);
}

function drawDesks(ctx) {
  for (const [sx, sy] of SLOTS.desk) {
    // 책상
    px(ctx, sx - 6, sy + 24, 42, 10, PALETTE.paper2);
    frame(ctx, sx - 6, sy + 24, 42, 10, PALETTE.ink, 2);
    px(ctx, sx + 2, sy + 27, 26, 2, PALETTE.line);
    // 모니터
    px(ctx, sx + 6, sy + 12, 18, 12, PALETTE.ink);
    px(ctx, sx + 8, sy + 14, 14, 8, PALETTE.paper);
    px(ctx, sx + 9, sy + 15, 12, 1, PALETTE.gray2);
    px(ctx, sx + 9, sy + 17, 8, 1, PALETTE.gray2);
    px(ctx, sx + 9, sy + 19, 10, 1, PALETTE.gray2);
    // 받침
    px(ctx, sx + 13, sy + 24, 4, 2, PALETTE.gray);
    // 서류 더미
    px(ctx, sx + 26, sy + 27, 7, 4, PALETTE.light);
    frame(ctx, sx + 26, sy + 27, 7, 4, PALETTE.gray2, 1);
  }
}

function drawMeeting(ctx) {
  // 회의 테이블
  px(ctx, 292, 74, 148, 38, PALETTE.paper2);
  frame(ctx, 292, 74, 148, 38, PALETTE.ink, 2);
  px(ctx, 296, 78, 140, 4, PALETTE.line);
  // 다리
  px(ctx, 296, 112, 4, 4, PALETTE.ink);
  px(ctx, 432, 112, 4, 4, PALETTE.ink);
  // 의자
  for (const [sx] of SLOTS.meeting.slice(0, 3)) {
    px(ctx, sx + 4, 84, 22, 6, PALETTE.paper);
    frame(ctx, sx + 4, 84, 22, 6, PALETTE.gray, 1);
  }
  for (const [sx] of SLOTS.meeting.slice(3, 6)) {
    px(ctx, sx + 4, 92, 22, 6, PALETTE.paper);
    frame(ctx, sx + 4, 92, 22, 6, PALETTE.gray, 1);
  }
  // 화이트보드(회의실 벽면)
  px(ctx, 240, 34, 26, 18, PALETTE.light);
  frame(ctx, 240, 34, 26, 18, PALETTE.gray, 2);
}

function drawLounge(ctx) {
  // 러그
  px(ctx, 22, 164, 188, 108, PALETTE.paper);
  px(ctx, 24, 166, 184, 104, PALETTE.floor2);
  frame(ctx, 24, 166, 184, 104, PALETTE.line, 2);
  // 소파
  px(ctx, 138, 244, 74, 20, PALETTE.paper2);
  frame(ctx, 138, 244, 74, 20, PALETTE.ink, 2);
  px(ctx, 142, 250, 30, 10, PALETTE.paper);
  px(ctx, 178, 250, 30, 10, PALETTE.paper);
  px(ctx, 138, 240, 74, 5, PALETTE.gray2);
  // 탁자
  px(ctx, 116, 208, 34, 16, PALETTE.paper2);
  frame(ctx, 116, 208, 34, 16, PALETTE.ink, 2);
  px(ctx, 122, 213, 8, 6, PALETTE.light);
  frame(ctx, 122, 213, 8, 6, PALETTE.gray2, 1);
  // 화분
  px(ctx, 198, 172, 12, 10, PALETTE.paper2);
  frame(ctx, 198, 172, 12, 10, PALETTE.ink, 1);
  px(ctx, 202, 164, 4, 8, PALETTE.gray);
  px(ctx, 198, 168, 6, 3, PALETTE.gray2);
  px(ctx, 206, 166, 6, 3, PALETTE.gray2);
  // 커피 머신
  px(ctx, 34, 250, 16, 18, PALETTE.paper2);
  frame(ctx, 34, 250, 16, 18, PALETTE.ink, 2);
  px(ctx, 38, 254, 8, 5, PALETTE.ink2);
  px(ctx, 39, 262, 6, 4, PALETTE.light);
  frame(ctx, 39, 262, 6, 4, PALETTE.gray, 1);
}

function drawBoard(ctx) {
  // 화이트보드
  px(ctx, 246, 176, 208, 92, PALETTE.light);
  frame(ctx, 246, 176, 208, 92, PALETTE.ink, 3);
  px(ctx, 250, 180, 200, 8, PALETTE.paper2);
  px(ctx, 254, 183, 4, 3, PALETTE.gray2);
  px(ctx, 262, 183, 4, 3, PALETTE.gray2);
  px(ctx, 270, 183, 4, 3, PALETTE.gray2);
  // 필기 줄
  for (let i = 0; i < 5; i++) {
    px(ctx, 258, 198 + i * 12, 118 - (i % 3) * 16, 2, PALETTE.gray2);
  }
  // 점착 메모
  const notes = [[386, 196], [412, 200], [396, 228]];
  notes.forEach(([nx, ny], i) => {
    px(ctx, nx, ny, 24, 22, i % 2 ? PALETTE.paper2 : PALETTE.floor);
    frame(ctx, nx, ny, 24, 22, PALETTE.gray, 1);
    px(ctx, nx + 4, ny + 6, 16, 1, PALETTE.gray2);
    px(ctx, nx + 4, ny + 10, 12, 1, PALETTE.gray2);
    px(ctx, nx + 4, ny + 14, 14, 1, PALETTE.gray2);
  });
  // 트레이
  px(ctx, 254, 254, 60, 4, PALETTE.gray);
  px(ctx, 258, 248, 3, 6, PALETTE.ink2);
  px(ctx, 272, 248, 3, 6, PALETTE.ink2);
}

/* ---------- 캐릭터 ---------- */
const MOODS = {
  working: { mouth: 'flat' },
  meeting: { mouth: 'open' },
  idle: { mouth: 'smile' },
  away: { mouth: 'sleep' },
};

export function drawCharacter(ctx, opts) {
  const { consonant, x, y, status = 'working', blink = false, bob = 0, selected = false, dim = false } = opts;
  const letter = LETTERS[consonant] || LETTERS['ㅇ'];
  const cell = 3;
  const gx = Math.round(x + 4);
  const gy = Math.round(y + 3 + bob);
  const ink = PALETTE.ink;

  ctx.save();
  if (dim) ctx.globalAlpha = 0.42;

  // 그림자
  ctx.fillStyle = 'rgba(20,18,16,0.13)';
  ctx.beginPath();
  ctx.ellipse(x + SPRITE_W / 2, y + SPRITE_H - 2, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 팔
  px(ctx, gx - 4, gy + 9, 4, 3, ink);
  px(ctx, gx + 21, gy + 9, 4, 3, ink);

  // 몸통(자음)
  letter.g.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') px(ctx, gx + c * cell, gy + r * cell, cell, cell, ink);
    }
  });

  // 다리
  px(ctx, gx + 3, gy + 21, 3, 5, ink);
  px(ctx, gx + 15, gy + 21, 3, 5, ink);

  // 눈
  const mood = MOODS[status] || MOODS.working;
  for (const [ex, ey] of letter.eyes) {
    const ax = gx + ex * cell;
    const ay = gy + ey * cell;
    if (blink) {
      px(ctx, ax, ay + 1, cell, 1, ink);
    } else {
      px(ctx, ax, ay, cell, cell, ink);
      px(ctx, ax, ay, 1, 1, PALETTE.paper);
    }
  }

  // 입
  const [mx, my] = letter.mouth;
  const bx = gx + mx * cell;
  const by = gy + my * cell;
  if (mood.mouth === 'flat') px(ctx, bx, by + 1, cell * 2, 1, ink);
  else if (mood.mouth === 'open') {
    px(ctx, bx, by, cell * 2, cell, ink);
    px(ctx, bx + 1, by + 1, 2, 1, PALETTE.paper);
  } else if (mood.mouth === 'smile') {
    px(ctx, bx, by + 1, 1, 1, ink);
    px(ctx, bx + 1, by + 2, cell * 2 - 2, 1, ink);
    px(ctx, bx + cell * 2 - 1, by + 1, 1, 1, ink);
  } else {
    px(ctx, bx, by + 1, cell * 2, 1, ink);
    px(ctx, bx + cell * 2 + 2, by - 2, 3, 1, PALETTE.gray);
    px(ctx, bx + cell * 2 + 3, by - 5, 3, 1, PALETTE.gray);
  }

  // 볼
  px(ctx, gx + 1, gy + 14, 2, 2, PALETTE.line);
  px(ctx, gx + 20, gy + 14, 2, 2, PALETTE.line);

  ctx.restore();

  // 선택 표시
  if (selected) {
    ctx.save();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(Math.round(x - 2) + 0.5, Math.round(y - 4) + 0.5, SPRITE_W + 4, SPRITE_H + 2);
    ctx.restore();
    const bobY = blink ? 0 : -1;
    px(ctx, x + 13, y - 12 + bobY, 4, 6, PALETTE.ink);
  }
}

export function hitTest(members, lx, ly) {
  for (let i = members.length - 1; i >= 0; i--) {
    const m = members[i];
    if (
      lx >= m.x - 3 &&
      lx <= m.x + SPRITE_W + 3 &&
      ly >= m.y - 6 &&
      ly <= m.y + SPRITE_H
    ) {
      return m.id;
    }
  }
  return null;
}
