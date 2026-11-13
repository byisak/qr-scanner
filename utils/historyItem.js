// utils/historyItem.js - 기록 항목 하나를 그룹·코드로 찾아 고친다 (결과 화면의 메모·수량 편집용)
import { readHistory, updateHistory } from './historyStore';

export async function findHistoryItem(groupId, code) {
  try {
    const byGroup = await readHistory();
    const list = byGroup[groupId || 'default'] || [];
    return list.find(item => item.code === code) || null;
  } catch {
    return null;
  }
}

// patch는 객체 또는 (item) => 객체. 항목이 없으면 false
export async function updateHistoryItem(groupId, code, patch) {
  const gid = groupId || 'default';
  let updated = false;
  await updateHistory(byGroup => {
    const list = byGroup[gid] || [];
    const index = list.findIndex(item => item.code === code);
    if (index === -1) return false;
    const next = typeof patch === 'function' ? patch(list[index]) : patch;
    list[index] = { ...list[index], ...next };
    updated = list[index];
    return undefined;
  });
  return updated;
}
