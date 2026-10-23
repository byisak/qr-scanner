// utils/vectorExport.js - 생성한 코드를 벡터(SVG·EPS) 파일로
// SVG → EPS: 우리가 만드는 SVG(바코드 bwip-js, 이후 QR)에 쓰는 요소만 옮긴다.
//   path(d: M L H V C S Q T A Z, 절대·상대) / rect / circle / ellipse / polygon / g
//   fill·stroke(#hex, rgb()), stroke-width, fill-rule, transform(matrix·translate·scale·rotate), viewBox
//   clip-path(url(#id)) → PostScript clip, 선형·원형 그라데이션 → shfill (LanguageLevel 3)
//   image → opts.images[n] (문서 순서 n 번째 <image> 를 미리 JPEG 로 바꾼 것)이 있으면 DCTDecode 로 넣는다
// 색은 RGB 그대로. 그 밖의 요소(text, JPEG 없는 image)는 건너뛰고 skipped 로 알린다.

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

const urlId = (v) => {
  const m = /url\(\s*['"]?#([^'")]+)['"]?\s*\)/.exec(v || '');
  return m ? m[1] : null;
};

function collectDefs(root) {
  const clips = {}, grads = {};
  const visit = (n) => {
    if (n.tag === 'clipPath' && n.attrs.id) clips[n.attrs.id] = n;
    else if ((n.tag === 'linearGradient' || n.tag === 'radialGradient') && n.attrs.id) grads[n.attrs.id] = n;
    for (const c of n.children) visit(c);
  };
  visit(root);
  return { clips, grads };
}

const pctOrNum = (v, total) => (typeof v === 'string' && v.trim().endsWith('%') ? (parseFloat(v) / 100) * total : parseFloat(v));

// 그라데이션 색 함수 (정지점 2개면 Type 2, 그 이상이면 Type 3 로 이어 붙인다)
function shadingFunction(stops) {
  const c = (st) => `[${st.color.map(num).join(' ')}]`;
  const t2 = (a, b) => `<< /FunctionType 2 /Domain [0 1] /C0 ${c(a)} /C1 ${c(b)} /N 1 >>`;
  if (stops.length === 1) return t2(stops[0], stops[0]);
  if (stops.length === 2 && stops[0].offset === 0 && stops[1].offset === 1) return t2(stops[0], stops[1]);
  const pts = [...stops];
  if (pts[0].offset > 0) pts.unshift({ offset: 0, color: pts[0].color });
  if (pts[pts.length - 1].offset < 1) pts.push({ offset: 1, color: pts[pts.length - 1].color });
  const fns = [], bounds = [], encode = [];
  for (let i = 0; i < pts.length - 1; i++) {
    fns.push(t2(pts[i], pts[i + 1]));
    if (i > 0) bounds.push(num(pts[i].offset));
    encode.push('0 1');
  }
  return `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(' ')}] /Bounds [${bounds.join(' ')}] /Encode [${encode.join(' ')}] >>`;
}

function gradientShading(g, m, box) {
  const a = g.attrs;
  const stops = g.children.filter(c => c.tag === 'stop').map(st => ({
    offset: Math.min(1, Math.max(0, pctOrNum(st.attrs.offset || '0', 1))),
    color: parseColor(st.attrs['stop-color'] || '#000') || [0, 0, 0],
  })).sort((x, y) => x.offset - y.offset);
  if (!stops.length) return null;
  // objectBoundingBox(기본)면 도형 상자 기준 비율
  const userSpace = a.gradientUnits === 'userSpaceOnUse';
  const P = (x, y) => (userSpace ? apply(m, x, y) : apply(m, box.x + x * box.w, box.y + y * box.h));
  const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const fn = shadingFunction(stops);
  if (g.tag === 'linearGradient') {
    const x1 = pctOrNum(a.x1 ?? (userSpace ? '0' : '0'), 1), y1 = pctOrNum(a.y1 ?? '0', 1);
    const x2 = pctOrNum(a.x2 ?? (userSpace ? '0' : '1'), 1), y2 = pctOrNum(a.y2 ?? '0', 1);
    const p1 = P(x1, y1), p2 = P(x2, y2);
    return `<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${num(p1[0])} ${num(p1[1])} ${num(p2[0])} ${num(p2[1])}] /Function ${fn} /Extend [true true] >> shfill`;
  }
  const cx = pctOrNum(a.cx ?? '0.5', 1), cy = pctOrNum(a.cy ?? '0.5', 1), r = pctOrNum(a.r ?? '0.5', 1);
  const fx = a.fx !== undefined ? pctOrNum(a.fx, 1) : cx, fy = a.fy !== undefined ? pctOrNum(a.fy, 1) : cy;
  const c0 = P(fx, fy), c1 = P(cx, cy);
  const rr = userSpace ? r * scale : r * Math.max(box.w, box.h) * scale;
  return `<< /ShadingType 3 /ColorSpace /DeviceRGB /Coords [${num(c0[0])} ${num(c0[1])} 0 ${num(c1[0])} ${num(c1[1])} ${num(rr)}] /Function ${fn} /Extend [true true] >> shfill`;
}

function bboxOf(cmds) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cmds) for (let i = 1; i + 1 < c.length; i += 2) {
    x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]); y0 = Math.min(y0, c[i + 1]); y1 = Math.max(y1, c[i + 1]);
  }
  return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 1, h: 1 };
}

// ===== 이미지 (JPEG → ASCII85) =====
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64) {
  const clean = String(b64).replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

export function ascii85(bytes) {
  let out = '';
  let line = 0;
  const push = (s) => {
    out += s; line += s.length;
    if (line >= 75) { out += '\n'; line = 0; }
  };
  for (let i = 0; i < bytes.length; i += 4) {
    const rem = Math.min(4, bytes.length - i);
    let n = 0;
    for (let k = 0; k < 4; k++) n = n * 256 + (k < rem ? bytes[i + k] : 0);
    if (n === 0 && rem === 4) { push('z'); continue; }
    const c = [];
    for (let k = 4; k >= 0; k--) { c[k] = String.fromCharCode(33 + (n % 85)); n = Math.floor(n / 85); }
    push(c.slice(0, rem + 1).join(''));
  }
  return out + '~>';
}

/**
 * SVG 문자열 → EPS 문자열
 * @param {string} svg
 * @param {{ widthMm?: number, title?: string, images?: Array<{jpeg: string, w: number, h: number}> }} opt widthMm 를 주면 그 폭(mm)으로, 아니면 SVG width/viewBox 를 pt 로 본다
 * @returns {{ eps: string, widthPt: number, heightPt: number, skipped: string[] }}
 */
export function svgToEps(svg, { widthMm, title = 'code', images = [] } = {}) {
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
  const defs = collectDefs(root);
  let usesShading = false;
  let imageIndex = 0;
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
    if (node.tag === 'image') {
      const img = images[imageIndex++];
      const x = len(a.x), y = len(a.y), w = len(a.width), h = len(a.height);
      if (!img || !img.jpeg || !(w > 0 && h > 0)) { skipped.add('image'); return; }
      // 단위 정사각형(이미지 공간) → 그림 자리 (SVG 좌표, y 아래로) → 페이지
      const A = multiply(mm, [w, 0, 0, -h, x, y + h]);
      body += `gsave\n[${A.map(num).join(' ')}] concat\n/DeviceRGB setcolorspace\n`
        + `<< /ImageType 1 /Width ${img.w} /Height ${img.h} /BitsPerComponent 8 /Decode [0 1 0 1 0 1] /ImageMatrix [${img.w} 0 0 -${img.h} 0 ${img.h}]`
        + ` /DataSource currentfile /ASCII85Decode filter /DCTDecode filter >> image\n${ascii85(base64ToBytes(img.jpeg))}\ngrestore\n`;
      return;
    }
    if (node.tag === 'text' || node.tag === 'use' || node.tag === 'foreignObject') { skipped.add(node.tag); return; }
    const cmds = shapeCommands(node, { x: vbX, y: vbY, w: vbW, h: vbH });
    if (!cmds.length) return;
    const path = commandsToPs(cmds, mm);
    // clip-path: clipPath 안의 도형들을 잘라내기 영역으로 (qr-code-styling 은 점들을 이렇게 칠한다)
    const clipNode = a['clip-path'] ? defs.clips[urlId(a['clip-path'])] : null;
    let clipPs = '';
    if (clipNode) {
      const parts = [];
      const collect = (cn, cm) => {
        const cmm = multiply(cm, parseTransform(cn.attrs.transform));
        if (cn.tag === 'g') { for (const k of cn.children) collect(k, cmm); return; }
        const cc = shapeCommands(cn, { x: vbX, y: vbY, w: vbW, h: vbH });
        if (cc.length) parts.push(commandsToPs(cc, cmm).replace(/^newpath\n/, ''));
      };
      for (const k of clipNode.children) collect(k, mm);
      if (!parts.length) return; // 빈 잘라내기 영역 = 아무것도 안 보인다
      clipPs = `newpath\n${parts.join('')}clip\n`;
    }
    const fillRaw = st.fill === undefined ? '#000' : st.fill;
    const gradNode = urlId(fillRaw) ? defs.grads[urlId(fillRaw)] : null;
    if (gradNode) {
      const sh = gradientShading(gradNode, mm, bboxOf(cmds));
      if (sh) {
        usesShading = true;
        body += `gsave\n${clipPs}${path}${st.fillRule === 'evenodd' ? 'eoclip' : 'clip'}\n${sh}\ngrestore\n`;
      }
    } else {
      const fill = parseColor(fillRaw);
      if (fill === undefined) skipped.add('paint');
      if (fill) body += `${clipPs ? `gsave\n${clipPs}` : ''}${path}${rgbOp(fill)}\n${st.fillRule === 'evenodd' ? 'eofill' : 'fill'}\n${clipPs ? 'grestore\n' : ''}`;
    }
    const stroke = parseColor(st.stroke);
    if (stroke && st.strokeWidth !== 0) {
      // 선 굵기는 현재 변환의 크기만큼
      const scale = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2]));
      const cap = st.lineCap === 'round' ? 1 : st.lineCap === 'square' ? 2 : 0;
      body += `${clipPs ? `gsave\n${clipPs}` : ''}${path}${rgbOp(stroke)}\n${num((st.strokeWidth ?? 1) * scale)} setlinewidth ${cap} setlinecap\nstroke\n${clipPs ? 'grestore\n' : ''}`;
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
    `%%LanguageLevel: ${usesShading ? 3 : 2}`,
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

/** SVG 에 viewBox 와 실제 크기(mm)를 넣는다 (qr-code-styling SVG 는 px width/height 만 있다) */
export function withPhysicalSize(svg, widthMm) {
  const m = /<svg\b([^>]*)>/.exec(svg);
  if (!m) return svg;
  const attrs = parseAttrs(m[1]);
  let vb = attrs.viewBox;
  const w = parseFloat(attrs.width) || 100, h = parseFloat(attrs.height) || w;
  if (!vb) vb = `0 0 ${w} ${h}`;
  const [, , vw, vh] = vb.split(/[\s,]+/).map(Number);
  const heightMm = (widthMm * vh) / vw;
  const rest = m[1].replace(/\s(width|height|viewBox)\s*=\s*("[^"]*"|'[^']*')/g, '');
  const head = `<svg${rest} width="${num(widthMm)}mm" height="${num(heightMm)}mm" viewBox="${vb}">`;
  let out = svg.replace(m[0], head);
  if (!/^<\?xml/.test(out.trim())) out = `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
  return out;
}

export const mmFromPt = (pt) => pt / PT_PER_MM;
export { PT_PER_MM };
