// utils/vectorFileSave.js - SVG·EPS 같은 문서 파일을 저장 (사진 앨범에는 넣을 수 없는 형식)
// Android: 처음 한 번 고른 폴더(기본 다운로드)에 바로 저장. 권한이 사라지면 다시 고르게 한다.
// iOS: 공유 시트 → "파일에 저장"
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const DIR_KEY = 'vectorExportDirUri';

export const VECTOR_FORMATS = {
  svg: { ext: 'svg', mime: 'image/svg+xml', uti: 'public.svg-image' },
  // Android SAF 는 application/postscript 에 .ps 를 붙인다 → 저장할 때는 이름 그대로 두는 octet-stream
  eps: { ext: 'eps', mime: 'application/postscript', safMime: 'application/octet-stream', keepExt: true, uti: 'com.adobe.encapsulated-postscript' },
};

/** 파일 이름에 쓸 수 없는 글자를 뺀다 */
export function safeFileName(base, ext) {
  const clean = String(base || 'code').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'code';
  return `${clean}.${ext}`;
}

async function writeCache(name, content) {
  const dir = FileSystem.cacheDirectory.endsWith('/') ? FileSystem.cacheDirectory : `${FileSystem.cacheDirectory}/`;
  const uri = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

/** 공유 시트로 보낸다 (iOS 저장, 양쪽 공유) */
export async function shareTextFile(name, content, format) {
  const f = VECTOR_FORMATS[format];
  const uri = await writeCache(name, content);
  await Sharing.shareAsync(uri, { mimeType: f.mime, UTI: f.uti, dialogTitle: name });
  return { method: 'share', uri };
}

async function pickAndroidDir() {
  const SAF = FileSystem.StorageAccessFramework;
  const initial = SAF.getUriForDirectoryInRoot ? SAF.getUriForDirectoryInRoot('Download') : null;
  const res = await SAF.requestDirectoryPermissionsAsync(initial);
  if (!res.granted) return null;
  await AsyncStorage.setItem(DIR_KEY, res.directoryUri);
  return res.directoryUri;
}

// 같은 이름이 있으면 name-2.ext, name-3.ext … (SAF 는 "name.ext (1)" 처럼 확장자 뒤에 붙인다)
async function uniqueName(dirUri, name) {
  try {
    const uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
    const taken = new Set(uris.map(u => decodeURIComponent(u).split('/').pop()));
    if (!taken.has(name)) return name;
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}${ext}`)) return `${base}-${i}${ext}`;
  } catch { /* 목록을 못 읽으면 그대로 */ }
  return name;
}

async function writeAndroid(dirUri, rawName, content, format) {
  const SAF = FileSystem.StorageAccessFramework;
  const f = VECTOR_FORMATS[format];
  const name = await uniqueName(dirUri, rawName);
  // SAF 는 확장자를 MIME 으로 붙이므로 이름에서는 뺀다 (keepExt: 이름 그대로)
  const base = f.keepExt ? name : name.replace(new RegExp(`\\.${f.ext}$`), '');
  const fileUri = await SAF.createFileAsync(dirUri, base, f.safMime || f.mime);
  await SAF.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  return { fileUri, name };
}

/** Android: 저장 폴더를 이미 골랐는지 (처음이면 고르기 전에 안내한다) */
export async function needsFolderPick() {
  if (Platform.OS !== 'android') return false;
  return !(await AsyncStorage.getItem(DIR_KEY));
}

/** 폴더 이름 (보여 주기용). content://...tree/primary%3ADownload → Download */
export function folderLabel(dirUri) {
  try {
    const last = decodeURIComponent(dirUri.split('/tree/')[1] || '').split(':').pop();
    return last || 'Download';
  } catch {
    return 'Download';
  }
}

/**
 * 저장. 반환 { method: 'folder'|'share', folder?, canceled? }
 * @param {boolean} changeFolder Android: 폴더를 새로 고른다
 */
export async function saveTextFile(name, content, format, { changeFolder = false } = {}) {
  if (Platform.OS !== 'android') return shareTextFile(name, content, format);
  let dir = changeFolder ? null : await AsyncStorage.getItem(DIR_KEY);
  if (!dir) {
    dir = await pickAndroidDir();
    if (!dir) return { method: 'folder', canceled: true };
  }
  let saved;
  try {
    saved = await writeAndroid(dir, name, content, format);
  } catch (e) {
    // 폴더 권한이 사라졌으면 한 번 다시 고른다
    await AsyncStorage.removeItem(DIR_KEY);
    dir = await pickAndroidDir();
    if (!dir) return { method: 'folder', canceled: true };
    saved = await writeAndroid(dir, name, content, format);
  }
  return { method: 'folder', folder: folderLabel(dir), name: saved.name };
}
