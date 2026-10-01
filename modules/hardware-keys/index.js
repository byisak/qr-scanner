// modules/hardware-keys/index.js - 볼륨 키 가로채기 (Android 전용. iOS는 공식 방법이 없어 no-op)
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const native = Platform.OS === 'android' ? requireOptionalNativeModule('HardwareKeys') : null;

export const HARDWARE_KEYS = ['volumeUp', 'volumeDown'];

export const isHardwareKeysAvailable = !!native;

// 가로챌 키 목록. 빈 배열이면 평소처럼 볼륨이 바뀐다
export function setCapturedKeys(keys) {
  if (!native) return;
  try {
    native.setCapturedKeys(Array.isArray(keys) ? keys.filter(k => HARDWARE_KEYS.includes(k)) : []);
  } catch (e) {
    console.warn('[hardware-keys] setCapturedKeys failed:', e);
  }
}

// 리스너는 { key: 'volumeUp' | 'volumeDown' } 를 받는다. 반환값의 remove()로 해제
export function addHardwareKeyListener(listener) {
  if (!native) return { remove() {} };
  return native.addListener('onHardwareKey', listener);
}
