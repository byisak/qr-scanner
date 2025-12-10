// contexts/AdContext.js - 광고 상태 관리
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePurchase } from './PurchaseContext';

const AdContext = createContext();

// 기능 해제에 필요한 광고 시청 횟수
const REQUIRED_AD_COUNT = 5;

// 프리미엄 기능 목록
const PREMIUM_FEATURES = {
  realtimeSync: 'realtimeSync',     // 실시간 서버 전송
  batchScan: 'batchScan',           // 배치 스캔 모드
  photoSave: 'photoSave',           // 사진 저장
  exportHistory: 'exportHistory',   // 히스토리 내보내기
  scanUrl: 'scanUrl',               // 스캔 연동 URL
};

export function AdProvider({ children }) {
  const { isPremium } = usePurchase();

  // 각 기능별 광고 시청 횟수
  const [adWatchCounts, setAdWatchCounts] = useState({
    realtimeSync: 0,
    batchScan: 0,
    photoSave: 0,
    exportHistory: 0,
    scanUrl: 0,
  });

  // 기능 잠금 해제 상태 (광고 시청으로 해제된 기능)
  const [unlockedFeatures, setUnlockedFeatures] = useState({
    realtimeSync: false,
    batchScan: false,
    photoSave: false,
    exportHistory: false,
    scanUrl: false,
  });

  // 초기화: 저장된 상태 로드
  useEffect(() => {
    loadSavedState();
  }, []);

  // 상태 변경 시 저장
  useEffect(() => {
    saveState();
  }, [adWatchCounts, unlockedFeatures]);

  const loadSavedState = async () => {
    try {
      const savedCounts = await AsyncStorage.getItem('ad_watch_counts');
      const savedUnlocked = await AsyncStorage.getItem('unlocked_features');

      if (savedCounts) {
        setAdWatchCounts(JSON.parse(savedCounts));
      }
      if (savedUnlocked) {
        setUnlockedFeatures(JSON.parse(savedUnlocked));
      }
    } catch (error) {
      console.log('Load ad state error:', error);
    }
  };

  const saveState = async () => {
    try {
      await AsyncStorage.setItem('ad_watch_counts', JSON.stringify(adWatchCounts));
      await AsyncStorage.setItem('unlocked_features', JSON.stringify(unlockedFeatures));
    } catch (error) {
      console.log('Save ad state error:', error);
    }
  };

  // 광고 시청 기록
  const recordAdWatch = (feature) => {
    if (!PREMIUM_FEATURES[feature]) return false;
    if (unlockedFeatures[feature]) return true; // 이미 해제됨

    const newCount = adWatchCounts[feature] + 1;

    setAdWatchCounts(prev => ({
      ...prev,
      [feature]: newCount,
    }));

    // 필요 횟수 달성 시 기능 해제
    if (newCount >= REQUIRED_AD_COUNT) {
      setUnlockedFeatures(prev => ({
        ...prev,
        [feature]: true,
      }));
      return true; // 기능 해제됨
    }

    return false;
  };

  // 기능 잠금 여부 확인
  const isFeatureLocked = (feature) => {
    // 프리미엄 사용자는 모든 기능 해제
    if (isPremium) return false;

    // 광고로 해제된 기능인지 확인
    return !unlockedFeatures[feature];
  };

  // 남은 광고 횟수
  const getRemainingAdCount = (feature) => {
    if (isPremium || unlockedFeatures[feature]) return 0;
    return REQUIRED_AD_COUNT - adWatchCounts[feature];
  };

  // 시청한 광고 횟수
  const getWatchedAdCount = (feature) => {
    return adWatchCounts[feature] || 0;
  };

  // 광고 표시 여부
  const shouldShowAds = () => {
    return !isPremium;
  };

  return (
    <AdContext.Provider
      value={{
        PREMIUM_FEATURES,
        REQUIRED_AD_COUNT,
        adWatchCounts,
        unlockedFeatures,
        recordAdWatch,
        isFeatureLocked,
        getRemainingAdCount,
        getWatchedAdCount,
        shouldShowAds,
      }}
    >
      {children}
    </AdContext.Provider>
  );
}

export function useAd() {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAd must be used within an AdProvider');
  }
  return context;
}

export { PREMIUM_FEATURES, REQUIRED_AD_COUNT };
export default AdContext;
