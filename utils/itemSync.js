// utils/itemSync.js - 품목 마스터를 계정(scanview.app)과 주고받기
// 받기: 계정의 품목으로 기기 품목을 덮어쓴다(계정에 없는 기기 품목은 그대로). 올리기: 기기 품목을 계정에 덮어쓴다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './serverApi';
import { loadItems, upsertItems } from './itemMaster';

const PAGE = 5000;
const CHUNK = 2000;
export const ITEM_SYNC_AT_KEY = 'itemMasterSyncedAt';

export async function pullItemsFromAccount(onProgress) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const data = await apiFetch(`/api/items?offset=${offset}&limit=${PAGE}`);
    all.push(...data.items);
    onProgress?.(all.length, data.total);
    if (all.length >= data.total || data.items.length < PAGE) break;
  }
  const stats = all.length ? await upsertItems(all, 'overwrite') : { added: 0, updated: 0, skipped: 0 };
  await AsyncStorage.setItem(ITEM_SYNC_AT_KEY, String(Date.now()));
  return { ...stats, total: all.length };
}

export async function pushItemsToAccount(onProgress) {
  const items = await loadItems();
  let added = 0, updated = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const d = await apiFetch('/api/items/bulk', { method: 'POST', body: { policy: 'overwrite', items: items.slice(i, i + CHUNK) } });
    added += d.added; updated += d.updated;
    onProgress?.(Math.min(items.length, i + CHUNK), items.length);
  }
  await AsyncStorage.setItem(ITEM_SYNC_AT_KEY, String(Date.now()));
  return { added, updated, total: items.length };
}
