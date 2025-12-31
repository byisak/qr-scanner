// components/AdBanner.js - 배너 광고 컴포넌트
import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// 테스트 광고 ID (프로덕션 배포 전 실제 ID로 교체 필요)
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 실제 iOS 광고 단위 ID
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 실제 Android 광고 단위 ID
    });

export default function AdBanner({ style, containerStyle }) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // 광고 로드 실패 시 컴포넌트 숨김
  if (adError) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle, !adLoaded && styles.hidden]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
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
});
