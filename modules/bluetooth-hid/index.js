// modules/bluetooth-hid/index.js - 휴대폰을 PC의 블루투스 키보드로 (Android 9+ 전용. iOS·구형 Android는 no-op)
import { Platform, PermissionsAndroid } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const native = Platform.OS === 'android' ? requireOptionalNativeModule('BluetoothHid') : null;

export const isBluetoothHidAvailable = !!native && (() => { try { return native.isSupported(); } catch { return false; } })();

// Android 12+: 연결·광고 권한을 먼저 받는다. 모두 허용되면 true
export async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 31) return true;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  ]);
  return Object.values(res).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
}

export function getStatus() {
  if (!native) return { supported: false, bluetoothOn: false, registered: false, device: null };
  try { return native.getStatus(); } catch { return { supported: false, bluetoothOn: false, registered: false, device: null }; }
}

export async function start() { return native ? native.start() : false; }
export async function stop() { return native ? native.stop() : true; }
export function getPairedDevices() { try { return native ? native.getPairedDevices() : []; } catch { return []; } }
export async function connect(address) { return native ? native.connect(address) : false; }
export async function disconnect() { return native ? native.disconnect() : true; }
export function requestDiscoverable(seconds = 120) { try { return native ? native.requestDiscoverable(seconds) : false; } catch { return false; } }
export async function sendText(text) {
  if (!native) return { sent: 0, skipped: String(text).length, connected: false };
  return native.sendText(String(text));
}

// 리스너는 { state: 'registered'|'unregistered'|'connecting'|'connected'|'disconnected', registered, device } 를 받는다
export function addStateListener(listener) {
  if (!native) return { remove() {} };
  return native.addListener('onStateChange', listener);
}
