// utils/historyStore.js - 스캔 기록(scanHistoryByGroup)을 읽고 쓰는 단 하나의 통로
// 기록 전체가 AsyncStorage 키 하나에 들어 있어서, 화면마다 "읽기 → 고치기 → 통째로 쓰기"를 따로 하면
// 겹칠 때 한쪽 변경이 사라진다 (예: 결과 화면에서 메모를 고치는 동안 스캔 화면이 늦게 끝난 사진을 붙임).
// 여기서는 메모리에 한 벌만 들고, 고치는 일은 그 한 벌에 바로(동기) 적용한 뒤 순서대로 저장한다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export const HISTORY_KEY = 'scanHistoryByGroup';
export const HISTORY_LIMIT = 1000; // 그룹당 보관 개수

let cache = null; // { [groupId]: item[] }
let loadPromise = null;
let generation = 0; // invalidate 뒤에 끝난 옛 읽기를 버리기 위한 번호
let writeChain = Promise.resolve();
let dirty = false;

function ensureLoaded() {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) {
    const gen = generation;
    const p = AsyncStorage.getItem(HISTORY_KEY)
      .then(raw => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
          // 읽을 수 없는 기록은 다음 저장 때 덮어쓰이므로 원본을 따로 남겨 둔다
          AsyncStorage.setItem(`${HISTORY_KEY}_corrupt`, raw).catch(() => {});
        }
        const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        if (gen === generation) cache = value;
        return value;
      })
      .finally(() => { if (loadPromise === p) loadPromise = null; });
    loadPromise = p;
  }
  return loadPromise;
}

// 여러 번 고쳐도 저장은 차례로, 밀려 있으면 마지막 상태 한 번만 쓴다
function persist() {
  dirty = true;
  const p = writeChain.then(async () => {
    if (!dirty || !cache) return;
    dirty = false;
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(cache));
  });
  writeChain = p.catch(() => {});
  return p;
}

const snapshot = (byGroup) => {
  const out = {};
  for (const id of Object.keys(byGroup)) out[id] = Array.isArray(byGroup[id]) ? [...byGroup[id]] : byGroup[id];
  return out;
};

/** 기록이 저장소에 하나라도 있는지 (옛 형식 마이그레이션 판단용) */
export async function hasStoredHistory() {
  if (cache && Object.keys(cache).length) return true;
  return (await AsyncStorage.getItem(HISTORY_KEY)) != null;
}

/** 전체 기록의 복사본 { [groupId]: item[] }. 배열은 복사본이라 고쳐도 저장소에 영향이 없다 */
export async function readHistory() {
  return snapshot(await ensureLoaded());
}

/**
 * 기록을 고친다. mutator(byGroup)는 동기 함수여야 한다 (그래야 다른 변경과 섞이지 않는다).
 * - byGroup을 직접 고치면 저장한다 (통째로 바꾸려면 replaceHistory)
 * - false를 돌려주면 저장하지 않는다
 * 돌려주는 값: 저장이 끝난 뒤 mutator의 반환값 (false면 false)
 */
export async function updateHistory(mutator) {
  const byGroup = await ensureLoaded();
  const result = mutator(byGroup);
  if (result === false) return false;
  await persist();
  return result;
}

/**
 * 기록 전체를 바꿔 쓴다. readHistory()로 받은 복사본을 (await 없이) 고친 뒤 바로 넘기면
 * 읽기~쓰기 사이에 다른 변경이 끼어들지 못한다.
 */
export function replaceHistory(byGroup) {
  const apply = () => {
    cache = snapshot(byGroup || {});
    return persist();
  };
  return cache ? apply() : ensureLoaded().then(apply);
}

/** 다른 코드가 AsyncStorage에 직접 썼을 때(백업 복원, multiSet 등) 부른다. 다음 읽기에서 다시 불러온다 */
export async function invalidateHistory() {
  await writeChain;
  generation += 1;
  cache = null;
  loadPromise = null;
  dirty = false;
}

/** 밀린 저장이 끝날 때까지 기다린다 (직접 읽는 코드가 최신 값을 보게) */
export function flushHistory() {
  return writeChain;
}

/** 새 항목을 그룹 맨 앞에 넣고 보관 개수를 넘는 오래된 항목은 잘라 낸다. 잘린 항목의 사진도 지운다 */
export function prependCapped(byGroup, groupId, items) {
  const list = [...(Array.isArray(items) ? items : [items]), ...(byGroup[groupId] || [])];
  byGroup[groupId] = list.slice(0, HISTORY_LIMIT);
  if (list.length > HISTORY_LIMIT) deletePhotosOf(list.slice(HISTORY_LIMIT), Object.values(byGroup).flat());
  return byGroup[groupId];
}

const PHOTO_DIR = 'scan_photos/';

// 기록 항목이 가리키는 스캔 사진의 파일 이름들 (scan_photos 폴더 안의 것만)
const photoNamesOf = (item) => {
  if (!item || !Array.isArray(item.photos)) return [];
  return item.photos
    .filter(u => typeof u === 'string' && u.includes(`/${PHOTO_DIR}`))
    .map(u => u.slice(u.lastIndexOf('/') + 1))
    .filter(Boolean);
};

/**
 * 지워진 기록의 스캔 사진 파일을 지운다 (앱의 scan_photos 폴더 안의 파일만).
 * keep: 남아 있는 기록들 (안 주면 지금 기록 전체). 남은 기록이 같은 파일을 쓰고 있으면 지우지 않는다.
 * 실패해도 조용히 넘어간다 (기록 삭제가 사진 때문에 막히면 안 된다).
 */
export function deletePhotosOf(removed, keep = null) {
  const targets = new Set((Array.isArray(removed) ? removed : [removed]).flatMap(photoNamesOf));
  if (!targets.size) return;
  const keepItems = keep || (cache ? Object.values(cache).flat() : []);
  for (const item of keepItems) for (const name of photoNamesOf(item)) targets.delete(name);
  const base = FileSystem.documentDirectory;
  if (!base) return;
  // iOS는 앱 업데이트 때 폴더 경로가 바뀌므로 저장된 전체 경로 대신 파일 이름으로 다시 만든다
  targets.forEach(name => {
    FileSystem.deleteAsync(`${base}${PHOTO_DIR}${name}`, { idempotent: true }).catch(() => {});
  });
}
