// utils/scanPhotoStore.js - 스캔 직후 찍는 사진을 결과 화면에 늦게 넘겨준다
// 한 개 스캔은 사진 촬영(구형 기기 0.5~1.5초)을 기다리지 않고 결과 화면을 먼저 띄운다.
// 스캔 화면이 촬영 약속(promise)을 여기에 적고, 결과 화면은 사진이 비어 있으면 여기를 구독해 끝나면 보여 준다.
const KEEP_MS = 10000;
const entries = new Map(); // code → { uri, done, at }
const listeners = new Map(); // code → Set<fn>

const notify = (code, uri) => {
  const set = listeners.get(code);
  if (set) set.forEach(fn => { try { fn(uri); } catch { /* 화면이 사라졌으면 무시 */ } });
};

/** 촬영 약속을 적는다. promise는 사진 경로(string) 또는 null로 끝난다 */
export function setPendingScanPhoto(code, promise) {
  if (!code || !promise) return;
  const entry = { uri: null, done: false, at: Date.now() };
  entries.set(code, entry);
  Promise.resolve(promise)
    .then(uri => { entry.uri = uri || null; })
    .catch(() => {})
    .finally(() => {
      entry.done = true;
      if (entries.get(code) === entry) notify(code, entry.uri);
      // 오래 들고 있지 않는다
      setTimeout(() => { if (entries.get(code) === entry) entries.delete(code); }, KEEP_MS);
    });
}

/** 이미 끝난 사진 경로 (없거나 아직이면 null) */
export function getScanPhoto(code) {
  const e = entries.get(code);
  return e && e.done ? e.uri : null;
}

/** 아직 찍는 중인지 */
export function isScanPhotoPending(code) {
  const e = entries.get(code);
  return !!e && !e.done;
}

/** 사진이 끝나면 fn(uri | null). 반환값으로 구독을 끊는다 */
export function subscribeScanPhoto(code, fn) {
  if (!listeners.has(code)) listeners.set(code, new Set());
  listeners.get(code).add(fn);
  return () => {
    const set = listeners.get(code);
    if (!set) return;
    set.delete(fn);
    if (!set.size) listeners.delete(code);
  };
}
