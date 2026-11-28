import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  onValue,
  set,
  update,
  remove,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import {
  LOGICAL_W,
  LOGICAL_H,
  SCALE,
  SPRITE_W,
  SPRITE_H,
  CONSONANTS,
  ZONES,
  CHARACTER_COLORS,
  CHARACTER_COLOR_ORDER,
  STATUS_COLORS,
  colorKeyFor,
  drawOfficeBase,
  drawCharacter,
  paintPortrait,
  hitTest,
  slotFor,
  zoneForStatus,
} from './sprites.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
/* 익명 인증 세션 — RTDB 보안 규칙이 이 세션(uid)에 허용된 초대 코드가 묶여 있는지로 읽기/쓰기를 판단합니다 */
const auth = getAuth(app);

const STATUS_LIST = [
  { key: 'working', label: '작업 중' },
  { key: 'meeting', label: '회의 중' },
  { key: 'idle', label: '대기 중' },
  { key: 'away', label: '자리 비움' },
];

/* 캐릭터 색: 저장된 값 → 찐야수는 핑크 → 자음 순서 기본값 */
function memberColor(m) {
  if (!m) return 'pink';
  if (m.color && CHARACTER_COLORS[m.color]) return m.color;
  if (m.name === '찐야수') return 'pink';
  const idx = Math.max(0, CONSONANTS.indexOf(m.consonant));
  return colorKeyFor(null, idx);
}
const STATUS_LABEL = Object.fromEntries(STATUS_LIST.map((s) => [s.key, s.label]));
const COLUMNS = [
  { key: 'todo', label: '할 일' },
  { key: 'doing', label: '진행 중' },
  { key: 'review', label: '확인 요청' },
  { key: 'done', label: '완료' },
];
const PRIORITY_LABEL = { low: '낮음', normal: '보통', high: '높음', urgent: '긴급' };
const KIND_LABEL = { notice: '공지', brief: '브리핑', memo: '메모' };

const LS_ME = 'pickle-office:me';
const LS_CODE = 'pickle-office:code';

const store = { members: {}, notices: {}, agendas: {}, tasks: {} };
const loaded = { members: false, tasks: false, notices: false, agendas: false };
let me = null;
let selectedMember = null;
let selectedAgenda = null;
let detailMember = null;
const access = { state: 'checking', code: '', uid: '' };
/* 초대 링크에 실린 좌석(?seat=멤버ID) — 기존 자리를 그대로 이어 받습니다 */
let pendingSeat = new URLSearchParams(location.search).get('seat') || '';
let unlocked = false;
let subscribed = false;
const anims = new Map();
const drawn = [];

/* ---------------- 유틸 ---------------- */
const $ = (id) => document.getElementById(id);
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - Number(ts);
  if (diff < 60e3) return '방금 전';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)}분 전`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)}시간 전`;
  if (diff < 7 * 86400e3) return `${Math.floor(diff / 86400e3)}일 전`;
  const d = new Date(Number(ts));
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function countAuthored(list) {
  return Object.keys(list || {}).length;
}

function sortByTime(obj, dir = -1) {
  return Object.entries(obj || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (Number(a.createdAt || 0) - Number(b.createdAt || 0)) * dir);
}

function taskList() {
  return Object.entries(store.tasks || {}).map(([id, t]) => ({ id, ...t }));
}

function shortTitle(text, n = 18) {
  const s = String(text || '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/* ---------------- 상태 메시지 자동 생성 ----------------
 * 상태 + 담당 작업으로만 결정됩니다. 사용자가 직접 쓰지 않습니다. */
function autoMessage(member, tasks = taskList()) {
  const status = (member && member.status) || 'working';
  if (status === 'meeting') return '회의실 안건 논의 중';
  if (status === 'away') return '자리 비움';
  if (status === 'idle') return '새 요청 대기 중';
  const mine = tasks.filter((t) => t.assignee === (member && member.name));
  const doing = mine.filter((t) => (t.status || 'todo') === 'doing');
  if (doing.length) return `${shortTitle(doing[0].title)} 작업 중`;
  return '업무 진행 중';
}

/* 비서 목록 한 줄: 상태 + 자동 메시지 (같은 문구면 한 번만) */
function listLine(m) {
  const label = STATUS_LABEL[m.status] || '작업 중';
  const msg = autoMessage(m);
  return msg && msg !== label ? `${label} · ${msg}` : label;
}

function isPermissionError(err) {
  return !!err && (err.code === 'PERMISSION_DENIED' || /permission[-_ ]denied/i.test(String(err.message || '')));
}

/* ---------------- 초기 시드 ---------------- */
async function seedIfEmpty() {
  try {
    const res = await runTransaction(ref(db, 'office/meta'), (cur) => {
      if (cur && cur.seeded) return undefined;
      return { seeded: true, name: '합동 비서실', createdAt: Date.now() };
    });
    if (!res.committed) return;
    const now = Date.now();
    const jj = nid();
    await set(ref(db, `office/members/${jj}`), {
      name: '찐야수',
      consonant: 'ㅈ',
      color: 'pink',
      role: '권은서님의 비서',
      status: 'working',
      message: '업무 진행 중',
      joinedAt: now,
      lastSeen: now,
    });
    const notice = nid();
    await set(ref(db, `office/notices/${notice}`), {
      kind: 'notice',
      author: '찐야수',
      text: '합동 비서실 개장.\n여러 비서가 같은 오피스를 함께 씁니다. 자리를 잡고 상태를 바꾸면 캐릭터가 구역을 옮겨 다닙니다.',
      createdAt: now - 6 * 60e3,
    });
    const ag = nid();
    await set(ref(db, `office/agendas/${ag}`), {
      title: '주간 보고 형식을 하나로 통일할까요?',
      body: '비서마다 보고 형식이 달라서 취합이 번거롭습니다. 템플릿 하나를 정하면 좋겠습니다.',
      status: 'discussing',
      author: '찐야수',
      createdAt: now - 30 * 60e3,
    });
    await set(ref(db, `office/agendas/${ag}/messages/${nid()}`), {
      author: '찐야수',
      authorId: jj,
      text: '요약 → 결정 필요 → 다음 행동, 세 칸짜리 형식은 어떨까요?',
      createdAt: now - 28 * 60e3,
    });
    const t1 = nid();
    await set(ref(db, `office/tasks/${t1}`), {
      title: '주간 브리핑 초안 정리',
      assignee: '찐야수',
      assigneeConsonant: 'ㅈ',
      priority: 'high',
      status: 'doing',
      createdAt: now - 50 * 60e3,
    });
    const t2 = nid();
    await set(ref(db, `office/tasks/${t2}`), {
      title: '회의실 안건 템플릿 만들기',
      assignee: '찐야수',
      assigneeConsonant: 'ㅈ',
      priority: 'normal',
      status: 'todo',
      createdAt: now - 40 * 60e3,
    });
  } catch (err) {
    console.warn('[seed]', err);
  }
}

/* ---------------- 실시간 구독 ---------------- */
function subscribe() {
  onValue(ref(db, '.info/connected'), (snap) => {
    const on = snap.val() === true;
    const badge = $('liveBadge');
    badge.dataset.state = on ? 'on' : 'off';
    $('liveText').textContent = on ? '실시간 연결됨' : '연결 끊김';
    $('footSync').textContent = on ? 'Firebase Realtime Database · 연결됨' : 'Firebase Realtime Database · 재연결 중';
  });

  onValue(ref(db, 'office/members'), (snap) => {
    store.members = snap.val() || {};
    loaded.members = true;
    afterMembersChange();
  });
  onValue(ref(db, 'office/notices'), (snap) => {
    store.notices = snap.val() || {};
    loaded.notices = true;
    renderNotices();
  });
  onValue(ref(db, 'office/agendas'), (snap) => {
    store.agendas = snap.val() || {};
    loaded.agendas = true;
    renderAgendas();
  });
  onValue(ref(db, 'office/tasks'), (snap) => {
    store.tasks = snap.val() || {};
    loaded.tasks = true;
    renderTasks();
  });
}

/* ---------------- 오피스 맵 ---------------- */
const canvas = $('map');
const ctx = canvas.getContext('2d');
canvas.width = LOGICAL_W * SCALE;
canvas.height = LOGICAL_H * SCALE;

const baseCanvas = document.createElement('canvas');
baseCanvas.width = canvas.width;
baseCanvas.height = canvas.height;
{
  const bctx = baseCanvas.getContext('2d');
  bctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawOfficeBase(bctx);
}

function buildMapLabels() {
  const wrap = $('mapLabels');
  wrap.innerHTML = '';
  for (const z of Object.values(ZONES)) {
    const el = document.createElement('span');
    el.className = 'map-tag';
    el.dataset.zone = z.key;
    el.textContent = z.tag;
    el.style.left = `${(z.x / LOGICAL_W) * 100}%`;
    el.style.top = `${((z.y + 2) / LOGICAL_H) * 100}%`;
    wrap.appendChild(el);
  }
}

function memberList() {
  return Object.entries(store.members)
    .map(([id, m]) => ({ id, ...m }))
    .filter((m) => m && m.name)
    .sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
}

function targetsFor(members) {
  const counters = {};
  const out = [];
  for (const m of members) {
    const zone = zoneForStatus(m.status || 'working');
    counters[zone] = (counters[zone] || 0) + 1;
    const [x, y] = slotFor(m.status || 'working', counters[zone] - 1);
    out.push({ ...m, tx: x, ty: y, zone });
  }
  return out;
}

function afterMembersChange() {
  const list = targetsFor(memberList());
  const ids = new Set(list.map((m) => m.id));
  for (const id of [...anims.keys()]) if (!ids.has(id)) anims.delete(id);
  for (const m of list) {
    const a = anims.get(m.id);
    if (!a) anims.set(m.id, { x: m.tx, y: m.ty, tx: m.tx, ty: m.ty, blinkAt: 0, nextBlink: 0 });
    else { a.tx = m.tx; a.ty = m.ty; }
  }
  if (selectedMember && !store.members[selectedMember]) { selectedMember = null; $('bubble').hidden = true; }
  if (detailMember && !store.members[detailMember]) closeDetail();
  claimSeat();
  renderMembers();
  renderMeCard();
  syncAssigneeOptions();
  renderBubble();
  renderDetail();
  reconcileMessages();
}

/* 모든 비서의 상태 메시지를 상태·담당 작업에 맞춰 자동 저장합니다 (값이 다를 때만 씁니다) */let msgTimer = null;
function reconcileMessages() {
  /* 멤버·태스크가 모두 도착한 뒤에만 계산합니다 (도중에 잘못된 메시지로 덮어쓰지 않도록) */
  if (!unlocked || !loaded.members || !loaded.tasks) return;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    const tasks = taskList();
    for (const m of memberList()) {
      const want = autoMessage(m, tasks);
      if ((m.message || '') !== want) {
        update(ref(db, `office/members/${m.id}`), { message: want }).catch(() => {});
      }
    }
  }, 250);
}

let frameNo = 0;
function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  const list = targetsFor(memberList());
  drawn.length = 0;

  for (const m of list) {
    const a = anims.get(m.id);
    if (!a) continue;
    const dx = a.tx - a.x;
    const dy = a.ty - a.y;
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
      a.x += dx * 0.14;
      a.y += dy * 0.14;
    } else {
      a.x = a.tx;
      a.y = a.ty;
    }
    if (!a.nextBlink) a.nextBlink = t + 1500 + Math.random() * 4000;
    if (t > a.nextBlink) {
      a.blinkAt = t + 130;
      a.nextBlink = t + 2200 + Math.random() * 5200;
    }
    const blink = t < a.blinkAt;
    const moving = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y) > 0.6;
    const bob = moving ? (Math.floor(t / 140) % 2 === 0 ? -1 : 0) : (Math.floor(t / 700) % 2 === 0 ? 0 : -0.5);

    drawn.push({
      id: m.id,
      name: m.name,
      x: a.x,
      y: a.y,
      status: m.status || 'working',
      message: m.message || '',
      role: m.role || '',
      consonant: m.consonant || 'ㅇ',
      color: memberColor(m),
    });
    drawCharacter(ctx, {
      consonant: m.consonant || 'ㅇ',
      name: m.name || '',
      color: memberColor(m),
      x: a.x,
      y: a.y,
      status: m.status || 'working',
      blink,
      bob,
      moving,
      walk: t,
      selected: selectedMember === m.id,
      /* 상시 자리 유지: 브라우저가 닫혀 있거나 lastSeen이 오래돼도 흐려지지 않습니다 */
      dim: false,
    });
  }

  drawn.sort((p, q) => p.y - q.y);

  // 이름표 — 왼쪽 띠 = 상태 색, 앞글자 = 이름표 자음(캐릭터 색)
  ctx.font = '10px "Galmuri11", monospace';
  ctx.textAlign = 'left';
  for (const d of drawn) {
    if (selectedMember === d.id) continue; // 말풍선이 이름을 대신합니다
    const pal = CHARACTER_COLORS[d.color] || CHARACTER_COLORS.pink;
    const cw = ctx.measureText(d.consonant).width;
    const tw = ctx.measureText(d.name).width;
    const w = Math.max(32, Math.round(cw + tw + 17));
    const nx = Math.round(d.x + SPRITE_W / 2 - w / 2);
    const ny = Math.round(d.y + SPRITE_H + 1);
    ctx.fillStyle = '#FFFCF5';
    ctx.fillRect(nx, ny, w, 13);
    ctx.fillStyle = STATUS_COLORS[d.status] || '#16A34A';
    ctx.fillRect(nx, ny, 3, 13);
    ctx.strokeStyle = '#1B2130';
    ctx.lineWidth = 1;
    ctx.strokeRect(nx + 0.5, ny + 0.5, w - 1, 12);
    ctx.fillStyle = pal.deep;
    ctx.fillText(d.consonant, nx + 6, ny + 10);
    ctx.fillStyle = '#1B2130';
    ctx.fillText(d.name, nx + 6 + cw + 3, ny + 10);
  }

  frameNo += 1;
  if (selectedMember && frameNo % 6 === 0) renderBubble();
}

/* 한 프레임에서 오류가 나도 캐릭터가 멈춰 서지 않도록 루프는 계속 돕니다 */
function drawLoop(t) {
  try {
    renderFrame(t);
  } catch (err) {
    console.warn('[map]', err);
  }
  requestAnimationFrame(drawLoop);
}

function renderBubble() {
  const bubble = $('bubble');
  /* 좁은 화면에서는 상세 패널이 열린 동안 말풍선을 접습니다(맵 아래를 가리지 않도록) */
  if (detailMember && window.innerWidth <= 620) { bubble.hidden = true; return; }
  if (!selectedMember || !store.members[selectedMember]) { bubble.hidden = true; return; }
  const m = store.members[selectedMember];
  const d = drawn.find((x) => x.id === selectedMember);
  if (!d) { bubble.hidden = true; return; }
  $('bubbleName').textContent = m.name;
  $('bubbleStatus').textContent = STATUS_LABEL[m.status] || '작업 중';
  $('bubbleStatus').className = `chip s-${m.status || 'working'}`;
  $('bubbleMsg').textContent = autoMessage(m) || '상태 메시지 없음';
  const tasks = taskList().filter((t) => t.assignee === m.name && t.status !== 'done');
  const bt = $('bubbleTask');
  if (tasks.length) {
    bt.hidden = false;
    bt.textContent = `▸ ${shortTitle(tasks[0].title, 20)} · ${(COLUMNS.find((c) => c.key === (tasks[0].status || 'todo')) || {}).label || ''}${tasks.length > 1 ? ` 외 ${tasks.length - 1}건` : ''}`;
  } else {
    bt.hidden = true;
  }
  const hint = $('bubbleHint');
  if (hint) hint.hidden = false;
  // 카드 제목을 가리지 않도록 맨 위 즐기 캐릭터는 말풍선을 아래로 내립니다
  const below = d.y < 70;
  bubble.classList.toggle('below', below);
  bubble.hidden = false;
  // 캐릭터가 맵 가장자리에 있어도 말풍선이 잘리지 않도록 가로 위치를 보정합니다
  const wrapEl = $('mapWrap');
  const wrapW = wrapEl ? wrapEl.clientWidth : 0;
  let cx = ((d.x + SPRITE_W / 2) / LOGICAL_W) * wrapW;
  const half = bubble.offsetWidth / 2;
  if (wrapW && bubble.offsetWidth < wrapW) {
    cx = Math.min(Math.max(cx, half + 3), wrapW - half - 3);
  }
  bubble.style.left = `${(cx / (wrapW || LOGICAL_W)) * 100}%`;
  bubble.style.top = below
    ? `${((d.y + SPRITE_H + 6) / LOGICAL_H) * 100}%`
    : `${((d.y - 2) / LOGICAL_H) * 100}%`;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const lx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
  const ly = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
  const id = hitTest(drawn, lx, ly);
  if (!id) {
    // 빈 구역을 누르면 해당 탭으로 이동
    const zoneTab = { desk: 'work', meeting: 'meeting', board: 'notice' };
    for (const [key, tab] of Object.entries(zoneTab)) {
      const z = ZONES[key];
      if (lx >= z.x && lx <= z.x + z.w && ly >= z.y && ly <= z.y + z.h) {
        switchTab(tab);
        return;
      }
    }
  }
  selectedMember = id && id !== selectedMember ? id : null;
  if (!selectedMember || (detailMember && detailMember !== selectedMember)) closeDetail();
  renderMembers();
  renderBubble();
  if (selectedMember) setTimeout(() => scrollBelowBar($('bubble')), 40);
});

/* ---------------- 2단계: 캐릭터 상세 패널 ----------------
 * 1단계 — 캐릭터 클릭: 상태메시지 말풍선
 * 2단계 — 그 말풍선을 클릭: 상세 행동·담당 작업이 아래에 펼쳐집니다 */
function statusTasks(name) {
  const order = ['doing', 'review', 'todo', 'done'];
  return taskList()
    .filter((t) => t.assignee === name)
    .sort((a, b) => order.indexOf(a.status || 'todo') - order.indexOf(b.status || 'todo'));
}

function activityFor(m) {
  const items = [];
  for (const t of taskList()) {
    if (t.assignee !== m.name) continue;
    const col = COLUMNS.find((c) => c.key === (t.status || 'todo'));
    items.push({ ts: Number(t.movedAt || t.createdAt || 0), text: `작업실 · ‘${shortTitle(t.title, 24)}’ ${col ? col.label : ''}` });
  }
  for (const n of sortByTime(store.notices, 1)) {
    if (n.author === m.name) items.push({ ts: Number(n.createdAt || 0), text: `${KIND_LABEL[n.kind] || '공지'} · ${shortTitle(n.text, 28)}` });
  }
  for (const a of sortByTime(store.agendas, 1)) {
    if (a.author === m.name) items.push({ ts: Number(a.createdAt || 0), text: `회의실 · 안건 ‘${shortTitle(a.title, 24)}’` });
    for (const msg of sortByTime(a.messages, 1)) {
      if (msg.author === m.name) items.push({ ts: Number(msg.createdAt || 0), text: `회의실 · ${shortTitle(a.title, 16)} — “${shortTitle(msg.text, 22)}”` });
    }
  }
  return items.filter((i) => i.ts).sort((a, b) => b.ts - a.ts).slice(0, 6);
}

function openDetail(id) {
  if (!id || !store.members[id]) return;
  detailMember = id;
  renderDetail();
  renderBubble();
  scrollBelowBar($('charDetail'));
}

/* 상단 고정 바(topbar)에 가리지 않게 스크롤합니다 (모바일에서 특히 중요) */
function scrollBelowBar(el, extra = 10) {
  if (!el || el.hidden) return;
  const bar = document.querySelector('.topbar');
  const off = (bar ? bar.offsetHeight : 0) + extra;
  const rect = el.getBoundingClientRect();
  /* 화면 밖(위·아래)에 있거나 상단 바에 가려 있을 때만 움직입니다 */
  if (rect.top < off || rect.top > off + 48) {
    window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - off), behavior: 'smooth' });
  }
}

function closeDetail() {
  detailMember = null;
  const el = $('charDetail');
  if (el) el.hidden = true;
  renderBubble();
}

function renderDetail() {
  const el = $('charDetail');
  if (!el) return;
  if (!detailMember || !store.members[detailMember]) { el.hidden = true; return; }
  const m = store.members[detailMember];
  const col = CHARACTER_COLORS[memberColor(m)];
  el.style.setProperty('--cdc', col.base);
  el.style.setProperty('--cdc-soft', col.light);
  el.style.setProperty('--cdc-deep', col.deep);
  paintPortrait($('cdAvatar'), {
    scale: 2,
    consonant: m.consonant || 'ㅇ',
    name: m.name || '',
    color: memberColor(m),
    status: m.status || 'working',
  });
  $('cdName').textContent = m.name;
  $('cdRole').textContent = m.role || '역할 미지정';
  const chip = $('cdStatus');
  chip.textContent = STATUS_LABEL[m.status] || '작업 중';
  chip.className = `chip s-${m.status || 'working'}`;
  $('cdMsg').textContent = autoMessage(m);

  const tasks = statusTasks(m.name);
  $('cdTaskCount').textContent = tasks.length;
  $('cdTasks').innerHTML = tasks.length
    ? tasks
        .map((t) => {
          const c = COLUMNS.find((x) => x.key === (t.status || 'todo'));
          return `<li class="cd-task p-${esc(t.priority || 'normal')}">
            <span class="stt">${esc(t.title)}</span>
            <span class="chip">${esc(c ? c.label : '')}</span>
            <span class="chip p-${esc(t.priority || 'normal')}">${PRIORITY_LABEL[t.priority] || '보통'}</span></li>`;
        })
        .join('')
    : '<li class="cd-empty">담당 작업이 없습니다</li>';

  const acts = activityFor(m);
  $('cdActivity').innerHTML = acts.length
    ? acts.map((a) => `<li class="cd-act"><time>${relTime(a.ts)}</time><span>${esc(a.text)}</span></li>`).join('')
    : '<li class="cd-empty">기록된 활동이 없습니다</li>';

  $('cdSeat').textContent = `자리 유지 중 · 최근 확인 ${relTime(m.lastSeen) || '기록 없음'} · 입장 ${relTime(m.joinedAt) || '기록 없음'}`;
  el.hidden = false;
}

/* ---------------- 좌측/사이드 렌더 ---------------- */
function renderMembers() {
  const list = memberList();
  $('memberCount').textContent = list.length;
  const ul = $('memberList');
  if (!list.length) {
    ul.innerHTML = '<li class="col-empty">아직 아무도 없습니다</li>';
    return;
  }
  ul.innerHTML = list
    .map((m) => {
      const c = CHARACTER_COLORS[memberColor(m)];
      return `<li class="member-item ${selectedMember === m.id ? 'is-selected' : ''}" data-id="${esc(m.id)}" style="--mc:${c.base};--mc-soft:${c.light};--mc-deep:${c.deep}">
        <canvas class="ma" width="32" height="32" data-id="${esc(m.id)}" aria-hidden="true"></canvas>
        <span class="mi"><b>${esc(m.name)}</b>
        <span>${esc(listLine(m))}</span></span>
        <span class="dot ${esc(m.status || 'working')}" title="${esc(STATUS_LABEL[m.status] || '작업 중')}"></span>
      </li>`;
    })
    .join('');
  ul.querySelectorAll('canvas.ma').forEach((cv) => {
    const m = list.find((x) => x.id === cv.dataset.id);
    if (!m) return;
    paintPortrait(cv, {
      scale: 2,
      consonant: m.consonant || 'ㅇ',
      name: m.name || '',
      color: memberColor(m),
      status: m.status || 'working',
    });
  });
  ul.querySelectorAll('.member-item').forEach((li) => {
    li.addEventListener('click', () => {
      /* 이미 보고 있는 캐릭터를 다시 누르면 선택 해제합니다 */
      const same = li.dataset.id === selectedMember;
      selectedMember = same ? null : li.dataset.id;
      renderMembers();
      renderBubble();
      if (selectedMember) {
        switchTab('office');
        /* 좌우 목록에서 골라도 말풍선이 상단 바에 가리지 않도록 맵을 화면 안으로 가져옵니다 */
        setTimeout(() => scrollBelowBar($('mapWrap')), 60);
      }
    });
  });
}

function renderMeCard() {
  const has = !!(me && store.members[me.id]);
  $('meEmpty').hidden = has;
  $('meBody').hidden = !has;
  if (!has) return;
  const m = store.members[me.id];
  const av = $('meAvatar');
  paintPortrait(av, {
    scale: 2,
    consonant: m.consonant || 'ㅇ',
    name: m.name || '',
    color: memberColor(m),
    status: m.status || 'working',
  });
  $('meName').textContent = m.name || '';
  $('meRole').textContent = m.role || '역할 미지정';
  const grid = $('statusGrid');
  grid.querySelectorAll('.status-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.s === (m.status || 'working'));
  });
  renderMyColors(m);
  /* 상태 메시지는 사용자가 쓰지 않고 상태·담당 작업으로 자동 생성됩니다 */
  $('meMsg').textContent = autoMessage(m);
}

/* ---------- 색 고르기 (입장 모달 · 내 자리) ---------- */
function colorGridHTML(active, { labels = true } = {}) {
  return CHARACTER_COLOR_ORDER.map((k) => {
    const c = CHARACTER_COLORS[k];
    return `<button type="button" class="cchip" data-color="${k}" aria-pressed="${k === active}"
      title="${c.label}" style="--cc:${c.base};--cc-soft:${c.light};--cc-deep:${c.deep}">
      <span class="sw"></span>${labels ? `<small>${c.label}</small>` : ''}</button>`;
  }).join('');
}

function bindColorGrid(el, onPick) {
  el.querySelectorAll('.cchip').forEach((b) => {
    b.addEventListener('click', () => onPick(b.dataset.color));
  });
}

function renderMyColors(m) {
  const grid = $('myColorGrid');
  if (!grid) return;
  const active = memberColor(m);
  grid.innerHTML = colorGridHTML(active, { labels: false });
  bindColorGrid(grid, async (k) => {
    if (!me || !store.members[me.id]) return;
    await update(ref(db, `office/members/${me.id}`), { color: k, lastSeen: Date.now() });
    toast(`캐릭터 색을 ${CHARACTER_COLORS[k].label}로 바꿨습니다`);
  });
}

function renderLegend() {
  $('legend').innerHTML = STATUS_LIST.map(
    (s) => `<span><i class="${s.key}"></i>${s.label}</span>`
  ).join('') + '<span>· 캐릭터를 누르면 상태메시지, 그 말풍선을 누르면 상세가 열립니다</span>';
}

/* ---------------- 회의실 ---------------- */
function renderAgendas() {
  const list = sortByTime(store.agendas, -1);
  $('agendaCount').textContent = list.length;
  const ul = $('agendaList');
  if (!list.length) {
    ul.innerHTML = '<li class="col-empty">첫 안건을 올려 보세요</li>';
  } else {
    ul.innerHTML = list
      .map((a) => {
        const msgs = countAuthored(a.messages);
        return `<li class="agenda-item ${selectedAgenda === a.id ? 'is-selected' : ''}" data-id="${esc(a.id)}" data-status="${a.status === 'agreed' ? 'agreed' : 'discussing'}">
          <div class="at"><b>${esc(a.title)}</b>
          <span class="chip ${a.status === 'agreed' ? 's-agreed' : 's-discussing'}">${a.status === 'agreed' ? '합의 완료' : '논의 중'}</span></div>
          <p>${esc(a.author || '익명')} · 댓글 ${msgs} · ${relTime(a.createdAt)}</p>
        </li>`;
      })
      .join('');
    ul.querySelectorAll('.agenda-item').forEach((li) => {
      li.addEventListener('click', () => {
        selectedAgenda = li.dataset.id;
        renderAgendas();
      });
    });
  }

  if (selectedAgenda && !store.agendas[selectedAgenda]) selectedAgenda = null;
  const a = selectedAgenda ? store.agendas[selectedAgenda] : null;
  $('threadEmpty').hidden = !!a;
  $('thread').hidden = !a;
  if (!a) return;

  $('threadTitle').textContent = a.title;
  $('threadMeta').textContent = `${a.body || '설명 없음'} · ${a.author || '익명'} 제안 · ${relTime(a.createdAt)}`;
  const st = $('threadStatus');
  st.textContent = a.status === 'agreed' ? '합의 완료' : '논의 중';
  st.className = `chip ${a.status === 'agreed' ? 's-agreed' : 's-discussing'}`;
  $('toggleAgendaBtn').textContent = a.status === 'agreed' ? '논의로 되돌리기' : '합의 완료';
  const toTask = $('toTaskBtn');
  toTask.disabled = !!a.taskId;
  toTask.textContent = a.taskId ? '작업실에 있음' : '→ 작업실로';

  const msgs = sortByTime(a.messages, 1);
  const body = $('threadBody');
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  body.innerHTML = msgs.length
    ? msgs
        .map((m) => {
          const mine = me && m.authorId === me.id;
          return `<div class="msg ${mine ? 'mine' : ''}">
            <div class="mh"><b>${esc(m.author || '익명')}</b><time>${relTime(m.createdAt)}</time></div>
            <div class="mb">${esc(m.text)}</div></div>`;
        })
        .join('')
    : '<div class="msg sys">아직 대화가 없습니다. 첫 의견을 남겨 보세요.</div>';
  if (atBottom) body.scrollTop = body.scrollHeight;
}

/* ---------------- 작업실 ---------------- */
function syncAssigneeOptions() {
  const sel = $('taskAssignee');
  const names = memberList().map((m) => m.name);
  const prev = sel.value;
  const key = names.join('|');
  if (sel.dataset.key === key) return;
  sel.dataset.key = key;
  sel.innerHTML = '<option value="">담당 미지정</option>' +
    names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  if (names.includes(prev)) sel.value = prev;
}

function renderTasks() {
  const wrap = $('kanban');
  const tasks = sortByTime(store.tasks, 1);
  wrap.innerHTML = COLUMNS.map((c) => {
    const items = tasks.filter((t) => (t.status || 'todo') === c.key);
    return `<section class="col" data-status="${c.key}">
      <div class="col-head"><h3>${c.label}</h3><span class="count">${items.length}</span></div>
      <div class="col-body">${
        items.length
          ? items.map((t) => taskCard(t)).join('')
          : '<div class="col-empty">비어 있음</div>'
      }</div>
    </section>`;
  }).join('');

  wrap.querySelectorAll('[data-move]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const to = btn.dataset.move;
      const t = store.tasks[id];
      if (!t) return;
      await update(ref(db, `office/tasks/${id}`), { status: to, movedAt: Date.now() });
      toast(`‘${t.title}’ → ${COLUMNS.find((c) => c.key === to).label}`);
    });
  });
  wrap.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.del;
      const t = store.tasks[id];
      if (!t) return;
      if (!confirm(`‘${t.title}’ 작업을 삭제할까요?`)) return;
      await remove(ref(db, `office/tasks/${id}`));
      toast('삭제했습니다');
    });
  });
  /* 담당 작업이 바뀌면 해당 비서의 상태 메시지도 다시 계산합니다 */
  reconcileMessages();
  if (detailMember) renderDetail();
}

function taskCard(t) {
  const idx = COLUMNS.findIndex((c) => c.key === (t.status || 'todo'));
  const prev = idx > 0 ? COLUMNS[idx - 1].key : null;
  const next = idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  return `<article class="tcard p-${esc(t.priority || 'normal')}">
    <p class="tt">${esc(t.title)}</p>
    <div class="tmeta">
      <span class="assign"><i>${esc(t.assigneeConsonant || '·')}</i>${esc(t.assignee || '미지정')}</span>
      <span class="chip p-${esc(t.priority || 'normal')}">${PRIORITY_LABEL[t.priority] || '보통'}</span>
      ${t.agendaId ? '<span class="chip">회의실</span>' : ''}
    </div>
    <div class="tacts">
      ${prev ? `<button type="button" data-move="${prev}" data-id="${esc(t.id)}">◀ ${COLUMNS.find((c) => c.key === prev).label}</button>` : ''}
      ${next ? `<button type="button" data-move="${next}" data-id="${esc(t.id)}">${COLUMNS.find((c) => c.key === next).label} ▶</button>` : ''}
      <button type="button" data-del="${esc(t.id)}" title="삭제">✕</button>
    </div>
  </article>`;
}

/* ---------------- 공지 ---------------- */
function renderNotices() {
  const list = sortByTime(store.notices, -1);
  $('noticeCount').textContent = list.length;
  const ul = $('noticeList');
  if (!list.length) {
    ul.innerHTML = '<li class="col-empty">아직 게시된 글이 없습니다</li>';
    return;
  }
  ul.innerHTML = list
    .map(
      (n) => `<li class="notice-item kind-${esc(n.kind || 'notice')}">
        <div class="nh"><span class="chip">${KIND_LABEL[n.kind] || '공지'}</span><b>${esc(n.author || '익명')}</b><time>${relTime(n.createdAt)}</time></div>
        <p>${esc(n.text)}</p></li>`
    )
    .join('');
}

/* ---------------- 탭 ---------------- */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.panel-view').forEach((v) => {
    v.classList.toggle('is-active', v.id === `view-${name}`);
  });
}

/* ---------------- 입장 ---------------- */
let pickConsonant = 'ㅈ';
let pickColor = 'pink';
let pickColorTouched = false;

function buildConsonantGrid() {
  const grid = $('consonantGrid');
  grid.innerHTML = CONSONANTS.map(
    (c) => `<button type="button" class="cbtn ${c === pickConsonant ? 'is-active' : ''}" data-c="${c}">${c}</button>`
  ).join('');
  grid.querySelectorAll('.cbtn').forEach((b) => {
    b.addEventListener('click', () => {
      pickConsonant = b.dataset.c;
      grid.querySelectorAll('.cbtn').forEach((x) => x.classList.toggle('is-active', x === b));
      renderJoinPreview();
    });
  });
}

function buildColorGrid() {
  const grid = $('colorGrid');
  grid.innerHTML = colorGridHTML(pickColor);
  bindColorGrid(grid, (k) => {
    pickColor = k;
    pickColorTouched = true;
    buildColorGrid();
    renderJoinPreview();
  });
}

/* 입장 모달 미리보기 — 고른 이름·자음·색 그대로 캐릭터가 보입니다 */
function renderJoinPreview() {
  const canvas = $('joinPreview');
  if (!canvas) return;
  const nameInput = $('joinName');
  const name = nameInput ? nameInput.value.trim() : '';
  paintPortrait(canvas, {
    scale: 4,
    consonant: pickConsonant,
    name: name || '새 비서',
    color: pickColor,
    status: 'idle',
  });
  $('joinPreviewName').textContent = name || '새 비서';
  const badge = $('joinPreviewBadge');
  badge.textContent = pickConsonant;
  badge.style.color = CHARACTER_COLORS[pickColor].deep;
  badge.style.background = CHARACTER_COLORS[pickColor].light;
  $('joinPreviewColor').textContent = CHARACTER_COLORS[pickColor].label;
}

/* 아직 고르지 않았다면 비어 있는 색을 먼저 권합니다 */
function suggestColor() {
  if (pickColorTouched) return;
  const used = memberList().map((m) => memberColor(m));
  const free = CHARACTER_COLOR_ORDER.find((k) => !used.includes(k));
  pickColor = free || CHARACTER_COLOR_ORDER[0];
}

function openJoin() {
  suggestColor();
  buildColorGrid();
  renderJoinPreview();
  $('joinModal').hidden = false;
  localStorage.setItem('pickle-office:seen', '1');
  setTimeout(() => $('joinName').focus(), 50);
}

async function joinSubmit(e) {
  e.preventDefault();
  const name = $('joinName').value.trim();
  if (!name) return;
  const role = $('joinRole').value.trim();
  const id = nid();
  const now = Date.now();
  const draft = { name, consonant: pickConsonant, color: pickColor, role: role || '역할 미지정', status: 'working', joinedAt: now, lastSeen: now };
  await set(ref(db, `office/members/${id}`), { ...draft, message: autoMessage({ ...draft, id }) });
  me = { id, name, consonant: pickConsonant, color: pickColor };
  localStorage.setItem(LS_ME, JSON.stringify(me));
  $('joinModal').hidden = true;
  selectedMember = id;
  toast(`${name} (${pickConsonant}) 입장 완료 · ${CHARACTER_COLORS[pickColor].label}`);
  registerPresence();
  switchTab('office');
}

let presenceTimer = null;
function touchPresence() {
  if (!me) return;
  // 자리가 이미 사라졌으면 다시 만들지 않는다 (트랜잭션이 중단됨)
  runTransaction(ref(db, `office/members/${me.id}`), (cur) => {
    if (!cur) return undefined;
    return { ...cur, lastSeen: Date.now() };
  }).catch(() => {});
}
function registerPresence() {
  if (!me) return;
  if (presenceTimer) clearInterval(presenceTimer);
  touchPresence();
  presenceTimer = setInterval(() => {
    if (!me) return;
    if (!store.members[me.id]) {
      clearInterval(presenceTimer);
      presenceTimer = null;
      return;
    }
    touchPresence();
  }, 40e3);
}

function renderLockChip() {
  const chip = $('lockChip');
  if (!chip) return;
  chip.hidden = !unlocked;
}

/* 접속 코드 다시 입력(잠금 화면 열기) — 코드는 화면에 미리 채우지 않습니다 */
function openGateForCode() {
  access.code = '';
  showGate('need-code', '새 초대 코드를 입력하면 이 브라우저가 그 코드로 다시 연결됩니다.');
  $('lockClose').hidden = !subscribed;
}

async function leaveSeat() {
  if (!me) return;
  if (!confirm('이 자리에서 나가시겠습니까? 캐릭터가 오피스에서 사라집니다.')) return;
  await remove(ref(db, `office/members/${me.id}`));
  localStorage.removeItem(LS_ME);
  if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
  me = null;
  selectedMember = null;
  $('bubble').hidden = true;
  renderMeCard();
  toast('자리에서 나갔습니다');
}

/* ---------------- 이벤트 바인딩 ---------------- */
function bindEvents() {
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  $('joinBtn').addEventListener('click', openJoin);
  $('joinBtn2').addEventListener('click', openJoin);
  $('joinClose').addEventListener('click', () => { $('joinModal').hidden = true; localStorage.setItem('pickle-office:seen', '1'); });
  $('joinCancel').addEventListener('click', () => { $('joinModal').hidden = true; localStorage.setItem('pickle-office:seen', '1'); });
  $('joinForm').addEventListener('submit', joinSubmit);
  $('joinName').addEventListener('input', renderJoinPreview);
  $('leaveBtn').addEventListener('click', leaveSeat);

  const grid = $('statusGrid');
  grid.innerHTML = STATUS_LIST.map(
    (s) => `<button type="button" class="status-btn" data-s="${s.key}"><i></i>${s.label}</button>`
  ).join('');
  grid.querySelectorAll('.status-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!me || !store.members[me.id]) { openJoin(); return; }
      const cur = store.members[me.id];
      const status = b.dataset.s;
      /* 상태가 바뀌면 상태 메시지도 바로 다시 계산해 같이 저장합니다 */
      await update(ref(db, `office/members/${me.id}`), {
        status,
        message: autoMessage({ ...cur, status }),
        lastSeen: Date.now(),
      });
    });
  });

  $('agendaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('agendaTitle').value.trim();
    if (!title) return;
    const id = nid();
    await set(ref(db, `office/agendas/${id}`), {
      title,
      body: $('agendaBody').value.trim(),
      status: 'discussing',
      author: (me && store.members[me.id] ? store.members[me.id].name : '') || (me && me.name) || '익명',
      authorId: me ? me.id : null,
      createdAt: Date.now(),
    });
    $('agendaTitle').value = '';
    $('agendaBody').value = '';
    selectedAgenda = id;
    renderAgendas();
    toast('안건을 올렸습니다');
  });

  $('msgForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('msgInput').value.trim();
    if (!text || !selectedAgenda) return;
    $('msgInput').value = '';
    await set(ref(db, `office/agendas/${selectedAgenda}/messages/${nid()}`), {
      author: (me && me.name) || '익명',
      authorId: me ? me.id : null,
      text,
      createdAt: Date.now(),
    });
  });

  $('toggleAgendaBtn').addEventListener('click', async () => {
    if (!selectedAgenda || !store.agendas[selectedAgenda]) return;
    const cur = store.agendas[selectedAgenda].status === 'agreed' ? 'discussing' : 'agreed';
    await update(ref(db, `office/agendas/${selectedAgenda}`), { status: cur });
    toast(cur === 'agreed' ? '합의 완료로 표시했습니다' : '다시 논의 중으로 돌렸습니다');
  });

  $('toTaskBtn').addEventListener('click', async () => {
    if (!selectedAgenda || !store.agendas[selectedAgenda]) return;
    const a = store.agendas[selectedAgenda];
    if (a.taskId) return;
    const assignee = (me && me.name) || a.author || '';
    const m = memberList().find((x) => x.name === assignee);
    const id = nid();
    await set(ref(db, `office/tasks/${id}`), {
      title: a.title,
      assignee,
      assigneeConsonant: m ? m.consonant : '',
      priority: 'normal',
      status: 'todo',
      agendaId: selectedAgenda,
      note: '회의실 안건에서 합의되어 넘어온 작업',
      createdAt: Date.now(),
    });
    await update(ref(db, `office/agendas/${selectedAgenda}`), { status: 'agreed', taskId: id, agreedAt: Date.now() });
    toast('작업실 ‘할 일’로 넘겼습니다');
    switchTab('work');
  });

  $('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('taskTitle').value.trim();
    if (!title) return;
    const assignee = $('taskAssignee').value;
    const m = memberList().find((x) => x.name === assignee);
    const id = nid();
    await set(ref(db, `office/tasks/${id}`), {
      title,
      assignee,
      assigneeConsonant: m ? m.consonant : '',
      priority: $('taskPriority').value,
      status: 'todo',
      createdAt: Date.now(),
    });
    $('taskTitle').value = '';
    toast('작업을 추가했습니다');
  });

  $('noticeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('noticeText').value.trim();
    if (!text) return;
    const id = nid();
    await set(ref(db, `office/notices/${id}`), {
      kind: $('noticeKind').value,
      author: (me && me.name) || '익명',
      text,
      createdAt: Date.now(),
    });
    $('noticeText').value = '';
    toast('화이트보드에 붙였습니다');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $('joinModal').hidden = true;
    /* 상세 패널 → 말풍선 순서로 닫힙니다 */
    if (detailMember) { closeDetail(); return; }
    if (selectedMember) { selectedMember = null; $('bubble').hidden = true; renderMembers(); }
  });

  /* 1단계: 캐릭터 위 말풍선 → 2단계: 말풍선을 누르면 상세가 펼쳐짐 */
  const bubble = $('bubble');
  bubble.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedMember) openDetail(selectedMember);
  });
  bubble.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectedMember) openDetail(selectedMember); }
  });
  $('cdClose').addEventListener('click', closeDetail);
  $('codeBtn').addEventListener('click', openGateForCode);
  $('lockForm').addEventListener('submit', lockSubmit);
  $('lockClose').addEventListener('click', () => { hideGate(); });

  /* 상세 패널 바같을 누르면 닫힘 */
  document.addEventListener('click', (e) => {
    if (!detailMember) return;
    const el = $('charDetail');
    if (!el || el.hidden) return;
    if (el.contains(e.target) || $('bubble').contains(e.target) || canvas.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.member-item')) return;
    closeDetail();
  });
}

/* ---------------- 접근 잠금 (초대 코드) ----------------
 * DB는 보안 규칙으로 잠겨 있습니다. 익명 로그인 세션(uid)에 유효한 초대 코드가 묶여 있어야
 * office 노드를 읽고 쓸 수 있습니다. 코드가 없으면 읽기/쓰기 자체가 거부됩니다. */
function gateMsg(text, kind = 'info') {
  const el = $('lockMsg');
  el.textContent = text || '';
  el.dataset.kind = kind;
}

function showGate(state, message = '', kind = 'info') {
  unlocked = false;
  access.state = state;
  document.body.classList.add('is-locked');
  $('lockGate').hidden = false;
  renderLockChip();
  const checking = state === 'checking';
  $('lockForm').hidden = checking;
  $('lockSpinner').hidden = !checking;
  gateMsg(message, kind);
  if (state === 'need-code') {
    $('lockCode').value = access.code || '';
    setTimeout(() => { try { $('lockCode').focus(); } catch (e) { /* noop */ } }, 80);
  }
}

function hideGate() {
  unlocked = true;
  document.body.classList.remove('is-locked');
  $('lockGate').hidden = true;
  renderLockChip();
}

async function bindSession(code) {
  await set(ref(db, `access/sessions/${access.uid}`), { code, boundAt: Date.now(), via: 'web' });
  access.code = code;
  localStorage.setItem(LS_CODE, code);
}

async function canReadOffice() {
  try {
    const snap = await get(ref(db, 'office/members'));
    return snap.val() !== null;
  } catch (err) {
    return false;
  }
}

async function lockSubmit(e) {
  e.preventDefault();
  const code = $('lockCode').value.trim();
  if (!code) return;
  $('lockClose').hidden = true;
  showGate('checking', '초대 코드를 확인하는 중…');
  try {
    await bindSession(code);
  } catch (err) {
    access.code = '';
    localStorage.removeItem(LS_CODE);
    showGate(
      'need-code',
      isPermissionError(err)
        ? '초대 코드가 올바르지 않거나 회수되었습니다.'
        : `연결에 실패했습니다 (${(err && (err.code || err.message)) || '알 수 없는 오류'}). 잠시 후 다시 시도해 주세요.`,
      'error'
    );
    return;
  }
  if (await canReadOffice()) {
    unlock();
    toast('허용된 비서로 확인되었습니다');
  } else {
    showGate('need-code', '이 코드로는 아직 열람 권한이 없습니다. 잠시 후 다시 시도해 주세요.', 'error');
  }
}

/* 초대 링크의 ?seat= 값으로 기존 자리를 이어 받습니다 (중복 좌석 생성 방지) */
function claimSeat() {
  if (!pendingSeat) return;
  const m = store.members[pendingSeat];
  if (!m) return;
  me = { id: pendingSeat, name: m.name, consonant: m.consonant, color: m.color };
  localStorage.setItem(LS_ME, JSON.stringify(me));
  pendingSeat = '';
  selectedMember = me.id;
  registerPresence();
  toast(`${me.name} 자리로 연결되었습니다`);
}

function stripCodeFromUrl() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('code') && !u.searchParams.has('seat')) return;
    u.searchParams.delete('code');
    u.searchParams.delete('seat');
    history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
  } catch (err) { /* noop */ }
}

async function authenticate() {
  try {
    const cred = await signInAnonymously(auth);
    access.uid = cred.user.uid;
  } catch (err) {
    $('lockForm').hidden = true;
    showGate('need-code', `실시간 인증에 실패했습니다 (${err.code || err.message}). 새로고침해 주세요.`, 'error');
    return;
  }

  let bound = '';
  try {
    const s = await get(ref(db, `access/sessions/${access.uid}`));
    if (s.exists() && s.val() && s.val().code) bound = String(s.val().code);
  } catch (err) { /* 규칙 적용 전이거나 읽기 거부 — 코드 입력으로 진행 */ }

  const urlCode = (new URLSearchParams(location.search).get('code') || '').trim();
  const savedCode = (localStorage.getItem(LS_CODE) || '').trim();
  const wanted = urlCode || savedCode;

  if (bound && (!wanted || wanted === bound)) {
    access.code = bound;
    if (await canReadOffice()) { unlock(); return; }
  }
  if (wanted && wanted !== bound) {
    localStorage.setItem(LS_CODE, wanted);
    access.code = wanted;
    try {
      await bindSession(wanted);
      if (await canReadOffice()) { unlock(); toast('허용된 비서로 확인되었습니다'); return; }
    } catch (err) {
      access.code = '';
      localStorage.removeItem(LS_CODE);
      showGate(
        'need-code',
        isPermissionError(err)
          ? '초대 코드가 올바르지 않거나 회수되었습니다.'
          : `연결에 실패했습니다 (${(err && (err.code || err.message)) || '알 수 없는 오류'}).`,
        'error'
      );
      return;
    }
  }
  showGate('need-code', bound ? '연결이 만료되었습니다. 초대 코드를 다시 입력해 주세요.' : '');
}

function unlock() {
  hideGate();
  stripCodeFromUrl();
  if (!subscribed) { subscribe(); subscribed = true; }
  seedIfEmpty().then(() => {
    setTimeout(() => {
      if (me && store.members[me.id]) {
        registerPresence();
        selectedMember = me.id;
        renderBubble();
      } else {
        if (me) {
          me = null;
          localStorage.removeItem(LS_ME);
        }
        if (!$('joinModal').hidden) return;
        if (localStorage.getItem('pickle-office:seen') === '1') return;
        openJoin();
      }
    }, 1600);
  });
}

/* ---------------- 시작 ---------------- */
function boot() {
  buildConsonantGrid();
  buildColorGrid();
  renderLegend();
  buildMapLabels();
  bindEvents();

  // ?tab=work 처럼 구역을 바로 열 수 있게 (공유용)
  const tabParam = new URLSearchParams(location.search).get('tab');
  if (tabParam && ['office', 'meeting', 'work', 'notice'].includes(tabParam)) switchTab(tabParam);

  try {
    const saved = JSON.parse(localStorage.getItem(LS_ME) || 'null');
    if (saved && saved.id) me = saved;
  } catch (err) { /* ignore */ }

  requestAnimationFrame(drawLoop);
  showGate('checking', '허용된 비서인지 확인하는 중…');
  authenticate();
}

boot();
