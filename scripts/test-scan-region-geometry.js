// scripts/test-scan-region-geometry.js - 화면 영역 → 센서 좌표 역변환이 라이브러리 정변환(computeHighlights)과 맞는지
// 사용: node scripts/test-scan-region-geometry.js
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

function load(file, platform) {
  let src = fs.readFileSync(file, 'utf8');
  const { code } = babel.transformSync(src, { filename: file, presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]], babelrc: false, configFile: false });
  const m = { exports: {} };
  new Function('module', 'exports', 'require', code)(m, m.exports, (n) => (n === 'react-native' ? { Platform: { OS: platform } } : require(n)));
  return m.exports;
}

// 라이브러리 정변환을 dist에서 그대로 꺼낸다
function libForward(platform) {
  const dist = fs.readFileSync(path.join(__dirname, '../node_modules/@mgcrea/vision-camera-barcode-scanner/dist/index.js'), 'utf8');
  const grab = (name) => {
    const i = dist.indexOf(`var ${name} =`);
    let depth = 0, j = dist.indexOf('{', dist.indexOf('=>', i));
    for (; j < dist.length; j++) { if (dist[j] === '{') depth++; else if (dist[j] === '}' && --depth === 0) break; }
    return dist.slice(i, j + 2);
  };
  const body = [grab('normalizePrecision'), grab('applyScaleFactor'), grab('applyTransformation')].join('\n')
    + '\nreturn { applyScaleFactor, applyTransformation };';
  return new Function('Platform2', body)({ OS: platform });
}

let fail = 0;
for (const platform of ['android', 'ios']) {
  const { viewRegionToSensor } = load(path.join(__dirname, '../utils/scanRegionGeometry.js'), platform);
  const lib = libForward(platform);
  const cases = [
    { layout: { width: 411, height: 914 }, frame: { width: 1920, height: 1080, orientation: platform === 'ios' ? 'portrait' : 'landscape-right' } },
    { layout: { width: 411, height: 914 }, frame: { width: 1920, height: 1080, orientation: 'landscape-left' } },
    { layout: { width: 884, height: 960 }, frame: { width: 1920, height: 1080, orientation: 'landscape-right' } }, // 폴드 내부 화면
    { layout: { width: 412, height: 964 }, frame: { width: 1920, height: 1440, orientation: 'portrait' } },
  ];
  const regions = [{ x: 31, y: 312, width: 350, height: 176 }, { x: 0, y: 100, width: 200, height: 120 }, { x: 150, y: 600, width: 100, height: 100 }];
  for (const c of cases) {
    for (const r of regions) {
      if (r.x + r.width > c.layout.width || r.y + r.height > c.layout.height) continue;
      const out = viewRegionToSensor(r, c.layout, c.frame, platform === 'ios');
      if (!out) { console.log(`- ${platform} ${c.frame.orientation} region ${JSON.stringify(r)} → 센서 밖(null)`); continue; }
      const adj = { width: c.layout.height, height: c.layout.width };
      // 센서 사각형 네 모서리를 정변환해 화면 사각형으로
      const [nx, ny, nw, nh] = out;
      const pts = [[nx, ny], [nx + nw, ny], [nx, ny + nh], [nx + nw, ny + nh]].map(([a, b]) => {
        const sp = lib.applyScaleFactor({ x: a * c.frame.width, y: b * c.frame.height }, c.frame, adj, 'cover');
        return lib.applyTransformation(sp, adj, c.frame.orientation);
      });
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const back = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      const err = Math.max(Math.abs(back.x - r.x), Math.abs(back.y - r.y), Math.abs(back.width - r.width), Math.abs(back.height - r.height));
      // 영역이 센서 밖(cover로 잘린 부분)에 걸치면 잘라내므로 그 경우는 넘어간다
      const clipped = out.some((v, i) => (i < 2 ? v <= 0 : false)) || nx + nw >= 1 || ny + nh >= 1;
      const ok = err < 1 || clipped;
      if (!ok) fail++;
      console.log(`${ok ? '✓' : '✗'} ${platform} ${c.frame.orientation} layout ${c.layout.width}x${c.layout.height} region ${JSON.stringify(r)} → [${out.map(v => v.toFixed(3)).join(', ')}] 오차 ${err.toFixed(2)}${clipped ? ' (잘림)' : ''}`);
    }
  }
}
if (fail) { console.error(`${fail} failed`); process.exit(1); }
console.log('all passed');
