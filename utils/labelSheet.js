// utils/labelSheet.js - 품목 라벨을 A4 라벨지 HTML로 만든다 (expo-print 로 인쇄·PDF)
// 바코드는 직접 SVG로 그린다: EAN-13(13자리 숫자), Code 128(영문·숫자), QR(그 밖·한글). 네이티브 모듈 없이 몇백 장도 바로 만든다.
import QRCode from 'qrcode';

// A4(210×297mm) 라벨지. 많이 쓰는 규격에 맞춘 여백·칸 크기 (mm)
export const LABEL_TEMPLATES = {
  '3x7': { cols: 3, rows: 7, w: 63.5, h: 38.1, left: 7.2, top: 15.15, gapX: 2.5, gapY: 0 },
  '4x10': { cols: 4, rows: 10, w: 48.5, h: 25.4, left: 8, top: 21.5, gapX: 0, gapY: 0 },
  '2x5': { cols: 2, rows: 5, w: 100, h: 55, left: 5, top: 11, gapX: 0, gapY: 0 },
};

// ===== Code 128 =====
const C128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 '
  + '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 '
  + '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 '
  + '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 '
  + '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 '
  + '114131 311141 411131 211412 211214 211232 2331112').split(' ');
const START_B = 104, START_C = 105, TO_B = 100, TO_C = 99, STOP = 106;

/** 영문·숫자(ASCII 32~126)만 가능. 짝수 자리 숫자 묶음은 C 세트로 줄인다 */
function code128Values(text) {
  if (!/^[\x20-\x7e]+$/.test(text)) return null;
  const vals = [];
  let set = null;
  let i = 0;
  while (i < text.length) {
    const digits = (text.slice(i).match(/^\d+/) || [''])[0].length;
    // 맨 앞·맨 끝이면 4자리, 가운데면 6자리 이상 숫자일 때 C 세트가 이득
    const needC = digits >= ((i === 0 || i + digits === text.length) ? 4 : 6);
    if (needC) {
      if (set !== 'C') { vals.push(set === null ? START_C : TO_C); set = 'C'; }
      const even = digits - (digits % 2);
      for (let k = 0; k < even; k += 2) vals.push(Number(text.substr(i + k, 2)));
      i += even;
    } else {
      if (set !== 'B') { vals.push(set === null ? START_B : TO_B); set = 'B'; }
      vals.push(text.charCodeAt(i) - 32);
      i += 1;
    }
  }
  let sum = vals[0];
  for (let k = 1; k < vals.length; k++) sum += vals[k] * k;
  vals.push(sum % 103, STOP);
  return vals;
}

/** 막대 목록 [x, 폭] (모듈 단위)과 전체 폭 */
function code128Bars(text) {
  const vals = code128Values(text);
  if (!vals) return null;
  const bars = [];
  let x = 0;
  for (const v of vals) {
    const p = C128[v];
    for (let k = 0; k < p.length; k++) {
      const w = Number(p[k]);
      if (k % 2 === 0) bars.push([x, w]);
      x += w;
    }
  }
  return { bars, width: x };
}

// ===== EAN-13 =====
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map(p => p.replace(/./g, c => (c === '0' ? '1' : '0')));
const EAN_G = EAN_R.map(p => p.split('').reverse().join(''));
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13CheckDigit(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}
export function isValidEan13(code) {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code) === code[12];
}

function ean13Bars(code) {
  if (!isValidEan13(code)) return null;
  const par = EAN_PARITY[Number(code[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? EAN_L : EAN_G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(code[i])];
  bits += '101';
  const bars = [];
  const guard = new Set([0, 2, 45, 47, 92, 94]); // 가드 막대는 길게
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const last = bars[bars.length - 1];
    if (last && last[0] + last[1] === i && last[2] === guard.has(i)) last[1] += 1;
    else bars.push([i, 1, guard.has(i)]);
  }
  return { bars, width: bits.length };
}

// ===== SVG =====
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function barsSvg({ bars, width }, { ean = false } = {}) {
  const quiet = ean ? 9 : 10;
  const total = width + quiet * 2;
  const h = 40;
  const rects = bars.map(([x, w, long]) => `<rect x="${x + quiet}" y="0" width="${w}" height="${ean && !long ? h - 5 : h}"/>`).join('');
  return `<svg class="bars" viewBox="0 0 ${total} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${rects}</svg>`;
}

function qrSvg(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const d = qr.modules.data;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (d[y * n + x]) path += `M${x + 2} ${y + 2}h1v1h-1z`;
    }
  }
  return `<svg class="qr" viewBox="0 0 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><path d="${path}"/></svg>`;
}

// 막대 한 칸이 이보다 가늘면 인쇄·스캔이 어렵다 (mm)
const MIN_MODULE_MM = 0.25;

/** 품목 코드에 맞는 기호. mode: auto | barcode | qr. widthMm = 바코드를 놓을 폭 (넘치게 촘촘하면 QR) */
export function symbolFor(code, mode = 'auto', widthMm = 60) {
  if (mode !== 'qr') {
    if (mode === 'auto' && isValidEan13(code)) return { kind: 'ean13', svg: barsSvg(ean13Bars(code), { ean: true }) };
    const c128 = code128Bars(code);
    if (c128 && (c128.width + 20) * MIN_MODULE_MM <= widthMm) return { kind: 'code128', svg: barsSvg(c128) };
  }
  return { kind: 'qr', svg: qrSvg(code) };
}

/**
 * 라벨지 HTML
 * @param {Array} items 품목 [{code, name, spec, location}]
 * @param {object} opt { template, mode, copies, skip, showName, showMeta }
 */
export function buildLabelHtml(items, { template = '3x7', mode = 'auto', copies = 1, skip = 0, showName = true, showMeta = true } = {}) {
  const tp = LABEL_TEMPLATES[template] || LABEL_TEMPLATES['3x7'];
  const perPage = tp.cols * tp.rows;
  const cells = [];
  for (let i = 0; i < skip; i++) cells.push(null);
  for (const it of items) for (let k = 0; k < copies; k++) cells.push(it);

  const symbolCache = new Map();
  const small = tp.h < 30;
  const labelHtml = (it) => {
    if (!symbolCache.has(it.code)) symbolCache.set(it.code, symbolFor(it.code, mode, tp.w - (small ? 4 : 6)));
    const sym = symbolCache.get(it.code);
    const meta = showMeta ? [it.spec, it.location].filter(Boolean).join(' · ') : '';
    const text = `${showName ? `<div class="name">${esc(it.name)}</div>` : ''}${meta && !small ? `<div class="meta">${esc(meta)}</div>` : ''}`;
    if (sym.kind === 'qr') {
      return `<div class="qrwrap">${sym.svg}<div class="qrtext">${text}<div class="code">${esc(it.code)}</div></div></div>`;
    }
    return `${text}${sym.svg}<div class="code">${esc(it.code)}</div>`;
  };

  const pages = [];
  for (let p = 0; p * perPage < cells.length; p++) {
    const chunk = cells.slice(p * perPage, (p + 1) * perPage);
    const labels = chunk.map((it, i) => {
      if (!it) return '';
      const col = i % tp.cols;
      const row = Math.floor(i / tp.cols);
      const left = tp.left + col * (tp.w + tp.gapX);
      const top = tp.top + row * (tp.h + tp.gapY);
      return `<div class="label" style="left:${left}mm;top:${top}mm">${labelHtml(it)}</div>`;
    }).join('');
    pages.push(`<section class="page">${labels}</section>`);
  }

  const nameSize = small ? 2.6 : 3.2;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; background: #fff; color: #000; font-family: -apple-system, 'Noto Sans KR', 'Apple SD Gothic Neo', Roboto, sans-serif; -webkit-print-color-adjust: exact; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.label { position: absolute; width: ${tp.w}mm; height: ${tp.h}mm; padding: ${small ? 1.5 : 2.5}mm ${small ? 2 : 3}mm; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; text-align: center; }
.name { font-size: ${nameSize}mm; font-weight: 700; line-height: 1.2; max-height: ${nameSize * 2.4}mm; overflow: hidden; width: 100%; word-break: break-all; }
.meta { font-size: 2.4mm; color: #333; margin-top: 0.4mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
.bars { width: 100%; height: ${small ? 8 : 12}mm; margin-top: ${small ? 0.8 : 1.5}mm; fill: #000; }
.code { font-family: Menlo, 'Roboto Mono', monospace; font-size: ${small ? 2.3 : 2.7}mm; margin-top: 0.6mm; letter-spacing: 0.2mm; word-break: break-all; }
.qrwrap { display: flex; align-items: center; gap: 2mm; width: 100%; height: 100%; }
.qr { height: 100%; max-height: ${tp.h - (small ? 3 : 5)}mm; aspect-ratio: 1 / 1; flex: none; fill: #000; }
.qrtext { flex: 1; min-width: 0; text-align: left; }
.qrtext .code { font-size: ${small ? 2.1 : 2.5}mm; }
</style></head><body>${pages.join('')}</body></html>`;
}

export function labelPageCount(itemCount, { template = '3x7', copies = 1, skip = 0 } = {}) {
  const tp = LABEL_TEMPLATES[template] || LABEL_TEMPLATES['3x7'];
  const cells = skip + itemCount * copies;
  return Math.max(1, Math.ceil(cells / (tp.cols * tp.rows)));
}
