// screens/ProVersionScreen.js - Pro 버전 구매 페이지
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from '../components/MaterialPressable';

// Pro 기능 목록 - 실제 앱에 구현된 기능들 (11개)
const PRO_FEATURES = [
  { key: 'exclusiveQrDesign', icon: 'qr-code-outline' },
  { key: 'customLogoQr', icon: 'camera-outline' },
  { key: 'additionalFormats', icon: 'layers-outline' },
  { key: 'batchScan', icon: 'rocket-outline' },
  { key: 'deleteScannedBarcode', icon: 'menu-outline' },
  { key: 'copyToClipboard', icon: 'copy-outline' },
  { key: 'manualScanConfirm', icon: 'checkmark-circle-outline' },
  ...(Platform.OS === 'ios' ? [{ key: 'icloudSync', icon: 'cloud-upload-outline' }] : []),
  { key: 'extraThemes', icon: 'happy-outline' },
  { key: 'unlimitedExport', icon: 'infinite-outline' },
  { key: 'businessScannerMode', icon: 'wifi-outline' },
];

export default function ProVersionScreen() {
  const router = useRouter();
  const { language, t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
      {/* 하위 화면 헤더: 닫기 · (제목은 아래 큰 제목이 맡는다) */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          style={s.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </MaterialPressable>
        <View style={s.headerTitleSpacer} />
        <View style={s.headerButton} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 히어로: 아이콘 타일(프로모션 그라데이션) + 큰 제목 + 혜택 요약 */}
        <View style={s.hero}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroIcon}
          >
            <Ionicons name="diamond-outline" size={28} color="#FFFFFF" />
          </LinearGradient>
          <Text accessibilityRole="header" style={[s.title, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proPurchase.title')}
          </Text>

          {/* 서브 기능 표시 */}
          <View style={s.subFeatures}>
            <View style={s.subFeatureItem}>
              <Ionicons name="checkmark" size={16} color={colors.success} />
              <Text style={[s.subFeatureText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('proPurchase.noAds')}
              </Text>
            </View>
            <View style={s.subFeatureItem}>
              <Ionicons name="checkmark" size={16} color={colors.success} />
              <Text style={[s.subFeatureText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('proPurchase.advancedFeatures')}
              </Text>
            </View>
          </View>
        </View>

        {/* 기능 목록: 묶음 카드 하나 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PRO_FEATURES.map((feature, index) => (
            <View
              key={feature.key}
              style={[
                s.featureItem,
                index < PRO_FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
              ]}
            >
              <Ionicons name={feature.icon} size={20} color={colors.textSecondary} />
              <Text style={[s.featureText, { color: colors.text, fontFamily: fonts.medium }]}>
                {t(`proPurchase.features.${feature.key}`)}
              </Text>
            </View>
          ))}
        </View>

        {/* 액션 영역 */}
        <View style={s.actionArea}>
          {/* 구매 버튼 */}
          <MaterialPressable
            style={[s.purchaseButton, { backgroundColor: colors.primary }]}
            onPress={handlePurchase}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[s.purchaseButtonText, { fontFamily: fonts.semiBold }]}>
              {t('proPurchase.oneTimePurchase')} • ₩15,000
            </Text>
          </MaterialPressable>

          {/* 광고 보기: 이동 행 하나짜리 카드 */}
          <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialPressable
              style={s.adButton}
              onPress={handleWatchAd}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Ionicons name="play-circle-outline" size={20} color={colors.textSecondary} />
              <View style={s.adTextContainer}>
                <Text style={[s.adTitle, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('proPurchase.watchAd')}
                </Text>
                <Text style={[s.adDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('proPurchase.freeUnlock')}
                </Text>
              </View>
              <View style={s.adRight}>
                <View style={[s.newBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[s.newBadgeText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>
                    {t('proPurchase.new')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </View>
            </MaterialPressable>
          </View>
        </View>

        {/* 푸터 링크 */}
        <View style={s.footerArea}>
          {/* 구매 항목 복원 */}
          <MaterialPressable
            style={s.textLink}
            onPress={handleRestorePurchase}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[s.footerLink, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('proPurchase.restorePurchase')}
            </Text>
          </MaterialPressable>

          {/* 약관 및 개인정보 */}
          <View style={s.footerLinks}>
            <MaterialPressable
              style={s.textLink}
              accessibilityRole="link"
              onPress={() => router.push({
                pathname: '/webview',
                params: { url: `https://scanview.app/legal/terms?lang=${language}&theme=${isDark ? 'dark' : 'light'}` }
              })}
            >
              <Text style={[s.footerLink, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('proPurchase.terms')}
              </Text>
            </MaterialPressable>
            <Text style={[s.footerDot, { color: colors.textTertiary }]}>•</Text>
            <MaterialPressable
              style={s.textLink}
              accessibilityRole="link"
              onPress={() => router.push({
                pathname: '/webview',
                params: { url: `https://scanview.app/legal/privacy?lang=${language}&theme=${isDark ? 'dark' : 'light'}` }
              })}
            >
              <Text style={[s.footerLink, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('proPurchase.privacy')}
              </Text>
            </MaterialPressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
  },

  // 히어로
  hero: {
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    ...TYPE.tabTitle,
  },
  subFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
  },
  subFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subFeatureText: {
    fontSize: 15,
  },

  // 묶음 카드
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  featureText: {
    ...TYPE.body,
    flex: 1,
  },

  // 액션 영역
  actionArea: {
    marginTop: 24,
    gap: SPACE.gap,
  },
  purchaseButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  adButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  adTextContainer: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  adTitle: {
    ...TYPE.body,
  },
  adDesc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  adRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // 푸터 영역
  footerArea: {
    marginTop: 16,
    alignItems: 'center',
  },
  textLink: {
    minHeight: SIZE.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 13,
  },
  footerDot: {
    fontSize: 13,
  },
});
