// services/iCloudService.js - iCloud 자동 동기화 서비스
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// iCloud 관련 함수들
let CloudStore = null;

// 증분 동기화를 위한 해시 저장소
let lastSyncedHashes = {}; // { key: hash } 마지막 동기화된 데이터의 해시
const SYNC_HASH_KEY = '__icloud_sync_hashes__'; // 해시 저장 키

// 간단한 문자열 해시 함수 (djb2)
const hashString = (str) => {
  if (!str) return '0';
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // 32비트로 변환
  }
  return hash.toString(16);
};

// 동적으로 react-native-cloud-store 로드
const loadCloudStore = async () => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  if (CloudStore) {
    return CloudStore;
  }

  try {
    const module = await import('react-native-cloud-store');
    CloudStore = module;
    return CloudStore;
  } catch (error) {
    console.log('iCloud module not available:', error);
    return null;
  }
};

const BACKUP_FILENAME = 'qr_scanner_backup.json';

// iCloud 사용 가능 여부 확인
export const isICloudAvailable = async () => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    const cloud = await loadCloudStore();
    if (!cloud) return false;

    const available = await cloud.isICloudAvailable();
    return available;
  } catch (error) {
    console.log('iCloud availability check error:', error);
    return false;
  }
};

// 해시 로드 (앱 시작 시)
const loadSyncHashes = async () => {
  try {
    const saved = await AsyncStorage.getItem(SYNC_HASH_KEY);
    if (saved) {
      lastSyncedHashes = JSON.parse(saved);
    }
  } catch (error) {
    console.log('Load sync hashes error:', error);
    lastSyncedHashes = {};
  }
};

// 해시 저장
const saveSyncHashes = async (hashes) => {
  try {
    lastSyncedHashes = hashes;
    await AsyncStorage.setItem(SYNC_HASH_KEY, JSON.stringify(hashes));
  } catch (error) {
    console.log('Save sync hashes error:', error);
  }
};

// 백업 데이터 생성 (증분 동기화 - 변경된 키만 포함)
const createBackupData = async (forceFullSync = false) => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    // 동기화 해시 키는 제외
    const keysToSync = allKeys.filter(k => k !== SYNC_HASH_KEY);
    const allData = await AsyncStorage.multiGet(keysToSync);

    const backupData = {
      version: '1.1', // 증분 동기화 버전
      createdAt: new Date().toISOString(),
      platform: Platform.OS,
      data: {},
      isIncremental: !forceFullSync, // 증분 여부 표시
    };

    const newHashes = {};
    let hasChanges = false;

    allData.forEach(([key, value]) => {
      const currentHash = hashString(value);
      newHashes[key] = currentHash;

      // 전체 동기화 또는 변경된 키만 포함
      if (forceFullSync || lastSyncedHashes[key] !== currentHash) {
        try {
          backupData.data[key] = JSON.parse(value);
        } catch {
          backupData.data[key] = value;
        }
        hasChanges = true;
      }
    });

    // 삭제된 키 확인 (이전에는 있었지만 지금은 없는 키)
    const deletedKeys = Object.keys(lastSyncedHashes).filter(
      k => !newHashes[k] && k !== SYNC_HASH_KEY
    );
    if (deletedKeys.length > 0) {
      backupData.deletedKeys = deletedKeys;
      hasChanges = true;
    }

    // 해시 저장 (동기화 후)
    backupData._newHashes = newHashes; // 동기화 성공 시 저장할 해시

    return { backupData, hasChanges };
  } catch (error) {
    console.error('Create backup data error:', error);
    throw error;
  }
};

// iCloud에 백업 저장 (key-value storage 사용, 증분 동기화)
export const saveToICloud = async (forceFullSync = false) => {
  if (Platform.OS !== 'ios') {
    throw new Error('iCloud는 iOS에서만 사용 가능합니다.');
  }

  try {
    const cloud = await loadCloudStore();
    if (!cloud) {
      throw new Error('iCloud 모듈을 로드할 수 없습니다.');
    }

    const isAvailable = await cloud.isICloudAvailable();
    if (!isAvailable) {
      throw new Error('iCloud가 활성화되어 있지 않습니다. 설정에서 iCloud를 활성화해주세요.');
    }

    // 해시 로드 (첫 동기화 시)
    if (Object.keys(lastSyncedHashes).length === 0) {
      await loadSyncHashes();
    }

    const { backupData, hasChanges } = await createBackupData(forceFullSync);

    // 변경사항이 없으면 스킵 (디스크 쓰기 최적화)
    if (!hasChanges && !forceFullSync) {
      console.log('[iCloud] No changes detected, skipping sync');
      return {
        success: true,
        skipped: true,
        timestamp: new Date().toISOString(),
      };
    }

    // 증분 동기화: 기존 데이터와 병합
    if (backupData.isIncremental && !forceFullSync) {
      await cloud.kvSync();
      const existingContent = await cloud.kvGetItem('backup_data');

      if (existingContent) {
        try {
          const existingData = JSON.parse(existingContent);
          // 기존 데이터에 새 데이터 병합
          backupData.data = { ...existingData.data, ...backupData.data };
          // 삭제된 키 제거
          if (backupData.deletedKeys) {
            backupData.deletedKeys.forEach(key => {
              delete backupData.data[key];
            });
          }
          backupData.version = existingData.version || '1.1';
        } catch (e) {
          console.log('[iCloud] Could not merge with existing data, doing full sync');
        }
      }
    }

    // _newHashes는 저장하지 않음
    const newHashes = backupData._newHashes;
    delete backupData._newHashes;
    delete backupData.isIncremental;
    delete backupData.deletedKeys;

    const jsonString = JSON.stringify(backupData);

    // iCloud key-value storage 사용 (더 안정적)
    await cloud.kvSetItem('backup_data', jsonString);
    await cloud.kvSync();

    // 동기화 성공 시 해시 저장
    await saveSyncHashes(newHashes);

    console.log('[iCloud] Sync completed, keys updated:', Object.keys(backupData.data).length);

    return {
      success: true,
      timestamp: backupData.createdAt,
    };
  } catch (error) {
    console.error('iCloud save error:', error);
    throw error;
  }
};

// iCloud에서 백업 불러오기
export const loadFromICloud = async () => {
  if (Platform.OS !== 'ios') {
    throw new Error('iCloud는 iOS에서만 사용 가능합니다.');
  }

  try {
    const cloud = await loadCloudStore();
    if (!cloud) {
      throw new Error('iCloud 모듈을 로드할 수 없습니다.');
    }

    const isAvailable = await cloud.isICloudAvailable();
    if (!isAvailable) {
      throw new Error('iCloud가 활성화되어 있지 않습니다.');
    }

    // iCloud에서 동기화
    await cloud.kvSync();

    // key-value storage에서 읽기
    const content = await cloud.kvGetItem('backup_data');
    if (!content) {
      return null;
    }

    const backupData = JSON.parse(content);
    return backupData;
  } catch (error) {
    console.error('iCloud load error:', error);
    throw error;
  }
};

// 백업 데이터 복원
export const restoreFromBackup = async (backupData) => {
  try {
    if (!backupData.version || !backupData.data) {
      throw new Error('유효하지 않은 백업 파일입니다.');
    }

    const entries = Object.entries(backupData.data);
    for (const [key, value] of entries) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    }

    return true;
  } catch (error) {
    console.error('Restore backup error:', error);
    throw error;
  }
};

// iCloud 백업 정보 가져오기
export const getICloudBackupInfo = async () => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const cloud = await loadCloudStore();
    if (!cloud) return null;

    const isAvailable = await cloud.isICloudAvailable();
    if (!isAvailable) return null;

    await cloud.kvSync();
    const content = await cloud.kvGetItem('backup_data');
    if (!content) return null;

    const backupData = JSON.parse(content);

    return {
      exists: true,
      createdAt: backupData.createdAt,
      version: backupData.version,
    };
  } catch (error) {
    console.log('iCloud backup info error:', error);
    return null;
  }
};

// 자동 백업 (앱 백그라운드 진입 시 호출)
export const autoBackupToICloud = async () => {
  try {
    const isAvailable = await isICloudAvailable();
    if (!isAvailable) return false;

    await saveToICloud();
    console.log('Auto backup to iCloud completed');
    return true;
  } catch (error) {
    console.log('Auto backup failed:', error);
    return false;
  }
};

export default {
  isICloudAvailable,
  saveToICloud,
  loadFromICloud,
  restoreFromBackup,
  getICloudBackupInfo,
  autoBackupToICloud,
};
