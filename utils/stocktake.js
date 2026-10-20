// utils/stocktake.js - 재고 실사: 예상 목록을 불러와 스캔하면 일치·누락·초과를 센다
// 매칭: 코드가 같거나, GS1 GTIN이 같거나, 라벨 대표 필드 값이 같으면 같은 품목으로 본다
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lookupItemSync, codeKey } from './itemMaster';

export const STOCKTAKES_KEY = 'stocktakes';
export const ACTIVE_STOCKTAKE_KEY = 'activeStocktakeId';

// "코드[,|TAB]이름[,|TAB]수량" 한 줄에 하나. 라벨 코드 안에 | ; 가 있을 수 있어 구분자는 TAB과 쉼표만 본다
export function parseExpectedList(text) {
  if (typeof text !== 'string') return [];
  const byCode = new Map();
  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = (line.includes('\t') ? line.split('\t') : line.split(',')).map(p => p.trim().replace(/^"(.*)"$/, '$1'));
    const code = parts[0];
    if (!code) continue;
    // 첫 줄이 머리글이면 건너뛴다
    if (byCode.size === 0 && /^(code|코드|barcode|바코드)$/i.test(code)) continue;
    let name = '';
    let expected = 1;
    const rest = parts.slice(1).filter(Boolean);
    if (rest.length) {
      const last = rest[rest.length - 1];
      if (/^\d+$/.test(last)) {
        expected = Math.max(1, parseInt(last, 10));
        name = rest.slice(0, -1).join(' ');
      } else {
        name = rest.join(' ');
      }
    }
    const prev = byCode.get(code);
    if (prev) prev.expected += expected;
    else byCode.set(code, { code, name, expected, scanned: 0 });
  }
  return Array.from(byCode.values());
}

export function createStocktake(name, items) {
  return {
    id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name && name.trim() ? name.trim() : new Date().toISOString().slice(0, 10),
    createdAt: Date.now(),
    finishedAt: null,
    items: items.map(i => ({ code: i.code, name: i.name || lookupItemSync(i.code)?.name || '', expected: i.expected || 1, scanned: 0, lastAt: null })),
    extras: [], // 목록에 없는 코드 { code, scanned, lastAt }
  };
}

// 스캔 하나를 실사에 반영. scan = { code, gtin?, keyValue?, qty? }
// 반환: { stocktake(새 객체), status: 'matched' | 'complete' | 'over' | 'extra', item }
export function recordStocktakeScan(stocktake, scan) {
  const qty = scan.qty && scan.qty > 0 ? scan.qty : 1;
  const now = Date.now();
  const candidates = [scan.code, scan.gtin, scan.keyValue].filter(Boolean);
  let index = stocktake.items.findIndex(i => candidates.includes(i.code));
  if (index === -1) {
    // 품목 마스터로 한 번 더: 박스 바코드(대체 코드)나 앞자리 0만 다른 코드도 같은 품목으로
    const master = lookupItemSync(scan.code) || (scan.gtin ? lookupItemSync(scan.gtin) : null);
    const keys = new Set([...candidates, ...(master ? [master.code, ...(master.altCodes || [])] : [])].map(codeKey));
    index = stocktake.items.findIndex(i => keys.has(codeKey(i.code)));
  }
  if (index !== -1) {
    const item = { ...stocktake.items[index] };
    item.scanned += qty;
    item.lastAt = now;
    const items = stocktake.items.slice();
    items[index] = item;
    const status = item.scanned > item.expected ? 'over' : item.scanned === item.expected ? 'complete' : 'matched';
    return { stocktake: { ...stocktake, items }, status, item };
  }
  const extras = stocktake.extras.slice();
  const ei = extras.findIndex(e => e.code === scan.code);
  if (ei !== -1) extras[ei] = { ...extras[ei], scanned: extras[ei].scanned + qty, lastAt: now };
  else extras.unshift({ code: scan.code, scanned: qty, lastAt: now });
  return { stocktake: { ...stocktake, extras }, status: 'extra', item: extras[ei !== -1 ? ei : 0] };
}

// 수량을 직접 고친다 (실사 화면에서 −/+)
export function setStocktakeCount(stocktake, code, scanned) {
  const value = Math.max(0, scanned);
  if (stocktake.items.some(i => i.code === code)) {
    return { ...stocktake, items: stocktake.items.map(i => (i.code === code ? { ...i, scanned: value } : i)) };
  }
  const extras = value === 0
    ? stocktake.extras.filter(e => e.code !== code)
    : stocktake.extras.map(e => (e.code === code ? { ...e, scanned: value } : e));
  return { ...stocktake, extras };
}

export function stocktakeStatusOf(item) {
  if (item.expected === undefined) return 'extra';
  if (item.scanned === 0) return 'missing';
  if (item.scanned < item.expected) return 'partial';
  if (item.scanned > item.expected) return 'over';
  return 'complete';
}

export function summarizeStocktake(stocktake) {
  const s = { total: stocktake.items.length, complete: 0, partial: 0, missing: 0, over: 0, extra: stocktake.extras.length, expectedQty: 0, scannedQty: 0 };
  for (const item of stocktake.items) {
    s[stocktakeStatusOf(item)] += 1;
    s.expectedQty += item.expected;
    s.scannedQty += item.scanned;
  }
  for (const e of stocktake.extras) s.scannedQty += e.scanned;
  // 진행률: 예상 수량 중 채운 만큼 (초과분은 넘치지 않게)
  const filled = stocktake.items.reduce((sum, i) => sum + Math.min(i.scanned, i.expected), 0);
  s.progress = s.expectedQty ? filled / s.expectedQty : 0;
  return s;
}

// 차이 보고서 CSV
export function stocktakeCsv(stocktake, t) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = [t('stocktake.csv.code'), t('stocktake.csv.name'), t('stocktake.csv.expected'), t('stocktake.csv.scanned'), t('stocktake.csv.diff'), t('stocktake.csv.status')];
  const rows = stocktake.items.map(i => [i.code, i.name, i.expected, i.scanned, i.scanned - i.expected, t(`stocktake.status.${stocktakeStatusOf(i)}`)]);
  for (const e of stocktake.extras) rows.push([e.code, lookupItemSync(e.code)?.name || '', 0, e.scanned, e.scanned, t('stocktake.status.extra')]);
  return '﻿' + [header, ...rows].map(r => r.map(q).join(',')).join('\n') + '\n';
}

// ---- 저장소
export async function loadStocktakes() {
  try {
    const raw = await AsyncStorage.getItem(STOCKTAKES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveStocktakes(list) {
  await AsyncStorage.setItem(STOCKTAKES_KEY, JSON.stringify(list));
}

export async function upsertStocktake(stocktake) {
  const list = await loadStocktakes();
  const index = list.findIndex(s => s.id === stocktake.id);
  const next = index === -1 ? [stocktake, ...list] : list.map(s => (s.id === stocktake.id ? stocktake : s));
  await saveStocktakes(next);
  return stocktake;
}

export async function deleteStocktake(id) {
  const list = await loadStocktakes();
  await saveStocktakes(list.filter(s => s.id !== id));
  const active = await AsyncStorage.getItem(ACTIVE_STOCKTAKE_KEY);
  if (active === id) await AsyncStorage.removeItem(ACTIVE_STOCKTAKE_KEY);
}

export async function getActiveStocktake() {
  const id = await AsyncStorage.getItem(ACTIVE_STOCKTAKE_KEY);
  if (!id) return null;
  const list = await loadStocktakes();
  return list.find(s => s.id === id && !s.finishedAt) || null;
}

export async function setActiveStocktake(id) {
  if (id) await AsyncStorage.setItem(ACTIVE_STOCKTAKE_KEY, id);
  else await AsyncStorage.removeItem(ACTIVE_STOCKTAKE_KEY);
}
