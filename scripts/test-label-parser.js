// scripts/test-label-parser.js - 라벨 파서 단위 테스트 (node scripts/test-label-parser.js)
const path = require('path');
const babel = require('@babel/core');
const Module = require('module');

const ROOT = path.join(__dirname, '..');

// Babel로 변환해 로드 (import/export 사용 파일)
function load(relPath) {
  const file = path.join(ROOT, relPath);
  const { code } = babel.transformFileSync(file, { configFile: path.join(ROOT, 'babel.config.js'), filename: file });
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  // 상대 import는 같은 방식으로 변환해서 로드
  m.require = (request) => {
    if (request.startsWith('.')) return load(path.relative(ROOT, path.resolve(path.dirname(file), request + (request.endsWith('.js') ? '' : '.js'))));
    return require(request);
  };
  m._compile(code, file);
  return m.exports;
}

const parser = load('utils/labelParser.js');

const categories = [
  { id: 'cat_a', signature: '|:4', delimiter: '|', fieldCount: 4, name: '라벨 A', fields: ['품목코드', '수량', '', '순번'], keyField: 0 },
  { id: 'cat_b', signature: ';:2', delimiter: ';', fieldCount: 2, name: '라벨 B', fields: ['위치', '메모'], keyField: 0 },
];

const cases = [
  { code: '180100048|91163||0014', delimiter: '|', signature: '|:4', categoryId: 'cat_a', summary: '품목코드 180100048 · 수량 91163 · 순번 0014' },
  { code: ' 1801 | 9116 | x | 14 ', delimiter: '|', signature: '|:4', categoryId: 'cat_a' },
  { code: '180100048|91163|0014', delimiter: '|', signature: '|:3', categoryId: null },   // 칸 수 다르면 다른 패턴
  { code: 'O-02-A1', delimiter: null, signature: null, categoryId: null },
  { code: 'A1;첫 번째 선반', delimiter: ';', signature: ';:2', categoryId: 'cat_b', summary: '위치 A1 · 메모 첫 번째 선반' },
  { code: 'https://example.com/a?b=1|2', delimiter: null, signature: null, categoryId: null }, // URL은 분리 안 함
  { code: 'WIFI:T:WPA;S:myssid;P:pass;;', delimiter: null, signature: null, categoryId: null },  // Wi-Fi QR
  { code: 'BEGIN:VCARD\nN:Hong;Gil\nEND:VCARD', delimiter: null, signature: null, categoryId: null },
  { code: 'a\tb\tc', delimiter: '\t', signature: '\t:3', categoryId: null },
  { code: '1,2,3,4,5', delimiter: ',', signature: ',:5', categoryId: null },
  { code: '|', delimiter: '|', signature: '|:2', categoryId: null },                         // 빈 칸 2개
  { code: '', delimiter: null, signature: null, categoryId: null },
];

let failed = 0;
for (const c of cases) {
  const delimiter = parser.detectDelimiter(c.code);
  const signature = parser.signatureOf(c.code);
  const parsed = parser.parseLabel(c.code, categories);
  const categoryId = parsed ? parsed.categoryId : null;
  const problems = [];
  if (delimiter !== c.delimiter) problems.push(`delimiter ${JSON.stringify(delimiter)} ≠ ${JSON.stringify(c.delimiter)}`);
  if (signature !== c.signature) problems.push(`signature ${JSON.stringify(signature)} ≠ ${JSON.stringify(c.signature)}`);
  if (categoryId !== c.categoryId) problems.push(`category ${categoryId} ≠ ${c.categoryId}`);
  if (c.summary) {
    const label = parser.labelOfItem({ code: c.code, ...(parsed || {}) }, categories);
    const summary = parser.formatLabelSummary(label, 3);
    if (summary !== c.summary) problems.push(`summary ${JSON.stringify(summary)} ≠ ${JSON.stringify(c.summary)}`);
  }
  if (problems.length) { failed++; console.log('✗', JSON.stringify(c.code), problems.join(' / ')); }
  else console.log('✓', JSON.stringify(c.code));
}

// 이름 생성
const names = [];
let cats = [];
for (let i = 0; i < 28; i++) { const n = parser.nextCategoryName(cats); names.push(n); cats = [...cats, { name: n }]; }
if (names[0] !== '라벨 A' || names[25] !== '라벨 Z' || names[26] !== '라벨 AA' || names[27] !== '라벨 AB') { failed++; console.log('✗ names', names.slice(24, 28)); }
else console.log('✓ nextCategoryName A..Z, AA, AB');

// buildCategory
const built = parser.buildCategory('180100048|91163||0014', []);
if (!built || built.signature !== '|:4' || built.fields.length !== 4 || built.fields[0] !== '필드1' || built.name !== '라벨 A') { failed++; console.log('✗ buildCategory', built); }
else console.log('✓ buildCategory');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
