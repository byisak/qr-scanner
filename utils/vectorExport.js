// utils/vectorExport.js - 생성한 코드를 벡터(SVG·EPS) 파일로
// SVG → EPS: 우리가 만드는 SVG(바코드 bwip-js, 이후 QR)에 쓰는 요소만 옮긴다.
//   path(d: M L H V C S Q T A Z, 절대·상대) / rect / circle / ellipse / polygon / g
//   fill·stroke(#hex, rgb()), stroke-width, fill-rule, transform(matrix·translate·scale·rotate), viewBox
// 색은 RGB 그대로. 그 밖의 요소(image·text·그라데이션)는 건너뛰고 skipped 로 알린다.

const PT_PER_MM = 72 / 25.4;
const num = (v) => {
  const n = Math.round(v * 1000) / 1000;
  return Object.is(n, -0) ? '0' : String(n);
};

// ===== 행렬 =====
const IDENTITY = [1, 0, 0, 1, 0, 0];
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
function parseTransform(str) {
  let m = IDENTITY;
  if (!str) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let t;
  while ((t = re.exec(str))) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n = IDENTITY;
    if (t[1] === 'matrix' && a.length === 6) n = a;
    else if (t[1] === 'translate') n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (t[1] === 'scale') n = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
    else if (t[1] === 'rotate') {
      const r = (a[0] * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      n = [c, s, -s, c, 0, 0];
      if (a.length === 3) n = multiply(multiply([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
    } else if (t[1] === 'skewX') n = [1, 0, Math.tan((a[0] * Math.PI) / 180), 1, 0, 0];
    else if (t[1] === 'skewY') n = [1, Math.tan((a[0] * Math.PI) / 180), 0, 1, 0, 0];
    m = multiply(m, n);
  }
  return m;
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// ===== 색 =====
const NAMED = { black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff' };
function parseColor(v) {
  if (!v) return null;
  v = v.trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return null;
  if (NAMED[v]) v = '#' + NAMED[v];
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) v = '#' + m[1].split('').map(c => c + c).join('');
  m = /^#?([0-9a-f]{6})$/.exec(v);
  if (m) {
    const h = m[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) return m[1].split(',').slice(0, 3).map(s => Math.min(1, parseFloat(s) / (s.includes('%') ? 100 : 255)));
  return undefined; // url(#gradient) 등: 알 수 없음
}
const rgbOp = (c) => `${num(c[0])} ${num(c[1])} ${num(c[2])} setrgbcolor`;

// ===== path d → 절대 좌표 명령 (M L C Z) =====
function tokenizePath(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let t;
  while ((t = re.exec(d))) out.push(t[1] || Number(t[2]));
  return out;
}

// SVG 원호 → 3차 베지어 (SVG 1.1 부록 F.6)
function arcToBeziers(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const sinp = Math.sin((phi * Math.PI) / 180), cosp = Math.cos((phi * Math.PI) / 180);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosp * dx + sinp * dy, y1p = -sinp * dx + cosp * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = fa === fs ? -1 : 1;
  const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) / (rx * rx * y1p * y1p + ry * ry * x1p * x1p));
  const coef = sign * Math.sqrt(sq);
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cosp * cxp - sinp * cyp + (x1 + x2) / 2, cy = sinp * cxp + cosp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const delta = dt / segs;
  const k = (4 / 3) * Math.tan(delta / 4);
  const out = [];
  for (let i = 0; i < segs; i++) {
    const a1 = t1, a2 = t1 + delta;
    const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const p = (ex, ey) => [cosp * rx * ex - sinp * ry * ey + cx, sinp * rx * ex + cosp * ry * ey + cy];
    const [q1x, q1y] = p(c1 - k * s1, s1 + k * c1);
    const [q2x, q2y] = p(c2 + k * s2, s2 - k * c2);
    const [ex, ey] = p(c2, s2);
    out.push([q1x, q1y, q2x, q2y, ex, ey]);
    t1 = a2;
  }
  return out;
}

export function pathToCommands(d) {
  const tk = tokenizePath(d);
  const cmds = [];
  let i = 0, cmd = null;
  let x = 0, y = 0, sx = 0, sy = 0, lcx = null, lcy = null, lqx = null, lqy = null;
  const next = () => tk[i++];
  while (i < tk.length) {
    if (typeof tk[i] === 'string') cmd = next();
    else if (cmd === null) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') {
      cmds.push(['Z']); x = sx; y = sy; lcx = lqx = null;
      continue;
    }
    if (C === 'M') {
      x = ox + next(); y = oy + next(); sx = x; sy = y;
      cmds.push(['M', x, y]);
      cmd = rel ? 'l' : 'L'; lcx = lqx = null;
    } else if (C === 'L') {
      x = ox + next(); y = oy + next(); cmds.push(['L', x, y]); lcx = lqx = null;
    } else if (C === 'H') {
      x = (rel ? x : 0) + next(); cmds.push(['L', x, y]); lcx = lqx = null;
    } else if (C === 'V') {
      y = (rel ? y : 0) + next(); cmds.push(['L', x, y]); lcx = lqx = null;
    } else if (C === 'C' || C === 'S') {
      let x1, y1;
      if (C === 'C') { x1 = ox + next(); y1 = oy + next(); }
      else { x1 = lcx !== null ? 2 * x - lcx : x; y1 = lcy !== null ? 2 * y - lcy : y; }
      const x2 = ox + next(), y2 = oy + next(), ex = ox + next(), ey = oy + next();
      cmds.push(['C', x1, y1, x2, y2, ex, ey]);
      lcx = x2; lcy = y2; lqx = null; x = ex; y = ey;
    } else if (C === 'Q' || C === 'T') {
      let qx, qy;
      if (C === 'Q') { qx = ox + next(); qy = oy + next(); }
      else { qx = lqx !== null ? 2 * x - lqx : x; qy = lqy !== null ? 2 * y - lqy : y; }
      const ex = ox + next(), ey = oy + next();
      // 2차 → 3차
      cmds.push(['C', x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey]);
      lqx = qx; lqy = qy; lcx = null; x = ex; y = ey;
    } else if (C === 'A') {
      const rx = next(), ry = next(), phi = next(), fa = next(), fs = next();
      const ex = ox + next(), ey = oy + next();
      for (const b of arcToBeziers(x, y, rx, ry, phi, fa, fs, ex, ey)) cmds.push(['C', ...b]);
      x = ex; y = ey; lcx = lqx = null;
    } else {
      i++;
    }
  }
  return cmds;
}

// ===== 아주 작은 SVG 파서 (우리가 만든 SVG 전용) =====
function parseAttrs(s) {
  const a = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let t;
  while ((t = re.exec(s))) a[t[1]] = t[3] !== undefined ? t[3] : t[4];
  if (a.style) {
    for (const kv of a.style.split(';')) {
      const [k, v] = kv.split(':').map(z => z && z.trim());
      if (k && v && a[k] === undefined) a[k] = v;
    }
  }
  return a;
}

function parseSvg(svg) {
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([\w:-]+)([^>]*?)(\/?)>/g;
  let t;
  while ((t = re.exec(svg))) {
    const [, closing, tag, rest, selfClose] = t;
    if (tag.startsWith('?') || tag === '!--') continue;
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const node = { tag, attrs: parseAttrs(rest), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.children.find(n => n.tag === 'svg') || root;
}

const len = (v, fallback = 0) => (v === undefined || v === null || v === '' ? fallback : parseFloat(v));

function shapeCommands(n, vb) {
  const a = n.attrs;
  // 퍼센트 길이는 viewBox 기준 (bwip-js 배경: width="100%")
  const pct = (v, total, fallback) => (typeof v === 'string' && v.trim().endsWith('%') ? (parseFloat(v) / 100) * total : len(v, fallback));
  switch (n.tag) {
    case 'path': return a.d ? pathToCommands(a.d) : [];
    case 'rect': {
      const x = pct(a.x, vb.w, 0), y = pct(a.y, vb.h, 0);
      const w = pct(a.width, vb.w, 0), h = pct(a.height, vb.h, 0);
      let rx = len(a.rx, a.ry !== undefined ? len(a.ry) : 0), ry = len(a.ry, rx);
      if (!(w > 0 && h > 0)) return [];
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!rx || !ry) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
      return pathToCommands(`M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`);
    }
    case 'circle':
    case 'ellipse': {
      const cx = len(a.cx), cy = len(a.cy);
      const rx = n.tag === 'circle' ? len(a.r) : len(a.rx), ry = n.tag === 'circle' ? len(a.r) : len(a.ry);
      if (!(rx > 0 && ry > 0)) return [];
      return pathToCommands(`M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`);
    }
    case 'polygon':
    case 'polyline': {
      const p = (a.points || '').trim().split(/[\s,]+/).map(Number);
      if (p.length < 4) return [];
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return pathToCommands(n.tag === 'polygon' ? d + 'Z' : d);
    }
    case 'line':
      return [['M', len(a.x1), len(a.y1)], ['L', len(a.x2), len(a.y2)]];
    default: return [];
  }
}

function commandsToPs(cmds, m) {
  let ps = 'newpath\n';
  for (const c of cmds) {
    if (c[0] === 'M') { const [x, y] = apply(m, c[1], c[2]); ps += `${num(x)} ${num(y)} moveto\n`; }
    else if (c[0] === 'L') { const [x, y] = apply(m, c[1], c[2]); ps += `${num(x)} ${num(y)} lineto\n`; }
    else if (c[0] === 'C') {
      const p1 = apply(m, c[1], c[2]), p2 = apply(m, c[3], c[4]), p3 = apply(m, c[5], c[6]);
      ps += `${num(p1[0])} ${num(p1[1])} ${num(p2[0])} ${num(p2[1])} ${num(p3[0])} ${num(p3[1])} curveto\n`;
    } else if (c[0] === 'Z') ps += 'closepath\n';
  }
  return ps;
}

/**
 * SVG 문자열 → EPS 문자열
 * @param {string} svg
 * @param {{ widthMm?: number, title?: string }} opt widthMm 를 주면 그 폭(mm)으로, 아니면 SVG width/viewBox 를 pt 로 본다
 * @returns {{ eps: string, widthPt: number, heightPt: number, skipped: string[] }}
 */
export function svgToEps(svg, { widthMm, title = 'code' } = {}) {
  const root = parseSvg(svg);
  const vb = (root.attrs.viewBox || '').split(/[\s,]+/).map(Number);
  const vbW = vb.length === 4 ? vb[2] : len(root.attrs.width, 100);
  const vbH = vb.length === 4 ? vb[3] : len(root.attrs.height, 100);
  const vbX = vb.length === 4 ? vb[0] : 0, vbY = vb.length === 4 ? vb[1] : 0;
  let widthPt;
  if (widthMm) widthPt = widthMm * PT_PER_MM;
  else if (/mm$/.test(root.attrs.width || '')) widthPt = parseFloat(root.attrs.width) * PT_PER_MM;
  else widthPt = len(root.attrs.width, vbW);
  const k = widthPt / vbW;
  const heightPt = vbH * k;
  // SVG(y 아래로) → PS(y 위로)
  const base = [k, 0, 0, -k, -vbX * k, heightPt + vbY * k];
  const skipped = new Set();
  let body = '';

  const walk = (node, m, inherited) => {
    const a = node.attrs;
    if (['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'title', 'desc', 'metadata', 'style'].includes(node.tag)) return;
    if (a.display === 'none' || a.visibility === 'hidden' || a.opacity === '0') return;
    const mm = multiply(m, parseTransform(a.transform));
    const st = {
      fill: a.fill !== undefined ? a.fill : inherited.fill,
      stroke: a.stroke !== undefined ? a.stroke : inherited.stroke,
      strokeWidth: a['stroke-width'] !== undefined ? parseFloat(a['stroke-width']) : inherited.strokeWidth,
      fillRule: a['fill-rule'] || inherited.fillRule,
      lineCap: a['stroke-linecap'] || inherited.lineCap,
    };
    if (node.tag === 'svg' || node.tag === 'g' || node.tag === 'a') {
      for (const c of node.children) walk(c, mm, st);
      return;
    }
    if (node.tag === 'image' || node.tag === 'text' || node.tag === 'use' || node.tag === 'foreignObject') { skipped.add(node.tag); return; }
    if (a['clip-path']) skipped.add('clip-path');
    const cmds = shapeCommands(node, { x: vbX, y: vbY, w: vbW, h: vbH });
    if (!cmds.length) return;
    const path = commandsToPs(cmds, mm);
    const fill = parseColor(st.fill === undefined ? '#000' : st.fill);
    if (fill === undefined) skipped.add('gradient');
    if (fill) body += `${path}${rgbOp(fill)}\n${st.fillRule === 'evenodd' ? 'eofill' : 'fill'}\n`;
    const stroke = parseColor(st.stroke);
    if (stroke && st.strokeWidth !== 0) {
      // 선 굵기는 현재 변환의 크기만큼
      const scale = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2]));
      const cap = st.lineCap === 'round' ? 1 : st.lineCap === 'square' ? 2 : 0;
      body += `${path}${rgbOp(stroke)}\n${num((st.strokeWidth ?? 1) * scale)} setlinewidth ${cap} setlinecap\nstroke\n`;
    }
  };
  walk(root, base, { fill: undefined, stroke: undefined, strokeWidth: 1, fillRule: 'nonzero', lineCap: 'butt' });

  const W = Math.ceil(widthPt), H = Math.ceil(heightPt);
  const safeTitle = String(title).replace(/[()\\\r\n]/g, ' ').slice(0, 80);
  const eps = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${W} ${H}`,
    `%%HiResBoundingBox: 0 0 ${num(widthPt)} ${num(heightPt)}`,
    `%%Title: (${safeTitle})`,
    '%%Creator: QR Scanner (ScanView)',
    `%%CreationDate: (${new Date().toISOString()})`,
    '%%DocumentData: Clean7Bit',
    '%%LanguageLevel: 2',
    '%%Pages: 1',
    '%%EndComments',
    '%%BeginProlog',
    '%%EndProlog',
    '%%Page: 1 1',
    'gsave',
    body.trimEnd(),
    'grestore',
    'showpage',
    '%%EOF',
    '',
  ].join('\n');
  return { eps, widthPt, heightPt, skipped: [...skipped] };
}

export const mmFromPt = (pt) => pt / PT_PER_MM;
export { PT_PER_MM };
