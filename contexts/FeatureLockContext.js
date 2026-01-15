// contexts/FeatureLockContext.js - 기능 잠금 상태 관리
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { LOCKED_FEATURES, FREE_BARCODE_TYPES, FREE_QR_TYPES, FREE_QR_STYLE_INDEX, DEV_MODE_UNLOCK_ALL } from '../config/lockedFeatures';
import { useLanguage } from './LanguageContext';

const FeatureLockContext = createContext();

const UNLOCKED_FEATURES_KEY = 'unlockedFeatures';
const AD_WATCH_COUNT_KEY = 'adWatchCounts';
const DEV_MODE_KEY = 'devModeEnabled';

// 리워드 광고 ID
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: 'ca-app-pub-9431243505417325/1216382236',
      android: 'ca-app-pub-9431243505417325/1216382236',
    });

export const FeatureLockProvider = ({ children }) => {
  const { t } = useLanguage();
  const [unlockedFeatures, setUnlockedFeatures] = useState([]);
  const [adWatchCounts, setAdWatchCounts] = useState({}); // { featureId: count }
  // 개발 모드 비활성화 (프로덕션) - 배포 시 항상 false 유지
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const _devModeDisabledForProduction = true; // 배포용 플래그
  const [isLoading, setIsLoading] = useState(true);

  // 광고 관련 상태
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const rewardedAdRef = useRef(null);
  const rewardCallbackRef = useRef(null);
  const showRewardedAdRef = useRef(null); // 순환 참조 방지용
  const isAdLoadedRef = useRef(false); // 콜백에서 접근용
  const isAdLoadingRef = useRef(false); // 콜백에서 접근용
  const adUsedRef = useRef(false); // 광고 사용됨 플래그

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

      // 배포용: 사용자 광고 시청 기록은 유지 (진행 상황 보존)
      if (saved) {
        setUnlockedFeatures(JSON.parse(saved));
      }
      if (adCounts) {
        setAdWatchCounts(JSON.parse(adCounts));
      }

      // 배포용: devMode 로딩 비활성화 - 개발자 모드 우회 방지
      // if (devMode === 'true') {
      //   setDevModeEnabled(true);
      // }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 광고 로드 (ref 기반으로 클로저 문제 해결)
  const loadRewardedAd = useCallback(() => {
    // ref로 체크하여 클로저 문제 방지
    if (isAdLoadingRef.current) {
      console.log('Ad is already loading, skip');
      return;
    }

    // 이미 로드된 광고가 있고 사용되지 않았으면 스킵
    if (isAdLoadedRef.current && !adUsedRef.current && rewardedAdRef.current?.ad) {
      console.log('Ad already loaded and not used, skip');
      return;
    }

    console.log('Loading new rewarded ad...');
    isAdLoadingRef.current = true;
    setIsAdLoading(true);

    try {
      // 이전 인스턴스 정리
      if (rewardedAdRef.current?.unsubscribe) {
        rewardedAdRef.current.unsubscribe();
        rewardedAdRef.current = null;
      }

      const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      // 로드 완료
      const unsubscribeLoaded = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          console.log('Rewarded ad loaded successfully');
          isAdLoadedRef.current = true;
          isAdLoadingRef.current = false;
          adUsedRef.current = false; // 새 광고는 사용되지 않음
          setIsAdLoaded(true);
          setIsAdLoading(false);
        }
      );

      // 보상 획득
      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          console.log('User earned reward:', reward);
          adUsedRef.current = true; // 광고 사용됨 표시
          if (rewardCallbackRef.current) {
            rewardCallbackRef.current();
            rewardCallbackRef.current = null;
          }
        }
      );

      // 광고 닫힘
      const unsubscribeClosed = rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          console.log('Rewarded ad closed');
          isAdLoadedRef.current = false;
          isAdLoadingRef.current = false;
          adUsedRef.current = true; // 닫힌 광고는 사용됨으로 표시
          setIsAdLoaded(false);
          setIsAdLoading(false);

          // 다음 광고 로드 (새 인스턴스 생성 강제)
          setTimeout(() => {
            // ref 초기화 후 새 광고 로드
            if (rewardedAdRef.current?.unsubscribe) {
              rewardedAdRef.current.unsubscribe();
            }
            rewardedAdRef.current = null;
            isAdLoadingRef.current = false; // 로딩 상태 초기화
            loadRewardedAd();
          }, 1000);
        }
      );

      // 에러
      const unsubscribeError = rewarded.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.error('Rewarded ad error:', error);
          isAdLoadingRef.current = false;
          isAdLoadedRef.current = false;
          setIsAdLoading(false);
          setIsAdLoaded(false);
          // 에러 발생 시 재시도
          setTimeout(() => {
            rewardedAdRef.current = null;
            loadRewardedAd();
          }, 5000);
        }
      );

      rewardedAdRef.current = {
        ad: rewarded,
        unsubscribe: () => {
          unsubscribeLoaded();
          unsubscribeEarned();
          unsubscribeClosed();
          unsubscribeError();
        },
      };

      rewarded.load();
    } catch (error) {
      console.error('Failed to create rewarded ad:', error);
      isAdLoadingRef.current = false;
      setIsAdLoading(false);
    }
  }, []); // 의존성 제거 - ref만 사용

  // 초기 광고 로드
  useEffect(() => {
    loadRewardedAd();

    return () => {
      if (rewardedAdRef.current?.unsubscribe) {
        rewardedAdRef.current.unsubscribe();
      }
    };
  }, []);

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
    // 개발 모드: 모든 기능 잠금 해제 (config 설정 또는 런타임 설정)
    // DEV_MODE_UNLOCK_ALL은 배포 시 false로 설정해야 함
    if (DEV_MODE_UNLOCK_ALL || devModeEnabled) return false;
    if (!LOCKED_FEATURES[featureId]) return false;
    return !unlockedFeatures.includes(featureId);
  }, [unlockedFeatures, devModeEnabled]);

  // 바코드 타입이 잠겨있는지 확인 (bcid로 개별 체크)
  const isBarcodeTypeLocked = useCallback((bcid) => {
    // 개발 모드: 모든 기능 잠금 해제
    if (DEV_MODE_UNLOCK_ALL || devModeEnabled) return false;
    // FREE_BARCODE_TYPES에 있으면 무료
    if (FREE_BARCODE_TYPES.includes(bcid)) return false;
    // bcid로 해당 바코드 feature 찾기
    const barcodeFeature = Object.values(LOCKED_FEATURES).find(
      f => f.type === 'barcode' && f.bcid === bcid
    );
    // LOCKED_FEATURES에 정의되지 않은 바코드도 잠금 (기본값)
    // 해당 feature가 있으면 해당 ID로 체크, 없으면 'barcodeOther'로 체크
    if (!barcodeFeature) {
      return isLocked('barcodeOther');
    }
    return isLocked(barcodeFeature.id);
  }, [isLocked, devModeEnabled]);

  // bcid로 feature ID 가져오기
  const getBarcodeFeatureId = useCallback((bcid) => {
    // FREE_BARCODE_TYPES에 있으면 null (잠금 없음)
    if (FREE_BARCODE_TYPES.includes(bcid)) return null;
    const barcodeFeature = Object.values(LOCKED_FEATURES).find(
      f => f.type === 'barcode' && f.bcid === bcid
    );
    // 정의되지 않은 바코드는 'barcodeOther' 사용
    return barcodeFeature?.id || 'barcodeOther';
  }, []);

  // QR 타입이 잠겨있는지 확인 (qrType으로 개별 체크)
  const isQrTypeLocked = useCallback((qrType) => {
    // 개발 모드: 모든 기능 잠금 해제
    if (DEV_MODE_UNLOCK_ALL || devModeEnabled) return false;
    if (FREE_QR_TYPES.includes(qrType)) return false;
    // qrType으로 해당 feature 찾기
    const qrTypeFeature = Object.values(LOCKED_FEATURES).find(
      f => f.type === 'qrType' && f.qrType === qrType
    );
    if (!qrTypeFeature) return false;
    return isLocked(qrTypeFeature.id);
  }, [isLocked, devModeEnabled]);

  // qrType으로 feature ID 가져오기
  const getQrTypeFeatureId = useCallback((qrType) => {
    const qrTypeFeature = Object.values(LOCKED_FEATURES).find(
      f => f.type === 'qrType' && f.qrType === qrType
    );
    return qrTypeFeature?.id || null;
  }, []);

  // QR 스타일이 잠겨있는지 확인 (인덱스 기반)
  const isQrStyleLocked = useCallback((styleIndex) => {
    // 개발 모드: 모든 기능 잠금 해제
    if (DEV_MODE_UNLOCK_ALL || devModeEnabled) return false;
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
        // 약간의 지연 후 Alert 표시 (상태 업데이트 완료 후)
        setTimeout(() => {
          Alert.alert(
            t('featureLock.unlocked') || '잠금 해제됨',
            t('featureLock.featureUnlocked') || '기능이 해제되었습니다!',
            [{
              text: t('common.confirm') || '확인',
              onPress: () => {
                // onUnlock이 함수인 경우에만 호출
                if (typeof onUnlock === 'function') {
                  try {
                    onUnlock();
                  } catch (e) {
                    console.error('onUnlock callback error:', e);
                  }
                }
              }
            }]
          );
        }, 100);
      }
    } else {
      // 진행 중 - 남은 횟수 표시 후 연속 재생 옵션 제공
      const remaining = requiredCount - newCount;
      Alert.alert(
        t('featureLock.adWatched') || '광고 시청 완료',
        (t('featureLock.remainingAdsWithProgress') || '광고 {current}/{total} 시청 완료!\n{remaining}회 더 시청하면 해제됩니다.')
          .replace('{remaining}', remaining.toString())
          .replace('{current}', newCount.toString())
          .replace('{total}', requiredCount.toString()),
        [
          {
            text: t('common.later') || '나중에',
            style: 'cancel'
          },
          {
            text: t('featureLock.watchNextAd') || '계속 시청',
            onPress: () => {
              // 광고 로드 대기 후 재생 (최대 10초 대기)
              let attempts = 0;
              const maxAttempts = 20; // 500ms * 20 = 10초

              const tryShowAd = () => {
                attempts++;
                // 광고가 로드되었고, 사용되지 않았고, 광고 객체가 있으면 표시
                const isReady = isAdLoadedRef.current &&
                                !adUsedRef.current &&
                                rewardedAdRef.current?.ad &&
                                showRewardedAdRef.current;

                console.log(`tryShowAd attempt ${attempts}/${maxAttempts}:`, {
                  isLoaded: isAdLoadedRef.current,
                  isUsed: adUsedRef.current,
                  hasAd: !!rewardedAdRef.current?.ad,
                  hasShowFn: !!showRewardedAdRef.current,
                  isReady
                });

                if (isReady) {
                  showRewardedAdRef.current(featureId, onUnlock);
                } else if (attempts < maxAttempts) {
                  // 아직 준비 안됨, 500ms 후 재시도
                  setTimeout(tryShowAd, 500);
                } else {
                  // 최대 시도 횟수 초과 - 사용자에게 알림
                  Alert.alert(
                    t('featureLock.adNotReady') || '광고 준비 중',
                    t('featureLock.adNotReadyRetry') || '광고 로딩에 시간이 걸리고 있습니다. 잠시 후 다시 시도해주세요.',
                    [{ text: t('common.confirm') || '확인' }]
                  );
                }
              };

              // 1.5초 후 첫 시도 (광고 로드 시간 확보)
              setTimeout(tryShowAd, 1500);
            },
          },
        ]
      );
    }
  }, [incrementAdWatchCount, unlock, t]);

  // 리워드 광고 표시
  const showRewardedAdAndProcess = useCallback(async (featureId, onUnlock) => {
    // ref 기반으로 체크 - 광고가 로드되었고, 사용되지 않았는지 확인
    if (!isAdLoadedRef.current || !rewardedAdRef.current?.ad || adUsedRef.current) {
      console.log('Ad not ready:', {
        isLoaded: isAdLoadedRef.current,
        hasAd: !!rewardedAdRef.current?.ad,
        isUsed: adUsedRef.current
      });
      // 광고가 로드되지 않거나 이미 사용된 경우
      Alert.alert(
        t('featureLock.adNotReady') || '광고 준비 중',
        t('featureLock.adNotReadyMessage') || '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
        [{ text: t('common.confirm') || '확인' }]
      );
      // 광고 다시 로드 시도
      if (!isAdLoadingRef.current) {
        loadRewardedAd();
      }
      return;
    }

    // 보상 콜백 설정
    rewardCallbackRef.current = () => handleAdWatched(featureId, onUnlock);

    try {
      // 광고 표시 직전에 사용됨 표시 (중복 호출 방지)
      adUsedRef.current = true;
      await rewardedAdRef.current.ad.show();
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      // 표시 실패 시 다시 로드 시도
      adUsedRef.current = true; // 실패한 광고도 사용됨으로 표시
      Alert.alert(
        t('featureLock.adError') || '광고 오류',
        t('featureLock.adErrorMessage') || '광고를 표시하는 중 오류가 발생했습니다.',
        [{ text: t('common.confirm') || '확인' }]
      );
      // 새 광고 로드
      setTimeout(() => {
        if (rewardedAdRef.current?.unsubscribe) {
          rewardedAdRef.current.unsubscribe();
        }
        rewardedAdRef.current = null;
        isAdLoadedRef.current = false;
        isAdLoadingRef.current = false;
        setIsAdLoaded(false);
        loadRewardedAd();
      }, 500);
    }
  }, [loadRewardedAd, handleAdWatched, t]);

  // showRewardedAdAndProcess ref 업데이트 (순환 참조 방지)
  useEffect(() => {
    showRewardedAdRef.current = showRewardedAdAndProcess;
  }, [showRewardedAdAndProcess]);

  // QR 스타일용 리워드 광고 표시
  const showRewardedAdForQrStyles = useCallback(async (onUnlock) => {
    const qrStyleFeatures = Object.keys(LOCKED_FEATURES).filter(
      key => LOCKED_FEATURES[key].type === 'qrStyle'
    );
    const firstStyleId = qrStyleFeatures[0];

    // ref 기반으로 체크 - 광고가 로드되었고, 사용되지 않았는지 확인
    if (!isAdLoadedRef.current || !rewardedAdRef.current?.ad || adUsedRef.current) {
      console.log('Ad not ready for QR styles:', {
        isLoaded: isAdLoadedRef.current,
        hasAd: !!rewardedAdRef.current?.ad,
        isUsed: adUsedRef.current
      });
      Alert.alert(
        t('featureLock.adNotReady') || '광고 준비 중',
        t('featureLock.adNotReadyMessage') || '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
        [{ text: t('common.confirm') || '확인' }]
      );
      if (!isAdLoadingRef.current) {
        loadRewardedAd();
      }
      return;
    }

    // 보상 콜백 설정
    rewardCallbackRef.current = async () => {
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
    };

    try {
      // 광고 표시 직전에 사용됨 표시 (중복 호출 방지)
      adUsedRef.current = true;
      await rewardedAdRef.current.ad.show();
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      adUsedRef.current = true;
      Alert.alert(
        t('featureLock.adError') || '광고 오류',
        t('featureLock.adErrorMessage') || '광고를 표시하는 중 오류가 발생했습니다.',
        [{ text: t('common.confirm') || '확인' }]
      );
      // 새 광고 로드
      setTimeout(() => {
        if (rewardedAdRef.current?.unsubscribe) {
          rewardedAdRef.current.unsubscribe();
        }
        rewardedAdRef.current = null;
        isAdLoadedRef.current = false;
        isAdLoadingRef.current = false;
        setIsAdLoaded(false);
        loadRewardedAd();
      }, 500);
    }
  }, [loadRewardedAd, incrementAdWatchCount, unlockMultiple, t]);

  // 광고 시청 Alert 표시
  const showUnlockAlert = useCallback((featureId, onUnlock) => {
    const feature = LOCKED_FEATURES[featureId];
    if (!feature) return;

    const { current, required, remaining } = getAdProgress(featureId);

    // 진행 상태 메시지 생성
    let progressMessage = t('featureLock.watchAdToUnlock') || '광고를 시청하면 이 기능을 사용할 수 있습니다';
    if (required > 1) {
      if (current > 0) {
        progressMessage = (t('featureLock.watchAdProgress') || '광고 {current}/{total} 시청 완료\n{remaining}회 더 시청하면 해제됩니다.')
          .replace('{current}', current.toString())
          .replace('{total}', required.toString())
          .replace('{remaining}', remaining.toString());
      } else {
        progressMessage = (t('featureLock.watchAdRequired') || '이 기능을 해제하려면 광고를 {total}회 시청해야 합니다.')
          .replace('{total}', required.toString());
      }
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
          text: isAdLoaded
            ? (t('featureLock.watchAd') || '광고 보기')
            : (t('featureLock.loadingAd') || '로딩 중...'),
          onPress: () => showRewardedAdAndProcess(featureId, onUnlock),
        },
      ]
    );
  }, [t, getAdProgress, isAdLoaded, showRewardedAdAndProcess]);

  // 바코드 타입 해제 Alert
  const showBarcodeUnlockAlert = useCallback((onUnlock) => {
    showUnlockAlert('advancedBarcodes', onUnlock);
  }, [showUnlockAlert]);

  // QR 스타일 해제 Alert (모든 스타일 한번에 해제)
  const showQrStyleUnlockAlert = useCallback((onUnlock) => {
    const qrStyleFeatures = Object.keys(LOCKED_FEATURES).filter(
      key => LOCKED_FEATURES[key].type === 'qrStyle'
    );

    const firstStyleId = qrStyleFeatures[0];
    const { current, required, remaining } = getAdProgress(firstStyleId);

    let progressMessage = t('featureLock.watchAdToUnlock') || '광고를 시청하면 이 기능을 사용할 수 있습니다';
    if (required > 1) {
      if (current > 0) {
        progressMessage = (t('featureLock.watchAdProgress') || '광고 {current}/{total} 시청 완료\n{remaining}회 더 시청하면 해제됩니다.')
          .replace('{current}', current.toString())
          .replace('{total}', required.toString())
          .replace('{remaining}', remaining.toString());
      } else {
        progressMessage = (t('featureLock.watchAdRequired') || '이 기능을 해제하려면 광고를 {total}회 시청해야 합니다.')
          .replace('{total}', required.toString());
      }
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
          text: isAdLoaded
            ? (t('featureLock.watchAd') || '광고 보기')
            : (t('featureLock.loadingAd') || '로딩 중...'),
          onPress: () => showRewardedAdForQrStyles(onUnlock),
        },
      ]
    );
  }, [t, getAdProgress, isAdLoaded, showRewardedAdForQrStyles]);

  const value = {
    isLocked,
    isBarcodeTypeLocked,
    getBarcodeFeatureId,
    isQrTypeLocked,
    getQrTypeFeatureId,
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
    isAdLoaded,
    isAdLoading,
    loadRewardedAd,
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
