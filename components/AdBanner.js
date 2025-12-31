// components/AdBanner.js - 배너 광고 컴포넌트
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';

// 임시: 광고 비활성화 (크래시 디버깅용)
const AD_ENABLED = false;

// 네이티브 모듈 동적 로드 (Expo Go 호환성)
let BannerAd = null;
let BannerAdSize = null;
let TestIds = null;
let isAdModuleAvailable = false;

if (AD_ENABLED) {
  try {
    const AdModule = require('react-native-google-mobile-ads');
    BannerAd = AdModule.BannerAd;
    BannerAdSize = AdModule.BannerAdSize;
    TestIds = AdModule.TestIds;
    isAdModuleAvailable = true;
  } catch (error) {
    console.log('Google Mobile Ads module not available (Expo Go)');
  }
}

// 테스트 광고 ID (프로덕션 배포 전 실제 ID로 교체 필요)
const getBannerAdUnitId = () => {
  if (!isAdModuleAvailable || !TestIds) return null;

  return __DEV__
    ? TestIds.BANNER
    : Platform.select({
        ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 실제 iOS 광고 단위 ID
        android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 실제 Android 광고 단위 ID
      });
};

export default function AdBanner({ style, containerStyle }) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // 네이티브 모듈이 없으면 (Expo Go) 빈 컴포넌트 반환
  if (!isAdModuleAvailable || !BannerAd) {
    // 개발 모드에서만 플레이스홀더 표시
    if (__DEV__) {
      return (
        <View style={[styles.container, styles.placeholder, containerStyle]}>
          <Text style={styles.placeholderText}>광고 영역 (Development Build 필요)</Text>
        </View>
      );
    }
    return null;
  }

  const adUnitId = getBannerAdUnitId();
  if (!adUnitId) return null;

  // 광고 로드 실패 시 컴포넌트 숨김
  if (adError) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle, !adLoaded && styles.hidden]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(error) => {
          console.log('Ad failed to load:', error);
          setAdError(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 50,
  },
  hidden: {
    opacity: 0,
    height: 0,
    minHeight: 0,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
});
