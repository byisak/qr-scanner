// contexts/FeatureLockContext.js - 기능 잠금 상태 관리
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { LOCKED_FEATURES, FREE_BARCODE_TYPES, FREE_QR_STYLE_INDEX } from '../config/lockedFeatures';
import { useLanguage } from './LanguageContext';

const FeatureLockContext = createContext();

const UNLOCKED_FEATURES_KEY = 'unlockedFeatures';

export const FeatureLockProvider = ({ children }) => {
  const { t } = useLanguage();
  const [unlockedFeatures, setUnlockedFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 저장된 해제 상태 로드
  useEffect(() => {
    loadUnlockedFeatures();
  }, []);

  const loadUnlockedFeatures = async () => {
    try {
      const saved = await AsyncStorage.getItem(UNLOCKED_FEATURES_KEY);
      if (saved) {
        setUnlockedFeatures(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Load unlocked features error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 기능이 잠겨있는지 확인
  const isLocked = useCallback((featureId) => {
    if (!LOCKED_FEATURES[featureId]) return false;
    return !unlockedFeatures.includes(featureId);
  }, [unlockedFeatures]);

  // 바코드 타입이 잠겨있는지 확인
  const isBarcodeTypeLocked = useCallback((bcid) => {
    if (FREE_BARCODE_TYPES.includes(bcid)) return false;
    return isLocked('advancedBarcodes');
  }, [isLocked]);

  // QR 스타일이 잠겨있는지 확인 (인덱스 기반)
  const isQrStyleLocked = useCallback((styleIndex) => {
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
  }, [isLocked]);

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

  // 광고 시청 Alert 표시
  const showUnlockAlert = useCallback((featureId, onUnlock) => {
    const feature = LOCKED_FEATURES[featureId];
    if (!feature) return;

    Alert.alert(
      t('featureLock.lockedTitle'),
      t('featureLock.watchAdToUnlock'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('featureLock.watchAd'),
          onPress: async () => {
            // TODO: 실제 광고 SDK 연동
            // 현재는 바로 해제 (테스트용)
            Alert.alert(
              t('common.notice'),
              t('featureLock.adComingSoon'),
              [
                {
                  text: t('common.confirm'),
                  onPress: async () => {
                    // 테스트용: 광고 없이 바로 해제
                    const success = await unlock(featureId);
                    if (success && onUnlock) {
                      onUnlock();
                    }
                  }
                }
              ]
            );
          }
        },
      ]
    );
  }, [t, unlock]);

  // 바코드 타입 해제 Alert
  const showBarcodeUnlockAlert = useCallback((onUnlock) => {
    showUnlockAlert('advancedBarcodes', onUnlock);
  }, [showUnlockAlert]);

  // QR 스타일 해제 Alert (모든 스타일 한번에 해제)
  const showQrStyleUnlockAlert = useCallback((onUnlock) => {
    const qrStyleFeatures = Object.keys(LOCKED_FEATURES).filter(
      key => LOCKED_FEATURES[key].type === 'qrStyle'
    );

    Alert.alert(
      t('featureLock.lockedTitle'),
      t('featureLock.watchAdToUnlock'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('featureLock.watchAd'),
          onPress: async () => {
            Alert.alert(
              t('common.notice'),
              t('featureLock.adComingSoon'),
              [
                {
                  text: t('common.confirm'),
                  onPress: async () => {
                    const success = await unlockMultiple(qrStyleFeatures);
                    if (success && onUnlock) {
                      onUnlock();
                    }
                  }
                }
              ]
            );
          }
        },
      ]
    );
  }, [t, unlockMultiple]);

  const value = {
    isLocked,
    isBarcodeTypeLocked,
    isQrStyleLocked,
    unlock,
    unlockMultiple,
    showUnlockAlert,
    showBarcodeUnlockAlert,
    showQrStyleUnlockAlert,
    unlockedFeatures,
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
