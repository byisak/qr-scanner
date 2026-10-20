// utils/itemImport.js - 품목 마스터 불러오기·내보내기: 엑셀(.xlsx)·CSV·붙여 넣은 표 → 품목 레코드
// 화면과 무관한 순수 함수로 둔다 (파일 읽기만 readRowsFromFile 에서).
import * as XLSX from 'xlsx';
import cptable from 'xlsx/dist/cpexcel.js';

export const IMPORT_FIELDS = ['code', 'name', 'spec', 'unit', 'category', 'location', 'altCodes', 'memo'];

// 열 이름 → 필드. 공백·대소문자는 무시하고 비교한다
const HEADER_ALIASES = {
  code: ['코드', '바코드', '상품코드', '품목코드', '바코드번호', 'code', 'barcode', 'sku', 'ean', 'upc', 'gtin', 'jan', 'コード', 'バーコード', '条码', '条形码', '编码', 'código', 'codigo', 'códigodebarras'],
  name: ['품명', '상품명', '품목명', '제품명', '이름', 'name', 'item', 'itemname', 'product', 'productname', 'description', '品名', '商品名', '名称', '名前', 'nombre', 'producto'],
  spec: ['규격', '옵션', '사양', 'spec', 'specification', 'option', 'variant', '規格', '规格', 'especificación', 'variante'],
  unit: ['단위', 'unit', 'uom', '単位', '单位', 'unidad'],
  category: ['분류', '카테고리', '구분', 'category', 'group', 'カテゴリ', '分类', '類別', 'categoría', 'categoria'],
  location: ['위치', '로케이션', '보관위치', '창고위치', 'location', 'bin', 'place', 'ロケーション', '位置', '库位', 'ubicación', 'ubicacion'],
  altCodes: ['대체코드', '박스코드', '추가코드', '보조코드', 'altcode', 'altcodes', 'alternatecode', 'boxcode', '代替コード', '箱码', 'códigoalternativo'],
  memo: ['메모', '비고', 'memo', 'note', 'notes', 'remark', 'メモ', '备注', 'nota', 'notas'],
};
const ALIAS_TO_FIELD = new Map();
for (const [field, names] of Object.entries(HEADER_ALIASES)) {
  for (const n of names) ALIAS_TO_FIELD.set(n.toLowerCase().replace(/[\s_\-.]/g, ''), field);
}
const normHeader = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_\-.]/g, '');

// 엑셀이 숫자로 바꿔 버린 바코드 (8.80123E+12)
export const looksScientific = (s) => /^\d(\.\d+)?e\+?\d+$/i.test(String(s).trim());

// ---------- 바이트 → 글자 ----------
export function base64ToBytes(b64) {
  const bin = typeof atob === 'function' ? atob(b64) : decodeBase64(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeBase64(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let str = '', buffer = 0, bits = 0;
  for (const c of b64.replace(/[^A-Za-z0-9+/]/g, '')) {
    buffer = (buffer << 6) | chars.indexOf(c);
    bits += 6;
    if (bits >= 8) { bits -= 8; str += String.fromCharCode((buffer >> bits) & 0xff); }
  }
  return str;
}

function isValidUtf8(bytes) {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { i++; continue; }
    let n = 0;
    if ((b & 0xe0) === 0xc0) n = 1; else if ((b & 0xf0) === 0xe0) n = 2; else if ((b & 0xf8) === 0xf0) n = 3; else return false;
    if (i + n >= bytes.length) return false;
    for (let k = 1; k <= n; k++) if ((bytes[i + k] & 0xc0) !== 0x80) return false;
    i += n + 1;
  }
  return true;
}

// UTF-8(BOM 포함)이면 그대로, 아니면 한국어 엑셀 기본 CSV 인코딩(CP949/EUC-KR)으로 읽는다
export function decodeText(bytes) {
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  const body = start ? bytes.subarray(start) : bytes;
  if (start || isValidUtf8(body)) return cptable.utils.decode(65001, Array.from(body));
  return cptable.utils.decode(949, Array.from(body));
}

// ---------- 글자 → 행 ----------
// 붙여 넣은 표(엑셀 복사 = 탭) 또는 CSV(쉼표·세미콜론). 큰따옴표로 감싼 칸 안의 구분자·줄바꿈 처리
export function rowsFromText(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') { quoted = true; continue; }
    if (c === delim) { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      continue;
    }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(v => v.trim())).filter(r => r.some(v => v !== ''));
}

// 엑셀 시트 → 행. 숫자 칸(바코드)은 정수 그대로 글자로 (8801234002028), 지수 표기로 망가지지 않게
export function rowsFromWorkbookBase64(b64) {
  const wb = XLSX.read(b64, { type: 'base64', cellText: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) { row.push(''); continue; }
      if (cell.t === 'n' && Number.isFinite(cell.v)) {
        row.push(Number.isInteger(cell.v) && Math.abs(cell.v) < 1e16 ? String(cell.v) : String(cell.w ?? cell.v));
      } else {
        row.push(String(cell.w ?? cell.v ?? '').trim());
      }
    }
    if (row.some(v => v !== '')) rows.push(row);
  }
  return rows;
}

export async function readRowsFromFile({ uri, name }) {
  const FileSystem = require('expo-file-system/legacy');
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  if (/\.(xlsx|xlsm|xls)$/i.test(name || '')) return rowsFromWorkbookBase64(b64);
  return rowsFromText(decodeText(base64ToBytes(b64)));
}

// ---------- 행 → 품목 ----------
// 첫 줄이 열 이름이면 그걸로, 아니면 1열 = 코드, 2열 = 품명으로 본다
export function detectMapping(rows) {
  const first = rows[0] || [];
  const mapped = first.map(h => ALIAS_TO_FIELD.get(normHeader(h)) || null);
  if (mapped.includes('code')) {
    const seen = new Set();
    return { hasHeader: true, mapping: mapped.map(f => (f && !seen.has(f) ? (seen.add(f), f) : null)) };
  }
  const width = Math.max(0, ...rows.slice(0, 20).map(r => r.length));
  return { hasHeader: false, mapping: Array.from({ length: width }, (_, i) => (i === 0 ? 'code' : i === 1 ? 'name' : null)) };
}

// 반환 { records, errors: [{ line, reason, value }], duplicateCount }
// reason: 'noCode' | 'scientific' | 'noName'
export function buildRecords(rows, mapping, hasHeader) {
  const body = hasHeader ? rows.slice(1) : rows;
  const byCode = new Map();
  const errors = [];
  let duplicateCount = 0;
  body.forEach((row, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const rec = {};
    mapping.forEach((field, col) => {
      if (!field) return;
      const v = String(row[col] ?? '').trim();
      if (field === 'altCodes') rec.altCodes = v ? v.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [];
      else rec[field] = v;
    });
    if (!rec.code) { errors.push({ line, reason: 'noCode', value: rec.name || '' }); return; }
    if (looksScientific(rec.code)) { errors.push({ line, reason: 'scientific', value: rec.code }); return; }
    if (!rec.name) { errors.push({ line, reason: 'noName', value: rec.code }); return; }
    if (byCode.has(rec.code)) duplicateCount++;
    byCode.set(rec.code, rec); // 같은 코드가 여러 줄이면 마지막 줄
  });
  return { records: Array.from(byCode.values()), errors, duplicateCount };
}

// ---------- 서식·내보내기 ----------
const headerLabels = (t) => IMPORT_FIELDS.map(f => t(`itemMaster.fields.${f}`));

function itemToRow(it) {
  return [it.code, it.name, it.spec || '', it.unit || '', it.category || '', it.location || '', (it.altCodes || []).join(';'), it.memo || ''];
}

// 코드 열은 글자 칸으로 넣어 엑셀이 숫자로 바꾸지 않게 한다
function sheetFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let r = 1; r < rows.length; r++) {
    for (const c of [0, 6]) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) { ws[ref].t = 's'; ws[ref].v = String(rows[r][c]); ws[ref].z = '@'; }
    }
  }
  ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
  return ws;
}

export function buildTemplateBase64(t) {
  const rows = [
    headerLabels(t),
    ['8801234002028', t('itemMaster.sample.name1'), t('itemMaster.sample.spec1'), t('itemMaster.sample.unit1'), t('itemMaster.sample.category1'), 'A-03-12', '18801234002025', ''],
    ['8801234005050', t('itemMaster.sample.name2'), '', 'EA', '', 'B-01-02', '', ''],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(rows), 'Items');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export function buildExportXlsxBase64(items, t) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows([headerLabels(t), ...items.map(itemToRow)]), 'Items');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export function buildExportCsv(items, t) {
  return '﻿' + [headerLabels(t), ...items.map(itemToRow)].map(r => r.map(csvCell).join(',')).join('\r\n');
}
