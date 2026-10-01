// scripts/test-scan-rules.js - 자동 규칙 엔진 단위 테스트 (node scripts/test-scan-rules.js)
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
  m.require = (request) => {
    if (request.startsWith('.')) return load(path.relative(ROOT, path.resolve(path.dirname(file), request + (request.endsWith('.js') ? '' : '.js'))));
    return require(request);
  };
  m._compile(code, file);
  return m.exports;
}

const R = load('utils/scanRules.js');

const rules = [
  { id: 'r1', name: '위치', enabled: true, order: 0, stopAfterMatch: true,
    conditions: [{ type: 'startsWith', value: 'O-' }], actions: [{ type: 'setLocation' }] },
  { id: 'r2', name: '입고', enabled: true, order: 1, stopAfterMatch: true,
    conditions: [{ type: 'startsWith', value: '180' }], actions: [{ type: 'saveToGroup', groupId: 'g_in' }, { type: 'copy' }] },
  { id: 'r3', name: '수량 많음', enabled: true, order: 2, stopAfterMatch: false,
    conditions: [{ type: 'field', categoryId: 'cat_a', fieldIndex: 1, op: 'gt', value: '50000' }], actions: [{ type: 'feedback', haptic: 'warning' }] },
  { id: 'r4', name: '테스트 건너뜀', enabled: true, order: 3, stopAfterMatch: true,
    conditions: [{ type: 'regex', value: '^TEST' }], actions: [{ type: 'skip' }] },
  { id: 'r5', name: '꺼짐', enabled: false, order: 4, stopAfterMatch: true,
    conditions: [{ type: 'contains', value: 'X' }], actions: [{ type: 'skip' }] },
  { id: 'r6', name: 'EAN', enabled: true, order: 5, stopAfterMatch: true,
    conditions: [{ type: 'barcodeType', value: 'ean13' }, { type: 'endsWith', value: '7' }], actions: [{ type: 'openUrl', url: 'https://x.y/?c={code}&q={field2}', mode: 'send' }] },
  { id: 'r7', name: '깨진 정규식', enabled: true, order: 6, stopAfterMatch: true,
    conditions: [{ type: 'regex', value: '(' }], actions: [{ type: 'skip' }] },
  { id: 'r8', name: '카테고리', enabled: true, order: 7, stopAfterMatch: true,
    conditions: [{ type: 'category', value: 'cat_a' }], actions: [{ type: 'saveToGroup', groupId: 'g_cat' }] },
];

const cases = [
  { name: '선반 → 위치', input: { code: 'O-02-A1', type: 'qr' }, expect: { matched: ['r1'], skip: false, group: null, actions: ['setLocation'] } },
  { name: '180 → 입고+복사, 중단', input: { code: '180100048|91163||0014', type: 'qr', categoryId: 'cat_a', values: ['180100048', '91163', '', '0014'] }, expect: { matched: ['r2'], skip: false, group: 'g_in', actions: ['copy'] } },
  { name: '수량 많음 → 계속 → 카테고리 그룹', input: { code: '555|91163||1', type: 'qr', categoryId: 'cat_a', values: ['555', '91163', '', '1'] }, expect: { matched: ['r3', 'r8'], skip: false, group: 'g_cat', actions: ['feedback'] } },
  { name: '수량 적음 → 카테고리 그룹만', input: { code: '555|10||1', type: 'qr', categoryId: 'cat_a', values: ['555', '10', '', '1'] }, expect: { matched: ['r8'], skip: false, group: 'g_cat', actions: [] } },
  { name: 'TEST 건너뜀', input: { code: 'TEST123', type: 'qr' }, expect: { matched: ['r4'], skip: true, group: null, actions: [] } },
  { name: '꺼진 규칙 무시', input: { code: 'AXB', type: 'qr' }, expect: { matched: [], skip: false, group: null, actions: [] } },
  { name: 'EAN 끝 7 → URL 전송', input: { code: '8801234567897', type: 'ean13' }, expect: { matched: ['r6'], skip: false, group: null, actions: ['openUrl'] } },
  { name: 'EAN 끝 8 → 없음', input: { code: '8801234567898', type: 'ean13' }, expect: { matched: [], skip: false, group: null, actions: [] } },
  { name: '깨진 정규식은 불일치', input: { code: '(', type: 'qr' }, expect: { matched: [], skip: false, group: null, actions: [] } },
  { name: '빈 입력', input: { code: '', type: 'qr' }, expect: { matched: [], skip: false, group: null, actions: [] } },
];

let failed = 0;
for (const c of cases) {
  const { matched, decision } = R.evaluateRules(rules, c.input);
  const got = { matched: matched.map(r => r.id), skip: decision.skip, group: decision.targetGroupId, actions: decision.actions.map(a => a.type) };
  const ok = JSON.stringify(got) === JSON.stringify(c.expect);
  if (!ok) { failed++; console.log('✗', c.name, JSON.stringify(got), '≠', JSON.stringify(c.expect)); }
  else console.log('✓', c.name);
}

// 템플릿 치환
const url = R.substituteTemplate('https://x.y/?c={code}&q={field2}&n={field:품목코드}&g={group}', { code: 'A B', values: ['1', '2'] }, { fieldNames: ['품목코드', '수량'], groupName: '입고' });
if (url !== 'https://x.y/?c=A%20B&q=2&n=1&g=%EC%9E%85%EA%B3%A0') { failed++; console.log('✗ template', url); } else console.log('✓ substituteTemplate');

// 검증
const errs = R.validateRule({ name: '', conditions: [{ type: 'regex', value: '(' }], actions: [{ type: 'openUrl', url: 'ftp://x' }] });
if (errs.length < 3) { failed++; console.log('✗ validateRule', errs); } else console.log('✓ validateRule', errs.length, 'errors');
const ok = R.validateRule({ name: 'a', conditions: [{ type: 'startsWith', value: 'O-' }], actions: [{ type: 'setLocation' }] });
if (ok.length !== 0) { failed++; console.log('✗ validateRule ok', ok); } else console.log('✓ validateRule ok');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
