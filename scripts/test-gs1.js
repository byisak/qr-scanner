// scripts/test-gs1.js - GS1 해석 단위 테스트 (node scripts/test-gs1.js)
const path = require('path');
const babel = require('@babel/core');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
function load(relPath) {
  const file = path.join(ROOT, relPath);
  const { code } = babel.transformFileSync(file, { configFile: path.join(ROOT, 'babel.config.js'), filename: file });
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}
const G = load('utils/gs1.js');
const GS = '\u001d';

const cases = [
  { name: '괄호 표기', code: '(01)08801234567890(17)251231(10)LOT7', expect: { gtin: '08801234567890', expiry: '2025-12-31', lot: 'LOT7' } },
  { name: 'GS 구분 원본', code: `0108801234567890` + `10ABC123${GS}` + `17260600` + `3012`, expect: { gtin: '08801234567890', lot: 'ABC123', expiry: '2026-06-30', qty: 12 } },
  { name: ']C1 접두', code: `]C10108801234567890211234567`, expect: { gtin: '08801234567890', serial: '1234567' } },
  { name: 'Digital Link', code: 'https://id.gs1.org/01/09506000134352/10/ABC1?17=270101', expect: { gtin: '09506000134352', lot: 'ABC1', expiry: '2027-01-01' } },
  { name: '접두 없이 01+AI', code: '010880123456789017251231', expect: { gtin: '08801234567890', expiry: '2025-12-31' } },
  { name: '무게 3103', code: '(01)08801234567890(3103)001250', expect: { gtin: '08801234567890', netWeightKg: 1.25 } },
  { name: 'SSCC', code: '(00)388012345678901234', expect: { sscc: '388012345678901234' } },
  { name: '일반 EAN-13은 아님', code: '8801234567890', expect: null },
  { name: '숫자 16자리는 아님', code: '0108801234567890', expect: null },
  { name: '라벨 파이프 문자열은 아님', code: '180100048|91163||0014', expect: null },
  { name: '일반 URL은 아님', code: 'https://example.com/products/12', expect: null },
  { name: '깨진 괄호', code: '(01)123(xx)', expect: null },
];

let failed = 0;
for (const c of cases) {
  const r = G.parseGs1(c.code);
  let ok;
  if (c.expect === null) ok = r === null;
  else ok = !!r && Object.entries(c.expect).every(([k, v]) => r[k] === v);
  if (!ok) { failed++; console.log('✗', c.name, JSON.stringify(r)); } else console.log('✓', c.name);
}
const d = G.gs1Date('250200');
if (d !== '2025-02-28') { failed++; console.log('✗ DD=00 말일', d); } else console.log('✓ DD=00 말일');
const s = G.formatGs1Summary(G.parseGs1('(01)08801234567890(10)A1(17)251231(30)5'));
if (s !== 'GTIN 08801234567890 · LOT A1 · EXP 2025-12-31 · QTY 5') { failed++; console.log('✗ summary', s); } else console.log('✓ summary');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
