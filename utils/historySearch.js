// utils/historySearch.js - 기록 검색·필터·고정 정렬 (화면과 떨어진 순수 함수라 따로 검사할 수 있다)

/** QR로 취급하는 종류 (종류가 비어 있는 옛 기록도 QR) */
export const isQrType = (type) => !type || type === 'qr' || type === 'qrcode';

/** 검색어를 공백으로 나눈 소문자 단어들. 모두 들어 있어야 맞는 것으로 본다 */
export function parseTerms(query) {
  return String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
}

const push = (out, v) => {
  if (v == null || v === '') return;
  if (Array.isArray(v)) v.forEach(x => push(out, x));
  else if (typeof v === 'object') Object.values(v).forEach(x => push(out, x));
  else out.push(String(v));
};

/**
 * 항목에서 검색 대상이 되는 글자들: 코드, URL, 메모, 위치, 코드 종류, 라벨 필드 값, 복권 이름·회차,
 * 품목 마스터의 품명·규격 (master는 lookup 결과, 없으면 null)
 */
export function searchTextOf(item, master = null) {
  if (!item) return '';
  const out = [];
  push(out, item.code);
  push(out, item.url);
  push(out, item.memo);
  push(out, item.location);
  push(out, isQrType(item.type) ? 'qr' : item.type);
  push(out, item.values);
  if (item.lotteryData) {
    push(out, item.lotteryData.typeName);
    push(out, item.lotteryData.round);
  }
  if (master) {
    push(out, master.name);
    push(out, master.spec);
  }
  return out.join('\n').toLowerCase();
}

/** filters: { pinned, qr, barcode, memo, photo } (켠 것만 적용. qr과 barcode를 둘 다 켜면 종류는 가리지 않는다) */
export function matchesFilters(item, filters) {
  if (!filters) return true;
  if (filters.pinned && !item.pinned) return false;
  if (filters.memo && !(typeof item.memo === 'string' && item.memo.trim())) return false;
  if (filters.photo && !(Array.isArray(item.photos) && item.photos.length > 0)) return false;
  if (!!filters.qr !== !!filters.barcode) {
    if (isQrType(item.type) !== !!filters.qr) return false;
  }
  return true;
}

export const hasActiveFilter = (filters) => !!filters && Object.values(filters).some(Boolean);

/**
 * 검색어와 필터에 맞는 항목만 (순서 유지).
 * lookup(code) → 품목 마스터 항목({ name, spec }) 또는 null
 */
export function searchHistory(items, { query = '', filters = null, lookup = null } = {}) {
  const terms = parseTerms(query);
  const filtering = hasActiveFilter(filters);
  if (!terms.length && !filtering) return items;
  return items.filter(item => {
    if (!item) return false;
    if (filtering && !matchesFilters(item, filters)) return false;
    if (!terms.length) return true;
    const text = searchTextOf(item, lookup ? lookup(item.code) : null);
    return terms.every(term => text.includes(term));
  });
}

/** 고정한 것과 아닌 것으로 나눈다 (각각 순서 유지) */
export function splitPinned(items) {
  const pinned = [];
  const rest = [];
  items.forEach(item => (item && item.pinned ? pinned : rest).push(item));
  return { pinned, rest };
}
