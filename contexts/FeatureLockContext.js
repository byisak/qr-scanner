// contexts/FeatureLockContext.js - 기능 잠금 상태 관리
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { LOCKED_FEATURES, FREE_BARCODE_TYPES, FREE_QR_STYLE_INDEX } from '../config/lockedFeatures';
import { useLanguage } from './LanguageContext';

const FeatureLockContext = createContext();

const UNLOCKED_FEATURES_KEY = 'unlockedFeatures';
const AD_WATCH_COUNT_KEY = 'adWatchCounts';
const DEV_MODE_KEY = 'devModeEnabled';

export const FeatureLockProvider = ({ children }) => {
  const { t } = useLanguage();
  const [unlockedFeatures, setUnlockedFeatures] = useState([]);
  const [adWatchCounts, setAdWatchCounts] = useState({}); // { featureId: count }
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 저장된 해제 상태 및 개발 모드 로드
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [saved, adCounts, devMode] = await Promise.all([
        AsyncStorage.getItem(UNLOCKED_FEATURES_KEY),
        AsyncStorage.getItem(AD_WATCH_COUNT_KEY),
        AsyncStorage.getItem(DEV_MODE_KEY),
      ]);
      if (saved) {
        setUnlockedFeatures(JSON.parse(saved));
      }
      if (adCounts) {
        setAdWatchCounts(JSON.parse(adCounts));
      }
      if (devMode === 'true') {
        setDevModeEnabled(true);
      }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 개발 모드 토글
  const toggleDevMode = useCallback(async (enabled) => {
    try {
      setDevModeEnabled(enabled);
      await AsyncStorage.setItem(DEV_MODE_KEY, enabled.toString());
    } catch (error) {
      console.error('Toggle dev mode error:', error);
    }
  }, []);

  // 기능이 잠겨있는지 확인
  const isLocked = useCallback((featureId) => {
    // 개발 모드: 모든 기능 잠금 해제
    if (devModeEnabled) return false;
    if (!LOCKED_FEATURES[featureId]) return false;
    return !unlockedFeatures.includes(featureId);
  }, [unlockedFeatures, devModeEnabled]);

  // 바코드 타입이 잠겨있는지 확인
  const isBarcodeTypeLocked = useCallback((bcid) => {
    // 개발 모드: 모든 기능 잠금 해제
    if (devModeEnabled) return false;
    if (FREE_BARCODE_TYPES.includes(bcid)) return false;
    return isLocked('advancedBarcodes');
  }, [isLocked, devModeEnabled]);

  // QR 스타일이 잠겨있는지 확인 (인덱스 기반)
  const isQrStyleLocked = useCallback((styleIndex) => {
    // 개발 모드: 모든 기능 잠금 해제
    if (devModeEnabled) return false;
    if (styleIndex === FREE_QR_STYLE_INDEX) return false;
    // 각 스타일별 잠금 ID 매핑
    const styleKeys = [
      null, // 0: Classic (무료)
      'qrStyleRounded',
      'qrStyleDots',
      'qrStyleClassy',
      'qrStyleBlueGradient',
      'qrStyleSunset',
      'qrStyleDarkMode',
      'qrStyleNeon',
    ];
    const featureId = styleKeys[styleIndex];
    if (!featureId) return false;
    return isLocked(featureId);
  }, [isLocked, devModeEnabled]);

  // 광고 시청 횟수 가져오기
  const getAdWatchCount = useCallback((featureId) => {
    return adWatchCounts[featureId] || 0;
  }, [adWatchCounts]);

  // 필요한 광고 횟수 가져오기
  const getRequiredAdCount = useCallback((featureId) => {
    const feature = LOCKED_FEATURES[featureId];
    return feature?.adCount || 1;
  }, []);

  // 광고 시청 진행률 가져오기
  const getAdProgress = useCallback((featureId) => {
    const current = getAdWatchCount(featureId);
    const required = getRequiredAdCount(featureId);
    return { current, required, remaining: Math.max(0, required - current) };
  }, [getAdWatchCount, getRequiredAdCount]);

  // 광고 시청 횟수 증가
  const incrementAdWatchCount = useCallback(async (featureId) => {
    try {
      const newCount = (adWatchCounts[featureId] || 0) + 1;
      const newCounts = { ...adWatchCounts, [featureId]: newCount };
      setAdWatchCounts(newCounts);
      await AsyncStorage.setItem(AD_WATCH_COUNT_KEY, JSON.stringify(newCounts));
      return newCount;
    } catch (error) {
      console.error('Increment ad count error:', error);
      return adWatchCounts[featureId] || 0;
    }
  }, [adWatchCounts]);

  // 기능 잠금 해제
  const unlock = useCallback(async (featureId) => {
    try {
      const newUnlocked = [...unlockedFeatures, featureId];
      setUnlockedFeatures(newUnlocked);
      await AsyncStorage.setItem(UNLOCKED_FEATURES_KEY, JSON.stringify(newUnlocked));
      return true;
    } catch (error) {
      console.error('Unlock feature error:', error);
      return false;
    }
  }, [unlockedFeatures]);

  // 여러 기능 한번에 해제 (QR 스타일 전체 등)
  const unlockMultiple = useCallback(async (featureIds) => {
    try {
      const newUnlocked = [...new Set([...unlockedFeatures, ...featureIds])];
      setUnlockedFeatures(newUnlocked);
      await AsyncStorage.setItem(UNLOCKED_FEATURES_KEY, JSON.stringify(newUnlocked));
      return true;
    } catch (error) {
      console.error('Unlock features error:', error);
      return false;
    }
  }, [unlockedFeatures]);

  // 모든 잠금 초기화 (테스트용)
  const resetAllLocks = useCallback(async () => {
    try {
      setUnlockedFeatures([]);
      setAdWatchCounts({});
      await Promise.all([
        AsyncStorage.setItem(UNLOCKED_FEATURES_KEY, JSON.stringify([])),
        AsyncStorage.setItem(AD_WATCH_COUNT_KEY, JSON.stringify({})),
      ]);
      return true;
    } catch (error) {
      console.error('Reset locks error:', error);
      return false;
    }
  }, []);

  // 개별 기능 잠금/해제 토글 (개발자 옵션용)
  const toggleFeatureLock = useCallback(async (featureId, unlocked) => {
    try {
      let newUnlocked;
      if (unlocked) {
        // 해제
        newUnlocked = [...new Set([...unlockedFeatures, featureId])];
      } else {
        // 잠금
        newUnlocked = unlockedFeatures.filter(id => id !== featureId);
      }
      setUnlockedFeatures(newUnlocked);
      await AsyncStorage.setItem(UNLOCKED_FEATURES_KEY, JSON.stringify(newUnlocked));
      return true;
    } catch (error) {
      console.error('Toggle feature lock error:', error);
      return false;
    }
  }, [unlockedFeatures]);

  // 모든 기능 해제 (개발자 옵션용)
  const unlockAllFeatures = useCallback(async () => {
    try {
      const allFeatureIds = Object.keys(LOCKED_FEATURES);
      setUnlockedFeatures(allFeatureIds);
      await AsyncStorage.setItem(UNLOCKED_FEATURES_KEY, JSON.stringify(allFeatureIds));
      return true;
    } catch (error) {
      console.error('Unlock all features error:', error);
      return false;
    }
  }, []);

  // 광고 시청 후 처리
  const handleAdWatched = useCallback(async (featureId, onUnlock) => {
    const feature = LOCKED_FEATURES[featureId];
    if (!feature) return;

    const requiredCount = feature.adCount || 1;
    const newCount = await incrementAdWatchCount(featureId);

    if (newCount >= requiredCount) {
      // 필요한 횟수 달성 - 잠금 해제
      const success = await unlock(featureId);
      if (success) {
        Alert.alert(
          t('featureLock.unlocked') || '잠금 해제됨',
          t('featureLock.featureUnlocked') || '기능이 해제되었습니다!',
          [{ text: t('common.confirm') || '확인', onPress: onUnlock }]
        );
      }
    } else {
      // 진행 중 - 남은 횟수 표시
      const remaining = requiredCount - newCount;
      Alert.alert(
        t('featureLock.adWatched') || '광고 시청 완료',
        (t('featureLock.remainingAds') || '해제까지 {remaining}회 더 시청해주세요.')
          .replace('{remaining}', remaining.toString())
          .replace('{current}', newCount.toString())
          .replace('{total}', requiredCount.toString()),
        [{ text: t('common.confirm') || '확인' }]
      );
    }
  }, [incrementAdWatchCount, unlock, t]);

  // 광고 시청 Alert 표시
  const showUnlockAlert = useCallback((featureId, onUnlock) => {
    const feature = LOCKED_FEATURES[featureId];
    if (!feature) return;

    const { current, required, remaining } = getAdProgress(featureId);

    // 진행 상태 메시지 생성
    let progressMessage = t('featureLock.watchAdToUnlock') || '광고를 시청하면 이 기능을 사용할 수 있습니다';
    if (required > 1) {
      progressMessage = (t('featureLock.watchAdProgress') || '광고 {current}/{total} 시청 완료\n{remaining}회 더 시청하면 해제됩니다.')
        .replace('{current}', current.toString())
        .replace('{total}', required.toString())
        .replace('{remaining}', remaining.toString());
    }

    Alert.alert(
      t('featureLock.lockedTitle') || '잠긴 기능',
      progressMessage,
      [
        {
          text: t('common.cancel') || '취소',
          style: 'cancel'
        },
        {
          text: t('featureLock.watchAd') || '광고 보기',
          onPress: async () => {
            // TODO: 실제 광고 SDK 연동
            // 현재는 바로 광고 시청 처리 (테스트용)
            Alert.alert(
              t('common.notice') || '알림',
              t('featureLock.adComingSoon') || '광고 기능이 곧 추가됩니다.\n지금은 무료로 해제됩니다!',
              [
                {
                  text: t('common.confirm') || '확인',
                  onPress: async () => {
                    await handleAdWatched(featureId, onUnlock);
                  }
                }
              ]
            );
          }
        },
      ]
    );
  }, [t, getAdProgress, handleAdWatched]);

  // 바코드 타입 해제 Alert
  const showBarcodeUnlockAlert = useCallback((onUnlock) => {
    showUnlockAlert('advancedBarcodes', onUnlock);
  }, [showUnlockAlert]);

  // QR 스타일 해제 Alert (모든 스타일 한번에 해제)
  const showQrStyleUnlockAlert = useCallback((onUnlock) => {
    const qrStyleFeatures = Object.keys(LOCKED_FEATURES).filter(
      key => LOCKED_FEATURES[key].type === 'qrStyle'
    );

    // QR 스타일은 모두 동일한 adCount 사용 (첫 번째 스타일 기준)
    const firstStyleId = qrStyleFeatures[0];
    const { current, required, remaining } = getAdProgress(firstStyleId);

    let progressMessage = t('featureLock.watchAdToUnlock') || '광고를 시청하면 이 기능을 사용할 수 있습니다';
    if (required > 1) {
      progressMessage = (t('featureLock.watchAdProgress') || '광고 {current}/{total} 시청 완료\n{remaining}회 더 시청하면 해제됩니다.')
        .replace('{current}', current.toString())
        .replace('{total}', required.toString())
        .replace('{remaining}', remaining.toString());
    }

    Alert.alert(
      t('featureLock.lockedTitle') || '잠긴 기능',
      progressMessage,
      [
        {
          text: t('common.cancel') || '취소',
          style: 'cancel'
        },
        {
          text: t('featureLock.watchAd') || '광고 보기',
          onPress: async () => {
            Alert.alert(
              t('common.notice') || '알림',
              t('featureLock.adComingSoon') || '광고 기능이 곧 추가됩니다.\n지금은 무료로 해제됩니다!',
              [
                {
                  text: t('common.confirm') || '확인',
                  onPress: async () => {
                    // QR 스타일은 모두 함께 해제
                    const feature = LOCKED_FEATURES[firstStyleId];
                    const requiredCount = feature?.adCount || 1;
                    const newCount = await incrementAdWatchCount(firstStyleId);

                    if (newCount >= requiredCount) {
                      const success = await unlockMultiple(qrStyleFeatures);
                      if (success) {
                        Alert.alert(
                          t('featureLock.unlocked') || '잠금 해제됨',
                          t('featureLock.allStylesUnlocked') || '모든 QR 스타일이 해제되었습니다!',
                          [{ text: t('common.confirm') || '확인', onPress: onUnlock }]
                        );
                      }
                    } else {
                      const remaining = requiredCount - newCount;
                      Alert.alert(
                        t('featureLock.adWatched') || '광고 시청 완료',
                        (t('featureLock.remainingAds') || '해제까지 {remaining}회 더 시청해주세요.')
                          .replace('{remaining}', remaining.toString()),
                        [{ text: t('common.confirm') || '확인' }]
                      );
                    }
                  }
                }
              ]
            );
          }
        },
      ]
    );
  }, [t, getAdProgress, incrementAdWatchCount, unlockMultiple]);

  const value = {
    isLocked,
    isBarcodeTypeLocked,
    isQrStyleLocked,
    unlock,
    unlockMultiple,
    resetAllLocks,
    showUnlockAlert,
    showBarcodeUnlockAlert,
    showQrStyleUnlockAlert,
    unlockedFeatures,
    adWatchCounts,
    getAdProgress,
    getAdWatchCount,
    getRequiredAdCount,
    devModeEnabled,
    toggleDevMode,
    toggleFeatureLock,
    unlockAllFeatures,
    isLoading,
  };

  return (
    <FeatureLockContext.Provider value={value}>
      {children}
    </FeatureLockContext.Provider>
  );
};

export const useFeatureLock = () => {
  const context = useContext(FeatureLockContext);
  if (!context) {
    throw new Error('useFeatureLock must be used within a FeatureLockProvider');
  }
  return context;
};

export default FeatureLockContext;
