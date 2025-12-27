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
import { LinearGradient } from 'expo-linear-gradient';

// Pro 기능 목록
const PRO_FEATURES = [
  { key: 'exclusiveQrDesign', icon: 'qr-code-outline' },
  { key: 'customLogoQr', icon: 'camera-outline' },
  { key: 'additionalFormats', icon: 'options-outline' },
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

  const handlePurchase = () => {
    Alert.alert(
      t('proPurchase.purchaseTitle'),
      t('proPurchase.purchaseConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
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
    <View style={s.container}>
      {/* 배경 그라데이션 */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#1a1a2e']}
        style={s.backgroundGradient}
      />

      {/* 닫기 버튼 */}
      <TouchableOpacity
        style={s.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <View style={s.closeButtonCircle}>
          <Ionicons name="close" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* 헤더 아이콘 및 타이틀 */}
        <View style={s.headerSection}>
          {/* 3D 큐브 아이콘 with glow */}
          <View style={s.iconGlow}>
            <View style={s.iconContainer}>
              <Ionicons name="cube-outline" size={64} color="#00E5CC" />
            </View>
          </View>
          <Text style={[s.title, { fontFamily: fonts.bold }]}>
            {t('proPurchase.title')}
          </Text>
        </View>

        {/* 주요 혜택 */}
        <View style={s.benefitsRow}>
          <View style={s.benefitItem}>
            <Text style={[s.benefitText, { fontFamily: fonts.medium }]}>
              {t('proPurchase.noAds')}
            </Text>
            <Ionicons name="checkmark" size={18} color="#00E5CC" />
          </View>
          <View style={s.benefitItem}>
            <Text style={[s.benefitText, { fontFamily: fonts.medium }]}>
              {t('proPurchase.advancedFeatures')}
            </Text>
            <Ionicons name="checkmark" size={18} color="#00E5CC" />
          </View>
        </View>

        {/* 기능 목록 */}
        <View style={s.featuresList}>
          {PRO_FEATURES.map((feature) => (
            <View key={feature.key} style={s.featureItem}>
              <Ionicons name={feature.icon} size={22} color="rgba(255,255,255,0.7)" />
              <Text style={[s.featureText, { fontFamily: fonts.regular }]}>
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
          style={s.watchAdSection}
          onPress={handleWatchAd}
          activeOpacity={0.8}
        >
          <View style={s.watchAdLeft}>
            <View style={s.watchAdIconContainer}>
              <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
            </View>
            <View style={s.watchAdTextContainer}>
              <Text style={[s.watchAdTitle, { fontFamily: fonts.semiBold }]}>
                {t('proPurchase.watchAd')}
              </Text>
              <Text style={[s.watchAdDesc, { fontFamily: fonts.regular }]}>
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
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </View>
        </TouchableOpacity>

        {/* 구매 항목 복원 */}
        <TouchableOpacity
          style={s.restoreButton}
          onPress={handleRestorePurchase}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.5)" />
          <Text style={[s.restoreText, { fontFamily: fonts.regular }]}>
            {t('proPurchase.restorePurchase')}
          </Text>
        </TouchableOpacity>

        {/* 약관 및 개인정보 */}
        <View style={s.footerLinks}>
          <TouchableOpacity onPress={() => router.push('/terms-of-service')}>
            <Text style={[s.footerLink, { fontFamily: fonts.regular }]}>
              {t('proPurchase.terms')}
            </Text>
          </TouchableOpacity>
          <Text style={s.footerDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={[s.footerLink, { fontFamily: fonts.regular }]}>
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
    backgroundColor: '#1a1a2e',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGlow: {
    marginBottom: 16,
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  iconContainer: {
    padding: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00E5CC',
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
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
  },
  featuresList: {
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
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
    backgroundColor: '#8B2942',
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
    color: '#fff',
  },
  watchAdDesc: {
    fontSize: 13,
    marginTop: 2,
    color: 'rgba(255,255,255,0.7)',
  },
  watchAdRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 12,
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
    color: 'rgba(255,255,255,0.5)',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  footerDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
});
