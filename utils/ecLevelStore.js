// utils/ecLevelStore.js - QR 값 → 오류 정정 레벨(L/M/Q/H)을 앱이 켜져 있는 동안 기억한다
// Android는 레벨을 ZXing으로 따로 읽어서 코드가 처음 잡힌 프레임에는 없고 다음 프레임에 들어오는 일이 많다.
// 스캔 화면이 프레임마다 여기에 적고, 결과 화면은 레벨이 비어 있으면 여기를 구독해 늦게 들어온 값을 보여 준다
const levels = new Map();
const listeners = new Map(); // code → Set<fn>
const MAX = 300;

export function setEcLevel(code, level) {
  if (!code || !level) return;
  const v = String(level).toUpperCase();
  if (!/^[LMQH]$/.test(v) || levels.get(code) === v) return;
  if (levels.size >= MAX) levels.delete(levels.keys().next().value);
  levels.set(code, v);
  const set = listeners.get(code);
  if (set) set.forEach(fn => { try { fn(v); } catch { /* 화면이 사라졌으면 무시 */ } });
}

export function getEcLevel(code) {
  return levels.get(code) || null;
}

/** 레벨이 들어오면 fn(level). 반환값으로 구독을 끊는다 */
export function subscribeEcLevel(code, fn) {
  if (!listeners.has(code)) listeners.set(code, new Set());
  listeners.get(code).add(fn);
  return () => {
    const set = listeners.get(code);
    if (!set) return;
    set.delete(fn);
    if (!set.size) listeners.delete(code);
  };
}

/** 최대 ms 동안 레벨을 기다린다 (없으면 null) */
export function waitForEcLevel(code, ms) {
  const now = getEcLevel(code);
  if (now) return Promise.resolve(now);
  return new Promise(resolve => {
    let done = false;
    const off = subscribeEcLevel(code, (v) => { if (!done) { done = true; off(); resolve(v); } });
    setTimeout(() => { if (!done) { done = true; off(); resolve(null); } }, ms);
  });
}
