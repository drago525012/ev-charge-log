/* EV Charge Log - PWA frontend (vanilla JS, no build step). */
'use strict';

const VERSION = '1.0.0';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const APPS = [
  { name: 'Hoven Charge', logo: 'icons/apps/hoven.png', keys: ['hoven', 'hardhitter', 'hard hitter'], aliases: ['hardhitter'] },
  { name: 'PEA VOLTA', logo: 'icons/apps/pea.png', keys: ['volta', 'การไฟฟ้าส่วนภูมิภาค'] },
  { name: 'EV Station PluZ', logo: 'icons/apps/pluz.png', keys: ['pluz', 'ev station', 'evstation'] },
  { name: 'iGreen+', logo: 'icons/apps/igreen.png', keys: ['igreen', 'i green'] },
  { name: 'EVolt', logo: 'icons/apps/evolt.png', keys: ['evolt'] },
  { name: 'Spark', logo: 'icons/apps/spark.png', keys: ['spark'] },
  { name: 'Altervim Super Charge', logo: 'icons/apps/altervim.png', keys: ['altervim'] },
  { name: 'OneCharge', logo: 'icons/apps/onecharge.png', keys: ['onecharge', 'one charge'] },
  { name: 'MEA EV', logo: 'icons/apps/mea.png', keys: ['mea ev', 'การไฟฟ้านครหลวง'] },
  { name: 'ReverSharger', logo: 'icons/apps/rever.png', keys: ['reversharger', 'rever'] },
  { name: 'EleXa', logo: 'icons/apps/elexa.png', keys: ['elexa'] },
];
const OTHER = 'อื่น ๆ';

const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTH_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_DAY_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isNum = (v) => typeof v === 'number' && isFinite(v);
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
};
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n) => '฿' + fmt(n || 0);
const bigMoney = (n) => {
  const s = fmt(n || 0);
  const i = s.lastIndexOf('.');
  return '฿' + s.slice(0, i) + '<span class="dec">' + s.slice(i) + '</span>';
};

function loadLS(k, def) {
  try { const v = JSON.parse(localStorage.getItem('evlog.' + k)); return v == null ? def : v; } catch (_) { return def; }
}
function saveLS(k, v) {
  try { localStorage.setItem('evlog.' + k, JSON.stringify(v)); } catch (_) { /* storage full or blocked */ }
}

function parseISO(iso) {
  const p = String(iso || '').split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function nowHM() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
const monthKey = (iso) => String(iso).slice(0, 7);
function monthLabel(key, short) {
  const [y, m] = key.split('-').map(Number);
  return (short ? TH_MONTH_SHORT : TH_MONTH_LONG)[m - 1] + ' ' + y;
}
function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
function thaiShort(iso) {
  const d = parseISO(iso);
  return TH_DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + TH_MONTH_SHORT[d.getMonth()];
}
function thaiLong(iso) {
  const d = parseISO(iso);
  return 'วัน' + TH_DAY_LONG[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + TH_MONTH_SHORT[d.getMonth()] + ' ' + d.getFullYear();
}

/** Thai TOU: on-peak = Mon-Fri 09:00-22:00 (public holidays not handled). */
function peakOf(iso, time) {
  if (!iso || !/^\d{1,2}:\d{2}/.test(time || '')) return null;
  const dow = parseISO(iso).getDay();
  if (dow === 0 || dow === 6) return 'off';
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  return mins >= 540 && mins < 1320 ? 'on' : 'off';
}
function peakBadge(p) {
  if (!p) return '';
  return p === 'on' ? '<span class="badge on">ON-PEAK</span>' : '<span class="badge off">OFF-PEAK</span>';
}

function appInfo(name) {
  const low = String(name || '').toLowerCase();
  return APPS.find((a) => a.name.toLowerCase() === low || (a.aliases || []).includes(low)) || null;
}
function canonicalApp(name) {
  const a = appInfo(name);
  return a ? a.name : String(name || '').trim();
}
function logoHtml(app, cls, size) {
  const a = appInfo(app);
  const st = size ? ` style="width:${size}px;height:${size}px"` : '';
  if (a) return `<img class="${cls || 'logo'}" src="${a.logo}" alt=""${st}>`;
  const initials = String(app || '?').trim().slice(0, 2).toUpperCase();
  return `<div class="${cls || 'logo'} mono"${st}>${esc(initials)}</div>`;
}

/* Inline icons (stroke SVG) */
const ICONS = {
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  map: '<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  nav: '<path d="M3 11l18-8-8 18-2-8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
};
function icon(name, color, size, width) {
  return `<svg width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="${width || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/* ------------------------------------------------------------------ */
/* State + API                                                         */
/* ------------------------------------------------------------------ */

const S = {
  cfg: loadLS('cfg', {}),
  items: (loadLS('cache', {}).items || []),
  car: (loadLS('cache', {}).car || {}),
  lastSync: loadLS('cache', {}).at || null,
  syncing: false,
  homeMonths: 3,
  search: '',
  insights: { mode: 'month', key: null, allApps: false },
  mapFilter: 'all',
  imgs: new Map(),
};

async function api(action, params) {
  if (!S.cfg.url || !S.cfg.token) throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ');
  let res;
  try {
    res = await fetch(S.cfg.url, {
      method: 'POST',
      body: JSON.stringify(Object.assign({ token: S.cfg.token, action: action }, params || {})),
      redirect: 'follow',
    });
  } catch (err) {
    throw new Error('เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต');
  }
  let j;
  try { j = await res.json(); } catch (_) { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (' + res.status + ')'); }
  if (!j.ok) {
    const map = { unauthorized: 'Token ไม่ถูกต้อง', charge_sheet_not_found: 'ไม่พบชีทค่าชาร์จ', not_found: 'ไม่พบรายการ', image_not_found: 'ไม่พบรูป' };
    throw new Error(map[j.error] || j.error || 'เกิดข้อผิดพลาด');
  }
  return j.data;
}

function normalizeItem(it) {
  return Object.assign({}, it, { app: canonicalApp(it.app) });
}

function persist() {
  S.lastSync = Date.now();
  saveLS('cache', { items: S.items, car: S.car, at: S.lastSync });
}

async function sync(silent) {
  if (S.syncing || !S.cfg.url) return;
  S.syncing = true;
  updateSyncBtn();
  try {
    const data = await api('list');
    S.items = (data.items || []).map(normalizeItem);
    S.car = data.car || {};
    persist();
    if (!silent) toast('อัปเดตข้อมูลแล้ว');
    route();
  } catch (err) {
    toast(err.message, true);
  } finally {
    S.syncing = false;
    updateSyncBtn();
  }
}
function updateSyncBtn() {
  const b = $('#sync-btn');
  if (b) b.innerHTML = S.syncing ? '<div class="spinner"></div>' : icon('refresh', '#fff', 20);
}

async function loadImage(path, size) {
  const key = path + '@' + (size || 800);
  if (S.imgs.has(key)) return S.imgs.get(key);
  const p = api('image', { path: path, size: size || 800 }).then((r) => r.dataUrl);
  S.imgs.set(key, p);
  p.catch(() => S.imgs.delete(key));
  return p;
}

/* ------------------------------------------------------------------ */
/* Derived data                                                        */
/* ------------------------------------------------------------------ */

function sortedItems() {
  return S.items.slice().sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') ||
    (b.time || '').localeCompare(a.time || '') ||
    ((b.odo || 0) - (a.odo || 0)));
}
function monthTotals() {
  const m = {};
  S.items.forEach((it) => {
    if (!it.date) return;
    const k = monthKey(it.date);
    m[k] = m[k] || { cost: 0, kwh: 0, n: 0 };
    m[k].cost += it.cost || 0;
    m[k].kwh += it.kwh || 0;
    m[k].n += 1;
  });
  return m;
}
function prevOdo(item) {
  if (!isNum(item.odo)) return null;
  let best = null;
  S.items.forEach((o) => {
    if (isNum(o.odo) && o.odo < item.odo && (best === null || o.odo > best)) best = o.odo;
  });
  return best;
}
function rateStats(items) {
  let cost = 0, kwh = 0, n = 0;
  items.forEach((it) => { if (it.kwh > 0 && isNum(it.cost)) { cost += it.cost; kwh += it.kwh; n++; } });
  return { cost, kwh, n, rate: kwh > 0 ? cost / kwh : null };
}
/** Consumption over the whole period that has odometer readings. */
function consumption() {
  const withOdo = S.items.filter((i) => isNum(i.odo) && i.date).sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
  if (withOdo.length < 2) return null;
  const first = withOdo[0];
  const last = withOdo.reduce((m, i) => (i.odo > m.odo ? i : m), first);
  const dist = last.odo - first.odo;
  if (dist < 200) return null;
  let kwh = 0, cost = 0;
  S.items.forEach((i) => {
    if (!i.date || i.date <= first.date || i.date > last.date) return;
    kwh += i.kwh || 0;
    cost += i.cost || 0;
  });
  return { from: first.date, to: last.date, dist, kwh, per100: (kwh / dist) * 100, perKm: cost / dist, lastOdo: last.odo };
}
function appFrequency() {
  const c = {};
  S.items.forEach((i) => { c[i.app] = (c[i.app] || 0) + 1; });
  return c;
}
function customAppNames() {
  const seen = new Map();
  sortedItems().forEach((i) => { if (i.app && !appInfo(i.app) && !seen.has(i.app)) seen.set(i.app, true); });
  return Array.from(seen.keys());
}
function stationGroups() {
  const g = new Map();
  sortedItems().forEach((i) => {
    const name = (i.station || '').trim();
    if (!name) return;
    const key = name.toLowerCase() + '|' + i.app;
    if (!g.has(key)) g.set(key, { name, app: i.app, items: [], lat: null, lng: null });
    g.get(key).items.push(i);
  });
  return Array.from(g.values()).map((s) => {
    const pts = s.items.filter((i) => isNum(i.lat) && isNum(i.lng));
    if (pts.length) {
      s.lat = pts.reduce((a, i) => a + i.lat, 0) / pts.length;
      s.lng = pts.reduce((a, i) => a + i.lng, 0) / pts.length;
    }
    const r = rateStats(s.items);
    s.rate = r.rate;
    s.spent = s.items.reduce((a, i) => a + (i.cost || 0), 0);
    s.visits = s.items.length;
    s.last = s.items[0].date;
    return s;
  });
}

/* ------------------------------------------------------------------ */
/* UI primitives                                                       */
/* ------------------------------------------------------------------ */

let toastTimer = null;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, err ? 4000 : 2200);
}

function confirmBox(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <h3 id="mdl-t">${esc(title)}</h3><p>${esc(text)}</p>
      <div class="btnrow"><button class="btn-d" data-v="0">ยกเลิก</button><button class="${danger ? 'btn-d danger' : 'btn-w'}" data-v="1">${esc(okLabel)}</button></div>
    </div></div>`;
    root.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { root.innerHTML = ''; resolve(b.dataset.v === '1'); }));
  });
}

function openViewer(path) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="viewer"><div class="loading"><div class="spinner"></div></div><button class="circle" aria-label="ปิด">${icon('x', '#fff')}</button></div>`;
  const v = $('.viewer', root);
  $('button', v).addEventListener('click', () => { root.innerHTML = ''; });
  loadImage(path, 1600).then((src) => {
    if (!v.isConnected) return;
    $('.loading', v).outerHTML = `<img src="${src}" alt="รูปเต็ม">`;
  }).catch((e) => toast(e.message, true));
}

function setTabs(active) {
  const bar = $('#tabbar');
  if (!active) { bar.hidden = true; return; }
  const tabs = [['home', '#/', 'bolt', 'บันทึก'], ['insights', '#/insights', 'chart', 'สรุป'], ['map', '#/map', 'map', 'แผนที่'], ['car', '#/car', 'car', 'รถของฉัน']];
  bar.innerHTML = `<div class="tabs">${tabs.map((t) => `<a href="${t[1]}" class="${t[0] === active ? 'on' : ''}">${icon(t[2], t[0] === active ? '#fff' : '#98989F', 21)}${t[3]}</a>`).join('')}</div>
    <a class="fab" href="#/add" aria-label="เพิ่มการชาร์จ">${icon('plus', '#000', 26, 2.5)}</a>`;
  bar.hidden = false;
}

function view(html) {
  const v = $('#view');
  v.innerHTML = html;
  return v;
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

function renderHome() {
  setTabs('home');
  const totals = monthTotals();
  const cur = monthKey(todayISO());
  const t = totals[cur] || { cost: 0, kwh: 0, n: 0 };
  const prev = totals[shiftMonth(cur, -1)];
  const delta = prev && prev.cost > 0 ? ((t.cost - prev.cost) / prev.cost) * 100 : null;
  const spark = [];
  for (let i = 5; i >= 0; i--) spark.push((totals[shiftMonth(cur, -i)] || {}).cost || 0);
  const maxSpark = Math.max.apply(null, spark.concat([1]));

  const q = S.search.trim().toLowerCase();
  const list = sortedItems().filter((i) => !q || [i.app, i.station, i.note, i.date].join(' ').toLowerCase().includes(q));
  const groups = [];
  list.forEach((it) => {
    const k = monthKey(it.date || '0000-00');
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) { g = { key: k, items: [], total: 0 }; groups.push(g); }
    g.items.push(it);
    g.total += it.cost || 0;
  });
  const shown = q ? groups : groups.slice(0, S.homeMonths);

  const listHtml = shown.map((g) => `
    <section class="sec">
      <div class="month-hd"><h2>${g.key === '0000-00' ? 'ไม่ระบุวันที่' : monthLabel(g.key)}</h2><span>${money(g.total)}</span></div>
      <div class="card tight">${g.items.map(itemRow).join('')}</div>
    </section>`).join('');

  view(`<div class="page">
    <div class="hdr">
      <div><div class="sub">${monthLabel(cur)}</div><h1>ค่าชาร์จ</h1></div>
      <div style="display:flex;gap:8px">
        <button class="circle" id="sync-btn" aria-label="ดึงข้อมูลล่าสุด"></button>
        <button class="circle" id="search-btn" aria-label="ค้นหา">${icon('search', '#fff')}</button>
      </div>
    </div>
    <div class="search" id="search-box" ${S.search ? '' : 'hidden'}>
      ${icon('search', '#98989F', 18)}
      <label for="q" class="sr-only">ค้นหา</label>
      <input id="q" placeholder="ค้นหาแอป สถานี หรือหมายเหตุ" value="${esc(S.search)}" autocomplete="off">
    </div>
    <a href="#/insights" class="card">
      <div class="row-between"><div class="label" style="font-size:15px">ใช้ไปเดือนนี้</div><div class="link" style="color:var(--text2)">ดูสรุป ${icon('right', '#98989F', 14, 2.5)}</div></div>
      <div class="row-between" style="align-items:flex-end">
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="big">${bigMoney(t.cost)}</div>
          <div class="meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${delta !== null ? `<span class="tag">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%</span><span>จากเดือนก่อน ·</span>` : ''}
            <span>${t.n} ครั้ง · ${fmt(t.kwh, 1)} kWh</span>
          </div>
        </div>
        <div class="sparks">${spark.map((v, i) => `<i class="${i === 5 ? 'on' : ''}" style="height:${Math.max(4, Math.round((v / maxSpark) * 56))}px"></i>`).join('')}</div>
      </div>
    </a>
    ${!S.items.length ? (S.syncing || S.cfg.url ? '<div class="loading"><div class="spinner"></div>กำลังโหลด…</div>' : '') : ''}
    ${listHtml || (S.items.length ? '<div class="empty">ไม่พบรายการที่ค้นหา</div>' : '')}
    ${!q && groups.length > S.homeMonths ? '<button class="secondary" id="more">ดูเดือนก่อนหน้า</button>' : ''}
  </div>`);

  updateSyncBtn();
  $('#sync-btn').addEventListener('click', () => sync());
  $('#search-btn').addEventListener('click', () => {
    const box = $('#search-box');
    box.hidden = !box.hidden;
    if (!box.hidden) $('#q').focus();
    else if (S.search) { S.search = ''; renderHome(); }
  });
  const qi = $('#q');
  qi.addEventListener('input', () => {
    S.search = qi.value;
    const pos = qi.selectionStart;
    renderHome();
    const n = $('#q');
    n.focus();
    n.setSelectionRange(pos, pos);
  });
  const more = $('#more');
  if (more) more.addEventListener('click', () => { S.homeMonths += 3; renderHome(); });
}

function itemRow(it) {
  const sub = [thaiShort(it.date), it.time, it.kwh ? fmt(it.kwh, 1) + ' kWh' : '', it.station].filter(Boolean).join(' · ');
  return `<a class="item" href="#/item/${encodeURIComponent(it.id)}">
    ${logoHtml(it.app)}
    <div class="body"><div class="txt"><div class="name">${esc(it.app)}</div><div class="meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div></div>
    <div class="amt">${money(it.cost)}</div></div>
  </a>`;
}

/* ------------------------------------------------------------------ */
/* Add / Edit form                                                     */
/* ------------------------------------------------------------------ */

let F = null;

function newForm(id) {
  const src = id ? S.items.find((i) => i.id === id) : null;
  const base = src ? Object.assign({}, src) : { id: '', date: todayISO(), time: nowHM(), app: '', cost: null, odo: null, kwh: null, soc: null, station: '', lat: null, lng: null, receipt: '', carPic: '', note: '' };
  return Object.assign(base, {
    editing: !!src,
    preview: { receipt: null, car: null },
    ocr: { receipt: null, car: null },
    auto: {},
    otherOpen: !!(src && src.app && !appInfo(src.app)),
    saving: false,
    geo: null,
  });
}

function renderForm(id, query) {
  setTabs(null);
  if (!F || F._for !== (id || 'new')) {
    F = newForm(id);
    F._for = id || 'new';
  }
  if (id && !F.editing) {
    view('<div class="page"><div class="empty">ไม่พบรายการ</div></div>');
    return;
  }
  drawForm();
  if (query && query.get('shared') === '1') consumeSharedImage();
}

function drawForm() {
  const freq = appFrequency();
  const apps = APPS.slice().sort((a, b) => (freq[b.name] || 0) - (freq[a.name] || 0));
  const isCustom = F.app && !appInfo(F.app);
  const customs = customAppNames();
  const q = (isCustom ? F.app : '').toLowerCase();
  const sugg = customs.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 8);

  const stations = stationGroups();
  const forApp = stations.filter((s) => s.app === F.app).slice(0, 5);

  view(`<div class="page form">
    <div class="navbar">
      <a class="navbtn" href="${F.editing ? '#/item/' + encodeURIComponent(F.id) : '#/'}" id="cancel">ยกเลิก</a>
      <div class="title">${F.editing ? 'แก้ไขรายการ' : 'เพิ่มการชาร์จ'}</div>
      <div style="width:60px"></div>
    </div>

    <section class="sec">
      <div class="sec-hd"><span class="label">รูปภาพ · อ่านข้อมูลให้อัตโนมัติ</span></div>
      <div class="photos">${photoSlot('receipt', 'ใบเสร็จ')}${photoSlot('car', 'หน้าจอรถ')}</div>
    </section>

    <div class="amount">
      <label for="f-cost" class="label" style="font-weight:600">ค่าใช้จ่าย</label>
      <div class="row"><span class="cur">฿</span><input id="f-cost" inputmode="decimal" placeholder="0.00" value="${F.cost != null ? esc(F.auto.cost ? Number(F.cost).toFixed(2) : F.cost) : ''}" autocomplete="off"></div>
    </div>

    <section class="sec">
      <div class="sec-hd"><span class="label">แอปที่ใช้ชาร์จ</span><span class="aside">เรียงตามที่ใช้บ่อย</span></div>
      <div class="appgrid">
        <div class="grid">
          ${apps.map((a) => appTile(a.name, `<img src="${a.logo}" alt="">`, F.app === a.name)).join('')}
          ${appTile(OTHER, `<div class="mono">${icon('plus', '#fff', 22, 2.2)}</div>`, F.otherOpen || isCustom)}
        </div>
        <div class="other" ${F.otherOpen || isCustom ? '' : 'hidden'}>
          <label for="f-other" class="label" style="font-weight:600">ชื่อแอปหรือผู้ให้บริการ</label>
          <input id="f-other" class="field-input" placeholder="พิมพ์ชื่อ เช่น ปั๊มแถวบ้าน" value="${isCustom ? esc(F.app) : ''}" autocomplete="off">
          ${sugg.length ? `<div class="label" style="font-size:12px">ที่เคยใช้</div><div class="chips" id="sugg">${sugg.map((n) => `<button class="chip" type="button" data-name="${esc(n)}">${icon('clock', '#98989F', 13, 2.4)}${esc(n)}</button>`).join('')}</div>` : ''}
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="sec-hd"><span class="label">สถานีชาร์จ</span></div>
      <div class="group">
        <div class="station-row">
          <div class="pin">${icon('pin', '#30D158', 18)}</div>
          <div style="flex-grow:1;display:flex;flex-direction:column;gap:2px;min-width:0">
            <label for="f-station" class="label" style="font-size:12px">${F.auto.station ? 'อ่านจากใบเสร็จ · แก้ไขได้' : 'ชื่อสถานี หรือย่านที่ไปชาร์จ'}</label>
            <input id="f-station" list="dl-stations" placeholder="เช่น สาขาลาดพร้าว" value="${esc(F.station)}" autocomplete="off">
            <datalist id="dl-stations">${stations.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>
          </div>
        </div>
        <div class="f" style="border-top:0.5px solid var(--sep)">
          <div class="chips">
            <button class="chip" type="button" id="geo">${icon('nav', '#fff', 14, 2.2)}${isNum(F.lat) ? 'อัปเดตตำแหน่ง' : 'ใช้ตำแหน่งปัจจุบัน'}</button>
            ${forApp.map((s, i) => `<button class="chip" type="button" data-st="${i}">${esc(s.name)}</button>`).join('')}
          </div>
          <div class="hint ${isNum(F.lat) ? 'good' : ''}" id="geo-hint">${isNum(F.lat) ? 'บันทึกพิกัดแล้ว' + (F.geo ? ' (±' + Math.round(F.geo) + ' ม.)' : '') : ''}</div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="sec-hd"><span class="label">รายละเอียด</span></div>
      <div class="group">
        <div class="f"><div class="line"><label for="f-date">วันที่</label><input id="f-date" class="box" type="date" value="${esc(F.date)}" required></div></div>
        <div class="f"><div class="line"><label for="f-time">เวลาเริ่มชาร์จ</label><input id="f-time" class="box" type="time" value="${esc(F.time)}"></div>
          <div class="hint" id="peak-hint"></div></div>
        <div class="f"><div class="line"><label for="f-odo">เลขไมล์</label><div class="v"><input id="f-odo" inputmode="numeric" placeholder="0" value="${F.odo != null ? esc(F.odo) : ''}"><span class="u">กม.</span></div></div>
          <div class="hint" id="odo-hint"></div></div>
        <div class="f"><div class="line"><label for="f-soc">แบตก่อนชาร์จ</label><div class="v"><input id="f-soc" inputmode="numeric" placeholder="-" value="${F.soc != null ? esc(F.soc) : ''}" style="width:60px"><span class="u">%</span></div></div></div>
        <div class="f"><div class="line"><label for="f-kwh">พลังงาน (ตามแอป)</label><div class="v"><input id="f-kwh" inputmode="decimal" placeholder="0.00" value="${F.kwh != null ? esc(F.kwh) : ''}" style="width:80px"><span class="u">kWh</span></div></div>
          <div class="hint" id="kwh-hint"></div></div>
        <div class="f"><label for="f-note" class="label">หมายเหตุ</label><textarea id="f-note" rows="2" placeholder="ไม่บังคับ">${esc(F.note)}</textarea></div>
      </div>
    </section>
  </div>
  <div class="savebar"><button class="primary" id="save" ${F.saving ? 'disabled' : ''}>${F.saving ? '<div class="spinner" style="border-top-color:#000;border-color:rgba(0,0,0,0.2)"></div>' : ''}บันทึก</button></div>`);

  bindForm(stations, forApp);
  updateHints();
}

function appTile(name, inner, on) {
  return `<button type="button" class="appbtn ${on ? 'on' : ''}" data-app="${esc(name)}" aria-pressed="${on}">
    <div class="ic">${inner}<div class="chk">${icon('check', '#000', 12, 4)}</div></div>
    <div class="nm">${esc(name)}</div></button>`;
}

function photoSlot(kind, title) {
  const path = kind === 'car' ? F.carPic : F.receipt;
  const prev = F.preview[kind];
  const o = F.ocr[kind];
  let status = kind === 'car' ? 'แตะเพื่อถ่าย/เลือกรูปหน้าจอเลขไมล์' : 'แตะเพื่อถ่าย/เลือกรูปใบเสร็จ';
  let mark = icon('camera', '#98989F', 16);
  if (o && o.status === 'busy') { status = 'กำลังอัปโหลดและอ่านข้อความ…'; mark = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>'; }
  else if (o && o.status === 'error') { status = o.msg; mark = icon('x', '#FF6961', 16, 3); }
  else if (o && o.status === 'done') { status = o.summary || 'อ่านข้อมูลไม่ได้ กรอกเองได้'; mark = icon('check', o.summary ? '#30D158' : '#FFB340', 16, 3); }
  else if (path) { status = 'มีรูปแล้ว · แตะเพื่อเปลี่ยน'; mark = icon('check', '#30D158', 16, 3); }
  const thumb = prev ? `<img src="${prev}" alt="">` : (path ? `<img data-path="${esc(path)}" alt="">` : icon('camera', '#636366', 34, 1.6));
  return `<label class="photo">
    <div class="thumb">${thumb}</div>
    <div class="t">${mark}${title}</div>
    <div class="s">${esc(status)}</div>
    <input type="file" accept="image/*" data-kind="${kind}" aria-label="เลือกรูป${title}">
    ${prev || path ? `<button type="button" class="rm" data-rm="${kind}" aria-label="ลบรูป${title}">${icon('x', '#fff', 14, 2.5)}</button>` : ''}
  </label>`;
}

function bindForm(stations, forApp) {
  const byId = (i) => document.getElementById(i);
  const bindNum = (id, key) => byId(id).addEventListener('input', (e) => { F[key] = num(e.target.value); delete F.auto[key]; updateHints(); });
  bindNum('f-cost', 'cost');
  bindNum('f-odo', 'odo');
  bindNum('f-soc', 'soc');
  bindNum('f-kwh', 'kwh');
  byId('f-date').addEventListener('input', (e) => { F.date = e.target.value; updateHints(); });
  byId('f-time').addEventListener('input', (e) => { F.time = e.target.value; updateHints(); });
  byId('f-station').addEventListener('input', (e) => { F.station = e.target.value; delete F.auto.station; });
  byId('f-note').addEventListener('input', (e) => { F.note = e.target.value; });

  $$('.appbtn').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.app;
    if (name === OTHER) {
      F.otherOpen = true;
      if (appInfo(F.app)) F.app = '';
      drawForm();
      const o = byId('f-other');
      if (o) o.focus();
    } else {
      F.app = name;
      F.otherOpen = false;
      delete F.auto.app;
      drawForm();
    }
  }));
  const other = byId('f-other');
  if (other) other.addEventListener('input', (e) => {
    F.app = e.target.value;
    // Update suggestion visibility without full re-render (keeps keyboard open).
    const q = e.target.value.trim().toLowerCase();
    $$('#sugg .chip').forEach((c) => { c.hidden = q && !c.dataset.name.toLowerCase().includes(q); });
  });
  $$('#sugg .chip').forEach((c) => c.addEventListener('click', () => { F.app = c.dataset.name; drawForm(); }));

  $$('[data-st]').forEach((c) => c.addEventListener('click', () => {
    const s = forApp[Number(c.dataset.st)];
    F.station = s.name;
    if (isNum(s.lat)) { F.lat = s.lat; F.lng = s.lng; F.geo = null; }
    drawForm();
  }));
  byId('geo').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('อุปกรณ์นี้ไม่รองรับตำแหน่ง', true); return; }
    byId('geo-hint').textContent = 'กำลังหาตำแหน่ง…';
    navigator.geolocation.getCurrentPosition((pos) => {
      F.lat = +pos.coords.latitude.toFixed(6);
      F.lng = +pos.coords.longitude.toFixed(6);
      F.geo = pos.coords.accuracy;
      drawForm();
    }, (err) => {
      byId('geo-hint').textContent = '';
      toast(err.code === 1 ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง' : 'หาตำแหน่งไม่ได้', true);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });

  $$('.photo input[type=file]').forEach((inp) => inp.addEventListener('change', () => {
    const file = inp.files && inp.files[0];
    if (file) handlePhoto(inp.dataset.kind, file);
  }));
  $$('[data-rm]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const k = b.dataset.rm;
    F.preview[k] = null;
    F.ocr[k] = null;
    if (k === 'car') F.carPic = ''; else F.receipt = '';
    drawForm();
  }));
  $$('.photo img[data-path]').forEach((img) => {
    loadImage(img.dataset.path, 400).then((src) => { img.src = src; }).catch(() => { img.replaceWith(document.createTextNode('โหลดรูปไม่ได้')); });
  });

  byId('save').addEventListener('click', saveForm);
}

function updateHints() {
  const peak = peakOf(F.date, F.time);
  const ph = $('#peak-hint');
  if (ph) {
    const dow = F.date ? parseISO(F.date).getDay() : -1;
    const why = peak === 'off' && (dow === 0 || dow === 6) ? 'วันหยุดสุดสัปดาห์ คิดเรต Off-Peak ทั้งวัน'
      : peak === 'off' ? 'นอกช่วง จ.–ศ. 09:00–22:00' : peak === 'on' ? 'จ.–ศ. 09:00–22:00' : '';
    ph.innerHTML = peak ? `<span style="display:flex;gap:6px;align-items:center">${peakBadge(peak)}<span>${why}</span></span>` : '';
  }
  const oh = $('#odo-hint');
  if (oh) {
    const prev = F.odo != null ? prevOdo({ odo: F.odo }) : null;
    const src = F.auto.odo ? 'จากรูปหน้าจอรถ · ' : '';
    oh.className = 'hint' + (prev != null ? ' good' : '');
    oh.textContent = prev != null ? src + 'วิ่งไป ' + fmt(F.odo - prev, 0) + ' กม. จากครั้งก่อน (' + fmt(prev, 0) + ')' : (src ? src.slice(0, -3) : '');
  }
  const kh = $('#kwh-hint');
  if (kh) {
    const avg = rateStats(S.items.filter((i) => i.id !== F.id)).rate;
    if (F.kwh > 0 && F.cost > 0) {
      const r = F.cost / F.kwh;
      let cmp = '';
      if (avg) cmp = r > avg * 1.03 ? ' · แพงกว่าค่าเฉลี่ยของคุณ (฿' + fmt(avg) + ')' : r < avg * 0.97 ? ' · ถูกกว่าค่าเฉลี่ยของคุณ (฿' + fmt(avg) + ')' : ' · ใกล้เคียงค่าเฉลี่ย';
      kh.textContent = '฿' + fmt(r) + ' ต่อ kWh' + cmp;
    } else kh.textContent = '';
  }
}

async function compressImage(file, max, quality) {
  let src;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    src = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('เปิดรูปนี้ไม่ได้'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = src.width, h = src.height;
  const s = Math.min(1, (max || 1600) / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality || 0.82);
}

function applyParsed(kind, p) {
  const setIf = (key, v) => {
    if (v == null || v === '') return;
    const empty = F[key] == null || F[key] === '' || F.auto[key];
    if (empty) { F[key] = v; F.auto[key] = true; }
  };
  if (kind === 'receipt') {
    setIf('cost', p.cost);
    setIf('kwh', p.kwh);
    setIf('time', p.time);
    setIf('station', p.station);
    if (p.date) { F.date = p.date; F.auto.date = true; }
    if (p.time) { F.time = p.time; F.auto.time = true; }
    if (p.app && (!F.app || F.auto.app)) { F.app = p.app; F.auto.app = true; F.otherOpen = false; }
  } else {
    setIf('odo', p.odo);
    setIf('soc', p.soc);
  }
}

function summarize(kind, p) {
  if (kind === 'receipt') {
    return [p.cost != null ? money(p.cost) : '', p.app, p.kwh != null ? fmt(p.kwh, 1) + ' kWh' : '', p.time, p.station ? 'สถานี' : ''].filter(Boolean).join(' · ');
  }
  return [p.odo != null ? 'ไมล์ ' + fmt(p.odo, 0) + ' กม.' : '', p.soc != null ? 'แบต ' + p.soc + '%' : '', p.range != null ? 'วิ่งได้อีก ' + p.range + ' กม.' : ''].filter(Boolean).join(' · ');
}

async function handlePhoto(kind, file) {
  const form = F;
  try {
    form.preview[kind] = await compressImage(file, 1600, 0.82);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  form.ocr[kind] = { status: 'busy' };
  if (F === form) drawForm();
  try {
    const r = await api('upload', { kind: kind, dataUrl: form.preview[kind] });
    if (kind === 'car') form.carPic = r.path; else form.receipt = r.path;
    const p = kind === 'car' ? EVParse.parseCar(r.text) : EVParse.parseReceipt(r.text, APPS);
    applyParsed(kind, p);
    form.ocr[kind] = { status: 'done', summary: summarize(kind, p), text: r.text, err: r.ocrError };
    if (r.ocrError) form.ocr[kind].summary = 'อัปโหลดแล้ว แต่ OCR ใช้ไม่ได้ (' + r.ocrError + ')';
  } catch (err) {
    form.ocr[kind] = { status: 'error', msg: 'อัปโหลดไม่สำเร็จ: ' + err.message };
  }
  if (F === form && /^#\/(add|edit)/.test(location.hash)) drawForm();
}

async function consumeSharedImage() {
  try {
    const cache = await caches.open('share-inbox');
    const res = await cache.match('shared-image');
    if (!res) return;
    const blob = await res.blob();
    await cache.delete('shared-image');
    history.replaceState(null, '', location.pathname + '#/add');
    handlePhoto('receipt', blob);
  } catch (err) {
    console.warn('shared image unavailable', err);
  }
}

async function saveForm() {
  if (F.saving) return;
  const busy = ['receipt', 'car'].some((k) => F.ocr[k] && F.ocr[k].status === 'busy');
  if (busy) { toast('รอให้อัปโหลดรูปเสร็จก่อน', true); return; }
  const app = String(F.app || '').trim();
  if (!F.date) { toast('กรุณาใส่วันที่', true); return; }
  if (!app) { toast('กรุณาเลือกแอปที่ใช้ชาร์จ', true); return; }
  if (!(F.cost >= 0) || F.cost === null) { toast('กรุณาใส่ค่าใช้จ่าย', true); $('#f-cost').focus(); return; }
  const item = {
    id: F.id, date: F.date, time: F.time || '', app: canonicalApp(app), cost: F.cost, odo: F.odo, kwh: F.kwh, soc: F.soc,
    station: (F.station || '').trim(), lat: F.lat, lng: F.lng, receipt: F.receipt, carPic: F.carPic, note: (F.note || '').trim(),
  };
  F.saving = true;
  drawForm();
  try {
    const r = await api('save', { item: item });
    const saved = normalizeItem(r.item);
    const i = S.items.findIndex((x) => x.id === saved.id);
    if (i >= 0) S.items[i] = saved; else S.items.push(saved);
    persist();
    const wasEdit = F.editing;
    F = null;
    toast(wasEdit ? 'แก้ไขแล้ว' : 'บันทึกแล้ว');
    location.hash = wasEdit ? '#/item/' + encodeURIComponent(saved.id) : '#/';
  } catch (err) {
    F.saving = false;
    drawForm();
    toast('บันทึกไม่สำเร็จ: ' + err.message, true);
  }
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

function renderDetail(id) {
  setTabs(null);
  const it = S.items.find((i) => i.id === id);
  if (!it) {
    view(`<div class="page"><div class="navbar"><a class="navbtn" href="#/">${icon('left', '#fff')}</a><div></div><div></div></div><div class="empty">ไม่พบรายการ</div></div>`);
    return;
  }
  const prev = prevOdo(it);
  const trip = prev != null ? it.odo - prev : null;
  const rate = it.kwh > 0 ? it.cost / it.kwh : null;
  const peak = peakOf(it.date, it.time);
  const mapUrl = isNum(it.lat) ? `https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lng}` : '';
  const kv = [
    it.station ? ['สถานี', esc(it.station) + (mapUrl ? ` <a class="link" href="${mapUrl}" target="_blank" rel="noopener">แผนที่</a>` : '')] : null,
    isNum(it.odo) ? ['เลขไมล์', fmt(it.odo, 0) + ' กม.'] : null,
    trip != null ? ['วิ่งไปจากครั้งก่อน', fmt(trip, 0) + ' กม.'] : null,
    isNum(it.soc) ? ['แบตก่อนชาร์จ', it.soc + '%'] : null,
    it.note ? ['หมายเหตุ', esc(it.note)] : null,
  ].filter(Boolean);

  view(`<div class="page">
    <div class="navbar">
      <a class="circle" href="#/" aria-label="กลับ">${icon('left', '#fff', 20, 2.5)}</a>
      <div></div>
      <a class="pill-btn" href="#/edit/${encodeURIComponent(it.id)}">แก้ไข</a>
    </div>
    <div class="hero">
      ${logoHtml(it.app)}
      <div class="app">${esc(it.app)}</div>
      <div class="big">${bigMoney(it.cost)}</div>
      <div class="meta" style="font-size:15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">${thaiLong(it.date)}${it.time ? ' · ' + esc(it.time) : ''} ${peakBadge(peak)}</div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="k">พลังงาน</div><div class="n">${it.kwh != null ? fmt(it.kwh) : '–'}<small> kWh</small></div></div>
      <div class="tile"><div class="k">ต่อหน่วย</div><div class="n">${rate != null ? fmt(rate) : '–'}<small> ฿/kWh</small></div></div>
      <div class="tile"><div class="k">วิ่งไป</div><div class="n">${trip != null ? fmt(trip, 0) : '–'}<small> กม.</small></div></div>
    </div>
    ${kv.length ? `<div class="group">${kv.map((r) => `<div class="kv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>` : ''}
    ${it.receipt || it.carPic ? `<div class="pics">
      ${it.receipt ? picTile(it.receipt, 'ใบเสร็จ') : ''}${it.carPic ? picTile(it.carPic, 'หน้าจอรถ') : ''}
    </div>` : ''}
    <button class="secondary danger" id="del">ลบรายการ</button>
  </div>`);

  $$('.pic').forEach((b) => {
    const img = $('img', b);
    loadImage(b.dataset.path, 500).then((src) => { img.src = src; img.hidden = false; $('.spinner', b) && $('.spinner', b).remove(); })
      .catch(() => { const sp = $('.spinner', b); if (sp) sp.outerHTML = '<span class="meta">โหลดรูปไม่ได้</span>'; });
    b.addEventListener('click', () => openViewer(b.dataset.path));
  });
  $('#del').addEventListener('click', async () => {
    const ok = await confirmBox('ลบรายการนี้?', it.app + ' ' + money(it.cost) + ' วันที่ ' + thaiShort(it.date) + ' จะถูกลบออกจากชีท', 'ลบ', true);
    if (!ok) return;
    try {
      await api('remove', { id: it.id });
      S.items = S.items.filter((x) => x.id !== it.id);
      persist();
      toast('ลบแล้ว');
      location.hash = '#/';
    } catch (err) {
      toast('ลบไม่สำเร็จ: ' + err.message, true);
    }
  });
}

function picTile(path, title) {
  return `<button class="pic" data-path="${esc(path)}" aria-label="ดู${title}เต็มจอ">
    <div class="thumb"><div class="spinner"></div><img alt="" hidden></div>
    <div class="t">${title}</div></button>`;
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

function renderInsights() {
  setTabs('insights');
  const I = S.insights;
  const totals = monthTotals();
  const keys = Object.keys(totals).sort();
  if (!I.key) I.key = keys.includes(monthKey(todayISO())) ? monthKey(todayISO()) : (keys[keys.length - 1] || monthKey(todayISO()));

  let title, total, meta, bars, periodItems;
  if (I.mode === 'month') {
    const t = totals[I.key] || { cost: 0, kwh: 0, n: 0 };
    const p = totals[shiftMonth(I.key, -1)];
    const d = p && p.cost ? ((t.cost - p.cost) / p.cost) * 100 : null;
    title = monthLabel(I.key);
    total = t.cost;
    meta = `${t.n} ครั้ง · ${fmt(t.kwh, 1)} kWh${d !== null ? ` · ${d >= 0 ? '+' : ''}${d.toFixed(1)}% จากเดือนก่อน` : ''}`;
    bars = [];
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonth(I.key, -i);
      bars.push({ key: k, label: TH_MONTH_SHORT[Number(k.slice(5)) - 1], v: (totals[k] || {}).cost || 0, on: k === I.key });
    }
    periodItems = S.items.filter((i) => monthKey(i.date) === I.key);
  } else {
    const y = I.key.slice(0, 4);
    bars = [];
    total = 0;
    let n = 0, kwh = 0;
    for (let m = 1; m <= 12; m++) {
      const k = y + '-' + pad(m);
      const t = totals[k] || { cost: 0, n: 0, kwh: 0 };
      total += t.cost; n += t.n; kwh += t.kwh;
      bars.push({ key: k, label: TH_MONTH_SHORT[m - 1].replace('.', '').slice(0, 3), v: t.cost, on: k === I.key });
    }
    title = 'ปี ' + y;
    meta = `${n} ครั้ง · ${fmt(kwh, 1)} kWh`;
    periodItems = S.items.filter((i) => String(i.date).slice(0, 4) === y);
  }
  const maxBar = Math.max.apply(null, bars.map((b) => b.v).concat([1]));
  const pr = rateStats(periodItems);
  const cons = consumption();

  // App ranking (all time)
  const byApp = {};
  S.items.forEach((i) => { (byApp[i.app] = byApp[i.app] || []).push(i); });
  const rank = Object.keys(byApp).map((a) => Object.assign({ app: a }, rateStats(byApp[a]))).filter((r) => r.rate != null).sort((a, b) => a.rate - b.rate);
  const maxRate = rank.length ? rank[rank.length - 1].rate : 1;
  const shownRank = I.allApps ? rank : rank.slice(0, 6);

  // Peak split (all time, needs time)
  const on = rateStats(S.items.filter((i) => peakOf(i.date, i.time) === 'on'));
  const off = rateStats(S.items.filter((i) => peakOf(i.date, i.time) === 'off'));
  const peakKwh = on.kwh + off.kwh;

  const stations = stationGroups().filter((s) => s.rate != null).sort((a, b) => a.rate - b.rate).slice(0, 5);

  view(`<div class="page">
    <div class="hdr"><h1>สรุป</h1></div>
    <div class="seg" role="group" aria-label="ช่วงเวลา">
      <button class="${I.mode === 'month' ? 'on' : ''}" data-mode="month" aria-pressed="${I.mode === 'month'}">รายเดือน</button>
      <button class="${I.mode === 'year' ? 'on' : ''}" data-mode="year" aria-pressed="${I.mode === 'year'}">รายปี</button>
    </div>
    <div class="card">
      <div class="monthnav">
        <button class="circle" id="prev" aria-label="ก่อนหน้า" style="background:var(--card2)">${icon('left', '#fff', 18, 2.5)}</button>
        <div style="font-size:15px;font-weight:600">${title}</div>
        <button class="circle" id="next" aria-label="ถัดไป" style="background:var(--card2)">${icon('right', '#fff', 18, 2.5)}</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="big">${bigMoney(total)}</div>
        <div class="meta">${meta}</div>
      </div>
      <div class="bars">${bars.map((b) => `<button data-key="${b.key}" class="${b.on ? 'on' : ''}" aria-label="${monthLabel(b.key)} ${money(b.v)}">
        <span class="v">${b.v ? (b.v >= 1000 ? '฿' + (b.v / 1000).toFixed(1) + 'k' : '฿' + Math.round(b.v)) : ''}</span>
        <span class="b" style="height:${Math.round((b.v / maxBar) * 130)}px"></span></button>`).join('')}</div>
      <div class="bar-labels">${bars.map((b) => `<span>${b.label}</span>`).join('')}</div>
    </div>

    <section class="sec">
      <div class="tiles two">
        <div class="tile"><div class="k">อัตราสิ้นเปลือง</div><div class="n">${cons ? fmt(cons.per100, 1) : '–'}<small> kWh/100กม.</small></div></div>
        <div class="tile"><div class="k">ต้นทุนต่อกิโล</div><div class="n">${cons ? fmt(cons.perKm) : '–'}<small> ฿/กม.</small></div></div>
        <div class="tile"><div class="k">ราคาเฉลี่ย</div><div class="n">${pr.rate != null ? fmt(pr.rate) : '–'}<small> ฿/kWh</small></div></div>
        <div class="tile"><div class="k">เฉลี่ยต่อครั้ง</div><div class="n">${periodItems.length ? money(periodItems.reduce((a, i) => a + (i.cost || 0), 0) / periodItems.length) : '–'}</div></div>
      </div>
      <div class="meta" style="font-size:12px;padding:0 4px">${cons ? `สิ้นเปลืองและต้นทุนต่อกิโล คิดจากช่วงที่มีเลขไมล์ (${thaiShort(cons.from)} – ${thaiShort(cons.to)}) ${fmt(cons.dist, 0)} กม. · kWh ตามแอป รวม loss ที่ตู้` : 'ต้องมีเลขไมล์อย่างน้อย 2 รายการเพื่อคำนวณอัตราสิ้นเปลือง'} · ราคาเฉลี่ยและต่อครั้งเป็นของ${I.mode === 'month' ? 'เดือน' : 'ปี'}ที่เลือก</div>
    </section>

    <div class="card">
      <div class="row-between"><h2>แอปไหนคุ้มสุด</h2><span class="meta">฿ ต่อ kWh · ทั้งหมด</span></div>
      ${shownRank.length ? shownRank.map((r, i) => `<div class="rank">
        <div class="no">${i + 1}</div>${logoHtml(r.app)}
        <div class="main">
          <div class="row-between" style="font-size:15px;font-weight:600"><span>${esc(r.app)}</span><span style="color:${i === 0 ? 'var(--green)' : '#fff'}">฿${fmt(r.rate)}</span></div>
          <div class="meter"><i class="${i === 0 ? 'best' : ''}" style="width:${Math.round((r.rate / maxRate) * 100)}%"></i></div>
          <div class="meta" style="font-size:12px">${r.n} ครั้ง · ${fmt(r.kwh, 0)} kWh · ${money(r.cost)}</div>
        </div></div>`).join('') : '<div class="empty">ยังไม่มีข้อมูล kWh</div>'}
      ${rank.length > 6 ? `<button class="secondary" id="allapps" style="background:var(--card2);height:44px;font-size:15px;font-weight:600">${I.allApps ? 'แสดงน้อยลง' : 'ดูทั้งหมด ' + rank.length + ' แอป'}</button>` : ''}
    </div>

    <div class="card">
      <h2>On-Peak vs Off-Peak</h2>
      ${peakKwh > 0 ? `
        <div class="tiles two">
          <div class="peakbox"><span class="badge off" style="align-self:flex-start">OFF-PEAK</span><div class="n">${off.rate != null ? fmt(off.rate) : '–'}<small> ฿/kWh</small></div><div class="meta" style="font-size:12px">${off.n} ครั้ง · ${Math.round((off.kwh / peakKwh) * 100)}% ของ kWh</div></div>
          <div class="peakbox"><span class="badge on" style="align-self:flex-start">ON-PEAK</span><div class="n">${on.rate != null ? fmt(on.rate) : '–'}<small> ฿/kWh</small></div><div class="meta" style="font-size:12px">${on.n} ครั้ง · ${Math.round((on.kwh / peakKwh) * 100)}% ของ kWh</div></div>
        </div>
        <div class="split"><i style="width:${(off.kwh / peakKwh) * 100}%;background:var(--cyan)"></i><i style="flex-grow:1;background:var(--orange)"></i></div>
        <div class="meta" style="line-height:1.5">${on.rate && off.rate && on.rate > off.rate ? `ถ้าย้ายไปชาร์จช่วง Off-Peak ทั้งหมด จะประหยัดได้ประมาณ ${money((on.rate - off.rate) * on.kwh)} · ` : ''}On-Peak = จ.–ศ. 09:00–22:00 (ยังไม่หักวันหยุดนักขัตฤกษ์)</div>`
    : '<div class="empty">ยังไม่มีข้อมูลเวลาชาร์จ<br>จะเริ่มแยกให้เมื่อบันทึกรายการใหม่ที่มีเวลา</div>'}
    </div>

    <a class="card" href="#/map">
      <div class="row-between"><h2>สถานีที่คุ้มสุด</h2>${icon('right', '#98989F', 18, 2.5)}</div>
      ${stations.length ? stations.map((s) => `<div class="rank">${logoHtml(s.app, 'logo', 32)}
        <div class="main" style="gap:1px"><div style="font-size:15px;font-weight:600">${esc(s.name)}</div><div class="meta" style="font-size:12px">${s.visits} ครั้ง · ล่าสุด ${thaiShort(s.last)}</div></div>
        <div style="font-size:15px;font-weight:700">฿${fmt(s.rate)}</div></div>`).join('')
    : '<div class="empty">ยังไม่มีข้อมูลสถานี<br>ใส่ชื่อสถานีตอนบันทึก แล้วจะเห็นการเปรียบเทียบตรงนี้</div>'}
    </a>
  </div>`);

  $$('.seg button').forEach((b) => b.addEventListener('click', () => { I.mode = b.dataset.mode; renderInsights(); }));
  $('#prev').addEventListener('click', () => { I.key = I.mode === 'month' ? shiftMonth(I.key, -1) : shiftMonth(I.key, -12); renderInsights(); });
  $('#next').addEventListener('click', () => { I.key = I.mode === 'month' ? shiftMonth(I.key, 1) : shiftMonth(I.key, 12); renderInsights(); });
  $$('.bars button').forEach((b) => b.addEventListener('click', () => { I.key = b.dataset.key; I.mode = 'month'; renderInsights(); }));
  const all = $('#allapps');
  if (all) all.addEventListener('click', () => { I.allApps = !I.allApps; renderInsights(); });
}

/* ------------------------------------------------------------------ */
/* Map (Leaflet + OpenStreetMap/CARTO tiles)                           */
/* ------------------------------------------------------------------ */

let leafletReady = null;
let mapObj = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'vendor/leaflet/leaflet.js';
    js.onload = () => resolve();
    js.onerror = () => { leafletReady = null; reject(new Error('โหลดแผนที่ไม่ได้')); };
    document.head.appendChild(js);
  });
  return leafletReady;
}

function renderMap() {
  setTabs('map');
  const all = stationGroups().filter((s) => isNum(s.lat));
  view(`<div class="mapwrap">
    <div id="map"></div>
    <div class="map-top">
      <div class="search">${icon('search', '#98989F', 18, 2.2)}<label for="mq" class="sr-only">ค้นหาสถานี</label><input id="mq" placeholder="ค้นหาสถานีที่เคยไป" autocomplete="off"></div>
      <div class="chips">
        <button class="chip ${S.mapFilter === 'all' ? 'on' : ''}" data-f="all">ทั้งหมด</button>
        <button class="chip ${S.mapFilter === 'cheap' ? 'on' : ''}" data-f="cheap">ถูกสุด</button>
        <button class="chip ${S.mapFilter === 'freq' ? 'on' : ''}" data-f="freq">ไปบ่อย</button>
      </div>
    </div>
    <div class="sheet" id="sheet" hidden></div>
  </div>`);

  const sheet = $('#sheet');
  if (!all.length) {
    sheet.hidden = false;
    sheet.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start">${icon('pin', '#30D158', 28)}
      <div style="display:flex;flex-direction:column;gap:4px"><b>ยังไม่มีสถานีที่มีพิกัด</b>
      <span class="meta" style="line-height:1.5">ตอนบันทึกการชาร์จ ใส่ชื่อสถานีแล้วกด "ใช้ตำแหน่งปัจจุบัน" สถานีจะขึ้นบนแผนที่นี้</span></div></div>`;
  }

  loadLeaflet().then(() => {
    if (!$('#map')) return;
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapObj = L.map('map', { zoomControl: false, attributionControl: false }).setView([13.7563, 100.5018], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(mapObj);
    L.control.attribution({ position: 'topright', prefix: false }).addTo(mapObj);
    if (!all.length) return;

    const markers = all.map((s) => {
      const a = appInfo(s.app);
      const inner = a ? `<img src="${a.logo}" alt="">` : `<div class="mono" style="width:100%;height:100%">${esc(s.app.slice(0, 2))}</div>`;
      const mk = L.marker([s.lat, s.lng], { icon: L.divIcon({ html: `<div class="mk">${inner}</div>`, iconSize: [40, 40], iconAnchor: [20, 20], className: '' }) }).addTo(mapObj);
      mk.on('click', () => select(s));
      return { s, mk };
    });
    mapObj.fitBounds(L.latLngBounds(all.map((s) => [s.lat, s.lng])), { paddingTopLeft: [40, 150], paddingBottomRight: [40, 340], maxZoom: 15 });

    function select(s, fly) {
      markers.forEach((m) => {
        const el = m.mk.getElement() && m.mk.getElement().querySelector('.mk');
        if (el) el.classList.toggle('on', m.s === s);
        if (m.s === s) m.mk.setZIndexOffset(1000); else m.mk.setZIndexOffset(0);
      });
      sheet.hidden = false;
      if (fly) mapObj.flyTo([s.lat, s.lng], Math.max(mapObj.getZoom(), 14), { duration: 0.6 });
      sheet.innerHTML = `<div style="display:flex;gap:12px;align-items:center">${logoHtml(s.app, 'logo', 48)}
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><b style="font-size:17px">${esc(s.name)}</b><span class="meta">${esc(s.app)} · ล่าสุด ${thaiShort(s.last)}</span></div></div>
        <div class="mini"><div><span>ไปมาแล้ว</span><b>${s.visits} ครั้ง</b></div><div><span>เฉลี่ย</span><b>${s.rate != null ? '฿' + fmt(s.rate) : '–'}</b></div><div><span>ใช้ไปรวม</span><b>${money(s.spent).replace(/\.\d\d$/, '')}</b></div></div>
        <div class="btnrow"><a class="btn-w" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}" target="_blank" rel="noopener">นำทาง</a>
        <button class="btn-d" id="hist">ประวัติที่นี่</button></div>`;
      $('#hist').addEventListener('click', () => { S.search = s.name; location.hash = '#/'; });
    }
    const pick = () => {
      let list = all.slice();
      if (S.mapFilter === 'cheap') list = list.filter((s) => s.rate != null).sort((a, b) => a.rate - b.rate);
      if (S.mapFilter === 'freq') list.sort((a, b) => b.visits - a.visits);
      if (list[0]) select(list[0], S.mapFilter !== 'all');
    };
    pick();
    $$('.map-top .chip').forEach((c) => c.addEventListener('click', () => {
      S.mapFilter = c.dataset.f;
      $$('.map-top .chip').forEach((x) => x.classList.toggle('on', x === c));
      pick();
    }));
    $('#mq').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      markers.forEach((m) => {
        const show = !q || m.s.name.toLowerCase().includes(q) || m.s.app.toLowerCase().includes(q);
        if (show && !mapObj.hasLayer(m.mk)) m.mk.addTo(mapObj);
        if (!show && mapObj.hasLayer(m.mk)) m.mk.remove();
      });
      const first = markers.find((m) => mapObj.hasLayer(m.mk));
      if (q && first) select(first.s, true);
    });
  }).catch((err) => toast(err.message, true));
}

/* ------------------------------------------------------------------ */
/* Car                                                                 */
/* ------------------------------------------------------------------ */

const PLUGS = ['Type 2 (AC)', 'CCS2 (DC)', 'CHAdeMO', 'GB/T'];

function renderCar() {
  setTabs('car');
  const c = Object.assign({ name: '', year: '', capacity: '', plate: '', plugs: [], photo: '', serviceKm: '', taxDate: '', insDate: '' }, S.car);
  const cons = consumption();
  const lastOdo = S.items.reduce((m, i) => (isNum(i.odo) && i.odo > m ? i.odo : m), 0);
  const totalCost = S.items.reduce((a, i) => a + (i.cost || 0), 0);
  const totalKwh = S.items.reduce((a, i) => a + (i.kwh || 0), 0);
  const cap = num(c.capacity);
  const daysTo = (iso) => (iso ? Math.ceil((parseISO(iso) - parseISO(todayISO())) / 86400000) : null);
  const dueHint = (d) => (d == null ? '' : d < 0 ? `<span class="hint" style="color:var(--red)">เลยกำหนด ${-d} วัน</span>` : `<span class="hint ${d <= 30 ? '' : 'good'}" style="${d <= 30 ? 'color:var(--orange)' : ''}">อีก ${d} วัน</span>`);
  const svcLeft = num(c.serviceKm) && lastOdo ? num(c.serviceKm) - lastOdo : null;

  view(`<div class="page">
    <div class="hdr"><h1>รถของฉัน</h1><a class="circle" href="#/settings" aria-label="ตั้งค่า">${icon('gear', '#fff')}</a></div>
    <div class="carhero">
      <label class="img">${c.photo ? `<img data-path="${esc(c.photo)}" alt="รูปรถ">` : ''}${icon('car', '#636366', 56, 1.4)}<span>${c.photo ? '' : 'แตะเพื่อเพิ่มรูปรถ'}</span>
        <input type="file" accept="image/*" id="car-photo" aria-label="เลือกรูปรถ"></label>
      <div class="info"><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="nm">${esc(c.name || 'ยังไม่ได้ตั้งชื่อรถ')}</div><div class="meta" style="font-size:15px">${esc(c.plate || '')}</div></div>
        ${lastOdo ? `<div class="odo-badge">${fmt(lastOdo, 0)} กม.</div>` : ''}</div>
    </div>
    <div class="tiles two">
      <div class="tile"><div class="k">อัตราสิ้นเปลือง</div><div class="n">${cons ? fmt(cons.per100, 1) : '–'}<small> kWh/100กม.</small></div></div>
      <div class="tile"><div class="k">ต้นทุนเฉลี่ย</div><div class="n">${cons ? fmt(cons.perKm) : '–'}<small> ฿/กม.</small></div></div>
      <div class="tile"><div class="k">ค่าชาร์จทั้งหมด</div><div class="n">${money(totalCost).replace(/\.\d\d$/, '')}</div></div>
      <div class="tile"><div class="k">พลังงานทั้งหมด</div><div class="n">${fmt(totalKwh, 0)}<small> kWh</small></div></div>
    </div>

    <section class="sec">
      <div class="sec-hd"><span class="label">ข้อมูลรถ</span></div>
      <div class="group">
        <div class="f"><div class="line"><label for="c-name">ยี่ห้อ / รุ่น</label><div class="v"><input id="c-name" data-k="name" value="${esc(c.name)}" placeholder="เช่น ยี่ห้อ รุ่น" style="width:180px;font-weight:500"></div></div></div>
        <div class="f"><div class="line"><label for="c-year">ปีรถ</label><div class="v"><input id="c-year" data-k="year" inputmode="numeric" value="${esc(c.year)}" placeholder="ค.ศ." style="font-weight:500"></div></div></div>
        <div class="f"><div class="line"><label for="c-cap">ความจุแบตเตอรี่</label><div class="v"><input id="c-cap" data-k="capacity" inputmode="decimal" value="${esc(c.capacity)}" placeholder="0.0" style="width:70px;font-weight:500"><span class="u">kWh</span></div></div>
          ${cap && cons ? `<div class="hint good">ชาร์จเต็มวิ่งได้ประมาณ ${fmt((cap / cons.per100) * 100, 0)} กม. (จากอัตราสิ้นเปลืองจริง)</div>` : ''}</div>
        <div class="f"><div class="line"><label for="c-plate">ทะเบียน</label><div class="v"><input id="c-plate" data-k="plate" value="${esc(c.plate)}" placeholder="กข 1234" style="width:150px;font-weight:500"></div></div></div>
      </div>
    </section>

    <section class="sec">
      <div class="sec-hd"><span class="label">หัวชาร์จที่รองรับ</span></div>
      <div class="chips">${PLUGS.map((p) => `<button class="chip big ${c.plugs.includes(p) ? 'on' : ''}" data-plug="${esc(p)}" aria-pressed="${c.plugs.includes(p)}" style="${c.plugs.includes(p) ? '' : 'background:var(--card)'}">${esc(p)}</button>`).join('')}</div>
    </section>

    <section class="sec">
      <div class="sec-hd"><span class="label">แจ้งเตือน</span></div>
      <div class="group">
        <div class="f"><div class="line"><label for="c-svc" style="display:flex;gap:12px;align-items:center"><span class="rem-ic" style="background:#0A84FF">${icon('bell', '#fff', 16, 2.2)}</span>เช็กระยะที่</label>
          <div class="v"><input id="c-svc" data-k="serviceKm" inputmode="numeric" value="${esc(c.serviceKm)}" placeholder="0" style="width:90px;font-weight:500"><span class="u">กม.</span></div></div>
          ${svcLeft != null ? `<span class="hint" style="${svcLeft < 0 ? 'color:var(--red)' : svcLeft <= 1000 ? 'color:var(--orange)' : ''}">${svcLeft < 0 ? 'เลยกำหนด ' + fmt(-svcLeft, 0) + ' กม.' : 'อีก ' + fmt(svcLeft, 0) + ' กม.'}</span>` : ''}</div>
        <div class="f"><div class="line"><label for="c-tax" style="display:flex;gap:12px;align-items:center"><span class="rem-ic" style="background:#FF9F0A">${icon('bell', '#fff', 16, 2.2)}</span>ต่อภาษี / พ.ร.บ.</label>
          <input id="c-tax" data-k="taxDate" class="box" type="date" value="${esc(c.taxDate)}"></div>${dueHint(daysTo(c.taxDate))}</div>
        <div class="f"><div class="line"><label for="c-ins" style="display:flex;gap:12px;align-items:center"><span class="rem-ic" style="background:#BF5AF2">${icon('bell', '#fff', 16, 2.2)}</span>ต่อประกันภัย</label>
          <input id="c-ins" data-k="insDate" class="box" type="date" value="${esc(c.insDate)}"></div>${dueHint(daysTo(c.insDate))}</div>
      </div>
    </section>
    <button class="primary" id="car-save">บันทึกข้อมูลรถ</button>
  </div>`);

  const img = $('.carhero img[data-path]');
  if (img) loadImage(img.dataset.path, 1000).then((src) => { img.src = src; }).catch(() => img.remove());

  const draft = Object.assign({}, c, { plugs: c.plugs.slice() });
  $$('[data-k]').forEach((inp) => inp.addEventListener('input', () => { draft[inp.dataset.k] = inp.value; }));
  $$('[data-plug]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.plug;
    const i = draft.plugs.indexOf(p);
    if (i >= 0) draft.plugs.splice(i, 1); else draft.plugs.push(p);
    const on = draft.plugs.includes(p);
    b.classList.toggle('on', on);
    b.style.background = on ? '' : 'var(--card)';
    b.setAttribute('aria-pressed', on);
  }));
  const saveCar = async (extra) => {
    Object.assign(draft, extra || {});
    const btn = $('#car-save');
    if (btn) btn.disabled = true;
    try {
      const r = await api('saveCar', { car: draft });
      S.car = r.car || draft;
      persist();
      toast('บันทึกข้อมูลรถแล้ว');
      renderCar();
    } catch (err) {
      toast('บันทึกไม่สำเร็จ: ' + err.message, true);
      if (btn) btn.disabled = false;
    }
  };
  $('#car-save').addEventListener('click', () => saveCar());
  $('#car-photo').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    toast('กำลังอัปโหลดรูปรถ…');
    try {
      const dataUrl = await compressImage(file, 1400, 0.85);
      const r = await api('upload', { kind: 'car', dataUrl: dataUrl, ocr: false });
      S.imgs.set(r.path + '@1000', Promise.resolve(dataUrl));
      await saveCar({ photo: r.path });
    } catch (err) {
      toast('อัปโหลดไม่สำเร็จ: ' + err.message, true);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function renderSettings() {
  setTabs(S.cfg.url ? 'car' : null);
  view(`<div class="page">
    <div class="navbar">${S.cfg.url ? `<a class="circle" href="#/car" aria-label="กลับ">${icon('left', '#fff', 20, 2.5)}</a>` : '<div></div>'}<div class="title">ตั้งค่า</div><div style="width:44px"></div></div>
    ${S.cfg.url ? '' : `<div class="card"><h2>เริ่มต้นใช้งาน</h2><p class="meta" style="margin:0;line-height:1.6">ใส่ Web app URL และ API token จาก Google Apps Script ที่ผูกกับชีทค่าชาร์จ (ดูขั้นตอนในคู่มือ)</p></div>`}
    <section class="sec">
      <div class="sec-hd"><span class="label">การเชื่อมต่อ Google Sheet</span></div>
      <div class="group">
        <div class="f"><label for="s-url" class="label">Web app URL</label><input id="s-url" class="field-input" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.cfg.url || '')}" autocomplete="off" inputmode="url"></div>
        <div class="f"><label for="s-token" class="label">API token</label><input id="s-token" class="field-input" placeholder="จาก Logs ตอนรัน setup()" value="${esc(S.cfg.token || '')}" autocomplete="off"></div>
      </div>
    </section>
    <button class="primary" id="s-save">บันทึกและทดสอบ</button>
    <section class="sec">
      <div class="group">
        <div class="kv"><span>รายการในเครื่อง</span><b>${S.items.length}</b></div>
        <div class="kv"><span>ซิงก์ล่าสุด</span><b>${S.lastSync ? new Date(S.lastSync).toLocaleString('th-TH') : '–'}</b></div>
        <div class="kv"><span>เวอร์ชัน</span><b>${VERSION}</b></div>
      </div>
    </section>
    <button class="secondary danger" id="s-clear">ล้างข้อมูลในเครื่อง</button>
  </div>`);
  $('#s-save').addEventListener('click', async () => {
    const url = $('#s-url').value.trim();
    const token = $('#s-token').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('URL ต้องขึ้นต้นด้วย https://script.google.com/', true); return; }
    if (!token) { toast('กรุณาใส่ token', true); return; }
    const old = S.cfg;
    S.cfg = { url, token };
    const btn = $('#s-save');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="border-top-color:#000;border-color:rgba(0,0,0,0.2)"></div>กำลังทดสอบ…';
    try {
      const data = await api('list');
      S.items = (data.items || []).map(normalizeItem);
      S.car = data.car || {};
      saveLS('cfg', S.cfg);
      persist();
      toast('เชื่อมต่อสำเร็จ · ' + S.items.length + ' รายการ');
      location.hash = '#/';
    } catch (err) {
      S.cfg = old;
      btn.disabled = false;
      btn.textContent = 'บันทึกและทดสอบ';
      toast(err.message, true);
    }
  });
  $('#s-clear').addEventListener('click', async () => {
    if (!(await confirmBox('ล้างข้อมูลในเครื่อง?', 'ข้อมูลในชีทไม่หาย แค่ต้องดึงใหม่', 'ล้าง', true))) return;
    localStorage.removeItem('evlog.cache');
    S.items = [];
    S.car = {};
    S.imgs.clear();
    toast('ล้างแล้ว');
    sync(true);
  });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = new URLSearchParams(qs || location.search.slice(1));
  if (mapObj && path !== '/map') { mapObj.remove(); mapObj = null; }
  if (!/^\/(add|edit)/.test(path)) F = null;
  $('#modal-root').innerHTML = '';

  if (!S.cfg.url && path !== '/settings') { renderSettings(); return; }
  let m;
  if (path === '/' || path === '') renderHome();
  else if (path === '/add') renderForm(null, query);
  else if ((m = path.match(/^\/edit\/(.+)$/))) renderForm(decodeURIComponent(m[1]));
  else if ((m = path.match(/^\/item\/(.+)$/))) renderDetail(decodeURIComponent(m[1]));
  else if (path === '/insights') renderInsights();
  else if (path === '/map') renderMap();
  else if (path === '/car') renderCar();
  else if (path === '/settings') renderSettings();
  else renderHome();
  if (!/^\/map/.test(path)) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.cfg.url && (!S.lastSync || Date.now() - S.lastSync > 5 * 60 * 1000)) sync(true);
});

// Boot
if (new URLSearchParams(location.search).get('shared') === '1' && !/#\/add/.test(location.hash)) location.hash = '#/add';
route();
if (S.cfg.url) sync(true);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
}
