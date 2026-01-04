// hooks/useRewardAd.js - 리워드 광고 관리 훅
import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// 테스트 광고 ID (개발용)
// 실제 배포 시에는 AdMob 콘솔에서 발급받은 광고 단위 ID로 교체
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: 'ca-app-pub-XXXXX/XXXXX', // TODO: 실제 iOS 광고 단위 ID
      android: 'ca-app-pub-XXXXX/XXXXX', // TODO: 실제 Android 광고 단위 ID
    });

export const useRewardAd = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const rewardedAdRef = useRef(null);
  const onRewardEarnedRef = useRef(null);
  const onCloseRef = useRef(null);

  // 광고 인스턴스 생성 및 로드
  const loadAd = useCallback(() => {
    if (isLoading || isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      // 이전 광고 인스턴스 정리
      if (rewardedAdRef.current) {
        rewardedAdRef.current = null;
      }

      // 새 광고 인스턴스 생성
      const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      // 광고 로드 완료 이벤트
      const unsubscribeLoaded = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          setIsLoaded(true);
          setIsLoading(false);
          console.log('Rewarded ad loaded');
        }
      );

      // 보상 획득 이벤트
      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          console.log('User earned reward:', reward);
          if (onRewardEarnedRef.current) {
            onRewardEarnedRef.current(reward);
          }
        }
      );

      // 광고 닫힘 이벤트
      const unsubscribeClosed = rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          console.log('Rewarded ad closed');
          setIsLoaded(false);
          if (onCloseRef.current) {
            onCloseRef.current();
          }
          // 다음 광고 미리 로드
          loadAd();
        }
      );

      // 에러 이벤트
      const unsubscribeError = rewarded.addAdEventListener(
        AdEventType.ERROR,
        (err) => {
          console.error('Rewarded ad error:', err);
          setError(err);
          setIsLoading(false);
          setIsLoaded(false);
        }
      );

      rewardedAdRef.current = rewarded;

      // 광고 로드
      rewarded.load();

      // 클린업 함수 반환
      return () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
      };
    } catch (err) {
      console.error('Failed to create rewarded ad:', err);
      setError(err);
      setIsLoading(false);
    }
  }, [isLoading, isLoaded]);

  // 컴포넌트 마운트 시 광고 로드
  useEffect(() => {
    loadAd();
  }, []);

  // 광고 표시
  const showAd = useCallback(
    (onRewardEarned, onClose) => {
      return new Promise((resolve, reject) => {
        if (!isLoaded || !rewardedAdRef.current) {
          reject(new Error('Ad not loaded'));
          return;
        }

        onRewardEarnedRef.current = (reward) => {
          if (onRewardEarned) onRewardEarned(reward);
          resolve(reward);
        };

        onCloseRef.current = onClose;

        try {
          rewardedAdRef.current.show();
        } catch (err) {
          reject(err);
        }
      });
    },
    [isLoaded]
  );

  return {
    isLoaded,
    isLoading,
    error,
    loadAd,
    showAd,
  };
};

export default useRewardAd;
