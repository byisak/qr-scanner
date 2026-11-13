import {
  detectDelimiter, splitLabel, signatureOf, parseSignature, describeSignature, resolveCategory, parseLabel,
  labelOfItem, formatLabelSummary, keyValueOf, nextCategoryName, buildCategory,
} from '../utils/labelParser';

const CODE = '180100048|91163||0014';
const category = { id: 'cat1', signature: '|:4', delimiter: '|', fieldCount: 4, name: '라벨 A', fields: ['품목코드', '수량', '', '순번'], keyField: 0 };

describe('구분자 찾기', () => {
  test('우선순위: | ; TAB ,', () => {
    expect(detectDelimiter(CODE)).toBe('|');
    expect(detectDelimiter('a;b,c')).toBe(';');
    expect(detectDelimiter('a\tb,c')).toBe('\t');
    expect(detectDelimiter('a,b')).toBe(',');
  });

  test('구분자가 없으면 null', () => {
    expect(detectDelimiter('8801234567890')).toBeNull();
    expect(detectDelimiter('')).toBeNull();
    expect(detectDelimiter(null)).toBeNull();
  });

  test('URL·Wi-Fi·연락처 같은 특수 QR은 라벨이 아니다', () => {
    expect(detectDelimiter('https://example.com/?a=1,2;3')).toBeNull();
    expect(detectDelimiter('WIFI:T:WPA;S:Net;P:pw;;')).toBeNull();
    expect(detectDelimiter('MECARD:N:홍길동;TEL:010;;')).toBeNull();
    expect(detectDelimiter('mailto:a@b.com?subject=a,b')).toBeNull();
  });

  test('칸이 32개를 넘으면 라벨로 보지 않는다', () => {
    expect(detectDelimiter(Array(33).fill('x').join('|'))).toBeNull();
    expect(detectDelimiter(Array(32).fill('x').join('|'))).toBe('|');
  });
});

describe('서명', () => {
  test('구분자:칸수 (빈 칸도 센다)', () => {
    expect(signatureOf(CODE)).toBe('|:4');
    expect(signatureOf('plain')).toBeNull();
  });

  test('parseSignature / describeSignature', () => {
    expect(parseSignature('|:4')).toEqual({ delimiter: '|', fieldCount: 4 });
    expect(parseSignature('\t:3')).toEqual({ delimiter: '\t', fieldCount: 3 });
    expect(parseSignature('|:1')).toBeNull();
    expect(parseSignature('bad')).toBeNull();
    expect(parseSignature(null)).toBeNull();
    expect(describeSignature('\t:3')).toBe('TAB × 3');
    expect(describeSignature('nope')).toBe('');
  });
});

describe('카테고리로 나누기', () => {
  test('splitLabel은 앞뒤 공백을 떼고 빈 칸을 남긴다', () => {
    expect(splitLabel(' a | b ||c', '|')).toEqual(['a', 'b', '', 'c']);
    expect(splitLabel(null, '|')).toEqual([]);
  });

  test('같은 서명의 카테고리에 맞춰 나눈다', () => {
    expect(resolveCategory(CODE, [category]).values).toEqual(['180100048', '91163', '', '0014']);
    expect(resolveCategory('a|b', [category])).toBeNull();
    expect(resolveCategory(CODE, null)).toBeNull();
  });

  test('parseLabel: 이름 없는 필드는 기본 이름', () => {
    expect(parseLabel(CODE, [category])).toEqual({
      categoryId: 'cat1',
      values: ['180100048', '91163', '', '0014'],
      fields: { 품목코드: '180100048', 수량: '91163', 필드3: '', 순번: '0014' },
    });
  });

  test('labelOfItem: 저장된 categoryId·values가 먼저, 없으면 코드로 다시 나눈다', () => {
    expect(labelOfItem({ code: 'zzz', categoryId: 'cat1', values: ['1', '2', '3', '4'] }, [category]).values).toEqual(['1', '2', '3', '4']);
    expect(labelOfItem({ code: CODE, categoryId: 'deleted' }, [category]).values[0]).toBe('180100048');
    expect(labelOfItem({ code: 'plain' }, [category])).toBeNull();
    expect(labelOfItem(null, [category])).toBeNull();
  });
});

describe('요약', () => {
  const label = { category, values: ['180100048', '91163', '', '0014'] };

  test('대표 필드 먼저, 빈 값은 건너뛴다', () => {
    expect(formatLabelSummary(label)).toBe('품목코드 180100048 · 수량 91163 · 순번 0014');
    expect(formatLabelSummary({ category: { ...category, keyField: 3 }, values: label.values }, 2)).toBe('순번 0014 · 품목코드 180100048');
    expect(formatLabelSummary(null)).toBe('');
  });

  test('keyValueOf', () => {
    expect(keyValueOf(label)).toBe('180100048');
    expect(keyValueOf({ category: { ...category, keyField: 1 }, values: label.values })).toBe('91163');
    expect(keyValueOf(null)).toBe('');
  });
});

describe('새 카테고리', () => {
  test('안 겹치는 다음 이름', () => {
    expect(nextCategoryName([])).toBe('라벨 A');
    expect(nextCategoryName([{ name: '라벨 A' }, { name: '라벨 B' }])).toBe('라벨 C');
    const all = Array.from({ length: 26 }, (_, i) => ({ name: `라벨 ${String.fromCharCode(65 + i)}` }));
    expect(nextCategoryName(all)).toBe('라벨 AA');
  });

  test('buildCategory', () => {
    const c = buildCategory(CODE, [category]);
    expect(c).toMatchObject({ signature: '|:4', delimiter: '|', fieldCount: 4, name: '라벨 B', keyField: 0, sample: CODE });
    expect(c.fields).toEqual(['필드1', '필드2', '필드3', '필드4']);
    expect(buildCategory('plain', [])).toBeNull();
  });
});
