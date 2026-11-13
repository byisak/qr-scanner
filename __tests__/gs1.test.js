import { parseGs1, gs1Date, gs1DisplayValue, formatGs1Summary, compactGs1 } from '../utils/gs1';

const GS = '\u001d';

describe('parseGs1', () => {
  test('괄호 표기', () => {
    const r = parseGs1('(01)08801234567890(17)251231(10)LOT7');
    expect(r.gtin).toBe('08801234567890');
    expect(r.expiry).toBe('2025-12-31');
    expect(r.lot).toBe('LOT7');
    expect(r.ais).toHaveLength(3);
  });

  test('심볼 접두 + GS 문자 (가변 길이 뒤에 GS)', () => {
    const r = parseGs1(`]C10108801234567890` + `10LOT7${GS}21SN001`);
    expect(r.gtin).toBe('08801234567890');
    expect(r.lot).toBe('LOT7');
    expect(r.serial).toBe('SN001');
  });

  test('접두·GS 없이 01로 시작하고 AI가 이어지는 경우', () => {
    const r = parseGs1('01088012345678901725123110LOT7');
    expect(r).toMatchObject({ gtin: '08801234567890', expiry: '2025-12-31', lot: 'LOT7' });
  });

  test('Digital Link', () => {
    const r = parseGs1('https://id.gs1.org/01/08801234567890/10/LOT%207?17=251231');
    expect(r).toMatchObject({ gtin: '08801234567890', lot: 'LOT 7', expiry: '2025-12-31' });
  });

  test('수량과 순중량', () => {
    const r = parseGs1('(01)08801234567890(37)12(3103)001250');
    expect(r.qty).toBe(12);
    expect(r.netWeightKg).toBeCloseTo(1.25);
  });

  test('SSCC', () => {
    expect(parseGs1('(00)123456789012345678').sscc).toBe('123456789012345678');
  });

  test('일반 바코드·텍스트·URL은 해석하지 않는다', () => {
    expect(parseGs1('8801234567890')).toBeNull(); // EAN-13
    expect(parseGs1('0108801234567890')).toBeNull(); // 숫자 16자리만
    expect(parseGs1('hello world')).toBeNull();
    expect(parseGs1('https://example.com/path?x=1')).toBeNull();
    expect(parseGs1('')).toBeNull();
    expect(parseGs1(null)).toBeNull();
    expect(parseGs1(12345)).toBeNull();
  });

  test('괄호 밖에 다른 글자가 섞이면 해석하지 않는다', () => {
    expect(parseGs1('(주)회사 이름')).toBeNull();
  });

  test('고정 길이가 모자라면 해석하지 않는다', () => {
    expect(parseGs1(']C1010880123')).toBeNull();
  });
});

describe('gs1Date', () => {
  test('YYMMDD → YYYY-MM-DD', () => {
    expect(gs1Date('251231')).toBe('2025-12-31');
  });
  test('일이 00이면 그 달 말일', () => {
    expect(gs1Date('240200')).toBe('2024-02-29');
    expect(gs1Date('250200')).toBe('2025-02-28');
  });
  test('잘못된 값', () => {
    expect(gs1Date('251301')).toBeNull();
    expect(gs1Date('2512')).toBeNull();
    expect(gs1Date('251232')).toBeNull();
  });
});

describe('표시·저장 형태', () => {
  test('gs1DisplayValue', () => {
    expect(gs1DisplayValue('17', '251231')).toBe('2025-12-31');
    expect(gs1DisplayValue('3102', '001250')).toBe('12.5');
    expect(gs1DisplayValue('10', 'LOT7')).toBe('LOT7');
  });
  test('formatGs1Summary', () => {
    const r = parseGs1('(01)08801234567890(17)251231(10)LOT7(37)12');
    expect(formatGs1Summary(r)).toBe('GTIN 08801234567890 · LOT LOT7 · EXP 2025-12-31 · QTY 12');
    expect(formatGs1Summary(null)).toBe('');
  });
  test('compactGs1은 있는 값만 남긴다', () => {
    const c = compactGs1(parseGs1('(01)08801234567890(10)LOT7'));
    expect(Object.keys(c).sort()).toEqual(['ais', 'gtin', 'lot']);
    expect(compactGs1(null)).toBeNull();
  });
});
