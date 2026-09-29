/*
 * Parsers for Google Drive OCR text of EV-charging receipts and of the car's dashboard screen.
 * Tuned against real receipts from each app (see test/ocr-eval.js).
 * OCR quirks handled: "฿" is often read as "$", "B", "BB" or "b"; Thai dates use BE years;
 * some apps use yy/mm/dd (iGreen+) or mm/dd/yyyy (ReverSharger).
 */
(function (g) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const toNum = (s) => parseFloat(String(s).replace(/,/g, ''));

  const MONTHS = [
    ['ม.ค.', 'มกราคม', 'jan'], ['ก.พ.', 'กุมภาพันธ์', 'feb'], ['มี.ค.', 'มีนาคม', 'mar'], ['เม.ย.', 'เมษายน', 'apr'],
    ['พ.ค.', 'พฤษภาคม', 'may'], ['มิ.ย.', 'มิถุนายน', 'jun'], ['ก.ค.', 'กรกฎาคม', 'jul'], ['ส.ค.', 'สิงหาคม', 'aug'],
    ['ก.ย.', 'กันยายน', 'sep'], ['ต.ค.', 'ตุลาคม', 'oct'], ['พ.ย.', 'พฤศจิกายน', 'nov'], ['ธ.ค.', 'ธันวาคม', 'dec'],
  ];

  /* ---------------- dates & times ---------------- */

  function normYear(y) {
    y = Number(y);
    if (y < 100) {
      // Two-digit year: CE (20yy) or Buddhist era (25yy); pick the one closest to now.
      const now = new Date().getFullYear();
      const ce = 2000 + y;
      const be = 2500 + y - 543;
      return Math.abs(ce - now) <= Math.abs(be - now) ? ce : be;
    }
    return y > 2400 ? y - 543 : y;
  }
  function iso(y, m, d) {
    y = normYear(y); m = Number(m); d = Number(d);
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2100)) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }
  function addDays(isoDate, n) {
    const p = isoDate.split('-').map(Number);
    const dt = new Date(p[0], p[1] - 1, p[2] + n);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }

  /** Finds the first date in s. order: 'dmy' (default), 'mdy' or 'ymd' for 2-part-year numeric forms. */
  function findDate(s, order) {
    s = String(s || '');
    let m;
    if (order === 'ymd') {
      m = s.match(/(?:^|[^\d])(\d{2})\/(\d{1,2})\/(\d{1,2})(?!\d)/);
      if (m) { const r = iso(m[1], m[2], m[3]); if (r) return r; }
    }
    m = s.match(/(?:^|[^\d])(20\d{2}|25\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/);
    if (m) { const r = iso(m[1], m[2], m[3]); if (r) return r; }
    m = s.match(/(?:^|[^\d])(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})(?!\d)/);
    if (m) {
      const r = order === 'mdy' ? iso(m[3], m[1], m[2]) : iso(m[3], m[2], m[1]);
      if (r) return r;
    }
    const low = s.toLowerCase();
    for (let i = 0; i < 12; i++) {
      for (const name of MONTHS[i]) {
        const esc = name.replace(/\./g, '\\.');
        let mm = low.match(new RegExp('(\\d{1,2})\\s*' + esc + '[a-z]*\\.?,?\\s*(\\d{4}|\\d{2})(?!\\d)'));
        if (mm) { const r = iso(mm[2], i + 1, mm[1]); if (r) return r; }
        mm = low.match(new RegExp(esc + '[a-z]*\\.?\\s*(\\d{1,2}),\\s*(\\d{4})'));
        if (mm) { const r = iso(mm[2], i + 1, mm[1]); if (r) return r; }
      }
    }
    return null;
  }

  function findTime(s) {
    const m = String(s || '').match(/(?:^|[^\d:])([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.][0-5]\d)?(?:\s*([AaPp])\.?[Mm])?(?![\d])/);
    if (!m) return null;
    let h = Number(m[1]);
    if (m[3]) { const pm = /p/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return pad(h) + ':' + m[2];
  }

  /* ---------------- numbers ---------------- */

  const CUR = '(?:฿|\\$|THB|บาท|BB|B|b)';
  // Money that is not a unit rate ("7.50 บาท/kWh", "$4.99/kWh").
  function moneys(s, requireCurrency) {
    const out = [];
    const re = new RegExp('(' + CUR + ')?[ \\t]?(-?\\d{1,3}(?:,\\d{3})*[.,]\\d{2})(?!\\d)([ \\t]*(?:THB|บาท|฿))?([ \\t]*\\/[ \\t]*(?:k\\s*w\\s*h|unit|หน่วย))?', 'gi');
    let m;
    while ((m = re.exec(String(s || '')))) {
      if (m[4]) continue;
      if (requireCurrency && !m[1] && !m[3]) continue;
      const v = toNum(m[2].replace(/,(\d{2})$/, '.$1'));
      if (v >= 0) out.push(v);
    }
    return out;
  }
  function kwhs(s) {
    const out = [];
    const re = /(\d{1,3}(?:[.,]\d{1,4})?)\s*(?:k\s*w\s*h|units?\s*\(kwh\)|หน่วย)(?!\s*\/)/gi;
    let m;
    while ((m = re.exec(String(s || '')))) {
      const v = toNum(m[1].replace(',', '.'));
      if (v > 0 && v < 150) out.push(v);
    }
    return out;
  }

  /* ---------------- line helpers ---------------- */

  function mk(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    const idx = (re, from) => { for (let i = from || 0; i < lines.length; i++) if (re.test(lines[i])) return i; return -1; };
    /** Applies fn to the rest of the label line, then to the next `span` lines; first non-null wins. */
    const after = (re, fn, span) => {
      const i = idx(re);
      if (i < 0) return null;
      const rest = lines[i].replace(re, ' ');
      let v = fn(rest);
      for (let k = 1; (v == null || (Array.isArray(v) && !v.length)) && k <= (span || 3) && i + k < lines.length; k++) v = fn(lines[i + k]);
      return Array.isArray(v) ? (v.length ? v[0] : null) : v;
    };
    return { lines, idx, after, text: lines.join('\n') };
  }
  const maxOf = (arr) => (arr.length ? Math.max.apply(null, arr) : null);

  /* ---------------- app detection ---------------- */

  const SIGNATURES = [
    ['Hoven Charge', /hoven|TH4387|emperius/i],
    ['EV Station PluZ', /WK-\d{6}-\d{6}|blueplus|ev\s*station\s*pluz/i],
    ['PEA VOLTA', /pea\s*volta|ร่วมเครือข่าย\s*pea|หน่วยรวม\s*\(kwh\)/i],
    ['Spark', /SPK[A-Z]{3}|\bspark\b/i],
    ['iGreen+', /การปล่อยมลพิษ|igreen/i],
    ['EVolt', /station origin|transactions details|\bevolt\b/i],
    ['ReverSharger', /bangchak all station|reversharger/i],
    ['Gentari Go', /gentari/i],
    ['Altervim Super Charge', /altervim|lotus'?s[\s\S]*charging detail|charging detail[\s\S]*lotus/i],
    ['OneCharge', /onecharge|onechange|one\s*charge/i],
    ['MEA EV', /tax ref:\s*EV\d|mea\s*ev/i],
    ['EleXa', /elexa/i],
  ];
  function detectApp(t) {
    for (const [name, re] of SIGNATURES) if (re.test(t)) return name;
    return null;
  }

  /* ---------------- per-app extractors ---------------- */

  const X = {};

  X['Spark'] = (L) => ({
    cost: L.after(/ยอดรวมทั้งสิ้น/, (s) => moneys(s)),
    kwh: L.after(/หน่วยพลังงานที่ชาร์จ/, kwhs),
    date: L.after(/เวลาเริ่มต้น/, (s) => findDate(s)),
    time: L.after(/เวลาเริ่มต้น/, findTime),
    station: (() => { const i = L.idx(/ยอดรวมทั้งสิ้น/); const l = i >= 0 ? L.lines[i + 2] : ''; return /^[ถตซอ]\.|แขวง|เขต|จ\./.test(l || '') ? l : null; })(),
  });

  X['Hoven Charge'] = (L) => {
    const o = { kwh: maxOf(kwhs(L.text)) };
    const all = moneys(L.text, true);
    o.cost = maxOf(all.length ? all : moneys(L.text));
    const st = L.lines.find((l) => /HOVEN\s*EV\s*Station|HOVEN\S*Ram|HOVEN\S*\(/i.test(l));
    if (st) o.station = st.replace(/\s+\d+\/?\d*\s+ถนน.*$/, '').replace(/\(TH\d+.*$/, '').trim();
    const start = L.after(/วัน\/เวลาเริ่ม/, (s) => findDate(s));
    if (start) {
      o.date = start;
      o.time = L.after(/วัน\/เวลาเริ่ม/, findTime);
    } else {
      // "My Order" layout: Stop Time has the full date, Start only the time.
      const stopLine = L.lines.find((l) => /20\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(l));
      if (stopLine) {
        const stopDate = findDate(stopLine);
        const stopTime = findTime(stopLine.replace(/^[\d-]+/, ''));
        const si = L.idx(/^Stop$/i);
        const startTime = si >= 0 ? findTime(L.lines[si + 1]) : null;
        o.time = startTime || stopTime;
        o.date = startTime && stopTime && startTime > stopTime ? addDays(stopDate, -1) : stopDate;
      }
    }
    return o;
  };

  X['EV Station PluZ'] = (L) => {
    const o = {};
    const ref = L.text.match(/WK-(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})\d{2}/);
    if (ref) { o.date = iso(ref[1], ref[2], ref[3]); o.time = ref[4] + ':' + ref[5]; }
    const d2 = L.after(/^วันที่$/, (s) => findDate(s));
    if (d2) o.date = d2;
    const st = L.after(/ระยะเวลาเริ่ม/, findTime);
    if (st) o.time = st;
    o.kwh = maxOf(kwhs(L.text));
    if (o.kwh == null) {
      const q = L.text.match(/(?:^|\s)(\d{1,3}\.\d{3})(?!\d)/m);
      if (q) o.kwh = toNum(q[1]);
    }
    // The grand total is the largest amount on these screens (net + VAT lines are smaller).
    o.cost = maxOf(moneys(L.text, true)) || maxOf(moneys(L.text).filter((v) => v < 5000));
    return o;
  };

  X['iGreen+'] = (L) => {
    const o = {};
    const c = L.text.match(/(\d{1,3}(?:,\d{3})*\.\d{1,2})\s*THB/i);
    if (c) o.cost = toNum(c[1]);
    o.kwh = kwhs(L.text)[0] || null;
    const dl = L.lines.find((l) => /\d{2}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}/.test(l));
    if (dl) { o.date = findDate(dl, 'ymd'); o.time = findTime(dl.replace(/^\S+/, '')); }
    const i = L.lines.findIndex((l) => />\s*$/.test(l));
    if (i >= 0) o.station = L.lines[i].replace(/\s*>\s*$/, '').trim();
    return o;
  };

  X['EVolt'] = (L) => {
    const o = { kwh: kwhs(L.text)[0] || null };
    const thb = [...L.text.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})\s*THB/gi)].map((m) => toNum(m[1]));
    o.cost = maxOf(thb);
    const i = L.idx(/session start/i);
    const dl = L.lines.slice(Math.max(0, i)).find((l) => /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{1,2}:\d{2}/.test(l));
    if (dl) { o.date = findDate(dl); o.time = findTime(dl.replace(/^.*\d{4}/, '')); }
    const st = L.text.match(/Station\s+(.+?)(?:\.{2,}|…|\n)/);
    if (st) o.station = st[1].trim();
    return o;
  };

  X['ReverSharger'] = (L) => ({
    kwh: kwhs(L.text)[0] || null,
    cost: maxOf([...L.text.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})\s*THB/gi)].map((m) => toNum(m[1]))),
    date: L.after(/session start/i, (s) => findDate(s, 'mdy')),
    time: L.after(/session start/i, (s) => findTime(String(s).replace(/^[\d\/]+,?/, ''))),
    station: L.after(/^station$/i, (s) => (s.trim().length > 2 ? s.trim() : null)),
  });

  X['Gentari Go'] = (L) => {
    const o = { kwh: kwhs(L.text)[0] || null, cost: maxOf(moneys(L.text, true)) };
    const dl = L.lines.find((l) => /\d{1,2}:\d{2}\s*[AP]M,\s*\d{1,2}\s+[A-Za-z]{3}/i.test(l));
    if (dl) { o.date = findDate(dl); o.time = findTime(dl); }
    const i = L.idx(/^gentari$/i);
    if (i >= 0 && L.lines[i + 1]) o.station = L.lines[i + 1];
    return o;
  };

  X['Altervim Super Charge'] = (L) => {
    const o = { kwh: kwhs(L.text)[0] || null };
    o.cost = L.after(/total amount/i, (s) => moneys(s, true), 4) || maxOf(moneys(L.text, true));
    const dl = L.after(/transaction date|fully charged/i, (s) => (findDate(s) ? s : null));
    if (dl) { o.date = findDate(dl); o.time = findTime(dl.replace(/^.*?\d{4}/, '')); }
    const i = L.idx(/charging detail/i);
    if (i >= 0 && L.lines[i + 1] && !/^\W+$/.test(L.lines[i + 1])) o.station = L.lines[i + 1];
    return o;
  };

  X['OneCharge'] = (L) => {
    const o = {};
    const i = L.idx(/ยอดรวม/);
    const pool = i >= 0 ? moneys(L.lines.slice(i, i + 8).join('\n')) : moneys(L.text);
    o.cost = maxOf(pool.filter((v) => v < 5000));
    const d = L.after(/เวลาเริ่มต้น/, (s) => findDate(s), 2);
    if (d) { o.date = d; o.time = L.after(/เวลาเริ่มต้น/, (s) => findTime(String(s).replace(/^[\d\/]+/, '')), 2); }
    let k = kwhs(L.text)[0] || null;
    const rate = L.after(/ราคาต่อหน่วย/, (s) => { const m = String(s).match(/^(\d{1,2}\.\d{2})$/); return m ? toNum(m[1]) : null; }, 4);
    if ((k == null || k > 100 || Number.isInteger(k)) && rate && o.cost) k = Math.round((o.cost / rate) * 100) / 100;
    o.kwh = k;
    o.station = L.after(/จุดบริ/, (s) => (s.trim().length > 2 ? s.trim() : null), 1);
    return o;
  };

  X['MEA EV'] = (L) => {
    const o = { kwh: kwhs(L.text)[0] || null };
    o.cost = maxOf(moneys(L.text, true));
    const dl = L.lines.find((l) => /\d{1,2}\s+[A-Za-z]{3}\s+\d{4},?\s+\d{1,2}:\d{2}/.test(l));
    if (dl) { o.date = findDate(dl); o.time = findTime(dl.replace(/^.*\d{4}/, '')); }
    o.station = L.after(/bill from/i, (s) => (s.trim().length > 2 ? s.trim() : null), 1);
    return o;
  };

  /** PEA VOLTA history list: several sessions per screenshot. */
  function peaEntries(L) {
    const start = L.idx(/ค่าบริการ\s*\(บาท\)|หน่วยรวม\s*\(kwh\)/i);
    const body = L.lines.slice(start >= 0 ? start + 1 : 0);
    const names = [], dates = [], pairs = [];
    const NAV = /^(หน้าแรก|ประวัติ|วอลเล็ก|วอลเล็ต|ข้อมูลผู้ใช้|รายปี|รายเดือน|ค่าบริการ.*|จ[ํำ]+นวน.*|หน่วยรวม.*|[<>{}]|.{0,3})$/i;
    let pendingCost = null;
    for (let raw of body) {
      let l = raw;
      const dm = l.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})(?::\d{2})?/);
      if (dm) {
        dates.push({ date: findDate(dm[1]), time: dm[2] });
        l = l.replace(dm[0], ' ').trim();
      }
      const km = l.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*หน่วย/);
      const mm = l.match(new RegExp(CUR + '\\s?(\\d{1,3}(?:,\\d{3})*\\.\\d{2})'));
      if (mm) { pendingCost = toNum(mm[1]); l = l.replace(mm[0], ' ').trim(); }
      if (km) {
        pairs.push({ cost: pendingCost, kwh: toNum(km[1].replace(',', '.')) });
        pendingCost = null;
        l = l.replace(km[0], ' ').trim();
      } else if (mm) {
        continue;
      }
      if (!l || NAV.test(l) || /^[\d.,\s*=%#]+$/.test(l) || /^B+$/.test(l)) continue;
      if (/^#\d/.test(l) || /^VOLTA\)?$/.test(l)) { if (names.length) names[names.length - 1] += ' ' + l; continue; }
      if (/volta|สถานี|บางจาก|คาลเท็กซ์|ปตท|pt\b|7-eleven|ฮับ|#\d/i.test(l) || l.length >= 8) names.push(l);
    }
    const entries = pairs.filter((p) => p.cost != null).map((p, i) => {
      const e = { cost: p.cost, kwh: p.kwh };
      if (dates.length === pairs.length && dates[i]) { e.date = dates[i].date; e.time = dates[i].time; }
      if (names.length === pairs.length && names[i]) e.station = names[i].replace(/^สถานี\s*/, '').replace(/\s+/g, ' ').trim();
      return e;
    });
    return entries;
  }

  /* ---------------- public API ---------------- */

  function parseReceipt(text, apps) {
    const L = mk(text);
    const out = {};
    const app = detectApp(L.text);
    if (app) out.app = app;
    else {
      const low = L.text.toLowerCase();
      for (const a of apps || []) if ((a.keys || []).some((k) => low.includes(k))) { out.app = a.name; break; }
    }

    if (app === 'PEA VOLTA') {
      const entries = peaEntries(L);
      if (entries.length) {
        Object.assign(out, entries[0]);
        if (entries.length > 1) out.candidates = entries;
      }
    } else if (app && X[app]) {
      const r = X[app](L);
      Object.keys(r).forEach((k) => { if (r[k] != null && r[k] !== '') out[k] = r[k]; });
    }

    // Generic fallbacks for anything still missing.
    if (out.kwh == null) { const k = kwhs(L.text); if (k.length) out.kwh = k[0]; }
    if (out.cost == null) {
      const keyed = L.after(/ยอดชำระ|ยอดช[ํำ]าระ|ยอดรวม|รวมทั้งสิ้น|จ[ํำ]+นวน:?$|total|amount|paid/i, (s) => moneys(s), 3);
      out.cost = keyed != null ? keyed : maxOf(moneys(L.text, true));
      if (out.cost == null) delete out.cost;
    }
    if (!out.date) { const d = findDate(L.text); if (d) out.date = d; }
    const fold = (v) => String(v).replace(/\u0E4D([\u0E48-\u0E4B])\u0E32/g, '$1\u0E33').replace(/\u0E4D\u0E32/g, '\u0E33').replace(/\s+/g, ' ').trim();
    if (out.station) out.station = fold(out.station);
    (out.candidates || []).forEach((c) => { if (c.station) c.station = fold(c.station); });
    if (!out.time) {
      // Skip the phone status-bar clock on the first line.
      const t = findTime(L.lines.slice(1).join('\n'));
      if (t) out.time = t;
    }
    return out;
  }

  function parseCar(text) {
    const L = mk(text);
    const out = {};
    let m = L.text.match(/(?:ระยะไมล์สะสม(?:รวม)?|ไมล์สะสม|ระยะทางสะสม|odo(?:meter)?|total\s*mileage)[^\d]{0,20}([\d,]{3,8})/i);
    if (m) out.odo = toNum(m[1]);
    if (!out.odo) {
      const all = [...L.text.matchAll(/([\d,]{4,8})\s*(?:กม|km)/gi)].map((x) => toNum(x[1])).filter((v) => v >= 1000);
      if (all.length) out.odo = Math.max.apply(null, all);
    }
    const socs = [...L.text.matchAll(/(?:^|[^\d])(\d{1,3})\s*%/g)].map((x) => Number(x[1])).filter((v) => v >= 0 && v <= 100);
    if (socs.length) out.soc = socs[socs.length - 1];
    // Remaining range: "327" on one line followed by "กม. ไดนามิก", or "46 กม." inline.
    const ri = L.idx(/^กม\.?\s*(ไดนามิก|wltp|cltc|nedc)?/i);
    if (ri > 0 && /^\d{1,3}$/.test(L.lines[ri - 1])) out.range = Number(L.lines[ri - 1]);
    else {
      const r = L.text.match(/(?:^|\n)(\d{1,3})\s*กม\.?\s*(?:ไดนามิก|\n)/);
      if (r) out.range = Number(r[1]);
    }
    return out;
  }

  g.EVParse = { parseReceipt, parseCar, findDate, findTime, detectApp };
})(typeof window !== 'undefined' ? window : globalThis);
