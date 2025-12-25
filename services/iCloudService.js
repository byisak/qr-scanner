// services/iCloudService.js - iCloud 자동 동기화 서비스
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// iCloud 관련 함수들
let CloudStore = null;

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

// 백업 데이터 생성
const createBackupData = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const allData = await AsyncStorage.multiGet(allKeys);

    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      platform: Platform.OS,
      data: {},
    };

    allData.forEach(([key, value]) => {
      try {
        backupData.data[key] = JSON.parse(value);
      } catch {
        backupData.data[key] = value;
      }
    });

    return backupData;
  } catch (error) {
    console.error('Create backup data error:', error);
    throw error;
  }
};

// iCloud에 백업 저장 (key-value storage 사용)
export const saveToICloud = async () => {
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

    const backupData = await createBackupData();
    const jsonString = JSON.stringify(backupData);

    // iCloud key-value storage 사용 (더 안정적)
    await cloud.kvSync();
    await cloud.kvSetItem('backup_data', jsonString);
    await cloud.kvSync();

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
