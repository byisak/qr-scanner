// utils/groupStore.js - 그룹 여러 개를 한 번에 지우고, 지워질 기록 수를 센다
// 그룹·기록·세션 정보를 한 번에 읽고 한 번에 써서(multiGet/multiSet), 중간에 앱이 꺼져도
// "그룹은 지워졌는데 기록은 남는" 식으로 어긋나지 않게 한다.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_GROUP_ID = 'default';

const parse = (json, fallback) => {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

/** 그룹별 스캔 기록 수 { [groupId]: number } */
export async function countRecordsByGroup() {
  const json = await AsyncStorage.getItem('scanHistoryByGroup');
  const byGroup = parse(json, {});
  const counts = {};
  for (const id of Object.keys(byGroup)) counts[id] = Array.isArray(byGroup[id]) ? byGroup[id].length : 0;
  return counts;
}

/**
 * 그룹 여러 개 삭제 (기본 그룹은 항상 건너뛴다).
 * 그룹 목록, 그룹별 기록, 전체 기록, 실시간 전송 세션, 활성 세션, 선택된 그룹을 함께 정리한다.
 * @returns 실제로 지운 그룹 id 목록
 */
export async function deleteGroups(ids) {
  const targets = new Set(ids.filter((id) => id !== DEFAULT_GROUP_ID));
  if (targets.size === 0) return [];

  const keys = ['scanGroups', 'scanHistoryByGroup', 'scanHistory', 'sessionUrls', 'activeSessionId', 'selectedGroupId'];
  const entries = Object.fromEntries(await AsyncStorage.multiGet(keys));

  const groups = parse(entries.scanGroups, []);
  const cloudIds = new Set(groups.filter((g) => targets.has(g.id) && g.isCloudSync).map((g) => g.id));
  const nextGroups = groups.filter((g) => !targets.has(g.id));

  const byGroup = parse(entries.scanHistoryByGroup, {});
  for (const id of targets) delete byGroup[id];

  const history = parse(entries.scanHistory, null);
  const nextHistory = Array.isArray(history) ? history.filter((item) => !targets.has(item.groupId)) : null;

  const writes = [
    ['scanGroups', JSON.stringify(nextGroups)],
    ['scanHistoryByGroup', JSON.stringify(byGroup)],
  ];
  if (nextHistory) writes.push(['scanHistory', JSON.stringify(nextHistory)]);
  const removes = [];

  if (cloudIds.size > 0) {
    const sessions = parse(entries.sessionUrls, []);
    const nextSessions = sessions.filter((s) => !cloudIds.has(s.id));
    writes.push(['sessionUrls', JSON.stringify(nextSessions)]);
    if (entries.activeSessionId && cloudIds.has(entries.activeSessionId)) {
      if (nextSessions.length > 0) writes.push(['activeSessionId', nextSessions[0].id]);
      else removes.push('activeSessionId');
    }
  }
  if (entries.selectedGroupId && targets.has(entries.selectedGroupId)) {
    writes.push(['selectedGroupId', DEFAULT_GROUP_ID]);
  }

  await AsyncStorage.multiSet(writes);
  if (removes.length) await AsyncStorage.multiRemove(removes);
  return [...targets];
}
