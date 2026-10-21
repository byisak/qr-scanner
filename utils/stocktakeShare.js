// utils/stocktakeShare.js - 재고 실사를 여러 사람이 함께: 서버(scanview.app)에 공유 실사를 만들고 참여 코드로 들어온다
// 스캔은 기기에 바로 반영하고, 보낼 기록은 큐에 쌓았다가 보낸다(오프라인이어도 잃지 않게, client_id 로 중복 방지).
// 서버 합계를 받을 때는 아직 못 보낸 기록을 더해 화면 숫자가 뒤로 가지 않게 한다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './serverApi';
import { codeKey } from './itemMaster';
import { upsertStocktake, setActiveStocktake } from './stocktake';
import { trackEvent } from './analytics';

const queueKey = (sharedId) => `stocktakeShareQueue:${sharedId}`;
const BATCH = 400;
const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;

async function readQueue(sharedId) {
  try { return JSON.parse((await AsyncStorage.getItem(queueKey(sharedId))) || '[]'); } catch { return []; }
}
async function writeQueue(sharedId, q) {
  await AsyncStorage.setItem(queueKey(sharedId), JSON.stringify(q));
}

// 서버 상태 → 기기 실사 객체 (못 보낸 기록은 더한다)
function applyServerState(local, state, role, pending) {
  const pendingByKey = new Map();
  for (const e of pending) {
    const k = codeKey(e.itemCode || e.code);
    pendingByKey.set(k, (pendingByKey.get(k) || 0) + e.qty);
  }
  const used = new Set();
  const items = state.items.map((i) => {
    used.add(i.codeKey);
    return { code: i.code, name: i.name, expected: i.expected, scanned: Math.max(0, i.scanned + (pendingByKey.get(i.codeKey) || 0)), lastAt: i.lastAt ? Date.parse(i.lastAt) : null };
  });
  const extras = state.extras.map((e) => {
    used.add(e.codeKey);
    return { code: e.code, scanned: e.scanned + (pendingByKey.get(e.codeKey) || 0), lastAt: e.lastAt ? Date.parse(e.lastAt) : null };
  });
  for (const ev of pending) {
    const k = codeKey(ev.itemCode || ev.code);
    if (!used.has(k)) { used.add(k); extras.unshift({ code: ev.code, scanned: pendingByKey.get(k), lastAt: ev.scannedAt }); }
  }
  return {
    ...local,
    name: state.name,
    finishedAt: state.finishedAt ? Date.parse(state.finishedAt) : null,
    items,
    extras: extras.filter((e) => e.scanned !== 0),
    shared: {
      id: state.id,
      joinCode: state.joinCode,
      role,
      members: state.members,
      syncedAt: Date.now(),
      pending: pending.length,
    },
  };
}

/** 기기에서 만든 실사를 함께 하는 실사로 바꾼다 (이미 찍은 수량도 함께 올린다) */
export async function shareStocktake(stocktake) {
  const scans = [
    ...stocktake.items.filter((i) => i.scanned > 0).map((i, n) => ({ clientId: `init-${stocktake.id}-i${n}`, code: i.code, qty: i.scanned })),
    ...stocktake.extras.filter((e) => e.scanned > 0).map((e, n) => ({ clientId: `init-${stocktake.id}-e${n}`, code: e.code, qty: e.scanned })),
  ];
  const data = await apiFetch('/api/stocktakes', {
    method: 'POST',
    body: { name: stocktake.name, items: stocktake.items.map((i) => ({ code: i.code, name: i.name, expected: i.expected })), scans },
  });
  const next = applyServerState(stocktake, data.stocktake, 'owner', []);
  await upsertStocktake(next);
  trackEvent('stocktake_shared', { item_count: stocktake.items.length });
  return next;
}

/** 참여 코드로 들어가 기기에 실사를 만들고 진행 중으로 둔다 */
export async function joinStocktake(code) {
  const data = await apiFetch('/api/stocktakes/join', { method: 'POST', body: { code } });
  const st = data.stocktake;
  const base = { id: `st_shared_${st.id}`, name: st.name, createdAt: Date.parse(st.createdAt) || Date.now(), finishedAt: null, items: [], extras: [] };
  const next = applyServerState(base, st, data.role, await readQueue(st.id));
  await upsertStocktake(next);
  if (!next.finishedAt) await setActiveStocktake(next.id);
  trackEvent('stocktake_joined');
  return next;
}

let flushing = null;
/** 쌓인 스캔 기록을 보낸다. 서버 상태(마지막 응답)를 돌려준다. 오프라인이면 null */
export async function flushShareQueue(sharedId) {
  if (flushing) return flushing;
  flushing = (async () => {
    let state = null;
    try {
      for (;;) {
        const q = await readQueue(sharedId);
        if (!q.length) break;
        const batch = q.slice(0, BATCH);
        const data = await apiFetch(`/api/stocktakes/${sharedId}/scans`, { method: 'POST', body: { events: batch } });
        state = data;
        const sent = new Set(batch.map((e) => e.clientId));
        await writeQueue(sharedId, (await readQueue(sharedId)).filter((e) => !sent.has(e.clientId)));
      }
    } catch (e) {
      // 끝난 실사(409)·접근 불가(404)면 더 보내지 않고 버린다. 그 밖(오프라인 등)은 다음에 다시
      if (e?.status === 409 || e?.status === 404) await writeQueue(sharedId, []);
    }
    return state;
  })();
  try { return await flushing; } finally { flushing = null; }
}

/** 스캔·수량 고치기 하나를 큐에 넣고 보내기를 시작한다. itemCode = 맞춘 품목 코드(없으면 목록 외) */
export async function enqueueShareEvent(stocktake, { code, itemCode, qty }) {
  if (!stocktake?.shared?.id || !qty) return;
  const sharedId = stocktake.shared.id;
  const q = await readQueue(sharedId);
  q.push({ clientId: newClientId(), code, itemCode: itemCode || undefined, qty, scannedAt: Date.now() });
  await writeQueue(sharedId, q);
  flushShareQueue(sharedId).catch(() => {});
}

/** 보내고, 서버 합계로 기기 실사를 새로 고친다 */
export async function syncSharedStocktake(stocktake) {
  if (!stocktake?.shared?.id) return stocktake;
  const sharedId = stocktake.shared.id;
  await flushShareQueue(sharedId);
  const data = await apiFetch(`/api/stocktakes/${sharedId}`);
  const next = applyServerState(stocktake, data.stocktake, data.role, await readQueue(sharedId));
  await upsertStocktake(next);
  return next;
}

/** 만든 사람: 서버에서도 끝내기·다시 열기 */
export async function setSharedFinished(stocktake, finished) {
  if (!stocktake?.shared?.id || stocktake.shared.role !== 'owner') return;
  await flushShareQueue(stocktake.shared.id);
  await apiFetch(`/api/stocktakes/${stocktake.shared.id}`, { method: 'PATCH', body: { finished } });
}

/** 만든 사람: 서버 실사 삭제, 참여자: 나가기 */
export async function leaveOrDeleteShared(stocktake) {
  if (!stocktake?.shared?.id) return;
  try { await apiFetch(`/api/stocktakes/${stocktake.shared.id}`, { method: 'DELETE' }); } catch { /* 이미 없으면 무시 */ }
  await AsyncStorage.removeItem(queueKey(stocktake.shared.id));
}
