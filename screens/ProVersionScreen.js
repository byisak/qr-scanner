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

// Pro 기능 목록 - 실제 앱에 구현된 기능들
const PRO_FEATURES = [
  { key: 'exclusiveQrDesign', icon: 'qr-code-outline' },      // QR 스타일 커스터마이징
  { key: 'customLogoQr', icon: 'camera-outline' },            // 로고 포함 QR 코드
  { key: 'additionalFormats', icon: 'options-outline' },      // 추가 바코드 형식 생성
  { key: 'batchScan', icon: 'rocket-outline' },               // 배치 스캔 모드
  { key: 'deleteScannedBarcode', icon: 'menu-outline' },      // 스캔 기록 삭제
  { key: 'copyToClipboard', icon: 'copy-outline' },           // 클립보드 복사
  { key: 'manualScanConfirm', icon: 'checkmark-circle-outline' }, // 수동 스캔 확인
  { key: 'icloudSync', icon: 'cloud-upload-outline' },        // iCloud/백업 동기화
  { key: 'extraThemes', icon: 'color-palette-outline' },      // 추가 테마
  { key: 'unlimitedExport', icon: 'infinite-outline' },       // 무제한 내보내기
  { key: 'businessScannerMode', icon: 'wifi-outline' },       // 비즈니스 스캐너 (실시간 전송)
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
        colors={['#0f0c29', '#302b63', '#24243e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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

      <ScrollView
        style={s.content}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 아이콘 및 타이틀 */}
        <View style={s.headerSection}>
          {/* 3D 큐브 아이콘 with glow */}
          <View style={s.iconGlow}>
            <Ionicons name="cube-outline" size={72} color="#00E5CC" />
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
            <Ionicons name="checkmark" size={20} color="#00E5CC" style={s.checkIcon} />
          </View>
          <View style={s.benefitItem}>
            <Text style={[s.benefitText, { fontFamily: fonts.medium }]}>
              {t('proPurchase.advancedFeatures')}
            </Text>
            <Ionicons name="checkmark" size={20} color="#00E5CC" style={s.checkIcon} />
          </View>
        </View>

        {/* 기능 목록 */}
        <View style={s.featuresList}>
          {PRO_FEATURES.map((feature) => (
            <View key={feature.key} style={s.featureItem}>
              <Ionicons name={feature.icon} size={24} color="rgba(255,255,255,0.6)" style={s.featureIcon} />
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
          activeOpacity={0.85}
        >
          <Text style={[s.purchaseButtonText, { fontFamily: fonts.bold }]}>
            {t('proPurchase.oneTimePurchase')} · ₩15,000
          </Text>
        </TouchableOpacity>

        {/* 광고 보기 섹션 */}
        <TouchableOpacity
          style={s.watchAdSection}
          onPress={handleWatchAd}
          activeOpacity={0.85}
        >
          <View style={s.watchAdLeft}>
            <View style={s.playIconCircle}>
              <Ionicons name="play" size={16} color="#fff" />
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
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>

        {/* 구매 항목 복원 */}
        <TouchableOpacity
          style={s.restoreButton}
          onPress={handleRestorePurchase}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.45)" />
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

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
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
    top: 55,
    right: 20,
    zIndex: 10,
  },
  closeButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 70,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconGlow: {
    marginBottom: 12,
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#00E5CC',
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 28,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginRight: 6,
  },
  checkIcon: {
    marginLeft: 2,
  },
  featuresList: {
    marginBottom: 28,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  featureIcon: {
    width: 32,
    marginRight: 14,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  purchaseButton: {
    backgroundColor: '#00A693',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
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
    backgroundColor: '#7B2D42',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  watchAdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  watchAdTextContainer: {
    flex: 1,
  },
  watchAdTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  watchAdDesc: {
    fontSize: 12,
    marginTop: 2,
    color: 'rgba(255,255,255,0.65)',
  },
  watchAdRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 10,
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
    marginBottom: 14,
  },
  restoreText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  footerDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
});
