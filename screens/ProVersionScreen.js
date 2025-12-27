// screens/ProVersionScreen.js - Pro 버전 구매 페이지
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

// Pro 기능 목록
const PRO_FEATURES = [
  { key: 'exclusiveQrDesign', icon: 'qr-code-outline' },
  { key: 'customLogoQr', icon: 'camera-outline' },
  { key: 'additionalFormats', icon: 'layers-outline' },
  { key: 'batchScan', icon: 'rocket-outline' },
  { key: 'deleteScannedBarcode', icon: 'reorder-three-outline' },
  { key: 'copyToClipboard', icon: 'copy-outline' },
  { key: 'manualScanConfirm', icon: 'checkmark-circle-outline' },
  { key: 'icloudSync', icon: 'cloud-upload-outline' },
  { key: 'extraThemes', icon: 'color-palette-outline' },
  { key: 'unlimitedExport', icon: 'infinite-outline' },
  { key: 'businessScannerMode', icon: 'radio-outline' },
];

export default function ProVersionScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const handlePurchase = () => {
    Alert.alert(
      t('proPurchase.purchaseTitle'),
      t('proPurchase.purchaseConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            // 인앱 결제 로직
            Alert.alert(t('common.notice'), t('proPurchase.comingSoon'));
          }
        },
      ]
    );
  };

  const handleWatchAd = () => {
    router.push('/pro-features');
  };

  const handleRestorePurchase = () => {
    Alert.alert(t('common.notice'), t('proPurchase.restoring'));
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 닫기 버튼 */}
      <TouchableOpacity
        style={s.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <View style={[s.closeButtonCircle, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]}>
          <Ionicons name="close" size={20} color={colors.text} />
        </View>
      </TouchableOpacity>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* 헤더 아이콘 및 타이틀 */}
        <View style={s.headerSection}>
          <View style={s.iconContainer}>
            <Ionicons name="cube-outline" size={48} color={colors.text} />
          </View>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proPurchase.title')}
          </Text>
        </View>

        {/* 주요 혜택 */}
        <View style={s.benefitsRow}>
          <View style={s.benefitItem}>
            <Text style={[s.benefitText, { color: colors.text, fontFamily: fonts.medium }]}>
              {t('proPurchase.noAds')}
            </Text>
            <Ionicons name="checkmark" size={18} color={colors.text} />
          </View>
          <View style={s.benefitItem}>
            <Text style={[s.benefitText, { color: colors.text, fontFamily: fonts.medium }]}>
              {t('proPurchase.advancedFeatures')}
            </Text>
            <Ionicons name="checkmark" size={18} color={colors.text} />
          </View>
        </View>

        {/* 기능 목록 */}
        <View style={s.featuresList}>
          {PRO_FEATURES.map((feature) => (
            <View key={feature.key} style={s.featureItem}>
              <Ionicons name={feature.icon} size={22} color={colors.textSecondary} />
              <Text style={[s.featureText, { color: colors.text, fontFamily: fonts.regular }]}>
                {t(`proPurchase.features.${feature.key}`)}
              </Text>
            </View>
          ))}
        </View>

        {/* 구매 버튼 */}
        <TouchableOpacity
          style={s.purchaseButton}
          onPress={handlePurchase}
          activeOpacity={0.8}
        >
          <Text style={[s.purchaseButtonText, { fontFamily: fonts.bold }]}>
            {t('proPurchase.oneTimePurchase')} · ₩15,000
          </Text>
        </TouchableOpacity>

        {/* 광고 보기 섹션 */}
        <TouchableOpacity
          style={[s.watchAdSection, { borderColor: colors.border }]}
          onPress={handleWatchAd}
          activeOpacity={0.7}
        >
          <View style={s.watchAdLeft}>
            <View style={s.watchAdIconContainer}>
              <Ionicons name="play-circle-outline" size={24} color={colors.text} />
            </View>
            <View style={s.watchAdTextContainer}>
              <Text style={[s.watchAdTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('proPurchase.watchAd')}
              </Text>
              <Text style={[s.watchAdDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('proPurchase.freeUnlock')}
              </Text>
            </View>
          </View>
          <View style={s.watchAdRight}>
            <View style={s.newBadge}>
              <Text style={[s.newBadgeText, { fontFamily: fonts.bold }]}>
                {t('proPurchase.new')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* 구매 항목 복원 */}
        <TouchableOpacity
          style={s.restoreButton}
          onPress={handleRestorePurchase}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text style={[s.restoreText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('proPurchase.restorePurchase')}
          </Text>
        </TouchableOpacity>

        {/* 약관 및 개인정보 */}
        <View style={s.footerLinks}>
          <TouchableOpacity onPress={() => router.push('/terms-of-service')}>
            <Text style={[s.footerLink, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
              {t('proPurchase.terms')}
            </Text>
          </TouchableOpacity>
          <Text style={[s.footerDot, { color: colors.textTertiary }]}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={[s.footerLink, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
              {t('proPurchase.privacy')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 16,
  },
  featuresList: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  purchaseButton: {
    backgroundColor: '#00A693',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  watchAdSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  watchAdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  watchAdIconContainer: {
    marginRight: 12,
  },
  watchAdTextContainer: {
    flex: 1,
  },
  watchAdTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  watchAdDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  watchAdRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  restoreText: {
    fontSize: 14,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 13,
  },
  footerDot: {
    fontSize: 13,
  },
});
