/* Heuristic parsers for OCR text (receipts and the car's dashboard screen). */
(function (g) {
  'use strict';

  const TH_MONTHS = [
    ['ม.ค.', 'มกราคม', 'jan'], ['ก.พ.', 'กุมภาพันธ์', 'feb'], ['มี.ค.', 'มีนาคม', 'mar'], ['เม.ย.', 'เมษายน', 'apr'],
    ['พ.ค.', 'พฤษภาคม', 'may'], ['มิ.ย.', 'มิถุนายน', 'jun'], ['ก.ค.', 'กรกฎาคม', 'jul'], ['ส.ค.', 'สิงหาคม', 'aug'],
    ['ก.ย.', 'กันยายน', 'sep'], ['ต.ค.', 'ตุลาคม', 'oct'], ['พ.ย.', 'พฤศจิกายน', 'nov'], ['ธ.ค.', 'ธันวาคม', 'dec'],
  ];

  const pad = (n) => String(n).padStart(2, '0');
  const toNum = (s) => parseFloat(String(s).replace(/,/g, ''));

  function normYear(y) {
    y = Number(y);
    if (y < 100) y += y > 50 ? 2500 : 2000;
    if (y > 2400) y -= 543;
    return y;
  }

  function validDate(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2100)) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function findDate(t) {
    let m = t.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})\b/);
    if (m) {
      const iso = validDate(normYear(m[3]), Number(m[2]), Number(m[1]));
      if (iso) return iso;
    }
    m = t.match(/\b(20\d{2}|25\d{2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\b/);
    if (m) {
      const iso = validDate(normYear(m[1]), Number(m[2]), Number(m[3]));
      if (iso) return iso;
    }
    const low = t.toLowerCase();
    for (let i = 0; i < 12; i++) {
      for (const name of TH_MONTHS[i]) {
        const esc = name.replace(/\./g, '\\.');
        const re = new RegExp('(\\d{1,2})\\s*' + esc + '[a-z]*\\.?\\s*(\\d{2,4})', 'i');
        const mm = low.match(re);
        if (mm) {
          const iso = validDate(normYear(mm[2]), i + 1, Number(mm[1]));
          if (iso) return iso;
        }
      }
    }
    return null;
  }

  function findTime(t) {
    const re = /(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.][0-5]\d)?(?!\d)/g;
    const all = [];
    let m;
    while ((m = re.exec(t))) all.push({ idx: m.index, v: pad(m[1]) + ':' + m[2] });
    if (!all.length) return null;
    // Prefer a time that follows a "start" keyword.
    const start = t.search(/เริ่ม|start|begin/i);
    if (start >= 0) {
      const after = all.find((x) => x.idx >= start);
      if (after) return after.v;
    }
    return all[0].v;
  }

  function parseReceipt(text, apps) {
    const t = String(text || '').replace(/\r/g, '');
    const low = t.toLowerCase();
    const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
    const out = {};

    // App name
    for (const a of apps || []) {
      if ((a.keys || []).some((k) => low.includes(k))) { out.app = a.name; break; }
    }

    // Rates like "7.50 บาท/kWh" must not be taken as energy or cost.
    const rates = new Set();
    for (const m of t.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:บาท|฿|thb)?\s*\/\s*(?:k\s*w\s*h|หน่วย)/gi)) rates.add(toNum(m[1]));

    // Energy (kWh)
    const kwh = [];
    for (const m of t.matchAll(/(\d{1,3}(?:[.,]\d{1,3})?)\s*k\s*w\s*h(?!\s*\/)/gi)) {
      const v = toNum(m[1].replace(',', '.'));
      if (v > 0 && v < 200 && !rates.has(v)) kwh.push(v);
    }
    if (!kwh.length) {
      const m = t.match(/(?:k\s*w\s*h|พลังงาน|หน่วยไฟ|energy)[^\d\n]{0,25}\n?\s*(\d{1,3}[.,]\d{1,3})/i);
      if (m) kwh.push(toNum(m[1].replace(',', '.')));
    }
    if (kwh.length) out.kwh = kwh[0];

    // Cost
    const moneyRe = /(\d{1,3}(?:,\d{3})*[.,]\d{2})(?!\d)/g;
    const isMoney = (v) => v > 0 && v < 10000 && !rates.has(v) && !kwh.includes(v);
    const keyRe = /ยอดชำระ|ยอดรวม|รวมทั้งสิ้น|ยอดเงิน|ชำระเงิน|ที่ต้องชำระ|ค่าบริการรวม|รวมเงิน|total|amount|grand|paid|net/i;
    let cost = null;
    for (let i = 0; i < lines.length && cost === null; i++) {
      if (!keyRe.test(lines[i])) continue;
      const pool = (lines[i] + ' ' + (lines[i + 1] || '')).match(moneyRe) || [];
      const vals = pool.map((s) => toNum(s.replace(/,(\d{2})$/, '.$1'))).filter(isMoney);
      if (vals.length) cost = Math.max.apply(null, vals);
    }
    if (cost === null) {
      const baht = [...t.matchAll(/(?:฿|thb)\s*(\d{1,3}(?:,\d{3})*\.\d{2})|(\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:บาท|฿|thb)/gi)]
        .map((m) => toNum(m[1] || m[2])).filter(isMoney);
      if (baht.length) cost = Math.max.apply(null, baht);
    }
    if (cost === null) {
      const all = (t.match(moneyRe) || []).map((s) => toNum(s)).filter(isMoney);
      if (all.length) cost = Math.max.apply(null, all);
    }
    if (cost !== null) out.cost = cost;

    const d = findDate(t);
    if (d) out.date = d;
    const tm = findTime(t);
    if (tm) out.time = tm;

    // Station name
    const stRe = /(ชื่อสถานี|สถานีชาร์จ|สถานี|station|สาขา|location|ที่ตั้ง|site)\s*[:：]?\s*(.*)/i;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(stRe);
      if (!m) continue;
      let name = m[2].trim();
      if (name.length < 3) name = (lines[i + 1] || '').trim();
      name = name.replace(/^[:：\-\s]+/, '').slice(0, 80);
      if (name.length >= 3 && !/^\d+([.,]\d+)?$/.test(name)) { out.station = name; break; }
    }
    return out;
  }

  function parseCar(text) {
    const t = String(text || '').replace(/\r/g, '');
    const out = {};
    let m = t.match(/(?:ระยะไมล์สะสม(?:รวม)?|ไมล์สะสม|ระยะทางสะสม|odo(?:meter)?|total\s*mileage)[^\d]{0,20}([\d,]{3,8})/i);
    if (m) out.odo = toNum(m[1]);
    if (!out.odo) {
      const all = [...t.matchAll(/([\d,]{4,8})\s*(?:กม|km)/gi)].map((x) => toNum(x[1])).filter((v) => v >= 1000);
      if (all.length) out.odo = Math.max.apply(null, all);
    }
    const socs = [...t.matchAll(/(\d{1,3})\s*%/g)].map((x) => Number(x[1])).filter((v) => v >= 0 && v <= 100);
    if (socs.length) out.soc = socs[socs.length - 1];
    const ranges = [...t.matchAll(/(?:^|[^\d,])(\d{1,3})\s*(?:กม|km)(?![a-z])/gi)].map((x) => Number(x[1])).filter((v) => v > 0 && v < 1000);
    if (ranges.length) out.range = ranges[0];
    return out;
  }

  g.EVParse = { parseReceipt, parseCar, findDate, findTime };
})(typeof window !== 'undefined' ? window : globalThis);
