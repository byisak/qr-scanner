// contexts/AdContext.js - 광고 관리 컨텍스트
import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useLanguage } from './LanguageContext';

const AdContext = createContext();

// 테스트 광고 ID (개발용)
// 실제 배포 시에는 AdMob 콘솔에서 발급받은 광고 단위 ID로 교체
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: 'ca-app-pub-XXXXX/XXXXX', // TODO: 실제 iOS 광고 단위 ID
      android: 'ca-app-pub-XXXXX/XXXXX', // TODO: 실제 Android 광고 단위 ID
    });

export const AdProvider = ({ children }) => {
  const { t } = useLanguage();
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [adError, setAdError] = useState(null);

  const rewardedAdRef = useRef(null);
  const rewardCallbackRef = useRef(null);
  const closeCallbackRef = useRef(null);

  // 광고 로드
  const loadRewardedAd = useCallback(() => {
    if (isAdLoading || isAdLoaded) return;

    setIsAdLoading(true);
    setAdError(null);

    try {
      // 이전 인스턴스 정리
      if (rewardedAdRef.current) {
        rewardedAdRef.current = null;
      }

      const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      // 로드 완료
      const unsubscribeLoaded = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          setIsAdLoaded(true);
          setIsAdLoading(false);
          console.log('Rewarded ad loaded');
        }
      );

      // 보상 획득
      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          console.log('User earned reward:', reward);
          if (rewardCallbackRef.current) {
            rewardCallbackRef.current(reward);
            rewardCallbackRef.current = null;
          }
        }
      );

      // 광고 닫힘
      const unsubscribeClosed = rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          console.log('Rewarded ad closed');
          setIsAdLoaded(false);
          if (closeCallbackRef.current) {
            closeCallbackRef.current();
            closeCallbackRef.current = null;
          }
          // 다음 광고 미리 로드
          setTimeout(() => loadRewardedAd(), 1000);
        }
      );

      // 에러
      const unsubscribeError = rewarded.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.error('Rewarded ad error:', error);
          setAdError(error);
          setIsAdLoading(false);
          setIsAdLoaded(false);
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
      setAdError(error);
      setIsAdLoading(false);
    }
  }, [isAdLoading, isAdLoaded]);

  // 초기 로드
  useEffect(() => {
    loadRewardedAd();

    return () => {
      if (rewardedAdRef.current?.unsubscribe) {
        rewardedAdRef.current.unsubscribe();
      }
    };
  }, []);

  // 광고 표시 및 보상 콜백
  const showRewardedAd = useCallback(
    async (onRewardEarned, onClose) => {
      if (!isAdLoaded || !rewardedAdRef.current?.ad) {
        // 광고가 로드되지 않은 경우
        Alert.alert(
          t('featureLock.adNotReady') || '광고 준비 중',
          t('featureLock.adNotReadyMessage') || '광고를 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
          [
            {
              text: t('common.confirm') || '확인',
              onPress: () => {
                // 광고 다시 로드 시도
                if (!isAdLoading) {
                  loadRewardedAd();
                }
              },
            },
          ]
        );
        return false;
      }

      rewardCallbackRef.current = onRewardEarned;
      closeCallbackRef.current = onClose;

      try {
        await rewardedAdRef.current.ad.show();
        return true;
      } catch (error) {
        console.error('Failed to show rewarded ad:', error);
        Alert.alert(
          t('featureLock.adError') || '광고 오류',
          t('featureLock.adErrorMessage') || '광고를 표시하는 중 오류가 발생했습니다.',
          [{ text: t('common.confirm') || '확인' }]
        );
        return false;
      }
    },
    [isAdLoaded, isAdLoading, t, loadRewardedAd]
  );

  const value = {
    isAdLoaded,
    isAdLoading,
    adError,
    loadRewardedAd,
    showRewardedAd,
  };

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
};

export const useAd = () => {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAd must be used within an AdProvider');
  }
  return context;
};

export default AdContext;
