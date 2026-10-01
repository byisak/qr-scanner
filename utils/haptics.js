// utils/haptics.js - 앱 공용 진동
// Android expo-haptics 기본 진동은 진폭이 30~70/255라 약하고 "부르르" 탁하게 느껴진다.
// 그래서 Android는 (1) 시스템 햅틱(기기 튜닝, 또렷함) 또는 (2) 진폭을 직접 정한 파형으로 울린다.
// 세기·패턴은 설정 > 스캔 피드백에서 고른다.
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';

const NativeHaptics = Platform.OS === 'android' ? requireOptionalNativeModule('ExpoHaptics') : null;
const canWaveform = !!NativeHaptics?.vibrateWaveformAsync;

export const HAPTIC_INTENSITY_KEY = 'hapticIntensity';
export const HAPTIC_PATTERN_KEY = 'hapticPattern';
export const HAPTIC_INTENSITIES = ['light', 'medium', 'strong'];
export const HAPTIC_PATTERNS = ['system', 'tap', 'double', 'long'];

// 기본값: 또렷한 짧은 '톡'을 보통 세기로
let settings = { intensity: 'medium', pattern: 'tap' };

const AMPLITUDE = { light: 110, medium: 190, strong: 255 };
const IOS_IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  strong: Haptics.ImpactFeedbackStyle.Heavy,
};

export async function loadHapticSettings() {
  try {
    const [[, intensity], [, pattern]] = await AsyncStorage.multiGet([HAPTIC_INTENSITY_KEY, HAPTIC_PATTERN_KEY]);
    if (HAPTIC_INTENSITIES.includes(intensity)) settings.intensity = intensity;
    if (HAPTIC_PATTERNS.includes(pattern)) settings.pattern = pattern;
  } catch {
    // 기본값 유지
  }
  return { ...settings };
}

export async function saveHapticSettings(next) {
  settings = { ...settings, ...next };
  await AsyncStorage.multiSet([
    [HAPTIC_INTENSITY_KEY, settings.intensity],
    [HAPTIC_PATTERN_KEY, settings.pattern],
  ]);
}

export function getHapticSettings() {
  return { ...settings };
}

function waveform(timings, amplitudes) {
  return NativeHaptics.vibrateWaveformAsync(timings, amplitudes).catch(() => {});
}

function safe(promise) {
  return promise?.catch?.(() => {});
}

// 패턴별 파형 (0으로 시작: 대기 0ms 후 진동)
function patternWave(pattern, amp) {
  switch (pattern) {
    case 'double':
      return [[0, 28, 70, 28], [0, amp, 0, amp]];
    case 'long':
      return [[0, 90], [0, amp]];
    case 'tap':
    default:
      return [[0, 32], [0, amp]];
  }
}

// 스캔 성공 (가장 자주 울리는 진동 — 세기·패턴 설정을 그대로 따른다)
export function scan(override) {
  const { intensity, pattern } = { ...settings, ...override };
  if (Platform.OS === 'android') {
    if (pattern === 'system' || !canWaveform) {
      return safe(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
    }
    const [t, a] = patternWave(pattern, AMPLITUDE[intensity]);
    return waveform(t, a);
  }
  if (pattern === 'double') {
    safe(Haptics.impactAsync(IOS_IMPACT[intensity]));
    setTimeout(() => safe(Haptics.impactAsync(IOS_IMPACT[intensity])), 90);
    return Promise.resolve();
  }
  if (pattern === 'system') return safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  return safe(Haptics.impactAsync(IOS_IMPACT[intensity]));
}

// 성공 알림 (저장 완료 등) — 스캔과 같은 느낌
export function success() {
  return scan();
}

// 경고 (중복 등): 스캔과 구분되게 짧게 두 번, 두 번째가 길다
export function warning() {
  if (Platform.OS === 'android') {
    if (settings.pattern === 'system' || !canWaveform) {
      return safe(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
    }
    const amp = AMPLITUDE[settings.intensity];
    return waveform([0, 30, 80, 60], [0, amp, 0, amp]);
  }
  return safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

// 오류 (PIN 틀림 등): 세 번
export function error() {
  if (Platform.OS === 'android') {
    if (settings.pattern === 'system' || !canWaveform) {
      return safe(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
    }
    const amp = AMPLITUDE[settings.intensity];
    return waveform([0, 40, 60, 40, 60, 40], [0, amp, 0, amp, 0, amp]);
  }
  return safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

// 가벼운 터치 (키패드·버튼·선택): 짧고 또렷한 클릭
export function tap() {
  if (Platform.OS === 'android') {
    if (settings.pattern === 'system' || !canWaveform) {
      return safe(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap));
    }
    return waveform([0, 14], [0, Math.round(AMPLITUDE[settings.intensity] * 0.75)]);
  }
  return safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

// 선택 변경 (토글·탭 이동)
export function selection() {
  if (Platform.OS === 'android') {
    if (settings.pattern === 'system' || !canWaveform) {
      return safe(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick));
    }
    return waveform([0, 10], [0, Math.round(AMPLITUDE[settings.intensity] * 0.6)]);
  }
  return safe(Haptics.selectionAsync());
}

// 중간 세기 강조 (길게 누름 등)
export function impact() {
  if (Platform.OS === 'android') {
    if (settings.pattern === 'system' || !canWaveform) {
      return safe(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press));
    }
    return waveform([0, 24], [0, AMPLITUDE[settings.intensity]]);
  }
  return safe(Haptics.impactAsync(IOS_IMPACT[settings.intensity]));
}

export default { scan, success, warning, error, tap, selection, impact, loadHapticSettings, saveHapticSettings, getHapticSettings };
