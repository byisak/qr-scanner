// scripts/test-stocktake.js - 재고 실사 단위 테스트 (node scripts/test-stocktake.js)
const path = require('path');
const babel = require('@babel/core');
const Module = require('module');
const ROOT = path.join(__dirname, '..');
// AsyncStorage는 테스트에서 쓰지 않으니 빈 모듈로
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === '@react-native-async-storage/async-storage') return path.join(__dirname, 'test-stocktake.js');
  return realResolve.call(this, req, ...rest);
};
function load(rel) {
  const file = path.join(ROOT, rel);
  const { code } = babel.transformFileSync(file, { configFile: path.join(ROOT, 'babel.config.js'), filename: file });
  const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file); return m.exports;
}
if (require.main !== module) { module.exports = {}; return; }
const S = load('utils/stocktake.js');
let failed = 0;
const check = (name, cond, extra) => { if (cond) console.log('✓', name); else { failed++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const items = S.parseExpectedList('코드,이름,수량\n8801234567890,생수,3\n180100048|91163||0014\t박스\t2\nO-02-A1\n8801234567890,생수,1\n');
check('parse: 머리글 건너뜀 + 같은 코드 합침', items.length === 3 && items[0].expected === 4, items);
check('parse: 탭 구분 + 파이프가 든 코드', items[1].code === '180100048|91163||0014' && items[1].name === '박스' && items[1].expected === 2, items[1]);
check('parse: 코드만', items[2].code === 'O-02-A1' && items[2].expected === 1, items[2]);

let st = S.createStocktake('t', items);
let r = S.recordStocktakeScan(st, { code: '8801234567890' }); st = r.stocktake;
check('일치(부족)', r.status === 'matched' && r.item.scanned === 1);
r = S.recordStocktakeScan(st, { code: '(01)08801234567890', gtin: '8801234567890', qty: 3 }); st = r.stocktake;
check('GTIN으로 매칭 + 수량 3 → 완료', r.status === 'complete' && r.item.scanned === 4, r.item);
r = S.recordStocktakeScan(st, { code: '8801234567890' }); st = r.stocktake;
check('초과', r.status === 'over');
r = S.recordStocktakeScan(st, { code: 'ZZZ' }); st = r.stocktake;
check('목록 외', r.status === 'extra' && st.extras.length === 1);
r = S.recordStocktakeScan(st, { code: '180100048|91163||0014' }); st = r.stocktake;
const sum = S.summarizeStocktake(st);
check('요약', sum.total === 3 && sum.over === 1 && sum.partial === 1 && sum.missing === 1 && sum.extra === 1, sum);
st = S.setStocktakeCount(st, 'ZZZ', 0);
check('목록 외 0으로 → 제거', st.extras.length === 0);
const csv = S.stocktakeCsv(st, (k) => k.split('.').pop());
check('CSV 줄 수', csv.trim().split('\n').length === 4, csv);
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
