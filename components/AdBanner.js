// components/AdBanner.js - 배너 광고 컴포넌트
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';

// 광고 활성화 플래그
// TODO: 스크린샷 촬영 후 true로 복원
const AD_ENABLED = false;

// 네이티브 모듈 동적 로드 (Expo Go 호환성)
let BannerAd = null;
let BannerAdSize = null;
let TestIds = null;
let mobileAds = null;
let isAdModuleAvailable = false;
let isInitialized = false;

if (AD_ENABLED) {
  try {
    const AdModule = require('react-native-google-mobile-ads');
    BannerAd = AdModule.BannerAd;
    BannerAdSize = AdModule.BannerAdSize;
    TestIds = AdModule.TestIds;
    mobileAds = AdModule.default;
    isAdModuleAvailable = true;

    // SDK 초기화
    if (mobileAds && !isInitialized) {
      mobileAds()
        .initialize()
        .then((adapterStatuses) => {
          isInitialized = true;
          console.log('Mobile Ads SDK initialized');
        })
        .catch((error) => {
          console.log('Mobile Ads SDK initialization failed:', error);
        });
    }
  } catch (error) {
    console.log('Google Mobile Ads module not available:', error.message);
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

export default function AdBanner({ style, containerStyle, wrapperStyle }) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // 네이티브 모듈이 없으면 (Expo Go) 빈 컴포넌트 반환
  if (!isAdModuleAvailable || !BannerAd) {
    // 개발 모드에서만 플레이스홀더 표시
    if (__DEV__) {
      return (
        <View style={[styles.wrapper, wrapperStyle]}>
          <View style={[styles.container, styles.placeholder, containerStyle]}>
            <Text style={styles.placeholderText}>광고 영역 (Development Build 필요)</Text>
          </View>
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
    <View style={[styles.wrapper, wrapperStyle, !adLoaded && styles.hidden]}>
      <View style={[styles.container, containerStyle]}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => {
            console.log('Ad loaded successfully');
            setAdLoaded(true);
          }}
          onAdFailedToLoad={(error) => {
            console.log('Ad failed to load:', error);
            setAdError(true);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 50,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  hidden: {
    opacity: 0,
    height: 0,
    minHeight: 0,
  },
  placeholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 15,
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
});
