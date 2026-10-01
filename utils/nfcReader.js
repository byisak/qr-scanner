// utils/nfcReader.js - NFC 태그 읽기. NDEF 텍스트/URI가 있으면 그 값, 없으면 태그 ID(16진수)
// Android: 스캐너가 떠 있는 동안 계속 듣는다(리더 모드 → 시스템 NFC 팝업 안 뜸)
// iOS: 버튼을 눌렀을 때 시스템 시트로 한 번 읽는다
import { Platform } from 'react-native';
import NfcManager, { NfcEvents, Ndef, NfcAdapter } from 'react-native-nfc-manager';

let started = false;

export async function isNfcSupported() {
  try {
    const supported = await NfcManager.isSupported();
    if (supported && !started) {
      await NfcManager.start();
      started = true;
    }
    return !!supported;
  } catch {
    return false;
  }
}

export async function isNfcEnabled() {
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

function bytesToString(bytes) {
  try {
    return decodeURIComponent(escape(String.fromCharCode(...bytes)));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

// 태그 → { value, kind: 'text' | 'uri' | 'mime' | 'id' } | null
export function decodeTag(tag) {
  if (!tag) return null;
  const records = Array.isArray(tag.ndefMessage) ? tag.ndefMessage : [];
  for (const record of records) {
    const type = Array.isArray(record.type) ? String.fromCharCode(...record.type) : String(record.type || '');
    const payload = Uint8Array.from(record.payload || []);
    try {
      if (record.tnf === Ndef.TNF_WELL_KNOWN && type === 'T') {
        const value = Ndef.text.decodePayload(payload);
        if (value) return { value, kind: 'text' };
      }
      if (record.tnf === Ndef.TNF_WELL_KNOWN && type === 'U') {
        const value = Ndef.uri.decodePayload(payload);
        if (value) return { value, kind: 'uri' };
      }
      if (record.tnf === Ndef.TNF_ABSOLUTE_URI && type) return { value: type, kind: 'uri' };
      if (record.tnf === Ndef.TNF_MIME_MEDIA && /^text\//i.test(type)) {
        const value = bytesToString(Array.from(payload)).trim();
        if (value) return { value, kind: 'mime' };
      }
    } catch {
      // 다음 레코드로
    }
  }
  if (tag.id) return { value: String(tag.id).toUpperCase(), kind: 'id' };
  return null;
}

// Android: 계속 듣기. 반환값을 호출하면 멈춘다
export async function startNfcListening(onRead) {
  if (Platform.OS !== 'android') return () => {};
  if (!(await isNfcSupported())) return () => {};
  NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag) => {
    const decoded = decodeTag(tag);
    if (decoded) onRead(decoded);
  });
  try {
    await NfcManager.registerTagEvent({
      isReaderModeEnabled: true,
      readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V,
      readerModeDelay: 200,
      invalidateAfterFirstRead: false,
    });
  } catch (e) {
    console.warn('[nfc] registerTagEvent failed:', e);
  }
  return () => {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.unregisterTagEvent().catch(() => {});
  };
}

// iOS: 시스템 시트로 한 번 읽기. 취소하면 null
export function readNfcOnce(alertMessage) {
  return new Promise(async (resolve) => {
    if (!(await isNfcSupported())) { resolve(null); return; }
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.setEventListener(NfcEvents.SessionClosed, null);
      NfcManager.unregisterTagEvent().catch(() => {});
      resolve(value);
    };
    NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag) => finish(decodeTag(tag)));
    NfcManager.setEventListener(NfcEvents.SessionClosed, () => finish(null));
    try {
      await NfcManager.registerTagEvent({ alertMessage, invalidateAfterFirstRead: true });
    } catch {
      finish(null);
    }
  });
}
