// utils/historyItem.js - 기록 항목 하나를 그룹·코드로 찾아 고친다 (결과 화면의 메모·수량 편집용)
// 스캐너는 화면에 돌아올 때 기록 캐시를 다시 읽으므로 여기서 AsyncStorage를 직접 써도 덮어쓰이지 않는다
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'scanHistoryByGroup';

export async function findHistoryItem(groupId, code) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const byGroup = raw ? JSON.parse(raw) : {};
    const list = byGroup[groupId || 'default'] || [];
    return list.find(item => item.code === code) || null;
  } catch {
    return null;
  }
}

// patch는 객체 또는 (item) => 객체. 항목이 없으면 false
export async function updateHistoryItem(groupId, code, patch) {
  const raw = await AsyncStorage.getItem(KEY);
  const byGroup = raw ? JSON.parse(raw) : {};
  const gid = groupId || 'default';
  const list = byGroup[gid] || [];
  const index = list.findIndex(item => item.code === code);
  if (index === -1) return false;
  const next = typeof patch === 'function' ? patch(list[index]) : patch;
  list[index] = { ...list[index], ...next };
  byGroup[gid] = list;
  await AsyncStorage.setItem(KEY, JSON.stringify(byGroup));
  return list[index];
}
