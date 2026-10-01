// utils/hardwareKeys.js - 하드웨어 키 매핑과 수동 스캔 확정 설정 저장소
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HARDWARE_KEY_MAP_KEY = 'hardwareKeyMap';
export const SCAN_CONFIRM_MODE_KEY = 'scanConfirmMode';

export const KEY_ACTIONS = ['none', 'confirm', 'torch', 'result', 'group', 'multiResults'];
export const DEFAULT_KEY_MAP = { volumeUp: 'none', volumeDown: 'none' };

export function normalizeKeyMap(raw) {
  const map = { ...DEFAULT_KEY_MAP };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_KEY_MAP)) {
      if (KEY_ACTIONS.includes(raw[key])) map[key] = raw[key];
    }
  }
  return map;
}

export function parseKeyMap(json) {
  try {
    return normalizeKeyMap(json ? JSON.parse(json) : null);
  } catch {
    return { ...DEFAULT_KEY_MAP };
  }
}

// '확정'이 지정된 키 이름 (없으면 null)
export function confirmKeyOf(keyMap) {
  return Object.keys(keyMap || {}).find(k => keyMap[k] === 'confirm') || null;
}

export async function loadHardwareKeySettings() {
  const [[, mapJson], [, mode]] = await AsyncStorage.multiGet([HARDWARE_KEY_MAP_KEY, SCAN_CONFIRM_MODE_KEY]);
  return {
    keyMap: parseKeyMap(mapJson),
    scanConfirmMode: mode === 'manual' ? 'manual' : 'auto',
  };
}

export async function saveKeyMap(keyMap) {
  const normalized = normalizeKeyMap(keyMap);
  await AsyncStorage.setItem(HARDWARE_KEY_MAP_KEY, JSON.stringify(normalized));
  // 어느 키에든 '확정'이 있으면 수동 확정이 켜진다
  if (confirmKeyOf(normalized)) await AsyncStorage.setItem(SCAN_CONFIRM_MODE_KEY, 'manual');
  return normalized;
}

// 수동 확정을 끄면 '확정' 매핑도 같이 지운다 (켜는 쪽은 키 없이도 화면 버튼으로 확정)
export async function saveScanConfirmMode(mode, keyMap) {
  await AsyncStorage.setItem(SCAN_CONFIRM_MODE_KEY, mode === 'manual' ? 'manual' : 'auto');
  if (mode !== 'manual' && keyMap && confirmKeyOf(keyMap)) {
    const cleared = { ...keyMap };
    for (const key of Object.keys(cleared)) if (cleared[key] === 'confirm') cleared[key] = 'none';
    await AsyncStorage.setItem(HARDWARE_KEY_MAP_KEY, JSON.stringify(normalizeKeyMap(cleared)));
    return cleared;
  }
  return keyMap;
}
