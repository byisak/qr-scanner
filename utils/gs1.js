// utils/gs1.js - GS1 바코드(GS1-128, GS1 DataMatrix/QR, GS1 Digital Link) 안의 AI(응용 식별자)를 해석한다
// 예: "(01)08801234567890(17)251231(10)LOT7"  →  GTIN 08801234567890 · 유통기한 2025-12-31 · 로트 LOT7
// 일반 EAN·텍스트를 잘못 해석하지 않도록, 확실한 신호(괄호 표기, ]C1 같은 심볼 접두, GS 문자, Digital Link)가 있을 때만 해석한다

const GS = '\u001d';

// 고정 길이 AI (AI 뒤 데이터 길이). 나머지는 가변(GS로 끝남)
const FIXED = {
  '00': 18, '01': 14, '02': 14,
  '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6,
  '20': 2,
  '410': 13, '411': 13, '412': 13, '413': 13, '414': 13, '415': 13, '416': 13, '417': 13,
  '422': 3, '424': 3, '425': 3, '426': 3,
  '7003': 10, '8001': 14, '8005': 6, '8006': 18,
};
// 가변 길이 AI의 최대 길이
const VARIABLE = {
  '10': 20, '21': 20, '22': 20, '235': 28, '240': 30, '241': 30, '242': 6, '243': 20, '250': 30, '251': 30, '253': 30, '254': 20, '255': 25,
  '30': 8, '37': 8, '400': 30, '401': 30, '402': 17, '403': 30, '420': 20, '421': 12, '423': 15,
  '7001': 13, '7002': 30, '8002': 20, '8003': 30, '8004': 30, '8007': 34, '8008': 12, '8020': 25,
  '90': 30, '91': 90, '92': 90, '93': 90, '94': 90, '95': 90, '96': 90, '97': 90, '98': 90, '99': 90,
};

// 화면에 이름을 붙이는 AI (나머지는 "AI (xx)")
export const GS1_NAMED_AIS = ['00', '01', '02', '10', '11', '13', '15', '17', '21', '30', '37', '400', '410', '414', '8004'];

// 31nn~36nn: 4자리 AI + 6자리 숫자 (마지막 자리 = 소수점 위치). 무게·길이 등
function isMeasureAi(ai4) {
  return /^3[1-6]\d\d$/.test(ai4);
}

// 데이터 앞에서 AI를 찾는다 → { ai, fixed, max }
function matchAi(s) {
  const four = s.slice(0, 4);
  if (isMeasureAi(four)) return { ai: four, fixed: 6 };
  if (FIXED[four] !== undefined) return { ai: four, fixed: FIXED[four] };
  if (VARIABLE[four] !== undefined) return { ai: four, max: VARIABLE[four] };
  const three = s.slice(0, 3);
  if (FIXED[three] !== undefined) return { ai: three, fixed: FIXED[three] };
  if (VARIABLE[three] !== undefined) return { ai: three, max: VARIABLE[three] };
  const two = s.slice(0, 2);
  if (FIXED[two] !== undefined) return { ai: two, fixed: FIXED[two] };
  if (VARIABLE[two] !== undefined) return { ai: two, max: VARIABLE[two] };
  return null;
}

// GS 문자로 이어진 원본 문자열 해석. 끝까지 깔끔히 해석되지 않으면 null
function parseRaw(s) {
  const out = [];
  let rest = s;
  while (rest.length > 0) {
    if (rest[0] === GS) { rest = rest.slice(1); continue; }
    const m = matchAi(rest);
    if (!m) return null;
    rest = rest.slice(m.ai.length);
    let value;
    if (m.fixed !== undefined) {
      if (rest.length < m.fixed) return null;
      value = rest.slice(0, m.fixed);
      rest = rest.slice(m.fixed);
    } else {
      const end = rest.indexOf(GS);
      value = end === -1 ? rest : rest.slice(0, end);
      if (value.length === 0 || value.length > m.max) return null;
      rest = end === -1 ? '' : rest.slice(end);
    }
    out.push({ ai: m.ai, value });
  }
  return out.length ? out : null;
}

// "(01)…(17)…" 괄호 표기
function parseBracketed(s) {
  const re = /\((\d{2,4})\)([^(]*)/g;
  const out = [];
  let consumed = '';
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({ ai: m[1], value: m[2].trim() });
    consumed += m[0];
  }
  if (!out.length || consumed.replace(/\s/g, '') !== s.replace(/\s/g, '')) return null;
  return out;
}

// GS1 Digital Link: https://도메인/01/{gtin}/10/{lot}?17=251231
function parseDigitalLink(s) {
  const m = /^https?:\/\/[^/]+(\/[^?#]*)(\?[^#]*)?/i.exec(s);
  if (!m) return null;
  const segs = m[1].split('/').filter(Boolean);
  const start = segs.findIndex((seg, i) => /^(01|00|414|8004|8006|8003)$/.test(seg) && segs[i + 1]);
  if (start === -1) return null;
  const out = [];
  for (let i = start; i + 1 < segs.length; i += 2) {
    if (!/^\d{2,4}$/.test(segs[i])) break;
    out.push({ ai: segs[i], value: decodeURIComponent(segs[i + 1]) });
  }
  if (m[2]) {
    for (const pair of m[2].slice(1).split('&')) {
      const [k, v] = pair.split('=');
      if (/^\d{2,4}$/.test(k) && v) out.push({ ai: k, value: decodeURIComponent(v) });
    }
  }
  return out.some(e => e.ai === '01' || e.ai === '00' || e.ai === '414' || e.ai === '8004') ? out : null;
}

// YYMMDD → YYYY-MM-DD (DD=00이면 그 달 말일). GS1 규칙: 현재 기준 -49년~+50년
export function gs1Date(yymmdd) {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  let dd = parseInt(yymmdd.slice(4, 6), 10);
  if (mm < 1 || mm > 12) return null;
  const nowYear = new Date().getFullYear();
  const century = Math.floor(nowYear / 100) * 100;
  let year = century + yy;
  if (year - nowYear > 50) year -= 100;
  else if (nowYear - year > 49) year += 100;
  if (dd === 0) dd = new Date(year, mm, 0).getDate();
  if (dd > 31) return null;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// 31nn 측정값 (마지막 자리 = 소수점 아래 자릿수)
function measureValue(ai, value) {
  const decimals = parseInt(ai[3], 10);
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return n / Math.pow(10, decimals);
}

// 메인: 해석되면 { ais:[{ai,value}], gtin, lot, serial, expiry, bestBefore, prodDate, packDate, qty, netWeightKg } 아니면 null
export function parseGs1(code) {
  if (typeof code !== 'string') return null;
  let s = code.trim();
  if (!s) return null;

  let entries = null;
  // 심볼 식별 접두 (]C1 GS1-128, ]d2 DataMatrix, ]Q3 QR, ]e0 DataBar)
  const prefixed = /^\](C1|d2|Q3|e0|J1)/.test(s);
  if (prefixed) s = s.slice(3);

  if (/^https?:\/\//i.test(s)) {
    entries = parseDigitalLink(s);
  } else if (s.startsWith('(')) {
    entries = parseBracketed(s);
  } else if (prefixed || s.includes(GS) || s[0] === GS) {
    entries = parseRaw(s);
  } else if (/^01\d{14}/.test(s) && s.length > 16) {
    // 접두·GS 없이 온 경우: 01+14자리로 시작하고 뒤에도 AI가 이어질 때만 (그냥 숫자 16자리는 제외)
    const parsed = parseRaw(s);
    if (parsed && parsed.length >= 2) entries = parsed;
  }
  if (!entries || !entries.length) return null;

  const result = { ais: entries };
  for (const { ai, value } of entries) {
    switch (ai) {
      case '01': case '02': result.gtin = result.gtin || value; break;
      case '00': result.sscc = value; break;
      case '10': result.lot = value; break;
      case '21': result.serial = value; break;
      case '17': result.expiry = gs1Date(value) || value; break;
      case '15': result.bestBefore = gs1Date(value) || value; break;
      case '11': result.prodDate = gs1Date(value) || value; break;
      case '13': result.packDate = gs1Date(value) || value; break;
      case '30': case '37': {
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n > 0) result.qty = n;
        break;
      }
      default:
        if (/^310\d$/.test(ai)) result.netWeightKg = measureValue(ai, value);
        break;
    }
  }
  return result;
}

// AI 이름 (번역). 이름이 없는 AI는 "AI (xx)"
export function gs1AiLabel(ai, t) {
  if (/^310\d$/.test(ai)) return t ? t('gs1.netWeight') : 'Net weight (kg)';
  if (GS1_NAMED_AIS.includes(ai)) return t ? t(`gs1.ai${ai}`) : `AI ${ai}`;
  return `AI (${ai})`;
}

// 사람이 읽을 값 (날짜 AI는 YYYY-MM-DD, 무게는 소수)
export function gs1DisplayValue(ai, value) {
  if (['11', '12', '13', '15', '16', '17'].includes(ai)) return gs1Date(value) || value;
  if (/^3[1-6]\d\d$/.test(ai)) {
    const v = measureValue(ai, value);
    return v === null ? value : String(v);
  }
  return value;
}

// 목록·카드 한 줄 요약: "GTIN 0880… · 로트 A1 · 유통기한 2025-12-31 · 수량 12"
export function formatGs1Summary(gs1, t) {
  if (!gs1) return '';
  const tr = (key, fallback) => (t ? t(key) : fallback);
  const parts = [];
  if (gs1.gtin) parts.push(`GTIN ${gs1.gtin}`);
  else if (gs1.sscc) parts.push(`SSCC ${gs1.sscc}`);
  if (gs1.lot) parts.push(`${tr('gs1.short.lot', 'LOT')} ${gs1.lot}`);
  if (gs1.expiry) parts.push(`${tr('gs1.short.expiry', 'EXP')} ${gs1.expiry}`);
  if (gs1.qty) parts.push(`${tr('gs1.short.qty', 'QTY')} ${gs1.qty}`);
  return parts.join(' · ');
}

// 기록에 저장할 가벼운 형태 (ais 원본 + 주요 값)
export function compactGs1(gs1) {
  if (!gs1) return null;
  const { ais, gtin, sscc, lot, serial, expiry, bestBefore, prodDate, qty, netWeightKg } = gs1;
  const out = { ais };
  if (gtin) out.gtin = gtin;
  if (sscc) out.sscc = sscc;
  if (lot) out.lot = lot;
  if (serial) out.serial = serial;
  if (expiry) out.expiry = expiry;
  if (bestBefore) out.bestBefore = bestBefore;
  if (prodDate) out.prodDate = prodDate;
  if (qty) out.qty = qty;
  if (netWeightKg !== undefined && netWeightKg !== null) out.netWeightKg = netWeightKg;
  return out;
}
