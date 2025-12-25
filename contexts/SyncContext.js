// contexts/SyncContext.js - iCloud 자동 동기화 컨텍스트
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveToICloud, isICloudAvailable, getICloudBackupInfo } from '../services/iCloudService';

const SyncContext = createContext();

// 동기화 상태
const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  DISABLED: 'disabled',
};

export function SyncProvider({ children }) {
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [iCloudEnabled, setICloudEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const syncTimeoutRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // iCloud 사용 가능 여부 확인
  useEffect(() => {
    const checkICloud = async () => {
      if (Platform.OS !== 'ios') {
        setICloudEnabled(false);
        setSyncStatus(SYNC_STATUS.DISABLED);
        return;
      }

      const available = await isICloudAvailable();
      setICloudEnabled(available);

      if (available) {
        // 마지막 동기화 시간 가져오기
        const info = await getICloudBackupInfo();
        if (info?.createdAt) {
          setLastSyncTime(new Date(info.createdAt));
        }
      } else {
        setSyncStatus(SYNC_STATUS.DISABLED);
      }
    };

    checkICloud();
  }, []);

  // 앱 상태 변경 감지 (백그라운드 진입 시 동기화)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/) &&
        autoSyncEnabled &&
        iCloudEnabled
      ) {
        // 앱이 백그라운드로 갈 때 동기화
        triggerSync();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [autoSyncEnabled, iCloudEnabled]);

  // 동기화 실행 (디바운스 적용)
  const triggerSync = useCallback(async () => {
    if (!iCloudEnabled || !autoSyncEnabled || Platform.OS !== 'ios') {
      return;
    }

    // 이전 타이머 취소
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // 2초 디바운스
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        setSyncStatus(SYNC_STATUS.SYNCING);
        await saveToICloud();
        setLastSyncTime(new Date());
        setSyncStatus(SYNC_STATUS.SUCCESS);

        // 3초 후 IDLE로 복귀
        setTimeout(() => {
          setSyncStatus(SYNC_STATUS.IDLE);
        }, 3000);
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus(SYNC_STATUS.ERROR);

        // 5초 후 IDLE로 복귀
        setTimeout(() => {
          setSyncStatus(SYNC_STATUS.IDLE);
        }, 5000);
      }
    }, 2000);
  }, [iCloudEnabled, autoSyncEnabled]);

  // 즉시 동기화 (수동)
  const syncNow = useCallback(async () => {
    if (!iCloudEnabled || Platform.OS !== 'ios') {
      throw new Error('iCloud를 사용할 수 없습니다.');
    }

    try {
      setSyncStatus(SYNC_STATUS.SYNCING);
      await saveToICloud();
      setLastSyncTime(new Date());
      setSyncStatus(SYNC_STATUS.SUCCESS);

      setTimeout(() => {
        setSyncStatus(SYNC_STATUS.IDLE);
      }, 3000);

      return true;
    } catch (error) {
      setSyncStatus(SYNC_STATUS.ERROR);
      setTimeout(() => {
        setSyncStatus(SYNC_STATUS.IDLE);
      }, 5000);
      throw error;
    }
  }, [iCloudEnabled]);

  // 자동 동기화 토글
  const toggleAutoSync = useCallback(async (enabled) => {
    setAutoSyncEnabled(enabled);
    await AsyncStorage.setItem('autoSyncEnabled', JSON.stringify(enabled));

    if (enabled && iCloudEnabled) {
      // 자동 동기화 활성화 시 즉시 동기화
      triggerSync();
    }
  }, [iCloudEnabled, triggerSync]);

  // 자동 동기화 설정 로드
  useEffect(() => {
    const loadAutoSyncSetting = async () => {
      try {
        const saved = await AsyncStorage.getItem('autoSyncEnabled');
        if (saved !== null) {
          setAutoSyncEnabled(JSON.parse(saved));
        }
      } catch (error) {
        console.log('Load auto sync setting error:', error);
      }
    };

    loadAutoSyncSetting();
  }, []);

  const value = {
    syncStatus,
    lastSyncTime,
    iCloudEnabled,
    autoSyncEnabled,
    triggerSync,
    syncNow,
    toggleAutoSync,
    SYNC_STATUS,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export default SyncContext;
