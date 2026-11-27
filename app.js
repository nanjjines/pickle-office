import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  remove,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';
import {
  LOGICAL_W,
  LOGICAL_H,
  SCALE,
  SPRITE_H,
  CONSONANTS,
  ZONES,
  drawOfficeBase,
  drawCharacter,
  hitTest,
  slotFor,
  zoneForStatus,
} from './sprites.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const STATUS_LIST = [
  { key: 'working', label: '작업 중' },
  { key: 'meeting', label: '회의 중' },
  { key: 'idle', label: '대기 중' },
  { key: 'away', label: '자리 비움' },
];
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
const LS_ROOM = 'pickle-office:room';

const store = { members: {}, notices: {}, agendas: {}, tasks: {} };
let me = null;
let selectedMember = null;
let selectedAgenda = null;
let roomCode = new URLSearchParams(location.search).get('room') || '';
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
      role: '권은서님의 비서',
      status: 'working',
      message: '오늘의 브리핑 정리 중',
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
    afterMembersChange();
  });
  onValue(ref(db, 'office/notices'), (snap) => {
    store.notices = snap.val() || {};
    renderNotices();
  });
  onValue(ref(db, 'office/agendas'), (snap) => {
    store.agendas = snap.val() || {};
    renderAgendas();
  });
  onValue(ref(db, 'office/tasks'), (snap) => {
    store.tasks = snap.val() || {};
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
    el.textContent = z.tag;
    el.style.left = `${(z.x / LOGICAL_W) * 100}%`;
    el.style.top = `${((z.y + 2) / LOGICAL_H) * 100}%`;
    wrap.appendChild(el);
  }
}

function memberList() {
  return Object.entries(store.members)
    .map(([id, m]) => ({ id, ...m }))
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
  renderMembers();
  renderMeCard();
  syncAssigneeOptions();
  renderBubble();
}

function drawLoop(t) {
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
      consonant: m.consonant || 'ㅇ',
    });
    drawCharacter(ctx, {
      consonant: m.consonant || 'ㅇ',
      x: a.x,
      y: a.y,
      status: m.status || 'working',
      blink,
      bob,
      selected: selectedMember === m.id,
      dim: m.status === 'away',
    });
  }

  drawn.sort((p, q) => p.y - q.y);

  // 이름표
  ctx.font = '10px "Galmuri11", monospace';
  ctx.textAlign = 'center';
  for (const d of drawn) {
    ctx.fillStyle = 'rgba(247,243,233,0.8)';
    const w = Math.max(24, ctx.measureText(d.name).width + 6);
    ctx.fillRect(d.x + 15 - w / 2, d.y + SPRITE_H - 4, w, 11);
    ctx.fillStyle = '#141210';
    ctx.fillText(d.name, d.x + 15, d.y + SPRITE_H + 5);
  }

  requestAnimationFrame(drawLoop);
}

function renderBubble() {
  const bubble = $('bubble');
  if (!selectedMember || !store.members[selectedMember]) { bubble.hidden = true; return; }
  const m = store.members[selectedMember];
  const d = drawn.find((x) => x.id === selectedMember);
  if (!d) { bubble.hidden = true; return; }
  $('bubbleName').textContent = m.name;
  $('bubbleStatus').textContent = STATUS_LABEL[m.status] || '작업 중';
  $('bubbleStatus').className = `chip s-${m.status === 'working' ? 'agreed' : 'discussing'}`;
  $('bubbleMsg').textContent = m.message || '상태 메시지 없음';
  const task = Object.values(store.tasks || {}).find(
    (t) => t.assignee === m.name && t.status !== 'done'
  );
  const bt = $('bubbleTask');
  if (task) {
    bt.hidden = false;
    bt.textContent = `▸ ${task.title} · ${(COLUMNS.find((c) => c.key === task.status) || {}).label || ''}`;
  } else {
    bt.hidden = true;
  }
  bubble.style.left = `${((d.x + 15) / LOGICAL_W) * 100}%`;
  bubble.style.top = `${((d.y - 2) / LOGICAL_H) * 100}%`;
  bubble.hidden = false;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const lx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
  const ly = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
  const id = hitTest(drawn, lx, ly);
  selectedMember = id && id !== selectedMember ? id : null;
  renderMembers();
  renderBubble();
});

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
      const online = me && me.id === m.id ? true : m.lastSeen && Date.now() - Number(m.lastSeen) < 3 * 60e3;
      return `<li class="member-item ${selectedMember === m.id ? 'is-selected' : ''}" data-id="${esc(m.id)}">
        <span class="ma">${esc(m.consonant || 'ㅇ')}</span>
        <span class="mi"><b>${esc(m.name)}${online ? '' : ' <span class="muted">· 오프라인</span>'}</b>
        <span>${STATUS_LABEL[m.status] || '작업 중'}${m.message ? ' · ' + esc(m.message) : ''}</span></span>
        <span class="dot ${esc(m.status || 'working')}"></span>
      </li>`;
    })
    .join('');
  ul.querySelectorAll('.member-item').forEach((li) => {
    li.addEventListener('click', () => {
      selectedMember = li.dataset.id === selectedMember ? null : li.dataset.id;
      renderMembers();
      renderBubble();
      if (selectedMember) switchTab('office');
    });
  });
}

function renderMeCard() {
  const has = !!(me && store.members[me.id]);
  $('meEmpty').hidden = has;
  $('meBody').hidden = !has;
  if (!has) return;
  const m = store.members[me.id];
  $('meAvatar').textContent = m.consonant || 'ㅇ';
  $('meName').textContent = m.name || '';
  $('meRole').textContent = m.role || '역할 미지정';
  const grid = $('statusGrid');
  grid.querySelectorAll('.status-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.s === (m.status || 'working'));
  });
  const input = $('statusMsg');
  if (document.activeElement !== input) input.value = m.message || '';
}

function renderLegend() {
  $('legend').innerHTML = STATUS_LIST.map(
    (s) => `<span><i class="${s.key}"></i>${s.label}</span>`
  ).join('') + '<span>· 캐릭터를 누르면 상세가 열립니다</span>';
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
        return `<li class="agenda-item ${selectedAgenda === a.id ? 'is-selected' : ''}" data-id="${esc(a.id)}">
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
}

function taskCard(t) {
  const idx = COLUMNS.findIndex((c) => c.key === (t.status || 'todo'));
  const prev = idx > 0 ? COLUMNS[idx - 1].key : null;
  const next = idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  return `<article class="tcard">
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

function buildConsonantGrid() {
  const grid = $('consonantGrid');
  grid.innerHTML = CONSONANTS.map(
    (c) => `<button type="button" class="cbtn ${c === pickConsonant ? 'is-active' : ''}" data-c="${c}">${c}</button>`
  ).join('');
  grid.querySelectorAll('.cbtn').forEach((b) => {
    b.addEventListener('click', () => {
      pickConsonant = b.dataset.c;
      grid.querySelectorAll('.cbtn').forEach((x) => x.classList.toggle('is-active', x === b));
    });
  });
}

function openJoin() {
  $('joinModal').hidden = false;
  $('joinCode').value = roomCode || '';
  setTimeout(() => $('joinName').focus(), 50);
}

async function joinSubmit(e) {
  e.preventDefault();
  const name = $('joinName').value.trim();
  if (!name) return;
  const role = $('joinRole').value.trim();
  const code = $('joinCode').value.trim();
  if (code) {
    roomCode = code;
    localStorage.setItem(LS_ROOM, code);
    updateRoomChip();
  }
  const id = nid();
  const now = Date.now();
  await set(ref(db, `office/members/${id}`), {
    name,
    consonant: pickConsonant,
    role: role || '역할 미지정',
    status: 'working',
    message: '',
    joinedAt: now,
    lastSeen: now,
  });
  me = { id, name, consonant: pickConsonant };
  localStorage.setItem(LS_ME, JSON.stringify(me));
  $('joinModal').hidden = true;
  selectedMember = id;
  toast(`${name} (${pickConsonant}) 입장 완료`);
  registerPresence();
  switchTab('office');
}

let presenceTimer = null;
function registerPresence() {
  if (!me) return;
  if (presenceTimer) clearInterval(presenceTimer);
  const r = ref(db, `office/members/${me.id}`);
  update(r, { lastSeen: Date.now() }).catch(() => {});
  presenceTimer = setInterval(() => {
    if (me) update(ref(db, `office/members/${me.id}`), { lastSeen: Date.now() }).catch(() => {});
  }, 40e3);
}

function updateRoomChip() {
  const chip = $('roomChip');
  if (roomCode) {
    chip.hidden = false;
    $('roomCodeText').textContent = roomCode.toUpperCase();
  } else {
    chip.hidden = true;
  }
}

async function leaveSeat() {
  if (!me) return;
  if (!confirm('이 자리에서 나가시겠습니까? 캐릭터가 오피스에서 사라집니다.')) return;
  await remove(ref(db, `office/members/${me.id}`));
  localStorage.removeItem(LS_ME);
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
  $('joinClose').addEventListener('click', () => { $('joinModal').hidden = true; });
  $('joinCancel').addEventListener('click', () => { $('joinModal').hidden = true; });
  $('joinForm').addEventListener('submit', joinSubmit);
  $('leaveBtn').addEventListener('click', leaveSeat);

  $('shareBtn').addEventListener('click', async () => {
    const url = roomCode ? `${location.origin}${location.pathname}?room=${encodeURIComponent(roomCode)}` : location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast('초대 링크를 복사했습니다');
    } catch (err) {
      window.prompt('아래 링크를 복사하세요', url);
    }
  });

  const grid = $('statusGrid');
  grid.innerHTML = STATUS_LIST.map(
    (s) => `<button type="button" class="status-btn" data-s="${s.key}"><i></i>${s.label}</button>`
  ).join('');
  grid.querySelectorAll('.status-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!me) { openJoin(); return; }
      await update(ref(db, `office/members/${me.id}`), { status: b.dataset.s, lastSeen: Date.now() });
    });
  });

  let msgTimer = null;
  $('statusMsg').addEventListener('input', (e) => {
    if (!me) return;
    clearTimeout(msgTimer);
    const val = e.target.value;
    msgTimer = setTimeout(() => {
      update(ref(db, `office/members/${me.id}`), { message: val, lastSeen: Date.now() }).catch(() => {});
    }, 500);
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
    if (e.key === 'Escape') {
      $('joinModal').hidden = true;
      if (selectedMember) { selectedMember = null; $('bubble').hidden = true; renderMembers(); }
    }
  });
}

/* ---------------- 시작 ---------------- */
function boot() {
  buildConsonantGrid();
  renderLegend();
  buildMapLabels();
  bindEvents();
  updateRoomChip();

  const savedRoom = localStorage.getItem(LS_ROOM);
  if (!roomCode && savedRoom) { roomCode = savedRoom; updateRoomChip(); }
  const params = new URLSearchParams(location.search).get('room');
  if (params) { roomCode = params; localStorage.setItem(LS_ROOM, roomCode); updateRoomChip(); }

  try {
    const saved = JSON.parse(localStorage.getItem(LS_ME) || 'null');
    if (saved && saved.id) me = saved;
  } catch (err) { /* ignore */ }

  subscribe();
  requestAnimationFrame(drawLoop);
  seedIfEmpty().then(() => {
    if (me && store.members[me.id]) {
      registerPresence();
      selectedMember = me.id;
    } else if (!me) {
      setTimeout(() => { if (!$('joinModal').hidden) return; openJoin(); }, 1400);
    }
  });
}

boot();
