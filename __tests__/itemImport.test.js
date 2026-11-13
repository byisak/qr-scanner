// 품목 가져오기·내보내기: 엑셀 라이브러리(xlsx)를 바꿔도 결과가 같은지 보는 검사
import * as XLSX from 'xlsx';
import {
  rowsFromWorkbookBase64, rowsFromText, decodeText, base64ToBytes, detectMapping, buildRecords,
  buildTemplateBase64, buildExportXlsxBase64, buildExportCsv, looksScientific, IMPORT_FIELDS,
} from '../utils/itemImport';

const t = (key) => key;
const HEADER = IMPORT_FIELDS.map(f => `itemMaster.fields.${f}`);
const items = [
  { code: '8801234002028', name: '생수 500ml', spec: '500ml', unit: 'EA', category: '음료', location: 'A-03-12', altCodes: ['18801234002025', '28801234002022'], memo: '메모, "따옴표"' },
  { code: '0012345678905', name: 'Café ñ 日本語 中文', altCodes: [] },
];
const itemRows = [
  ['8801234002028', '생수 500ml', '500ml', 'EA', '음료', 'A-03-12', '18801234002025;28801234002022', '메모, "따옴표"'],
  ['0012345678905', 'Café ñ 日本語 中文', '', '', '', '', '', ''],
];
const workbookBase64 = (aoa, bookType = 'xlsx') => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  return XLSX.write(wb, { type: 'base64', bookType });
};

describe('엑셀 읽기', () => {
  test('내보낸 파일을 다시 읽으면 같은 값 (앞자리 0·한글·여러 언어 유지)', () => {
    expect(rowsFromWorkbookBase64(buildExportXlsxBase64(items, t))).toEqual([HEADER, ...itemRows]);
  });

  test('숫자 칸으로 들어온 바코드는 지수 표기 없이 정수 그대로', () => {
    const rows = rowsFromWorkbookBase64(workbookBase64([['코드', '품명', '수량'], [8801234002028, '생수', 1.5], [123, '', '']]));
    expect(rows).toEqual([['코드', '품명', '수량'], ['8801234002028', '생수', '1.5'], ['123', '', '']]);
  });

  test('옛 형식(.xls)도 읽는다', () => {
    const rows = rowsFromWorkbookBase64(workbookBase64([['코드', '품명'], [8801234002028, '생수 한글']], 'biff8'));
    expect(rows).toEqual([['코드', '품명'], ['8801234002028', '생수 한글']]);
  });

  test('빈 줄은 건너뛰고, 중간의 빈 칸은 자리를 지킨다', () => {
    const rows = rowsFromWorkbookBase64(workbookBase64([['a', null, 'c'], [], [null, 'b']]));
    expect(rows).toEqual([['a', '', 'c'], ['', 'b', '']]);
  });

  test('빈 시트', () => {
    expect(rowsFromWorkbookBase64(workbookBase64([]))).toEqual([]);
  });

  test('서식 파일: 머리글 + 예시 2줄, 코드가 그대로', () => {
    const rows = rowsFromWorkbookBase64(buildTemplateBase64(t));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(HEADER);
    expect(rows[1][0]).toBe('8801234002028');
    expect(rows[1][6]).toBe('18801234002025');
    expect(detectMapping([['코드', '품명'], ...rows.slice(1)]).hasHeader).toBe(true);
  });

  test('내보낸 파일의 코드 열은 글자 칸이다 (엑셀이 숫자로 바꾸지 않게)', () => {
    const wb = XLSX.read(buildExportXlsxBase64(items, t), { type: 'base64' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(wb.SheetNames).toEqual(['Items']);
    expect(ws.A2).toMatchObject({ t: 's', v: '8801234002028' });
    expect(ws.A3).toMatchObject({ t: 's', v: '0012345678905' });
    expect(ws.G2).toMatchObject({ t: 's', v: '18801234002025;28801234002022' });
  });
});

describe('글자 읽기', () => {
  test('UTF-8 (BOM 있음/없음)', () => {
    const bytes = Uint8Array.from(Buffer.from('코드,품명\n1,생수', 'utf8'));
    expect(decodeText(bytes)).toBe('코드,품명\n1,생수');
    expect(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes]))).toBe('코드,품명\n1,생수');
  });

  test('한국어 엑셀 CSV (CP949)', () => {
    // "코드,품명" 의 CP949 바이트
    const bytes = Uint8Array.from([0xc4, 0xda, 0xb5, 0xe5, 0x2c, 0xc7, 0xb0, 0xb8, 0xed]);
    expect(decodeText(bytes)).toBe('코드,품명');
  });

  test('base64ToBytes', () => {
    expect(Array.from(base64ToBytes(Buffer.from([0, 1, 200, 255]).toString('base64')))).toEqual([0, 1, 200, 255]);
  });

  test('CSV: 따옴표 안의 쉼표·줄바꿈·따옴표', () => {
    expect(rowsFromText('코드,품명,메모\r\n1,"a, b","줄1\n줄2"\r\n2,"say ""hi""",\r\n\r\n')).toEqual([
      ['코드', '품명', '메모'],
      ['1', 'a, b', '줄1\n줄2'],
      ['2', 'say "hi"', ''],
    ]);
  });

  test('붙여 넣은 표(탭)와 세미콜론 CSV', () => {
    expect(rowsFromText('1\t생수, 500ml\n2\t콜라')).toEqual([['1', '생수, 500ml'], ['2', '콜라']]);
    expect(rowsFromText('code;name;memo\n1;a,b;c')).toEqual([['code', 'name', 'memo'], ['1', 'a,b', 'c']]);
  });

  test('내보낸 CSV를 다시 읽으면 같은 값', () => {
    const csv = buildExportCsv(items, t);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // 엑셀이 한글을 알아보게 BOM
    expect(rowsFromText(csv)).toEqual([HEADER, ...itemRows]);
  });
});

describe('행 → 품목', () => {
  test('머리글을 알아보고 열을 맞춘다 (공백·대소문자 무시, 모르는 열은 건너뜀)', () => {
    expect(detectMapping([[' Bar Code ', '상품명', '수량', '비고', 'BARCODE']])).toEqual({
      hasHeader: true,
      mapping: ['code', 'name', null, 'memo', null],
    });
  });

  test('머리글이 없으면 1열 = 코드, 2열 = 품명', () => {
    expect(detectMapping([['8801', '생수', 'x'], ['8802', '콜라']])).toEqual({ hasHeader: false, mapping: ['code', 'name', null] });
  });

  test('buildRecords: 오류 줄 번호, 겹친 코드는 마지막 줄', () => {
    const rows = [
      ['코드', '품명', '대체코드'],
      ['8801', '생수', 'A1; A2,A3'],
      ['', '코드 없음', ''],
      ['8.80123E+12', '지수', ''],
      ['8802', '', ''],
      ['8801', '생수 (새 이름)', ''],
    ];
    const { hasHeader, mapping } = detectMapping(rows);
    const { records, errors, duplicateCount } = buildRecords(rows, mapping, hasHeader);
    expect(records).toEqual([{ code: '8801', name: '생수 (새 이름)', altCodes: [] }]);
    expect(duplicateCount).toBe(1);
    expect(errors).toEqual([
      { line: 3, reason: 'noCode', value: '코드 없음' },
      { line: 4, reason: 'scientific', value: '8.80123E+12' },
      { line: 5, reason: 'noName', value: '8802' },
    ]);
  });

  test('looksScientific', () => {
    expect(looksScientific('8.80123E+12')).toBe(true);
    expect(looksScientific('8801234002028')).toBe(false);
    expect(looksScientific('E12')).toBe(false);
  });
});
