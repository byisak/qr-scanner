// screens/PremiumScreen.js - 프리미엄 구독 모달 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePurchase } from '../contexts/PurchaseContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

export default function PremiumScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const {
    isPremium,
    isLoading,
    purchasePremium,
    restorePurchase,
    getProductPrice,
  } = usePurchase();

  // 프리미엄 기능 목록
  const features = [
    { icon: 'ban-outline', key: 'removeAds', color: '#FF3B30' },
    { icon: 'sync-outline', key: 'realtimeSync', color: '#007AFF' },
    { icon: 'layers-outline', key: 'batchScan', color: '#34C759' },
    { icon: 'camera-outline', key: 'photoSave', color: '#FF9500' },
    { icon: 'download-outline', key: 'exportHistory', color: '#5856D6' },
    { icon: 'link-outline', key: 'scanUrl', color: '#AF52DE' },
    { icon: 'star-outline', key: 'futureFeatures', color: '#FFD700' },
  ];

  const handlePurchase = async () => {
    const success = await purchasePremium();
    if (success) {
      Alert.alert(
        t('premium.purchaseSuccess'),
        t('premium.purchaseSuccessMessage'),
        [{ text: t('common.confirm'), onPress: () => router.back() }]
      );
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchase();
    if (success) {
      Alert.alert(
        t('premium.restoreSuccess'),
        t('premium.restoreSuccessMessage'),
        [{ text: t('common.confirm'), onPress: () => router.back() }]
      );
    } else {
      Alert.alert(
        t('premium.restoreNotFound'),
        t('premium.restoreNotFoundMessage')
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('premium.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 프리미엄 아이콘 */}
        <View style={styles.iconContainer}>
          <View style={styles.premiumIcon}>
            <Ionicons name="star" size={48} color="#FFD700" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('premium.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('premium.subtitle')}
          </Text>
        </View>

        {/* 기능 목록 */}
        <View style={[styles.featureList, { backgroundColor: colors.surface }]}>
          {features.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.featureItem,
                index < features.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }
              ]}
            >
              <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                <Ionicons name={feature.icon} size={22} color={feature.color} />
              </View>
              <Text style={[styles.featureText, { color: colors.text }]}>
                {t(`premium.${feature.key}`)}
              </Text>
              <Ionicons name="checkmark-circle" size={22} color="#34C759" />
            </View>
          ))}
        </View>

        {/* 구매 버튼 */}
        {isPremium ? (
          <View style={[styles.premiumBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.premiumBadgeText, { color: colors.success }]}>
              {t('premium.alreadyPremium')}
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.purchaseButton, isLoading && styles.purchaseButtonDisabled]}
              onPress={handlePurchase}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="diamond" size={24} color="#fff" />
                  <View style={styles.purchaseTextContainer}>
                    <Text style={styles.purchaseButtonText}>{t('premium.purchase')}</Text>
                    <Text style={styles.priceText}>
                      {getProductPrice()} / {t('premium.lifetime')}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isLoading}
            >
              <Text style={[styles.restoreText, { color: colors.primary }]}>
                {t('premium.restore')}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* 안내 문구 */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            {t('premium.info')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  premiumIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  featureList: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseTextContainer: {
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  priceText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  restoreButton: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
  },
  restoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  premiumBadgeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
