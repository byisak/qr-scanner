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

// Pro 기능 목록 - 실제 앱에 구현된 기능들 (11개)
const PRO_FEATURES = [
  { key: 'exclusiveQrDesign', icon: 'qr-code-outline' },
  { key: 'customLogoQr', icon: 'camera-outline' },
  { key: 'additionalFormats', icon: 'layers-outline' },
  { key: 'batchScan', icon: 'rocket-outline' },
  { key: 'deleteScannedBarcode', icon: 'menu-outline' },
  { key: 'copyToClipboard', icon: 'copy-outline' },
  { key: 'manualScanConfirm', icon: 'checkmark-circle-outline' },
  { key: 'icloudSync', icon: 'cloud-upload-outline' },
  { key: 'extraThemes', icon: 'happy-outline' },
  { key: 'unlimitedExport', icon: 'infinite-outline' },
  { key: 'businessScannerMode', icon: 'wifi-outline' },
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
        colors={['#121212', '#000000']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={s.backgroundGradient}
      />

      {/* 닫기 버튼 */}
      <TouchableOpacity
        style={s.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={24} color="#a0a0a0" />
      </TouchableOpacity>

      <ScrollView
        style={s.content}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 섹션 */}
        <View style={s.headerSection}>
          {/* 다이아몬드 아이콘 with 배경 & glow */}
          <View style={s.logoBox}>
            <Ionicons name="diamond-outline" size={48} color="#2ecc71" />
          </View>
          <Text style={[s.title, { fontFamily: fonts.bold }]}>
            {t('proPurchase.title')}
          </Text>

          {/* 서브 기능 표시 */}
          <View style={s.subFeatures}>
            <View style={s.subFeatureItem}>
              <Ionicons name="checkmark" size={16} color="#2ecc71" />
              <Text style={[s.subFeatureText, { fontFamily: fonts.regular }]}>
                {t('proPurchase.noAds')}
              </Text>
            </View>
            <View style={s.subFeatureItem}>
              <Ionicons name="checkmark" size={16} color="#2ecc71" />
              <Text style={[s.subFeatureText, { fontFamily: fonts.regular }]}>
                {t('proPurchase.advancedFeatures')}
              </Text>
            </View>
          </View>
        </View>

        {/* 기능 목록 */}
        <View style={s.featuresList}>
          {PRO_FEATURES.map((feature) => (
            <View key={feature.key} style={s.featureItem}>
              <Ionicons name={feature.icon} size={24} color="#a0a0a0" style={s.featureIcon} />
              <Text style={[s.featureText, { fontFamily: fonts.regular }]}>
                {t(`proPurchase.features.${feature.key}`)}
              </Text>
            </View>
          ))}
        </View>

        {/* 액션 영역 */}
        <View style={s.actionArea}>
          {/* 구매 버튼 */}
          <TouchableOpacity
            style={s.purchaseButton}
            onPress={handlePurchase}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#2ecc71', '#27ae60']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={s.purchaseButtonGradient}
            >
              <Text style={[s.purchaseButtonText, { fontFamily: fonts.bold }]}>
                {t('proPurchase.oneTimePurchase')} • ₩15,000
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* 광고 보기 버튼 */}
          <TouchableOpacity
            style={s.adButton}
            onPress={handleWatchAd}
            activeOpacity={0.85}
          >
            <View style={s.adContent}>
              <Ionicons name="play-circle-outline" size={28} color="#fff" />
              <View style={s.adTextContainer}>
                <Text style={[s.adTitle, { fontFamily: fonts.medium }]}>
                  {t('proPurchase.watchAd')}
                </Text>
                <Text style={[s.adDesc, { fontFamily: fonts.regular }]}>
                  {t('proPurchase.freeUnlock')}
                </Text>
              </View>
            </View>
            <View style={s.adRight}>
              <View style={s.newBadge}>
                <Text style={[s.newBadgeText, { fontFamily: fonts.bold }]}>
                  {t('proPurchase.new')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#a0a0a0" />
            </View>
          </TouchableOpacity>
        </View>

        {/* 푸터 링크 */}
        <View style={s.footerArea}>
          {/* 구매 항목 복원 */}
          <TouchableOpacity
            style={s.restoreButton}
            onPress={handleRestorePurchase}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={14} color="#a0a0a0" />
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
            <Text style={s.footerDot}>•</Text>
            <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
              <Text style={[s.footerLink, { fontFamily: fonts.regular }]}>
                {t('proPurchase.privacy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
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
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 70,
  },

  // 헤더 섹션
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    // Glow effect
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2ecc71',
    marginBottom: 12,
  },
  subFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
  },
  subFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subFeatureText: {
    fontSize: 14,
    color: '#a0a0a0',
  },

  // 기능 목록
  featuresList: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    opacity: 0.9,
  },
  featureIcon: {
    width: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },

  // 액션 영역
  actionArea: {
    gap: 12,
  },
  purchaseButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  purchaseButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  adButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  adContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adTextContainer: {
    gap: 2,
  },
  adTitle: {
    fontSize: 14,
    color: '#ffffff',
  },
  adDesc: {
    fontSize: 11,
    color: '#a0a0a0',
  },
  adRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },

  // 푸터 영역
  footerArea: {
    marginTop: 25,
    alignItems: 'center',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 15,
  },
  restoreText: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 12,
    color: '#a0a0a0',
    marginHorizontal: 8,
  },
  footerDot: {
    fontSize: 12,
    color: '#a0a0a0',
  },
});
