// utils/pcKeyboard.js - "PC 키보드 입력": 스캔 값을 블루투스 키보드처럼 PC에 바로 입력 (Android 9+)
// 켜 두면 앱이 시작될 때 키보드로 등록하고 마지막에 쓴 PC에 다시 연결한다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Hid from '../modules/bluetooth-hid';
import { trackEvent } from './analytics';

export const PC_KEYBOARD_ENABLED_KEY = 'pcKeyboardEnabled';
export const PC_KEYBOARD_SUFFIX_KEY = 'pcKeyboardSuffix'; // 'enter' | 'tab' | 'none'
export const PC_KEYBOARD_DEVICE_KEY = 'pcKeyboardLastDevice'; // 주소

export const isPcKeyboardAvailable = Hid.isBluetoothHidAvailable;

let enabled = false;
let suffix = 'enter';

async function permissionsAlreadyGranted() {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 31) return true;
  const a = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  const b = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
  return a && b;
}

export async function loadPcKeyboardSettings() {
  const [[, e], [, s], [, d]] = await AsyncStorage.multiGet([PC_KEYBOARD_ENABLED_KEY, PC_KEYBOARD_SUFFIX_KEY, PC_KEYBOARD_DEVICE_KEY]);
  enabled = e === 'true';
  suffix = s || 'enter';
  return { enabled, suffix, lastDevice: d || null };
}

export function setSuffix(value) {
  suffix = value;
  AsyncStorage.setItem(PC_KEYBOARD_SUFFIX_KEY, value).catch(() => {});
}

export async function setEnabled(value) {
  enabled = value;
  await AsyncStorage.setItem(PC_KEYBOARD_ENABLED_KEY, value ? 'true' : 'false');
  if (!value) await Hid.stop();
}

export function rememberDevice(address) {
  AsyncStorage.setItem(PC_KEYBOARD_DEVICE_KEY, address || '').catch(() => {});
}

// 앱 시작 때: 켜져 있고 권한이 이미 있으면 키보드로 등록하고 마지막 PC에 연결 (권한을 새로 묻지 않는다)
export async function initPcKeyboard() {
  if (!isPcKeyboardAvailable) return;
  const { enabled: on, lastDevice } = await loadPcKeyboardSettings();
  if (!on || !(await permissionsAlreadyGranted())) return;
  const ok = await Hid.start().catch(() => false);
  if (ok && lastDevice) Hid.connect(lastDevice).catch(() => {});
}

const SUFFIX = { enter: '\n', tab: '\t', none: '' };

// 스캔 저장 때 호출. 연결돼 있지 않으면 아무것도 하지 않는다
let sentThisSession = false;
export async function sendScanToPc(code) {
  if (!enabled || !isPcKeyboardAvailable || !code) return;
  const status = Hid.getStatus();
  if (!status.device) return;
  try {
    await Hid.sendText(String(code) + (SUFFIX[suffix] ?? '\n'));
    if (!sentThisSession) { sentThisSession = true; trackEvent('hid_scan_sent'); }
  } catch (e) {
    console.warn('[pcKeyboard] send failed:', e?.message);
  }
}

export { Hid };
