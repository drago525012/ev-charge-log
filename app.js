/* EV Charge Log - PWA frontend (vanilla JS, no build step). */
'use strict';

const VERSION = '1.4.0';

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
  let date = String(it.date || '');
  // Sheets in Thai locale can return Buddhist-era years (e.g. 2569-09-12).
  const y = Number(date.slice(0, 4));
  if (y > 2400) date = (y - 543) + date.slice(4);
  return Object.assign({}, it, { date: date, app: canonicalApp(it.app) });
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
    if (!F) routeNow(); // don't wipe a form that is being filled in
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
  const page = v.firstElementChild;
  if (page && S.animate) page.classList.add('enter');
  S.animate = false;
  return v;
}

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates a money value inside el (big-number style). */
function countUp(el, to, ms) {
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (reduceMotion || from === to) { el.innerHTML = bigMoney(to); return; }
  const start = performance.now();
  const dur = ms || 600;
  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.innerHTML = bigMoney(from + (to - from) * e);
    if (p < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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
      <div class="card tight">${g.items.map((it, i) => itemRow(it, i)).join('')}</div>
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
          <div class="big" id="home-total">${bigMoney(0)}</div>
          <div class="meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${delta !== null ? `<span class="tag">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%</span><span>จากเดือนก่อน ·</span>` : ''}
            <span>${t.n} ครั้ง · ${fmt(t.kwh, 1)} kWh</span>
          </div>
        </div>
        <div class="sparks">${spark.map((v, i) => `<i class="${i === 5 ? 'on' : ''}" style="--i:${i};height:${Math.max(4, Math.round((v / maxSpark) * 56))}px"></i>`).join('')}</div>
      </div>
    </a>
    ${!S.items.length ? (S.syncing || S.cfg.url ? '<div class="loading"><div class="spinner"></div>กำลังโหลด…</div>' : '') : ''}
    ${listHtml || (S.items.length ? '<div class="empty">ไม่พบรายการที่ค้นหา</div>' : '')}
    ${!q && groups.length > S.homeMonths ? '<button class="secondary" id="more">ดูเดือนก่อนหน้า</button>' : ''}
  </div>`);

  updateSyncBtn();
  const ht = $('#home-total');
  if (S.homeTotalShown === t.cost) ht.innerHTML = bigMoney(t.cost);
  else countUp(ht, t.cost, 800);
  S.homeTotalShown = t.cost;
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

function itemRow(it, i) {
  const sub = [thaiShort(it.date), it.time, it.kwh ? fmt(it.kwh, 1) + ' kWh' : '', it.station].filter(Boolean).join(' · ');
  return `<a class="item" style="--i:${Math.min(i || 0, 12)}" href="#/item/${encodeURIComponent(it.id)}">
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
    ${candidatesHtml()}

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
          <div id="loc-line">${locLineHtml()}</div>
          <div class="chips">
            <button class="chip" type="button" id="loc-search">${icon('search', '#fff', 14, 2.2)}ค้นหาตำแหน่ง</button>
            <button class="chip" type="button" id="geo">${icon('nav', '#fff', 14, 2.2)}ใช้ตำแหน่งปัจจุบัน</button>
            ${forApp.map((s, i) => `<button class="chip" type="button" data-st="${i}">${esc(s.name)}</button>`).join('')}
          </div>
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
  byId('f-station').addEventListener('input', (e) => {
    F.station = e.target.value;
    delete F.auto.station;
    clearTimeout(F._locT);
    F._locT = setTimeout(() => { attachKnownLocation(true); updateLocLine(); }, 400);
  });
  byId('loc-search').addEventListener('click', async () => {
    const r = await openLocationPicker({ station: F.station, app: F.app, lat: F.lat, lng: F.lng });
    if (r) { F.lat = r.lat; F.lng = r.lng; F.locLabel = r.label; F.locSrc = 'search'; F.geo = null; updateLocLine(); }
  });
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
    if (isNum(s.lat)) { F.lat = s.lat; F.lng = s.lng; F.geo = null; F.locSrc = 'known'; F.locLabel = 'ตำแหน่งเดิมของสถานีนี้'; }
    drawForm();
  }));
  byId('geo').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('อุปกรณ์นี้ไม่รองรับตำแหน่ง', true); return; }
    byId('loc-line').innerHTML = '<div class="hint">กำลังหาตำแหน่ง…</div>';
    navigator.geolocation.getCurrentPosition((pos) => {
      F.lat = +pos.coords.latitude.toFixed(6);
      F.lng = +pos.coords.longitude.toFixed(6);
      F.geo = pos.coords.accuracy;
      F.locSrc = 'gps';
      F.locLabel = 'ตำแหน่งปัจจุบัน';
      updateLocLine();
    }, (err) => {
      updateLocLine();
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

  $$('[data-cand]').forEach((b) => b.addEventListener('click', () => pickCandidate(Number(b.dataset.cand))));
  updateLocLine();
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

function isRecorded(c) {
  return S.items.some((i) => Math.abs((i.cost || 0) - c.cost) < 0.01 && (!c.date || !i.date || Math.abs(parseISO(i.date) - parseISO(c.date)) <= 86400000 * 2));
}

function pickCandidate(idx) {
  const c = F.cands[idx];
  F.candIdx = idx;
  ['cost', 'kwh', 'date', 'time', 'station'].forEach((k) => {
    if (c[k] != null && c[k] !== '') { F[k] = c[k]; F.auto[k] = true; }
  });
  if (c.app) { F.app = c.app; F.auto.app = true; F.otherOpen = false; }
  attachKnownLocation(true);
  drawForm();
}

function candidatesHtml() {
  if (!F.cands || F.cands.length < 2) return '';
  return `<section class="sec">
    <div class="sec-hd"><span class="label">พบ ${F.cands.length} รายการในรูป · เลือกรายการที่จะบันทึก</span></div>
    <div class="group cands">${F.cands.map((c, i) => `<button type="button" class="cand ${i === F.candIdx ? 'on' : ''} ${c.recorded ? 'done' : ''}" data-cand="${i}">
      <span class="radio"></span>
      <span style="flex-grow:1;display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left">
        <span style="font-weight:600">${money(c.cost)}${c.kwh != null ? ' · ' + fmt(c.kwh, 2) + ' kWh' : ''}</span>
        <span class="meta" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.date ? thaiShort(c.date) : ''}${c.time ? ' ' + c.time : ''}${c.station ? ' · ' + esc(c.station) : ''}</span>
      </span>
      ${c.recorded ? '<span class="badge sample">บันทึกแล้ว</span>' : ''}
    </button>`).join('')}</div>
  </section>`;
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
    if (p.date) {
      // Only trust an OCR date that is close to today; a misread year would hide the record.
      const days = Math.abs(parseISO(p.date) - parseISO(todayISO())) / 86400000;
      if (days <= 45) { F.date = p.date; F.auto.date = true; }
      else toast('วันที่ในใบเสร็จอ่านได้ ' + p.date + ' ดูไม่น่าถูก ใช้วันนี้แทน ตรวจอีกครั้งนะ', true);
    }
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
    let p = kind === 'car' ? EVParse.parseCar(r.text) : EVParse.parseReceipt(r.text, APPS);
    if (p.candidates && p.candidates.length > 1) {
      // History screenshots list several sessions: default to the newest one not yet recorded.
      const cands = p.candidates.map((c) => Object.assign({}, c, { app: p.app, recorded: isRecorded(c) }));
      form.cands = cands;
      const pick = cands.find((c) => !c.recorded) || cands[0];
      form.candIdx = cands.indexOf(pick);
      p = Object.assign({}, p, pick);
    } else {
      if (kind === 'receipt') form.cands = null;
    }
    applyParsed(kind, p);
    if (F === form) attachKnownLocation(false);
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
  const ageDays = (parseISO(todayISO()) - parseISO(F.date)) / 86400000;
  if (!F.editing && (ageDays > 60 || ageDays < -1)) {
    const ok = await confirmBox('วันที่ถูกต้องไหม?', 'รายการนี้ลงวันที่ ' + thaiLong(F.date) + ' ซึ่งห่างจากวันนี้มาก', 'ใช่ บันทึกเลย', false);
    if (!ok) { $('#f-date').focus(); return; }
  }
  if ((F.station || '').trim() && !isNum(F.lat) && !F.locSkipped) {
    attachKnownLocation(false);
    if (!isNum(F.lat)) {
      const choice = await choiceBox('สถานีนี้ยังไม่มีตำแหน่ง', '"' + F.station.trim() + '" จะยังไม่ขึ้นบนแผนที่ ค้นหาตำแหน่งตอนนี้เลยไหม?', [['search', 'ค้นหาตำแหน่ง', 'btn-w'], ['skip', 'ข้ามไปก่อน', 'btn-d']]);
      if (choice === 'search') {
        const r = await openLocationPicker({ station: F.station, app: F.app });
        if (r) { F.lat = r.lat; F.lng = r.lng; F.locLabel = r.label; F.locSrc = 'search'; }
        else return;
      } else if (choice === 'skip') {
        F.locSkipped = true;
      } else return;
    }
  }
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
    if (saved.station && isNum(saved.lat) && F.locSrc && F.locSrc !== 'known') {
      propagateStationLocation(saved.station, saved.app, saved.lat, saved.lng).catch(() => {});
    }
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
    it.station ? ['สถานี', esc(it.station) + (mapUrl ? ` <a class="link" href="${mapUrl}" target="_blank" rel="noopener">แผนที่</a>` : ` <button class="linkbtn warn" id="fix-loc">ยังไม่มีตำแหน่ง · ค้นหา</button>`)] : null,
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
      <div class="big" id="detail-total">${bigMoney(0)}</div>
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

  countUp($('#detail-total'), it.cost, 600);
  const fix = $('#fix-loc');
  if (fix) fix.addEventListener('click', async () => {
    const r = await openLocationPicker({ station: it.station, app: it.app });
    if (!r) return;
    try {
      it.lat = r.lat; it.lng = r.lng;
      const res = await propagateStationLocation(it.station, it.app, r.lat, r.lng);
      toast('บันทึกตำแหน่งแล้ว · ' + (res.updated || 1) + ' รายการ');
      renderDetail(it.id);
    } catch (err) { toast('บันทึกไม่สำเร็จ: ' + err.message, true); }
  });
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

function periodKeys(mode) {
  const dates = S.items.map((i) => i.date).filter(Boolean).sort();
  const now = monthKey(todayISO());
  const first = dates.length ? monthKey(dates[0]) : now;
  const keys = [];
  if (mode === 'year') {
    for (let y = Number(first.slice(0, 4)); y <= Number(now.slice(0, 4)); y++) keys.push(String(y));
  } else {
    for (let k = first; k <= now; k = shiftMonth(k, 1)) keys.push(k);
  }
  return keys;
}

function periodData(mode, key) {
  const items = S.items.filter((i) => (mode === 'year' ? String(i.date).slice(0, 4) === key : monthKey(i.date) === key));
  const cost = items.reduce((a, i) => a + (i.cost || 0), 0);
  const kwh = items.reduce((a, i) => a + (i.kwh || 0), 0);
  return { items, cost, kwh, n: items.length };
}

function renderInsights() {
  setTabs('insights');
  const I = S.insights;
  const keys = periodKeys(I.mode);
  const selKey = I.mode === 'year' ? (I.key || '').slice(0, 4) : (I.key || '').slice(0, 7);
  if (!keys.includes(selKey)) I.key = keys[keys.length - 1];
  else I.key = selKey;

  const vals = keys.map((k) => periodData(I.mode, k).cost);
  const maxV = Math.max.apply(null, vals.concat([1]));
  const cols = keys.map((k, idx) => {
    const m = I.mode === 'year' ? null : Number(k.slice(5));
    const label = I.mode === 'year' ? k : TH_MONTH_SHORT[m - 1];
    const sub = I.mode === 'year' ? '' : (m === 1 || idx === 0 ? k.slice(0, 4) : '');
    const h = Math.max(4, Math.round((vals[idx] / maxV) * 140));
    return `<button class="col" data-key="${k}" aria-label="${I.mode === 'year' ? 'ปี ' + k : monthLabel(k)} ${money(vals[idx])}">
      <span class="v">${vals[idx] >= 1000 ? '฿' + fmt(vals[idx] / 1000, 1) + 'k' : '฿' + Math.round(vals[idx])}</span>
      <span class="b" style="--h:${h}px"></span>
      <span class="l">${label}<small>${sub}</small></span></button>`;
  }).join('');

  // All-time cards (do not change with the selected period)
  const byApp = {};
  S.items.forEach((i) => { (byApp[i.app] = byApp[i.app] || []).push(i); });
  const rank = Object.keys(byApp).map((a) => Object.assign({ app: a }, rateStats(byApp[a]))).filter((r) => r.rate != null).sort((a, b) => a.rate - b.rate);
  const maxRate = rank.length ? rank[rank.length - 1].rate : 1;
  const shownRank = I.allApps ? rank : rank.slice(0, 6);
  const on = rateStats(S.items.filter((i) => peakOf(i.date, i.time) === 'on'));
  const off = rateStats(S.items.filter((i) => peakOf(i.date, i.time) === 'off'));
  const peakKwh = on.kwh + off.kwh;
  const stations = stationGroups().filter((s) => s.rate != null).sort((a, b) => a.rate - b.rate).slice(0, 5);

  view(`<div class="page">
    <div class="hdr"><h1>สรุป</h1></div>
    <div class="seg" role="group" aria-label="ช่วงเวลา">
      <span class="seg-thumb" style="transform:translateX(${I.mode === 'year' ? '100%' : '0'})"></span>
      <button class="${I.mode === 'month' ? 'on' : ''}" data-mode="month" aria-pressed="${I.mode === 'month'}">รายเดือน</button>
      <button class="${I.mode === 'year' ? 'on' : ''}" data-mode="year" aria-pressed="${I.mode === 'year'}">รายปี</button>
    </div>

    <div class="card">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="label" style="font-size:15px" id="ins-title"></div>
        <div class="big" id="ins-total"></div>
        <div class="meta" id="ins-meta"></div>
      </div>
      <div class="chart" id="chart">${cols}</div>
    </div>

    <section class="sec">
      <div class="tiles two" id="ins-kpi"></div>
      <div class="meta" style="font-size:12px;padding:0 4px;line-height:1.5" id="ins-note"></div>
    </section>

    <div class="card">
      <div class="row-between"><h2>แอปไหนคุ้มสุด</h2><span class="meta">฿ ต่อ kWh · ทั้งหมด</span></div>
      ${shownRank.length ? shownRank.map((r, i) => `<div class="rank" style="--i:${i}">
        <div class="no">${i + 1}</div>${logoHtml(r.app, 'logo', 36)}
        <div class="main">
          <div class="row-between" style="font-size:15px;font-weight:600"><span>${esc(r.app)}</span><span style="color:${i === 0 ? 'var(--green)' : '#fff'}">฿${fmt(r.rate)}</span></div>
          <div class="meter"><i class="${i === 0 ? 'best' : ''}" style="--w:${Math.round((r.rate / maxRate) * 100)}%"></i></div>
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
        <div class="split"><i style="--w:${(off.kwh / peakKwh) * 100}%;background:var(--cyan)"></i><i style="flex-grow:1;background:var(--orange)"></i></div>
        <div class="meta" style="line-height:1.5">${on.rate && off.rate && on.rate > off.rate ? `ถ้าย้ายไปชาร์จช่วง Off-Peak ทั้งหมด จะประหยัดได้ประมาณ ${money((on.rate - off.rate) * on.kwh)} · ` : ''}On-Peak = จ.–ศ. 09:00–22:00 (ยังไม่หักวันหยุดนักขัตฤกษ์)</div>`
    : '<div class="empty">ยังไม่มีข้อมูลเวลาชาร์จ<br>จะเริ่มแยกให้เมื่อบันทึกรายการใหม่ที่มีเวลา</div>'}
    </div>

    <a class="card" href="#/map">
      <div class="row-between"><h2>สถานีที่คุ้มสุด</h2>${icon('right', '#98989F', 18, 2.5)}</div>
      ${stations.length ? stations.map((s, i) => `<div class="rank" style="--i:${i}">${logoHtml(s.app, 'logo', 32)}
        <div class="main" style="gap:1px"><div style="font-size:15px;font-weight:600">${esc(s.name)}</div><div class="meta" style="font-size:12px">${s.visits} ครั้ง · ล่าสุด ${thaiShort(s.last)}</div></div>
        <div style="font-size:15px;font-weight:700">฿${fmt(s.rate)}</div></div>`).join('')
    : '<div class="empty">ยังไม่มีข้อมูลสถานี<br>ใส่ชื่อสถานีตอนบันทึก แล้วจะเห็นการเปรียบเทียบตรงนี้</div>'}
    </a>
  </div>`);

  const chart = $('#chart');
  updateInsightPeriod(true);
  // Start with the selected bar in view (no animation on first paint).
  const sel = $('.col.on', chart);
  if (sel) chart.scrollLeft = sel.offsetLeft - chart.clientWidth + sel.offsetWidth + 24;
  requestAnimationFrame(() => chart.classList.add('grown'));

  $$('.col', chart).forEach((b) => b.addEventListener('click', () => {
    if (I.key === b.dataset.key) return;
    I.key = b.dataset.key;
    updateInsightPeriod(false);
    const left = b.offsetLeft - (chart.clientWidth - b.offsetWidth) / 2;
    chart.scrollTo({ left: left, behavior: 'smooth' });
  }));
  $$('.seg button').forEach((b) => b.addEventListener('click', () => {
    if (I.mode === b.dataset.mode) return;
    I.mode = b.dataset.mode;
    I.key = I.mode === 'year' ? I.key.slice(0, 4) : (I.key.length === 4 ? (I.key === monthKey(todayISO()).slice(0, 4) ? monthKey(todayISO()) : I.key + '-12') : I.key);
    $('.seg-thumb').style.transform = 'translateX(' + (I.mode === 'year' ? '100%' : '0') + ')';
    const y = window.scrollY;
    setTimeout(() => { renderInsights(); window.scrollTo(0, y); }, 180);
  }));
  const all = $('#allapps');
  if (all) all.addEventListener('click', () => {
    const y = window.scrollY;
    I.allApps = !I.allApps;
    renderInsights();
    window.scrollTo(0, y);
  });
}

/** Updates the numbers that depend on the selected period, without rebuilding the page. */
function updateInsightPeriod(first) {
  const I = S.insights;
  const d = periodData(I.mode, I.key);
  let title, meta;
  if (I.mode === 'month') {
    const p = periodData('month', shiftMonth(I.key, -1));
    const delta = p.cost ? ((d.cost - p.cost) / p.cost) * 100 : null;
    title = monthLabel(I.key);
    meta = `${d.n} ครั้ง · ${fmt(d.kwh, 1)} kWh${delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% จากเดือนก่อน` : ''}`;
  } else {
    const p = periodData('year', String(Number(I.key) - 1));
    const delta = p.cost ? ((d.cost - p.cost) / p.cost) * 100 : null;
    title = 'ปี ' + I.key;
    meta = `${d.n} ครั้ง · ${fmt(d.kwh, 1)} kWh${delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% จากปีก่อน` : ''}`;
  }
  const pr = rateStats(d.items);
  const cons = consumption();
  $('#ins-title').textContent = title;
  $('#ins-meta').textContent = meta;
  countUp($('#ins-total'), d.cost, first ? 700 : 450);
  $$('#chart .col').forEach((c) => {
    const on = c.dataset.key === I.key;
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', on);
  });
  const kpi = $('#ins-kpi');
  kpi.innerHTML = `
    <div class="tile"><div class="k">อัตราสิ้นเปลือง</div><div class="n">${cons ? fmt(cons.per100, 1) : '–'}<small> kWh/100กม.</small></div></div>
    <div class="tile"><div class="k">ต้นทุนต่อกิโล</div><div class="n">${cons ? fmt(cons.perKm) : '–'}<small> ฿/กม.</small></div></div>
    <div class="tile"><div class="k">ราคาเฉลี่ย</div><div class="n swap">${pr.rate != null ? fmt(pr.rate) : '–'}<small> ฿/kWh</small></div></div>
    <div class="tile"><div class="k">เฉลี่ยต่อครั้ง</div><div class="n swap">${d.n ? money(d.cost / d.n) : '–'}</div></div>`;
  $('#ins-note').textContent = (cons
    ? `สิ้นเปลืองและต้นทุนต่อกิโล คิดจากช่วงที่มีเลขไมล์ (${thaiShort(cons.from)} – ${thaiShort(cons.to)}) ${fmt(cons.dist, 0)} กม. · kWh ตามแอป รวม loss ที่ตู้`
    : 'ต้องมีเลขไมล์อย่างน้อย 2 รายการเพื่อคำนวณอัตราสิ้นเปลือง')
    + ` · ราคาเฉลี่ยและต่อครั้งเป็นของ${I.mode === 'month' ? 'เดือน' : 'ปี'}ที่เลือก`;
}

/* ------------------------------------------------------------------ */
/* Map (Leaflet + OpenStreetMap tiles, darkened with CSS)             */
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
  const missingN = stationsWithoutLocation().length;
  view(`<div class="mapwrap">
    <div id="map"></div>
    <div class="map-top">
      <div class="search">${icon('search', '#98989F', 18, 2.2)}<label for="mq" class="sr-only">ค้นหาสถานี</label><input id="mq" placeholder="ค้นหาสถานีที่เคยไป" autocomplete="off"></div>
      ${missingN ? `<button class="missing-banner" id="missing">${icon('pin', 'currentColor', 16, 2.4)}<span>${missingN} สถานียังไม่มีตำแหน่ง · กดเพื่อค้นหา</span>${icon('right', 'currentColor', 14, 2.5)}</button>` : ''}
      <div class="chips">
        <button class="chip ${S.mapFilter === 'all' ? 'on' : ''}" data-f="all">ทั้งหมด</button>
        <button class="chip ${S.mapFilter === 'cheap' ? 'on' : ''}" data-f="cheap">ถูกสุด</button>
        <button class="chip ${S.mapFilter === 'freq' ? 'on' : ''}" data-f="freq">ไปบ่อย</button>
      </div>
    </div>
    <div class="sheet" id="sheet" hidden></div>
  </div>`);

  const sheet = $('#sheet');
  const mb = $('#missing');
  if (mb) mb.addEventListener('click', openMissingStations);
  if (!all.length) {
    sheet.hidden = false;
    sheet.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start">${icon('pin', '#30D158', 28)}
      <div style="display:flex;flex-direction:column;gap:4px"><b>ยังไม่มีสถานีที่มีพิกัด</b>
      <span class="meta" style="line-height:1.5">ใส่ชื่อสถานีตอนบันทึก แล้วกด "ค้นหาตำแหน่ง" หรือ "ใช้ตำแหน่งปัจจุบัน" สถานีจะขึ้นบนแผนที่นี้</span></div></div>`;
  }

  loadLeaflet().then(() => {
    if (!$('#map')) return;
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapObj = L.map('map', { zoomControl: false, attributionControl: false }).setView([13.7563, 100.5018], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', className: 'dark-tiles',
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
    <a class="group" href="#/review" style="flex-direction:row;align-items:center;gap:12px;padding:14px 16px">
      <span class="rem-ic" style="background:#30D158">${icon('check', '#000', 16, 3)}</span>
      <span style="flex-grow:1;display:flex;flex-direction:column;gap:2px"><b>ตรวจผลอ่านใบเสร็จ</b><span class="meta" style="font-size:12px">ดูรูปเทียบกับค่าที่อ่านได้และค่าในชีท</span></span>
      ${icon('right', '#98989F', 18, 2.5)}
    </a>
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
/* Station locations: geocoding + picker                               */
/* ------------------------------------------------------------------ */

/** OCR splits "ำ" into nikhahit + sara aa; fold it back and tidy spaces. */
function normalizeThai(s) {
  return String(s || '')
    .replace(/ํ([่-๋])า/g, '$1ำ')
    .replace(/ํา/g, 'ำ')
    .replace(/\s+/g, ' ').trim();
}
/** Loose key for matching the same place: ignores spaces, brackets and charger numbers. */
const stationKey = (s) => normalizeThai(s).toLowerCase().replace(/#\s*\d+/g, '').replace(/[\s()\-_.,@#]/g, '');

/** Builds search queries from a noisy station name, most specific first. */
function stationQueries(name, app) {
  const raw = normalizeThai(name);
  if (!raw) return [];
  let c = raw
    .replace(/\(?\s*ร่วมเครือข่าย\s*pea\s*volta\s*\)?/ig, ' ')
    .replace(/^สถานี\s*/, '')
    .replace(/pea\s*volta/ig, ' ')
    .replace(/hoven\s*ev\s*station\s*-?/ig, 'HOVEN ')
    .replace(/\(TH\d+.*$/i, '')
    .replace(/#\s*\d+/g, ' ')
    .replace(/\bกม\.?\s*\d+/g, ' ')
    .replace(/[@>]/g, ' ')
    .replace(/^ม\.(?=[ก-๙])/, 'มหาวิทยาลัย')
    .replace(/\s+/g, ' ').trim();
  const brand = { 'PEA VOLTA': 'PEA VOLTA', 'Hoven Charge': 'HOVEN', 'EV Station PluZ': 'EV Station PluZ', 'Spark': 'Spark EV', 'iGreen+': 'iGreen+', 'EVolt': 'EVolt', 'Altervim Super Charge': 'Altervim', 'MEA EV': 'MEA EV', 'Gentari Go': 'Gentari', 'OneCharge': 'OneCharge', 'ReverSharger': 'Bangchak' }[app] || '';
  const isAddress = /(^|\s)[ตอจ]\.|แขวง|เขต|ถนน|ถ\./.test(c);
  const q = [];
  if (isAddress) q.push(c);
  q.push(c + ' สถานีชาร์จ');
  if (brand && !c.toLowerCase().includes(brand.toLowerCase())) q.push(brand + ' ' + c);
  q.push(c);
  if (raw !== c) q.push(raw);
  return Array.from(new Set(q.filter((x) => x && x.length >= 3))).slice(0, 5);
}

/** Server (Google geocoder via Apps Script) first, OpenStreetMap Nominatim as fallback. */
async function geocode(queries) {
  let results = [];
  try {
    const r = await api('geocode', { queries: queries });
    results = r.results || [];
  } catch (err) {
    console.warn('server geocode failed', err);
  }
  if (!results.length) {
    for (const q of queries.slice(0, 3)) {
      try {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=th&accept-language=th&limit=5&q=' + encodeURIComponent(q);
        const list = await fetch(url).then((x) => x.json());
        results = list.map((x) => ({ label: x.display_name, name: x.name || q, lat: Number(x.lat), lng: Number(x.lon), query: q }));
        if (results.length) break;
      } catch (_) { /* offline */ }
    }
  }
  return results;
}

function knownLocation(station, app) {
  const k = stationKey(station);
  if (!k) return null;
  const hits = S.items.filter((i) => isNum(i.lat) && stationKey(i.station) === k);
  if (!hits.length) return null;
  const same = hits.filter((i) => i.app === app);
  const use = same.length ? same : hits;
  return { lat: use[0].lat, lng: use[0].lng };
}

/** Reuses coordinates already stored for the same station name. */
function attachKnownLocation(replaceAuto) {
  if (!F) return;
  if (isNum(F.lat) && !(replaceAuto && F.locSrc === 'known')) return;
  const k = knownLocation(F.station, F.app);
  if (k) { F.lat = k.lat; F.lng = k.lng; F.locSrc = 'known'; F.locLabel = 'ตำแหน่งเดิมของสถานีนี้'; F.geo = null; }
  else if (replaceAuto && F.locSrc === 'known') { F.lat = null; F.lng = null; F.locSrc = null; F.locLabel = ''; }
}

function locLineHtml() {
  if (isNum(F.lat)) {
    const lbl = F.locLabel || (F.lat.toFixed(5) + ', ' + F.lng.toFixed(5));
    return `<div class="locline ok">${icon('check', 'currentColor', 14, 3)}<span>มีตำแหน่งแล้ว · ${esc(lbl)}${F.geo ? ' (±' + Math.round(F.geo) + ' ม.)' : ''}</span>
      <button type="button" class="linkbtn" id="loc-clear">ล้าง</button></div>`;
  }
  if ((F.station || '').trim()) return `<div class="locline warn">${icon('pin', 'currentColor', 14, 2.4)}<span>ยังไม่มีตำแหน่งบนแผนที่ · กดค้นหาหรือใช้ตำแหน่งปัจจุบัน</span></div>`;
  return '<div class="locline">ใส่ชื่อสถานี แล้วค้นหาตำแหน่งบนแผนที่ได้</div>';
}
function updateLocLine() {
  const el = document.getElementById('loc-line');
  if (!el) return;
  el.innerHTML = locLineHtml();
  const c = document.getElementById('loc-clear');
  if (c) c.addEventListener('click', () => { F.lat = null; F.lng = null; F.locSrc = null; F.locLabel = ''; F.geo = null; updateLocLine(); });
}

/** Modal with custom buttons; resolves to the chosen key or null. */
function choiceBox(title, text, buttons) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <h3 id="mdl-t">${esc(title)}</h3><p>${esc(text)}</p>
      <div class="btnrow">${buttons.map((b) => `<button class="${b[2]}" data-v="${b[0]}">${esc(b[1])}</button>`).join('')}</div>
    </div></div>`;
    const bg = $('.modal-bg', root);
    bg.addEventListener('click', (e) => { if (e.target === bg) { root.innerHTML = ''; resolve(null); } });
    root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { root.innerHTML = ''; resolve(b.dataset.v); }));
  });
}

/**
 * Full-screen picker: search results + map with a draggable pin.
 * Resolves {lat, lng, label} or null when skipped.
 */
function openLocationPicker(opts) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    const queries = stationQueries(opts.station, opts.app);
    root.innerHTML = `<div class="picker" role="dialog" aria-modal="true" aria-labelledby="pk-t">
      <div class="picker-hd">
        <button class="navbtn" id="pk-skip">ข้าม</button>
        <div class="title" id="pk-t">ตำแหน่งสถานี</div>
        <button class="navbtn strong" id="pk-use" disabled>ใช้ตำแหน่งนี้</button>
      </div>
      <div class="picker-search">
        <div class="search">${icon('search', '#98989F', 18, 2.2)}<label for="pk-q" class="sr-only">ค้นหาสถานี</label>
          <input id="pk-q" value="${esc(queries[0] || opts.station || '')}" placeholder="ชื่อสถานี ปั๊ม หรือย่าน" autocomplete="off" enterkeyhint="search"></div>
        <button class="chip" id="pk-go">ค้นหา</button>
      </div>
      <div id="pk-map"></div>
      <div class="picker-list" id="pk-list"><div class="loading"><div class="spinner"></div>กำลังค้นหา…</div></div>
      <div class="picker-foot">
        <button class="chip" id="pk-gps">${icon('nav', '#fff', 14, 2.2)}ใช้ตำแหน่งปัจจุบัน</button>
        <span class="meta" style="font-size:12px">ลากหมุดเพื่อขยับให้ตรงได้</span>
      </div>
    </div>`;
    let map = null, marker = null, results = [], chosen = null;
    const done = (v) => { if (map) map.remove(); root.innerHTML = ''; resolve(v); };
    const useBtn = $('#pk-use');

    const setChosen = (lat, lng, label, fly) => {
      chosen = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), label: label };
      useBtn.disabled = false;
      if (!map) return;
      if (!marker) {
        marker = L.marker([lat, lng], { draggable: true, icon: L.divIcon({ className: '', html: '<div class="pk-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map);
        marker.on('dragend', () => { const p = marker.getLatLng(); chosen = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), label: (chosen && chosen.label ? chosen.label + ' (ปรับตำแหน่ง)' : 'ปักหมุดเอง') }; });
      } else marker.setLatLng([lat, lng]);
      if (fly) map.setView([lat, lng], 16);
    };
    const renderList = () => {
      const list = $('#pk-list');
      if (!results.length) {
        list.innerHTML = `<div class="empty">ไม่พบตำแหน่ง ลองพิมพ์ชื่อสั้นลง เช่น "บางจาก ทุ่งใหญ่"<br>หรือแตะบนแผนที่เพื่อปักหมุดเอง</div>`;
        return;
      }
      list.innerHTML = results.map((r, i) => `<button class="pk-item ${chosen && chosen.i === i ? 'on' : ''}" data-i="${i}">
        ${icon('pin', '#30D158', 18)}<span><b>${esc(r.name || r.label.split(',')[0])}</b><small>${esc(r.label)}</small></span></button>`).join('');
      list.querySelectorAll('.pk-item').forEach((b) => b.addEventListener('click', () => {
        const r = results[Number(b.dataset.i)];
        setChosen(r.lat, r.lng, r.name || r.label, true);
        chosen.i = Number(b.dataset.i);
        list.querySelectorAll('.pk-item').forEach((x) => x.classList.toggle('on', x === b));
      }));
    };
    const search = async (qs) => {
      $('#pk-list').innerHTML = '<div class="loading"><div class="spinner"></div>กำลังค้นหา…</div>';
      results = await geocode(qs);
      renderList();
      if (results.length) {
        const r = results[0];
        setChosen(r.lat, r.lng, r.name || r.label, true);
        chosen.i = 0;
        const first = $('#pk-list .pk-item');
        if (first) first.classList.add('on');
        if (map && results.length > 1) {
          results.slice(1).forEach((x) => L.circleMarker([x.lat, x.lng], { radius: 6, color: '#30D158', weight: 2, fillOpacity: 0.3 }).addTo(map));
        }
      }
    };

    $('#pk-skip').addEventListener('click', () => done(null));
    useBtn.addEventListener('click', () => { if (chosen) done({ lat: chosen.lat, lng: chosen.lng, label: chosen.label }); });
    const go = () => { const v = $('#pk-q').value.trim(); if (v) search(stationQueries(v, opts.app).concat([v])); };
    $('#pk-go').addEventListener('click', go);
    $('#pk-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    $('#pk-gps').addEventListener('click', () => {
      if (!navigator.geolocation) { toast('อุปกรณ์นี้ไม่รองรับตำแหน่ง', true); return; }
      navigator.geolocation.getCurrentPosition((p) => setChosen(p.coords.latitude, p.coords.longitude, 'ตำแหน่งปัจจุบัน', true),
        () => toast('หาตำแหน่งไม่ได้', true), { enableHighAccuracy: true, timeout: 15000 });
    });

    loadLeaflet().then(() => {
      if (!document.getElementById('pk-map')) return;
      map = L.map('pk-map', { zoomControl: false, attributionControl: false }).setView([13.7563, 100.5018], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles' }).addTo(map);
      L.control.attribution({ position: 'bottomright', prefix: false }).addAttribution('&copy; OpenStreetMap').addTo(map);
      map.on('click', (e) => { setChosen(e.latlng.lat, e.latlng.lng, 'ปักหมุดเอง', false); });
      if (isNum(opts.lat)) setChosen(opts.lat, opts.lng, 'ตำแหน่งเดิม', true);
      if (queries.length) search(queries); else renderList();
    }).catch((err) => { toast(err.message, true); if (queries.length) search(queries); });
  });
}

/** Saves the location to every record of this station that has none yet. */
async function propagateStationLocation(station, app, lat, lng) {
  const r = await api('setStationLocation', { station: station, app: app, lat: lat, lng: lng });
  const k = stationKey(station);
  S.items.forEach((i) => { if (stationKey(i.station) === k && (!app || i.app === app) && !isNum(i.lat)) { i.lat = lat; i.lng = lng; } });
  persist();
  return r;
}

/** Stations that still have no coordinates (for the map page). */
function stationsWithoutLocation() {
  const skipped = loadLS('locSkip', []);
  return stationGroups().filter((s) => !isNum(s.lat) && !skipped.includes(stationKey(s.name) + '|' + s.app));
}

async function openMissingStations() {
  const root = $('#modal-root');
  const draw = () => {
    const list = stationsWithoutLocation();
    root.innerHTML = `<div class="picker" role="dialog" aria-modal="true" aria-labelledby="ms-t">
      <div class="picker-hd"><div style="width:60px"></div><div class="title" id="ms-t">สถานีที่ยังไม่มีตำแหน่ง</div><button class="navbtn strong" id="ms-close">เสร็จ</button></div>
      <div class="picker-list" style="flex-grow:1">${list.length ? list.map((s, i) => `<div class="ms-row">
        ${logoHtml(s.app, 'logo', 36)}
        <span style="flex-grow:1;min-width:0;display:flex;flex-direction:column"><b style="overflow-wrap:anywhere">${esc(s.name)}</b><small class="meta">${esc(s.app)} · ${s.visits} ครั้ง · ล่าสุด ${thaiShort(s.last)}</small></span>
        <button class="chip" data-find="${i}">ค้นหา</button><button class="chip" data-skip="${i}" style="background:transparent">ข้าม</button>
      </div>`).join('') : '<div class="empty">ทุกสถานีมีตำแหน่งแล้ว</div>'}</div>
    </div>`;
    $('#ms-close').addEventListener('click', () => { root.innerHTML = ''; renderMap(); });
    root.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => {
      const s = list[Number(b.dataset.skip)];
      const sk = loadLS('locSkip', []);
      sk.push(stationKey(s.name) + '|' + s.app);
      saveLS('locSkip', sk);
      draw();
    }));
    root.querySelectorAll('[data-find]').forEach((b) => b.addEventListener('click', async () => {
      const s = list[Number(b.dataset.find)];
      const r = await openLocationPicker({ station: s.name, app: s.app });
      if (r) {
        try {
          const res = await propagateStationLocation(s.name, s.app, r.lat, r.lng);
          toast('บันทึกตำแหน่งแล้ว · ' + (res.updated || 0) + ' รายการ');
        } catch (err) { toast('บันทึกไม่สำเร็จ: ' + err.message, true); }
      }
      draw();
    }));
  };
  draw();
}

/* ------------------------------------------------------------------ */
/* Review portal: check OCR results against the sheet, with the image  */
/* ------------------------------------------------------------------ */

const R = { samples: null, loading: false, filter: 'todo', idx: 0, entries: [] };

function buildReviewEntries() {
  const fileOf = (p) => String(p || '').split('/').pop();
  const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.011;
  R.entries = (R.samples || []).map((s) => {
    const e = { s: s, kind: s.kind };
    if (s.kind === 'car') {
      e.p = EVParse.parseCar(s.text);
      e.item = S.items.find((i) => fileOf(i.carPic) === s.file) || null;
      e.checks = e.item && isNum(e.item.odo) ? { odo: near(e.p.odo, e.item.odo) } : {};
    } else {
      const p = EVParse.parseReceipt(s.text, APPS);
      e.item = S.items.find((i) => fileOf(i.receipt) === s.file) || null;
      let q = p;
      if (p.candidates && p.candidates.length) {
        q = (e.item && p.candidates.find((c) => near(c.cost, e.item.cost))) || p.candidates[0];
        e.nCands = p.candidates.length;
      }
      e.p = Object.assign({ app: p.app }, q);
      if (e.item) {
        const t = e.item;
        e.checks = {
          app: e.p.app === t.app,
          cost: near(e.p.cost, t.cost),
          kwh: t.kwh == null || near(e.p.kwh, t.kwh),
          date: !!(e.p.date && t.date && Math.abs(parseISO(e.p.date) - parseISO(t.date)) <= 86400000),
        };
      } else e.checks = {};
    }
    const vals = Object.values(e.checks);
    e.auto = !e.item ? 'noitem' : vals.every(Boolean) ? 'match' : 'diff';
    e.status = s.review || e.auto;
    return e;
  }).sort((a, b) => String(b.s.file).localeCompare(String(a.s.file), 'en', { numeric: true }));
}

function reviewList() {
  const f = R.filter;
  return R.entries.filter((e) =>
    f === 'all' ? true :
    f === 'done' ? !!e.s.review :
    f === 'wrong' ? e.s.review === 'wrong' :
    !e.s.review && (e.auto === 'diff' || e.auto === 'noitem'));
}

async function renderReview() {
  setTabs(null);
  if (!R.samples && !R.loading) {
    R.loading = true;
    view(`<div class="page"><div class="navbar"><a class="circle" href="#/car" aria-label="กลับ">${icon('left', '#fff', 20, 2.5)}</a><div class="title">ตรวจใบเสร็จ</div><div style="width:44px"></div></div>
      <div class="loading"><div class="spinner"></div>กำลังโหลดผล OCR…</div></div>`);
    try {
      R.samples = (await api('ocrSamples')).samples || [];
    } catch (err) {
      R.loading = false;
      toast(err.message, true);
      return;
    }
    R.loading = false;
    buildReviewEntries();
    if (!reviewList().length) R.filter = 'all';
  }
  if (!R.samples) return;
  drawReview();
}

function drawReview() {
  const list = reviewList();
  if (R.idx >= list.length) R.idx = Math.max(0, list.length - 1);
  const e = list[R.idx];
  const count = (f) => { const keep = R.filter; R.filter = f; const n = reviewList().length; R.filter = keep; return n; };
  const reviewed = R.entries.filter((x) => x.s.review).length;

  const pill = (st) => ({
    match: '<span class="rv-pill ok">ตรงกับชีท</span>', diff: '<span class="rv-pill bad">ต่างจากชีท</span>',
    noitem: '<span class="rv-pill new">ไม่มีในชีท</span>', ok: '<span class="rv-pill ok">ยืนยันถูกแล้ว</span>', wrong: '<span class="rv-pill bad">แจ้งว่าผิด</span>',
  }[st] || '');
  const row = (label, got, sheet, ok, fmtFn) => {
    const g = got == null || got === '' ? '–' : fmtFn ? fmtFn(got) : got;
    const t = sheet === undefined ? '' : sheet == null || sheet === '' ? '–' : fmtFn ? fmtFn(sheet) : sheet;
    const mark = ok === true ? icon('check', '#30D158', 16, 3) : ok === false ? icon('x', '#FF6961', 16, 3) : '';
    return `<div class="rv-row ${ok === false ? 'bad' : ''}"><span class="k">${label}</span><span class="g">${esc(g)}</span>${sheet === undefined ? '' : `<span class="t">${esc(t)}</span>`}<span class="m">${mark}</span></div>`;
  };

  let body = '';
  if (e) {
    const t = e.item;
    const has = !!t;
    const fields = e.kind === 'car'
      ? row('เลขไมล์', e.p.odo, has ? t.odo : undefined, e.checks.odo, (v) => fmt(v, 0))
        + row('แบต %', e.p.soc, has ? t.soc : undefined, undefined)
        + row('วิ่งได้อีก', e.p.range != null ? e.p.range + ' กม.' : null, undefined, undefined)
      : row('แอป', e.p.app, has ? t.app : undefined, e.checks.app)
        + row('ยอดเงิน', e.p.cost, has ? t.cost : undefined, e.checks.cost, (v) => money(v))
        + row('kWh', e.p.kwh, has ? t.kwh : undefined, e.checks.kwh, (v) => fmt(v, 2))
        + row('วันที่', e.p.date, has ? t.date : undefined, e.checks.date, (v) => thaiShort(v) + ' ' + String(v).slice(0, 4))
        + row('เวลาเริ่ม', e.p.time, has ? t.time : undefined, undefined)
        + row('สถานี', e.p.station, has ? t.station : undefined, undefined);
    body = `
      <button class="rv-img" id="rv-img" aria-label="ดูรูปเต็มจอ"><div class="spinner"></div><img alt="" hidden></button>
      <div class="card" style="gap:12px">
        <div class="row-between" style="flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:10px;align-items:center;min-width:0">${e.kind === 'car' ? `<div class="logo mono" style="width:32px;height:32px">${icon('car', '#fff', 18)}</div>` : logoHtml(e.p.app, 'logo', 32)}
            <b style="overflow-wrap:anywhere">${esc(e.kind === 'car' ? 'หน้าจอรถ' : (e.p.app || 'ไม่รู้แอป'))}</b></div>
          ${pill(e.status)}
        </div>
        ${e.nCands > 1 ? `<div class="meta" style="font-size:12px">รูปนี้มี ${e.nCands} รายการ · แสดงรายการที่ตรงกับชีท</div>` : ''}
        <div class="rv-table">
          <div class="rv-row head"><span class="k"></span><span class="g">อ่านได้</span>${e.item ? '<span class="t">ในชีท</span>' : ''}<span class="m"></span></div>
          ${fields}
        </div>
        <div class="meta" style="font-size:11px;word-break:break-all">${esc(e.s.file)}</div>
        ${e.item ? `<a class="link" href="#/edit/${encodeURIComponent(e.item.id)}">แก้ค่าในชีทสำหรับรายการนี้ ${icon('right', '#30D158', 14, 2.5)}</a>` : ''}
        <div id="rv-note-wrap" ${e.s.review === 'wrong' ? '' : 'hidden'}>
          <label for="rv-note" class="label">บอกว่าผิดตรงไหน (ไม่บังคับ)</label>
          <input id="rv-note" class="field-input" value="${esc(e.s.note)}" placeholder="เช่น kWh ที่ถูกคือ 22.63" autocomplete="off">
        </div>
      </div>`;
  } else {
    body = '<div class="empty">ไม่มีรายการในกลุ่มนี้</div>';
  }

  view(`<div class="page rv">
    <div class="navbar"><a class="circle" href="#/car" aria-label="กลับ">${icon('left', '#fff', 20, 2.5)}</a>
      <div class="title">ตรวจใบเสร็จ</div>
      <div class="meta" style="min-width:44px;text-align:right">${list.length ? (R.idx + 1) + '/' + list.length : ''}</div></div>
    <div class="rv-progress"><i style="width:${R.entries.length ? (reviewed / R.entries.length) * 100 : 0}%"></i></div>
    <div class="meta" style="font-size:12px;margin-top:-12px">ตรวจแล้ว ${reviewed} จาก ${R.entries.length} รูป</div>
    <div class="chips">
      ${[['todo', 'ต้องตรวจ'], ['all', 'ทั้งหมด'], ['wrong', 'แจ้งว่าผิด'], ['done', 'ตรวจแล้ว']].map((c) => `<button class="chip ${R.filter === c[0] ? 'on' : ''}" data-rf="${c[0]}">${c[1]} ${count(c[0])}</button>`).join('')}
    </div>
    ${body}
  </div>
  ${e ? `<div class="savebar rv-bar">
    <button class="circle" id="rv-prev" aria-label="ก่อนหน้า" ${R.idx === 0 ? 'disabled' : ''}>${icon('left', '#fff', 20, 2.5)}</button>
    <button class="btn-d rv-btn" id="rv-wrong">${icon('x', '#FF6961', 18, 3)}ผิด</button>
    <button class="btn-w rv-btn" id="rv-ok">${icon('check', '#000', 18, 3)}ถูกต้อง</button>
    <button class="circle" id="rv-next" aria-label="ถัดไป" ${R.idx >= list.length - 1 ? 'disabled' : ''}>${icon('right', '#fff', 20, 2.5)}</button>
  </div>` : ''}`);

  $$('[data-rf]').forEach((b) => b.addEventListener('click', () => { R.filter = b.dataset.rf; R.idx = 0; drawReview(); }));
  if (!e) return;

  const imgBtn = $('#rv-img');
  const img = $('img', imgBtn);
  const src = e.s.fileId;
  loadImageById(src, 1200).then((d) => { if (!img.isConnected) return; img.src = d; img.hidden = false; const sp = $('.spinner', imgBtn); if (sp) sp.remove(); })
    .catch(() => { const sp = $('.spinner', imgBtn); if (sp) sp.outerHTML = '<span class="meta">โหลดรูปไม่ได้</span>'; });
  imgBtn.addEventListener('click', () => { if (img.src) openViewerSrc(img.src); });
  const next = list[R.idx + 1];
  if (next) loadImageById(next.s.fileId, 1200).catch(() => {});

  const go = (d) => { const n = R.idx + d; if (n >= 0 && n < list.length) { R.idx = n; drawReview(); window.scrollTo(0, 0); } };
  $('#rv-prev').addEventListener('click', () => go(-1));
  $('#rv-next').addEventListener('click', () => go(1));
  const mark = async (review) => {
    const note = review === 'wrong' ? (($('#rv-note') || {}).value || '').trim() : '';
    const prevReview = e.s.review, prevNote = e.s.note;
    e.s.review = review; e.s.note = note; e.status = review;
    const stillListed = reviewList().includes(e);
    if (stillListed) R.idx += 1;
    drawReview();
    window.scrollTo(0, 0);
    try {
      await api('markReviewed', { file: e.s.file, review: review, note: note });
    } catch (err) {
      e.s.review = prevReview; e.s.note = prevNote; e.status = prevReview || e.auto;
      toast('บันทึกผลตรวจไม่สำเร็จ: ' + err.message, true);
      drawReview();
    }
  };
  $('#rv-ok').addEventListener('click', () => mark('ok'));
  $('#rv-wrong').addEventListener('click', () => {
    const wrap = $('#rv-note-wrap');
    if (wrap.hidden) { wrap.hidden = false; $('#rv-note').focus(); $('#rv-wrong').innerHTML = icon('x', '#FF6961', 18, 3) + 'ยืนยันว่าผิด'; return; }
    mark('wrong');
  });

  // Swipe left/right on the image to move between receipts.
  let x0 = null;
  imgBtn.addEventListener('touchstart', (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
  imgBtn.addEventListener('touchend', (ev) => {
    if (x0 == null) return;
    const dx = ev.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  });
}

function loadImageById(fileId, size) {
  const key = 'id:' + fileId + '@' + size;
  if (S.imgs.has(key)) return S.imgs.get(key);
  const p = api('image', { fileId: fileId, size: size }).then((r) => r.dataUrl);
  S.imgs.set(key, p);
  p.catch(() => S.imgs.delete(key));
  return p;
}

function openViewerSrc(src) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="viewer"><img src="${src}" alt="รูปเต็ม"><button class="circle" aria-label="ปิด">${icon('x', '#fff')}</button></div>`;
  $('.viewer button', root).addEventListener('click', () => { root.innerHTML = ''; });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

let firstRoute = true;
function route() {
  S.animate = true;
  if (!firstRoute && document.startViewTransition && !reduceMotion) {
    firstRoute = false;
    document.startViewTransition(() => routeNow());
    return;
  }
  firstRoute = false;
  routeNow();
}

function routeNow() {
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
  else if (path === '/review') renderReview();
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
