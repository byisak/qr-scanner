// utils/itemMaster.js - 품목 마스터: 코드 → 품명·규격·단위·분류·위치·대체 코드
// 수만 건도 담을 수 있게 AsyncStorage(행당 크기 제한)가 아니라 문서 폴더의 JSON 파일 하나에 저장하고,
// 처음 쓸 때 한 번 읽어 메모리 색인(Map)으로 찾는다. 스캔마다 파일을 읽지 않는다.
import * as FileSystem from 'expo-file-system/legacy';
import { parseGs1 } from './gs1';

const FILE = `${FileSystem.documentDirectory}item-master.json`;
export const ITEM_FIELDS = ['code', 'name', 'spec', 'unit', 'category', 'location', 'altCodes', 'memo'];

let items = null; // [{ code, name, spec, unit, category, location, altCodes: [], memo, updatedAt }]
let index = null; // 색인 키 → item
let loading = null;
const listeners = new Set();

// 같은 코드로 볼 키: 숫자만이면 앞자리 0을 뗀 값 (UPC-A 12자리 ↔ EAN-13 ↔ GTIN-14), 아니면 대문자
export function codeKey(code) {
  const s = String(code ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return s.replace(/^0+(?=\d)/, '');
  return s.toUpperCase();
}

function rebuildIndex() {
  index = new Map();
  for (const item of items) {
    for (const c of [item.code, ...(item.altCodes || [])]) {
      const k = codeKey(c);
      if (k && !index.has(k)) index.set(k, item);
    }
  }
}

function notify() {
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function subscribeItems(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadItems() {
  if (items) return items;
  if (!loading) {
    loading = (async () => {
      try {
        const info = await FileSystem.getInfoAsync(FILE);
        if (info.exists) {
          const parsed = JSON.parse(await FileSystem.readAsStringAsync(FILE));
          items = Array.isArray(parsed?.items) ? parsed.items : [];
        } else {
          items = [];
        }
      } catch (e) {
        console.warn('[itemMaster] load failed:', e?.message);
        items = [];
      }
      rebuildIndex();
      return items;
    })();
  }
  return loading;
}

async function persist() {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify({ version: 1, items }));
  rebuildIndex();
  notify();
}

export function getItemCount() {
  return items ? items.length : 0;
}

// 이미 불러온 상태에서만 동기로 찾는다 (스캔 직후 토스트 등). 아직 안 불러왔으면 null
export function lookupItemSync(code) {
  if (!index || !code) return null;
  const direct = index.get(codeKey(code));
  if (direct) return direct;
  const gs1 = parseGs1(String(code));
  if (gs1?.gtin) return index.get(codeKey(gs1.gtin)) || null;
  return null;
}

export async function lookupItem(code) {
  await loadItems();
  return lookupItemSync(code);
}

function cleanItem(raw, now) {
  const altCodes = Array.isArray(raw.altCodes)
    ? raw.altCodes
    : String(raw.altCodes || '').split(/[;,]/);
  return {
    code: String(raw.code).trim(),
    name: String(raw.name || '').trim(),
    spec: String(raw.spec || '').trim(),
    unit: String(raw.unit || '').trim(),
    category: String(raw.category || '').trim(),
    location: String(raw.location || '').trim(),
    altCodes: altCodes.map(c => String(c).trim()).filter(Boolean),
    memo: String(raw.memo || '').trim(),
    updatedAt: now,
  };
}

// 여러 건 넣기. policy: 'overwrite'(덮어쓰기) | 'fill'(빈칸만 채우기) | 'skip'(건너뛰기)
// 반환 { added, updated, skipped }
export async function upsertItems(records, policy = 'overwrite') {
  await loadItems();
  const now = Date.now();
  const byKey = new Map(items.map((it, i) => [codeKey(it.code), i]));
  const next = items.slice();
  let added = 0, updated = 0, skipped = 0;
  for (const raw of records) {
    if (!raw?.code) continue;
    const rec = cleanItem(raw, now);
    const at = byKey.get(codeKey(rec.code));
    if (at === undefined) {
      byKey.set(codeKey(rec.code), next.length);
      next.push(rec);
      added++;
      continue;
    }
    if (policy === 'skip') { skipped++; continue; }
    const prev = next[at];
    if (policy === 'fill') {
      const merged = { ...prev };
      for (const f of ['name', 'spec', 'unit', 'category', 'location', 'memo']) if (!merged[f] && rec[f]) merged[f] = rec[f];
      merged.altCodes = Array.from(new Set([...(prev.altCodes || []), ...rec.altCodes]));
      merged.updatedAt = now;
      next[at] = merged;
    } else {
      next[at] = { ...rec, code: prev.code };
    }
    updated++;
  }
  items = next;
  await persist();
  return { added, updated, skipped };
}

export async function saveItem(item, originalCode) {
  await loadItems();
  const rec = cleanItem(item, Date.now());
  const key = codeKey(originalCode || rec.code);
  const at = items.findIndex(it => codeKey(it.code) === key);
  items = items.slice();
  if (at === -1) items.unshift(rec); else items[at] = rec;
  await persist();
  return rec;
}

export async function deleteItem(code) {
  await loadItems();
  const key = codeKey(code);
  items = items.filter(it => codeKey(it.code) !== key);
  await persist();
}

export async function clearItems() {
  await loadItems();
  items = [];
  await persist();
}

// 백업·복원용
export async function exportItemsForBackup() {
  await loadItems();
  return items.length ? { version: 1, items } : null;
}

export async function restoreItemsFromBackup(data) {
  if (!data || !Array.isArray(data.items)) return;
  items = data.items;
  await persist();
}
