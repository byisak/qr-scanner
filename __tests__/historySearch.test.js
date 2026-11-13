// 기록 검색·필터·고정
import { parseTerms, searchTextOf, matchesFilters, searchHistory, splitPinned, isQrType } from '../utils/historySearch';

const items = [
  { code: 'https://example.com/a', timestamp: 5, type: 'qr', memo: '거래처 안내문' },
  { code: '8801234567893', timestamp: 4, type: 'ean13', location: 'A-01-02', photos: ['file:///p.jpg'] },
  { code: 'LOT|P-100|50', timestamp: 3, type: 'code128', values: ['LOT', 'P-100', '50'], pinned: true },
  { code: 'hello', timestamp: 2, memo: '  ' },
  { code: 'L1', timestamp: 1, type: 'qr', lotteryData: { typeName: '로또 6/45', round: 1145 }, url: 'https://dhlottery.co.kr/x' },
];
const codes = (list) => list.map(i => i.code);

describe('historySearch', () => {
  test('검색어 나누기', () => {
    expect(parseTerms('  Foo   BAR ')).toEqual(['foo', 'bar']);
    expect(parseTerms('')).toEqual([]);
    expect(parseTerms(null)).toEqual([]);
  });

  test('종류가 없으면 QR로 본다', () => {
    expect(isQrType(undefined)).toBe(true);
    expect(isQrType('qrcode')).toBe(true);
    expect(isQrType('ean13')).toBe(false);
  });

  test('검색어도 필터도 없으면 그대로 돌려준다', () => {
    expect(searchHistory(items, {})).toBe(items);
    expect(searchHistory(items, { query: '   ', filters: { pinned: false } })).toBe(items);
  });

  test('메모·위치·종류·라벨 값·URL·복권으로 찾는다 (대소문자 무시)', () => {
    expect(codes(searchHistory(items, { query: '안내문' }))).toEqual(['https://example.com/a']);
    expect(codes(searchHistory(items, { query: 'a-01' }))).toEqual(['8801234567893']);
    expect(codes(searchHistory(items, { query: 'EAN' }))).toEqual(['8801234567893']);
    expect(codes(searchHistory(items, { query: 'p-100' }))).toEqual(['LOT|P-100|50']);
    expect(codes(searchHistory(items, { query: 'dhlottery' }))).toEqual(['L1']);
    expect(codes(searchHistory(items, { query: '1145' }))).toEqual(['L1']);
    expect(codes(searchHistory(items, { query: '로또' }))).toEqual(['L1']);
  });

  test('여러 단어는 모두 들어 있어야 한다', () => {
    expect(codes(searchHistory(items, { query: 'lot 50' }))).toEqual(['LOT|P-100|50']);
    expect(searchHistory(items, { query: 'lot 안내문' })).toEqual([]);
  });

  test('품목 마스터의 품명·규격으로 찾는다', () => {
    const lookup = (code) => (code === '8801234567893' ? { name: '초코파이', spec: '12입' } : null);
    expect(codes(searchHistory(items, { query: '초코', lookup }))).toEqual(['8801234567893']);
    expect(codes(searchHistory(items, { query: '12입 ean', lookup }))).toEqual(['8801234567893']);
    expect(searchHistory(items, { query: '초코' })).toEqual([]);
  });

  test('필터', () => {
    expect(codes(searchHistory(items, { filters: { pinned: true } }))).toEqual(['LOT|P-100|50']);
    expect(codes(searchHistory(items, { filters: { memo: true } }))).toEqual(['https://example.com/a']); // 공백뿐인 메모는 없는 것
    expect(codes(searchHistory(items, { filters: { photo: true } }))).toEqual(['8801234567893']);
    expect(codes(searchHistory(items, { filters: { qr: true } }))).toEqual(['https://example.com/a', 'hello', 'L1']);
    expect(codes(searchHistory(items, { filters: { barcode: true } }))).toEqual(['8801234567893', 'LOT|P-100|50']);
    expect(searchHistory(items, { filters: { qr: true, barcode: true } })).toHaveLength(5);
    expect(codes(searchHistory(items, { query: 'lot', filters: { barcode: true } }))).toEqual(['LOT|P-100|50']);
    expect(searchHistory(items, { query: 'lot', filters: { qr: true, memo: true } })).toEqual([]);
    expect(matchesFilters(items[0], null)).toBe(true);
  });

  test('이상한 값이 섞여 있어도 죽지 않는다', () => {
    const odd = [null, { code: 123, timestamp: 1, values: { a: 'x', b: null }, memo: 5 }, { timestamp: 2 }];
    expect(searchHistory(odd, { query: '123' })).toHaveLength(1);
    expect(searchHistory(odd, { query: 'x' })).toHaveLength(1);
    expect(searchHistory(odd, { filters: { memo: true } })).toEqual([]);
    expect(searchTextOf(null)).toBe('');
  });

  test('고정 나누기는 순서를 지킨다', () => {
    const { pinned, rest } = splitPinned(items);
    expect(codes(pinned)).toEqual(['LOT|P-100|50']);
    expect(codes(rest)).toEqual(['https://example.com/a', '8801234567893', 'hello', 'L1']);
  });
});
