// components/ads/RewardedAdButton.js - 리워드 광고 버튼 컴포넌트
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAd } from '../../contexts/AdContext';
import { usePurchase } from '../../contexts/PurchaseContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/Colors';

// 리워드 광고 단위 ID (실제 배포 시 실제 ID로 교체)
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
      ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/rewarded-ios',
      android: 'ca-app-pub-xxxxxxxxxxxxxxxx/rewarded-android',
    });

export default function RewardedAdButton({ feature, onUnlock, children, style }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { isPremium } = usePurchase();
  const {
    isFeatureLocked,
    recordAdWatch,
    getRemainingAdCount,
    getWatchedAdCount,
    REQUIRED_AD_COUNT
  } = useAd();

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const rewardedAdRef = useRef(null);

  // 광고 로드
  useEffect(() => {
    loadAd();

    return () => {
      // 클린업
      if (rewardedAdRef.current) {
        rewardedAdRef.current.removeAllListeners();
      }
    };
  }, []);

  const loadAd = () => {
    const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setLoaded(true);
      setLoading(false);
    });

    rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      // 보상 획득 - 광고 시청 기록
      const unlocked = recordAdWatch(feature);
      if (unlocked) {
        Alert.alert(
          t('ads.featureUnlocked'),
          t('premium.' + feature),
          [{ text: t('common.confirm') }]
        );
        onUnlock?.();
      }
      // 다음 광고 로드
      loadAd();
    });

    rewardedAd.load();
    rewardedAdRef.current = rewardedAd;
  };

  const showAd = async () => {
    if (loaded && rewardedAdRef.current) {
      setLoading(true);
      try {
        await rewardedAdRef.current.show();
      } catch (error) {
        console.log('Show ad error:', error);
        Alert.alert(t('result.error'), t('ads.adFailed'));
        loadAd();
      }
      setLoading(false);
    } else {
      Alert.alert(t('ads.adLoading'));
      loadAd();
    }
  };

  // 프리미엄 사용자 또는 이미 해제된 기능이면 원래 컴포넌트 표시
  if (isPremium || !isFeatureLocked(feature)) {
    return children;
  }

  const remainingAds = getRemainingAdCount(feature);
  const watchedAds = getWatchedAdCount(feature);

  return (
    <View style={[styles.container, style]}>
      {/* 잠긴 기능 오버레이 */}
      <TouchableOpacity
        style={[styles.lockedOverlay, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={showAd}
        activeOpacity={0.8}
        disabled={loading}
      >
        <View style={styles.lockIconContainer}>
          <Ionicons name="lock-closed" size={24} color={colors.primary} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.lockedTitle, { color: colors.text }]}>
            {t('ads.watchToUnlock')}
          </Text>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {t('ads.adsRemaining').replace('{count}', remainingAds.toString())} ({watchedAds}/{REQUIRED_AD_COUNT})
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={[styles.watchButton, { backgroundColor: colors.primary }]}>
              <Ionicons name="play-circle" size={18} color="#fff" />
              <Text style={styles.watchButtonText}>{t('ads.watchAd')}</Text>
            </View>
          )}
        </View>

        {/* 프리미엄으로 바로 해제 링크 */}
        <TouchableOpacity
          style={styles.premiumLink}
          onPress={() => router.push('/premium')}
        >
          <Text style={[styles.premiumLinkText, { color: colors.primary }]}>
            {t('premium.unlockAll')}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  lockedOverlay: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  premiumLink: {
    padding: 8,
  },
  premiumLinkText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
