// hooks/useTrackingPermission.js - ATT (App Tracking Transparency) 훅
import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
  PermissionStatus,
} from 'expo-tracking-transparency';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAnalyticsConsent } from '../utils/analytics';
import mobileAds from 'react-native-google-mobile-ads';

const ATT_REQUESTED_KEY = '@att_requested';

export function useTrackingPermission() {
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState(null);

  // ATT 권한 요청 (iOS 전용)
  const requestPermission = useCallback(async () => {
    try {
      // iOS가 아니면 바로 동의 처리 (Android는 ATT 없음)
      if (Platform.OS !== 'ios') {
        // Android: 이전에 저장된 동의 상태 확인
        const consent = await AsyncStorage.getItem('@analytics_consent');
        if (consent === null) {
          // 최초 실행: 기본적으로 동의 처리 (설정에서 변경 가능)
          await setAnalyticsConsent(true);
        }
        await mobileAds().initialize();
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
        await mobileAds().initialize();
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
      await mobileAds().initialize();

      setIsLoading(false);
    } catch (error) {
      console.error('ATT permission error:', error);
      // 오류 시에도 앱 진행
      await mobileAds().initialize();
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
