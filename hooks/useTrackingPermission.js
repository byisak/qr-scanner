// hooks/useTrackingPermission.js - ATT (App Tracking Transparency) 훅
import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAnalyticsConsent } from '../utils/analytics';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';

// 네이티브 모듈 안전한 import (빌드 문제 대응)
let TrackingTransparency = null;
try {
  TrackingTransparency = require('expo-tracking-transparency');
} catch (e) {
  console.warn('expo-tracking-transparency not available:', e.message);
}

const requestTrackingPermissionsAsync = TrackingTransparency?.requestTrackingPermissionsAsync;
const getTrackingPermissionsAsync = TrackingTransparency?.getTrackingPermissionsAsync;
const PermissionStatus = TrackingTransparency?.PermissionStatus || { GRANTED: 'granted', DENIED: 'denied' };

const ATT_REQUESTED_KEY = '@att_requested';

// 광고 SDK 초기화는 서버에서 설정을 받아와 느린 망에서는 ~10초까지 걸린다 (에뮬레이터 실측 10.5초).
// 첫 화면에는 필요 없으므로 기다리지 않는다. 광고 요청은 초기화가 끝날 때까지 SDK가 대기시킨다
let adsInitStarted = false;
function initializeAdsInBackground() {
  if (adsInitStarted) return;
  adsInitStarted = true;
  mobileAds().initialize().catch(error => {
    adsInitStarted = false;
    console.warn('Mobile Ads initialize failed:', error?.message);
  });
}

export function useTrackingPermission() {
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState(null);

  // ATT 권한 요청 (iOS 전용)
  const requestPermission = useCallback(async () => {
    try {
      // Android: 기본 동의 처리
      if (Platform.OS !== 'ios') {
        // Android는 ATT가 없어 기다릴 게 없다 → 바로 첫 화면을 띄우고 나머지는 뒤에서
        setIsLoading(false);
        AsyncStorage.getItem('@analytics_consent')
          .then(consent => (consent === null ? setAnalyticsConsent(true) : null))
          .catch(() => {});
        initializeAdsInBackground();
        return;
      }

      // iOS: ATT 모듈이 없으면 비개인화 광고만 사용
      if (!TrackingTransparency) {
        console.warn('ATT module not available, using non-personalized ads only');
        // 추적 동의 없이 비개인화 광고만 허용
        await setAnalyticsConsent(false);
        // 비개인화 광고 설정
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        initializeAdsInBackground();
        setPermissionStatus('denied');
        setIsLoading(false);
        return;
      }

      // 이미 요청했는지 확인
      const alreadyRequested = await AsyncStorage.getItem(ATT_REQUESTED_KEY);

      if (alreadyRequested) {
        // 이미 요청한 경우: 현재 상태만 확인
        const { status } = await getTrackingPermissionsAsync();
        setPermissionStatus(status);

        // 권한 상태에 따라 분석 동의 설정
        const granted = status === PermissionStatus.GRANTED;
        await setAnalyticsConsent(granted);
        initializeAdsInBackground();
        setIsLoading(false);
        return;
      }

      // 최초 요청
      const { status } = await requestTrackingPermissionsAsync();
      setPermissionStatus(status);

      // 요청 완료 표시
      await AsyncStorage.setItem(ATT_REQUESTED_KEY, 'true');

      // 권한 상태에 따라 분석 동의 설정
      const granted = status === PermissionStatus.GRANTED;
      await setAnalyticsConsent(granted);

      // AdMob 초기화
      initializeAdsInBackground();

      setIsLoading(false);
    } catch (error) {
      console.error('ATT permission error:', error);
      // 오류 시 비개인화 광고만 사용
      await setAnalyticsConsent(false);
      initializeAdsInBackground();
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return {
    isLoading,
    permissionStatus,
    isGranted: permissionStatus === PermissionStatus.GRANTED,
  };
}
