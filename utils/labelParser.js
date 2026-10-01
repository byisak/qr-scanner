// utils/labelParser.js - 구분자로 이어진 라벨 값을 필드로 나눈다 (예: "180100048|91163||0014")
// 라벨마다 칸의 의미가 달라서, 같은 패턴(구분자 + 칸 수)끼리 "카테고리"로 묶고 필드 이름은 카테고리에서 가져온다.
import { parseQRContent, QR_CONTENT_TYPES } from './qrContentParser';

// 구분자 후보. 앞에 있는 것이 우선
export const LABEL_DELIMITERS = ['|', ';', '\t', ','];

// 설정 화면 표시용 이름
export const DELIMITER_LABELS = { '|': '|', ';': ';', '\t': 'TAB', ',': ',' };

const MAX_FIELDS = 32;

// URL·Wi-Fi·연락처 같은 특수 QR은 안에 ';'나 ','가 있어도 라벨이 아니다
function isSpecialContent(code) {
  if (!code) return true;
  const trimmed = code.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  try {
    const parsed = parseQRContent(trimmed);
    return !!parsed && parsed.type !== QR_CONTENT_TYPES.TEXT;
  } catch {
    return false;
  }
}

export function splitLabel(code, delimiter) {
  if (typeof code !== 'string' || !delimiter) return [];
  return code.split(delimiter).map(part => part.trim());
}

// 2칸 이상으로 나뉘는 첫 구분자. 없거나 특수 QR이면 null
export function detectDelimiter(code) {
  if (typeof code !== 'string' || isSpecialContent(code)) return null;
  for (const delimiter of LABEL_DELIMITERS) {
    if (!code.includes(delimiter)) continue;
    const parts = code.split(delimiter);
    if (parts.length >= 2 && parts.length <= MAX_FIELDS) return delimiter;
  }
  return null;
}

// 패턴 서명: "구분자:칸수". 같은 서명 = 같은 카테고리
export function signatureOf(code) {
  const delimiter = detectDelimiter(code);
  if (!delimiter) return null;
  return `${delimiter}:${splitLabel(code, delimiter).length}`;
}

export function parseSignature(signature) {
  if (typeof signature !== 'string') return null;
  const index = signature.lastIndexOf(':');
  if (index <= 0) return null;
  const delimiter = signature.slice(0, index);
  const fieldCount = parseInt(signature.slice(index + 1), 10);
  if (!delimiter || !Number.isFinite(fieldCount) || fieldCount < 2) return null;
  return { delimiter, fieldCount };
}

export function describeSignature(signature) {
  const parsed = parseSignature(signature);
  if (!parsed) return '';
  return `${DELIMITER_LABELS[parsed.delimiter] || parsed.delimiter} × ${parsed.fieldCount}`;
}

// 코드가 어느 카테고리에 속하는지. 없으면 null
export function resolveCategory(code, categories) {
  const signature = signatureOf(code);
  if (!signature || !Array.isArray(categories)) return null;
  const category = categories.find(c => c && c.signature === signature);
  if (!category) return null;
  return { category, values: splitLabel(code, category.delimiter) };
}

// 카테고리에 맞춰 분리. 기록에 저장할 형태(categoryId, values)와 표시용 fields(이름→값)를 돌려준다
export function parseLabel(code, categories) {
  const resolved = resolveCategory(code, categories);
  if (!resolved) return null;
  const { category, values } = resolved;
  const fields = {};
  category.fields.forEach((name, index) => {
    fields[name || defaultFieldName(index)] = values[index] ?? '';
  });
  return { categoryId: category.id, values, fields };
}

// 기록 항목(categoryId·values가 있거나, 없으면 code로 다시 분리)에서 표시용 데이터
export function labelOfItem(item, categories) {
  if (!item || !Array.isArray(categories)) return null;
  if (item.categoryId) {
    const category = categories.find(c => c && c.id === item.categoryId);
    if (category) {
      const values = Array.isArray(item.values) ? item.values : splitLabel(item.code, category.delimiter);
      return { category, values };
    }
  }
  return resolveCategory(item.code, categories);
}

export function defaultFieldName(index, t) {
  return t ? t('labelCategories.fieldN', { n: index + 1 }) : `필드${index + 1}`;
}

export function fieldNameAt(category, index, t) {
  const name = category && category.fields && category.fields[index];
  return name && name.trim() ? name : defaultFieldName(index, t);
}

// 목록·카드 한 줄 요약: "품목코드 180100048 · 수량 91163" (대표 필드 먼저, 빈 값은 건너뜀)
export function formatLabelSummary(label, maxFields = 3, t) {
  if (!label || !label.category) return '';
  const { category, values } = label;
  const order = [];
  const key = Number.isInteger(category.keyField) ? category.keyField : 0;
  order.push(key);
  for (let i = 0; i < values.length; i++) if (i !== key) order.push(i);
  const parts = [];
  for (const index of order) {
    const value = values[index];
    if (value === undefined || value === '') continue;
    parts.push(`${fieldNameAt(category, index, t)} ${value}`);
    if (parts.length >= maxFields) break;
  }
  return parts.join(' · ');
}

// 대표 필드 값만 (토스트 등 아주 짧은 자리)
export function keyValueOf(label) {
  if (!label || !label.category) return '';
  const key = Number.isInteger(label.category.keyField) ? label.category.keyField : 0;
  return label.values[key] ?? '';
}

// "라벨 A", "라벨 B", …, "라벨 Z", "라벨 AA" 순서로 안 겹치는 다음 이름
export function nextCategoryName(categories, t) {
  const used = new Set((categories || []).map(c => c && c.name));
  for (let n = 0; n < 26 * 27; n++) {
    let letters = '';
    let i = n;
    do {
      letters = String.fromCharCode(65 + (i % 26)) + letters;
      i = Math.floor(i / 26) - 1;
    } while (i >= 0);
    const name = t ? t('labelCategories.defaultName', { letter: letters }) : `라벨 ${letters}`;
    if (!used.has(name)) return name;
  }
  return `라벨 ${Date.now()}`;
}

// 새 카테고리 객체 (아직 저장 전)
export function buildCategory(code, categories, t) {
  const signature = signatureOf(code);
  const parsed = parseSignature(signature);
  if (!parsed) return null;
  return {
    id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    signature,
    delimiter: parsed.delimiter,
    fieldCount: parsed.fieldCount,
    name: nextCategoryName(categories, t),
    fields: Array.from({ length: parsed.fieldCount }, (_, i) => defaultFieldName(i, t)),
    keyField: 0,
    sample: code,
    createdAt: Date.now(),
    count: 0,
  };
}
