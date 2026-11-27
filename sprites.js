/* 합동 비서실 — 픽셀 스프라이트 & 오피스 맵 드로잉
 * 모든 좌표는 논리 픽셀(480 x 290) 기준. 캔버스는 SCALE 배율로 확대해 그립니다.
 *
 * 색 규칙(구역 = 색):
 *   데스크·작업 존 = 민트/에메랄드 · 회의실 = 슬레이트 블루 · 라운지 = 앰버/테라코타 · 공지 = 바이올렛
 * 캐릭터는 사용자가 고른 색(핑크·민트·스카이·앰버·라벤더·코랄)으로 칠합니다.
 */

export const LOGICAL_W = 480;
export const LOGICAL_H = 290;
export const SCALE = 2;

export const SPRITE_W = 30;
export const SPRITE_H = 36;

export const PALETTE = {
  ink: '#1B2130',
  ink2: '#39415A',
  gray: '#5A647A',
  gray2: '#9AA2B2',
  line: '#CFC8B8',
  paper: '#FFFCF5',
  paper2: '#F4EFE3',
  floor: '#EFE8D9',
  floor2: '#E7DFCD',
  light: '#FFFFFF',

  /* 목재 데스크 */
  wood: '#DDA36B',
  woodMid: '#C08552',
  woodDark: '#8C5A31',
  woodLight: '#F2C795',

  /* 구역 색 */
  mint: '#D1FAE5',
  mintMid: '#A7F3D0',
  emerald: '#10B981',
  emeraldDeep: '#047857',
  blueSoft: '#DBEAFE',
  blueMid: '#BFDBFE',
  blue: '#3B82F6',
  blueDeep: '#1D4ED8',
  amberSoft: '#FEF3C7',
  amberMid: '#FDE68A',
  amber: '#F59E0B',
  amberDeep: '#B45309',
  terraSoft: '#FFEDD5',
  terraMid: '#FBD3A8',
  terra: '#EA7A4D',
  terraDeep: '#C2410C',
  violetSoft: '#EDE9FE',
  violetMid: '#DDD6FE',
  violet: '#7C3AED',
  violetDeep: '#5B21B6',
  pink: '#EC4899',
  pinkSoft: '#FCE7F3',
  coral: '#F43F5E',
  leaf: '#3FA96B',
  leafDark: '#2C7A4B',
  sky: '#7DD3FC',
};

/* 상태 색 — 배지·이름표·범례가 모두 이 값을 씁니다. */
export const STATUS_COLORS = {
  working: '#16A34A',
  meeting: '#2563EB',
  idle: '#D97706',
  away: '#9AA2B2',
};

/* 캐릭터 색 */
export const CHARACTER_COLORS = {
  pink:     { base: '#F472B6', light: '#FBCFE8', deep: '#9D174D', label: '핑크' },
  mint:     { base: '#34D399', light: '#A7F3D0', deep: '#047857', label: '민트' },
  sky:      { base: '#60A5FA', light: '#BFDBFE', deep: '#1D4ED8', label: '스카이' },
  amber:    { base: '#FBBF24', light: '#FDE68A', deep: '#B45309', label: '앰버' },
  lavender: { base: '#A78BFA', light: '#DDD6FE', deep: '#6D28D9', label: '라벤더' },
  coral:    { base: '#FB7185', light: '#FECDD3', deep: '#BE123C', label: '코랄' },
};
export const CHARACTER_COLOR_ORDER = ['pink', 'mint', 'sky', 'amber', 'lavender', 'coral'];

export function colorKeyFor(color, fallbackIndex = 0) {
  if (color && CHARACTER_COLORS[color]) return color;
  return CHARACTER_COLOR_ORDER[fallbackIndex % CHARACTER_COLOR_ORDER.length];
}

export const CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/* 자음 몸통: 7x7 격자. 눈·입은 글자마다 빈 자리에 맞춰 지정합니다. */
const LETTERS = {
  'ㄱ': { g: ['#######', '......#', '......#', '......#', '......#', '......#', '......#'], eyes: [[2, 2], [4, 2]], mouth: [3, 4] },
  'ㄴ': { g: ['#......', '#......', '#......', '#......', '#......', '#......', '#######'], eyes: [[2, 1], [4, 1]], mouth: [3, 3] },
  'ㄷ': { g: ['#######', '#......', '#......', '#......', '#......', '#......', '#######'], eyes: [[2, 1], [4, 1]], mouth: [3, 3] },
  'ㄹ': { g: ['#######', '......#', '#######', '#......', '#......', '#......', '#######'], eyes: [[2, 3], [4, 3]], mouth: [3, 5] },
  'ㅁ': { g: ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.'], eyes: [[2, 2], [4, 2]], mouth: [3, 4] },
  'ㅂ': { g: ['#.....#', '#.....#', '#######', '#.....#', '#.....#', '#.....#', '#.....#'], eyes: [[2, 1], [4, 1]], mouth: [3, 4] },
  'ㅅ': { g: ['...#...', '..#....', '..#.#..', '.#...#.', '.#...#.', '#.....#', '#.....#'], eyes: [[2, 3], [4, 3]], mouth: [2, 5] },
  'ㅇ': { g: ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.'], eyes: [[2, 2], [4, 2]], mouth: [3, 4] },
  'ㅈ': { g: ['#######', '....#..', '...#...', '..#....', '.#.....', '.#.....', '#......'], eyes: [[1, 3], [4, 3]], mouth: [2, 4] },
  'ㅊ': { g: ['...#...', '#######', '....#..', '...#...', '..#....', '.#.....', '#......'], eyes: [[1, 3], [5, 3]], mouth: [3, 5] },
  'ㅋ': { g: ['#######', '.....#.', '.....#.', '.....#.', '#######', '.....#.', '.....#.'], eyes: [[1, 2], [4, 2]], mouth: [2, 3] },
  'ㅌ': { g: ['#######', '#......', '#######', '#......', '#######', '#......', '#######'], eyes: [[2, 1], [4, 1]], mouth: [2, 3] },
  'ㅍ': { g: ['#.....#', '#.....#', '#######', '#.....#', '#.....#', '#######', '...#...'], eyes: [[2, 1], [4, 1]], mouth: [2, 3] },
  'ㅎ': { g: ['..###..', '....#..', '...#...', '#######', '.#...#.', '#.....#', '#.....#'], eyes: [[1, 2], [5, 2]], mouth: [3, 4] },
};

export const ZONES = {
  desk: { x: 12, y: 28, w: 208, h: 114, tag: '데스크 · 작업 존', key: 'desk' },
  meeting: { x: 232, y: 28, w: 236, h: 114, tag: '회의실', key: 'meeting' },
  lounge: { x: 12, y: 158, w: 208, h: 120, tag: '라운지 · 휴게실', key: 'lounge' },
  board: { x: 232, y: 158, w: 236, h: 120, tag: '공지 화이트보드', key: 'board' },
};

/* 구역별 바닥·테두리 색 */
const ZONE_STYLE = {
  desk:    { a: '#E5F7ED', b: '#D9F2E4', frame: '#047857', stripe: '#10B981' },
  meeting: { a: '#E9EFFB', b: '#DCE5F7', frame: '#1D4ED8', stripe: '#3B82F6' },
  lounge:  { a: '#FBEEDC', b: '#F6E3C6', frame: '#C2410C', stripe: '#F59E0B' },
  board:   { a: '#F4F1FC', b: '#EAE5F7', frame: '#5B21B6', stripe: '#7C3AED' },
};

const SLOTS = {
  desk: [[30, 40], [86, 40], [142, 40], [30, 96], [86, 96], [142, 96]],
  meeting: [[280, 42], [326, 42], [372, 42], [280, 104], [326, 104], [372, 104]],
  lounge: [[34, 176], [92, 176], [150, 176], [34, 220]],
  away: [[150, 218], [186, 218]],
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
  // 바닥 전체 (따뜻한 회백 + 옅은 격자)
  px(ctx, 0, 0, LOGICAL_W, LOGICAL_H, PALETTE.floor);
  tiles(ctx, 0, 0, LOGICAL_W, LOGICAL_H, PALETTE.floor, PALETTE.floor2, 16);

  // 외곽 벽
  frame(ctx, 0, 0, LOGICAL_W, LOGICAL_H, PALETTE.ink, 4);
  px(ctx, 4, 4, LOGICAL_W - 8, 2, PALETTE.line);

  for (const key of ['desk', 'meeting', 'lounge', 'board']) {
    const z = ZONES[key];
    const st = ZONE_STYLE[key];
    px(ctx, z.x, z.y, z.w, z.h, PALETTE.paper);
    tiles(ctx, z.x + 3, z.y + 8, z.w - 6, z.h - 11, st.a, st.b, 12);
    frame(ctx, z.x, z.y, z.w, z.h, st.frame, 2);
    // 구역 색 띠(위쪽) — 한눈에 구역이 구분됩니다
    px(ctx, z.x + 2, z.y + 2, z.w - 4, 5, st.stripe);
    px(ctx, z.x + 2, z.y + 7, z.w - 4, 1, st.frame);
    // 모서리 픽셀 장식
    px(ctx, z.x - 2, z.y - 2, 5, 5, PALETTE.ink);
    px(ctx, z.x + z.w - 3, z.y - 2, 5, 5, PALETTE.ink);
    px(ctx, z.x - 2, z.y + z.h - 3, 5, 5, PALETTE.ink);
    px(ctx, z.x + z.w - 3, z.y + z.h - 3, 5, 5, PALETTE.ink);
  }

  drawDesks(ctx);
  drawMeeting(ctx);
  drawLounge(ctx);
  drawBoard(ctx);
}

function drawDesks(ctx) {
  SLOTS.desk.forEach(([sx, sy], i) => {
    // 캐릭터 자리 표시(민트 매트)
    px(ctx, sx + 1, sy + 28, 28, 5, PALETTE.mintMid);
    px(ctx, sx + 1, sy + 33, 28, 1, PALETTE.emerald);

    // 원목 데스크
    const dx = sx + 30;
    const dy = sy + 14;
    px(ctx, dx, dy, 26, 13, PALETTE.woodMid);
    px(ctx, dx, dy, 26, 4, PALETTE.woodLight);
    px(ctx, dx + 2, dy + 4, 22, 7, PALETTE.wood);
    frame(ctx, dx, dy, 26, 13, PALETTE.woodDark, 2);
    // 다리
    px(ctx, dx + 2, dy + 13, 3, 5, PALETTE.woodDark);
    px(ctx, dx + 21, dy + 13, 3, 5, PALETTE.woodDark);

    // 모니터(민트 화면) + 받침
    px(ctx, dx + 4, dy - 10, 16, 10, PALETTE.ink);
    px(ctx, dx + 5, dy - 9, 14, 8, i % 2 ? PALETTE.mintMid : PALETTE.mint);
    px(ctx, dx + 6, dy - 7, 8, 1, PALETTE.emeraldDeep);
    px(ctx, dx + 6, dy - 5, 11, 1, PALETTE.emerald);
    px(ctx, dx + 10, dy - 1, 4, 2, PALETTE.ink2);
    // 키보드 + 머그
    px(ctx, dx + 4, dy + 3, 12, 3, PALETTE.paper);
    px(ctx, dx + 5, dy + 4, 10, 1, PALETTE.gray2);
    px(ctx, dx + 18, dy + 2, 4, 4, PALETTE.coral);
    px(ctx, dx + 18, dy + 2, 4, 1, PALETTE.paper);
    // 서류 + 화분
    px(ctx, dx + 18, dy + 7, 6, 4, PALETTE.paper);
    frame(ctx, dx + 18, dy + 7, 6, 4, PALETTE.gray2, 1);
    if (i % 3 === 0) {
      px(ctx, dx + 1, dy - 14, 5, 4, PALETTE.terraMid);
      frame(ctx, dx + 1, dy - 14, 5, 4, PALETTE.terraDeep, 1);
      px(ctx, dx + 2, dy - 18, 3, 4, PALETTE.leaf);
      px(ctx, dx + 1, dy - 19, 2, 2, PALETTE.leafDark);
    }
  });
}

function drawMeeting(ctx) {
  // 벽면 화이트보드 (파란 필기)
  px(ctx, 240, 38, 32, 22, PALETTE.light);
  frame(ctx, 240, 38, 32, 22, PALETTE.blueDeep, 2);
  px(ctx, 244, 43, 17, 2, PALETTE.blue);
  px(ctx, 244, 48, 11, 2, PALETTE.amber);
  px(ctx, 244, 53, 14, 2, PALETTE.coral);

  // 프로젝터 스크린 (파란 화면)
  px(ctx, 398, 38, 34, 20, PALETTE.blueSoft);
  frame(ctx, 398, 38, 34, 20, PALETTE.blueDeep, 2);
  px(ctx, 402, 43, 19, 2, PALETTE.blue);
  px(ctx, 402, 48, 13, 2, PALETTE.blue);

  // 벽시계
  px(ctx, 440, 38, 12, 12, PALETTE.light);
  frame(ctx, 440, 38, 12, 12, PALETTE.blueDeep, 2);
  px(ctx, 445, 41, 1, 4, PALETTE.ink);
  px(ctx, 446, 44, 3, 1, PALETTE.coral);

  // 회의 테이블 (슬레이트 블루)
  px(ctx, 302, 84, 128, 14, '#8FA3C8');
  px(ctx, 305, 86, 122, 3, '#A9BCDD');
  frame(ctx, 302, 84, 128, 14, PALETTE.blueDeep, 2);
  px(ctx, 306, 98, 4, 5, PALETTE.blueDeep);
  px(ctx, 422, 98, 4, 5, PALETTE.blueDeep);
  // 의자 (위·아래)
  px(ctx, 304, 78, 124, 6, '#5B6C93');
  px(ctx, 304, 99, 124, 5, '#5B6C93');
  // 테이블 위: 컵·서류·노트북
  px(ctx, 330, 87, 6, 6, PALETTE.blueSoft);
  frame(ctx, 330, 87, 6, 6, PALETTE.blueDeep, 1);
  px(ctx, 352, 87, 16, 7, PALETTE.paper);
  frame(ctx, 352, 87, 16, 7, PALETTE.blue, 1);
  px(ctx, 355, 89, 10, 1, PALETTE.blueDeep);
  px(ctx, 355, 91, 7, 1, PALETTE.blue);
  px(ctx, 392, 87, 6, 6, PALETTE.amberSoft);
  frame(ctx, 392, 87, 6, 6, PALETTE.amberDeep, 1);
  px(ctx, 410, 87, 12, 8, PALETTE.ink2);
  px(ctx, 412, 89, 8, 4, PALETTE.blueMid);

  // 화분
  px(ctx, 244, 122, 11, 9, PALETTE.terraMid);
  frame(ctx, 244, 122, 11, 9, PALETTE.terraDeep, 1);
  px(ctx, 247, 115, 4, 7, PALETTE.leaf);
  px(ctx, 243, 118, 6, 3, PALETTE.leafDark);
  px(ctx, 251, 116, 5, 2, PALETTE.leaf);
}

function drawLounge(ctx) {
  // 앰버 러그
  px(ctx, 22, 164, 188, 108, PALETTE.terraMid);
  px(ctx, 26, 168, 180, 100, PALETTE.terraSoft);
  frame(ctx, 24, 166, 184, 104, PALETTE.terra, 2);
  px(ctx, 30, 172, 172, 1, PALETTE.amber);
  px(ctx, 30, 262, 172, 1, PALETTE.amber);

  // 소파 (테라코타) + 쿠션
  px(ctx, 120, 248, 72, 18, PALETTE.terra);
  frame(ctx, 120, 248, 72, 18, PALETTE.terraDeep, 2);
  px(ctx, 124, 252, 28, 10, PALETTE.amberSoft);
  px(ctx, 158, 252, 28, 10, '#FFE3B8');
  frame(ctx, 124, 252, 28, 10, PALETTE.terraDeep, 1);
  frame(ctx, 158, 252, 28, 10, PALETTE.terraDeep, 1);
  px(ctx, 118, 244, 76, 5, PALETTE.terraDeep);

  // 탁자(원목) + 컵
  px(ctx, 96, 214, 30, 15, PALETTE.woodMid);
  px(ctx, 96, 214, 30, 4, PALETTE.woodLight);
  frame(ctx, 96, 214, 30, 15, PALETTE.woodDark, 2);
  px(ctx, 100, 219, 8, 6, PALETTE.paper);
  frame(ctx, 100, 219, 8, 6, PALETTE.amberDeep, 1);
  px(ctx, 114, 219, 7, 7, PALETTE.paper);
  frame(ctx, 114, 219, 7, 7, PALETTE.amberDeep, 1);

  // 커피 머신 (앰버)
  px(ctx, 198, 244, 16, 20, PALETTE.ink2);
  frame(ctx, 198, 244, 16, 20, PALETTE.ink, 2);
  px(ctx, 201, 247, 10, 6, PALETTE.amber);
  px(ctx, 202, 249, 8, 2, PALETTE.amberSoft);
  px(ctx, 202, 256, 8, 5, PALETTE.paper);
  frame(ctx, 202, 256, 8, 5, PALETTE.amberDeep, 1);
  px(ctx, 205, 258, 3, 3, PALETTE.terraDeep);

  // 화분
  px(ctx, 196, 172, 13, 11, PALETTE.terraMid);
  frame(ctx, 196, 172, 13, 11, PALETTE.terraDeep, 1);
  px(ctx, 200, 163, 5, 9, PALETTE.leaf);
  px(ctx, 196, 167, 7, 3, PALETTE.leafDark);
  px(ctx, 205, 165, 6, 3, PALETTE.leaf);

  // 스탠드 조명 (앰버 불빛)
  px(ctx, 30, 186, 2, 12, PALETTE.gray);
  px(ctx, 25, 181, 12, 6, PALETTE.amber);
  frame(ctx, 25, 181, 12, 6, PALETTE.amberDeep, 1);
  px(ctx, 28, 198, 10, 2, PALETTE.ink2);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.ellipse(31, 190, 16, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoard(ctx) {
  // 화이트보드 (깨끗한 흰 판)
  px(ctx, 246, 176, 208, 92, PALETTE.light);
  frame(ctx, 246, 176, 208, 92, PALETTE.violetDeep, 3);
  px(ctx, 250, 180, 200, 8, PALETTE.violetSoft);
  px(ctx, 256, 183, 5, 3, PALETTE.violet);
  px(ctx, 264, 183, 5, 3, PALETTE.violet);
  px(ctx, 272, 183, 5, 3, PALETTE.violet);
  // 필기 줄 (여러 색)
  const ink = [PALETTE.violetDeep, PALETTE.blue, PALETTE.amberDeep, PALETTE.pink, PALETTE.emeraldDeep];
  for (let i = 0; i < 5; i++) {
    px(ctx, 258, 198 + i * 12, 110 - (i % 3) * 16, 2, ink[i]);
  }
  // 형광 밑줄
  px(ctx, 258, 210, 40, 4, PALETTE.amberMid);

  // 점착 메모 (노랑·핑크·민트·블루)
  const notes = [
    [386, 194, PALETTE.amberMid, PALETTE.amberDeep],
    [412, 198, PALETTE.pinkSoft, PALETTE.pink],
    [396, 226, PALETTE.mintMid, PALETTE.emeraldDeep],
    [368, 230, PALETTE.blueMid, PALETTE.blueDeep],
  ];
  notes.forEach(([nx, ny, bg, fg]) => {
    px(ctx, nx, ny, 24, 22, bg);
    frame(ctx, nx, ny, 24, 22, fg, 1);
    px(ctx, nx + 4, ny + 6, 16, 1, fg);
    px(ctx, nx + 4, ny + 10, 12, 1, fg);
    px(ctx, nx + 4, ny + 14, 14, 1, fg);
    px(ctx, nx + 9, ny, 6, 2, PALETTE.paper);
  });

  // 트레이 + 마커 (보드 아래)
  px(ctx, 254, 270, 62, 3, PALETTE.violetDeep);
  px(ctx, 258, 266, 3, 4, PALETTE.violet);
  px(ctx, 272, 266, 3, 4, PALETTE.blue);
  px(ctx, 286, 266, 3, 4, PALETTE.pink);
}

/* ---------- 캐릭터 ---------- */
const MOODS = {
  working: { mouth: 'flat' },
  meeting: { mouth: 'open' },
  idle: { mouth: 'smile' },
  away: { mouth: 'sleep' },
};

export function drawCharacter(ctx, opts) {
  const {
    consonant, x, y, status = 'working', color = 'pink',
    blink = false, bob = 0, selected = false, dim = false,
  } = opts;
  const letter = LETTERS[consonant] || LETTERS['ㅇ'];
  const pal = CHARACTER_COLORS[color] || CHARACTER_COLORS.pink;
  const cell = 3;
  const gx = Math.round(x + 4);
  const gy = Math.round(y + 3 + bob);
  const ink = PALETTE.ink;

  ctx.save();
  if (dim) ctx.globalAlpha = 0.45;

  // 바닥 그림자
  ctx.fillStyle = 'rgba(27,33,48,0.14)';
  ctx.beginPath();
  ctx.ellipse(x + SPRITE_W / 2, y + SPRITE_H - 2, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 몸통(자음) — 어두운 실루엣 테두리 + 사용자 색
  const cells = [];
  letter.g.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') cells.push([c, r]);
    }
  });
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    for (const [c, r] of cells) {
      px(ctx, gx + c * cell + ox, gy + r * cell + oy, cell, cell, ink);
    }
  }
  for (const [c, r] of cells) {
    px(ctx, gx + c * cell, gy + r * cell, cell, cell, pal.base);
  }
  // 위쪽 하이라이트 / 아래쪽 그늘로 픽셀 입체감
  const minR = Math.min(...cells.map(([, r]) => r));
  const maxR = Math.max(...cells.map(([, r]) => r));
  for (const [c, r] of cells) {
    if (r === minR) px(ctx, gx + c * cell + 1, gy + r * cell, cell - 1, 1, pal.light);
    if (r === maxR) px(ctx, gx + c * cell, gy + r * cell + cell - 1, cell, 1, pal.deep);
  }

  // 다리
  px(ctx, gx + 4, gy + 21, 3, 5, ink);
  px(ctx, gx + 15, gy + 21, 3, 5, ink);
  px(ctx, gx + 5, gy + 21, 1, 4, pal.base);
  px(ctx, gx + 16, gy + 21, 1, 4, pal.base);

  // 눈
  const mood = MOODS[status] || MOODS.working;
  for (const [ex, ey] of letter.eyes) {
    const ax = gx + ex * cell;
    const ay = gy + ey * cell;
    if (blink || mood.mouth === 'sleep') {
      px(ctx, ax - 1, ay + 1, cell + 2, 1, ink);
    } else {
      px(ctx, ax, ay, cell, cell, ink);
      px(ctx, ax, ay, 1, 1, PALETTE.paper);
    }
  }

  // 입
  const [mx, my] = letter.mouth;
  const bx = gx + mx * cell;
  const by = gy + my * cell;
  if (mood.mouth === 'flat') {
    px(ctx, bx, by + 2, cell * 2, 2, ink);
  } else if (mood.mouth === 'open') {
    px(ctx, bx, by + 1, cell * 2, cell + 1, ink);
    px(ctx, bx + 1, by + 2, cell * 2 - 2, 1, PALETTE.paper);
  } else if (mood.mouth === 'smile') {
    px(ctx, bx, by + 2, 2, 1, ink);
    px(ctx, bx + 1, by + 3, cell * 2 - 2, 1, ink);
    px(ctx, bx + cell * 2 - 2, by + 2, 2, 1, ink);
  } else {
    px(ctx, bx, by + 2, cell * 2, 1, ink);
    px(ctx, bx + cell * 2 + 4, by - 2, 4, 1, pal.deep);
    px(ctx, bx + cell * 2 + 5, by - 5, 4, 1, pal.deep);
    px(ctx, bx + cell * 2 + 4, by - 8, 4, 1, pal.deep);
  }

  ctx.restore();

  // 선택 표시
  if (selected) {
    ctx.save();
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 1]);
    ctx.strokeRect(Math.round(x - 2) + 0.5, Math.round(y - 5) + 0.5, SPRITE_W + 4, SPRITE_H + 3);
    ctx.restore();
    const bobY = blink ? 0 : -1;
    px(ctx, x + 12, y - 14 + bobY, 6, 2, pal.deep);
    px(ctx, x + 13, y - 12 + bobY, 4, 3, pal.deep);
    px(ctx, x + 14, y - 9 + bobY, 2, 2, pal.deep);
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
