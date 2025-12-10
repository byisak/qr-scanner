// components/ads/BannerAdWithRemove.js - 광고 제거 버튼이 있는 배너 광고
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePurchase } from '../../contexts/PurchaseContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

// 광고 단위 ID (실제 배포 시 실제 ID로 교체)
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy',
      android: 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz',
    });

export default function BannerAdWithRemove({ style }) {
  const router = useRouter();
  const { isPremium } = usePurchase();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  // 프리미엄 사용자는 광고 표시 안함
  if (isPremium) return null;

  // 광고 로드 실패 시 표시 안함
  if (adError) return null;

  return (
    <View style={[styles.container, style]}>
      {/* 광고 제거 버튼 */}
      <TouchableOpacity
        style={[
          styles.removeButton,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)' }
        ]}
        onPress={() => router.push('/premium')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="close-circle"
          size={14}
          color={isDark ? '#aaa' : '#666'}
        />
        <Text style={[styles.removeText, { color: isDark ? '#aaa' : '#666' }]}>
          {t('ads.removeAd')}
        </Text>
      </TouchableOpacity>

      {/* 배너 광고 */}
      <View style={styles.adContainer}>
        <BannerAd
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => {
            setAdLoaded(true);
            setAdError(false);
          }}
          onAdFailedToLoad={(error) => {
            console.log('Banner ad failed to load:', error);
            setAdError(true);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 8,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  removeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  adContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
});
