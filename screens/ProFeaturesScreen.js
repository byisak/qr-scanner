// screens/ProFeaturesScreen.js - 기능별 광고 해제 페이지
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
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { LOCKED_FEATURES } from '../config/lockedFeatures';

// 기능 카테고리별 정리
const FEATURE_CATEGORIES = {
  settings: {
    titleKey: 'proFeatures.settingsFeatures',
    features: [
      { id: 'batchScan', icon: 'layers-outline', color: '#007AFF' },
      { id: 'realtimeSync', icon: 'sync-outline', color: '#34C759' },
      { id: 'scanUrlIntegration', icon: 'link-outline', color: '#FF9500' },
      { id: 'productSearch', icon: 'search-outline', color: '#5856D6' },
    ],
  },
  generator: {
    titleKey: 'proFeatures.generatorFeatures',
    features: [
      { id: 'barcodeTab', icon: 'barcode-outline', color: '#007AFF' },
    ],
  },
  barcodeTypes: {
    titleKey: 'proFeatures.barcodeTypes',
    features: [
      { id: 'barcodeCode39', icon: 'barcode-outline', color: '#007AFF', barcodeName: 'Code 39' },
      { id: 'barcodeCode93', icon: 'barcode-outline', color: '#5856D6', barcodeName: 'Code 93' },
      { id: 'barcodeItf14', icon: 'barcode-outline', color: '#FF9500', barcodeName: 'ITF-14' },
      { id: 'barcodeInterleaved', icon: 'barcode-outline', color: '#34C759', barcodeName: 'Interleaved' },
      { id: 'barcodeCodabar', icon: 'barcode-outline', color: '#FF3B30', barcodeName: 'Codabar' },
      { id: 'barcodePdf417', icon: 'barcode-outline', color: '#AF52DE', barcodeName: 'PDF417' },
      { id: 'barcodeDatamatrix', icon: 'grid-outline', color: '#00C7BE', barcodeName: 'Data Matrix' },
      { id: 'barcodeAztec', icon: 'apps-outline', color: '#FF6B6B', barcodeName: 'Aztec' },
    ],
  },
  qrStyles: {
    titleKey: 'proFeatures.qrStyles',
    features: [
      { id: 'qrStyleRounded', icon: 'square-outline', color: '#FF3B30', styleName: 'Rounded' },
      { id: 'qrStyleDots', icon: 'ellipse-outline', color: '#FF9500', styleName: 'Dots' },
      { id: 'qrStyleClassy', icon: 'diamond-outline', color: '#34C759', styleName: 'Classy' },
      { id: 'qrStyleBlueGradient', icon: 'color-palette-outline', color: '#007AFF', styleName: 'Blue Gradient' },
      { id: 'qrStyleSunset', icon: 'sunny-outline', color: '#FF6B6B', styleName: 'Sunset' },
      { id: 'qrStyleDarkMode', icon: 'moon-outline', color: '#1A1A2E', styleName: 'Dark Mode' },
      { id: 'qrStyleNeon', icon: 'flash-outline', color: '#00FF88', styleName: 'Neon' },
    ],
  },
};

export default function ProFeaturesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const {
    isLocked,
    getAdProgress,
    showUnlockAlert,
    showQrStyleUnlockAlert,
    isAdLoaded,
    isAdLoading,
  } = useFeatureLock();

  // 개별 기능 클릭 처리
  const handleFeaturePress = (featureId) => {
    if (!isLocked(featureId)) {
      Alert.alert(
        t('common.notice') || '알림',
        t('proFeatures.alreadyUnlocked') || '이미 해제된 기능입니다.'
      );
      return;
    }
    showUnlockAlert(featureId);
  };

  // QR 스타일 클릭 처리 (모든 스타일 한번에 해제)
  const handleQrStylePress = (featureId) => {
    if (!isLocked(featureId)) {
      Alert.alert(
        t('common.notice') || '알림',
        t('proFeatures.alreadyUnlocked') || '이미 해제된 기능입니다.'
      );
      return;
    }
    showQrStyleUnlockAlert();
  };

  // 진행률 뱃지 렌더링
  const renderProgressBadge = (featureId, isUnlocked) => {
    if (isUnlocked) {
      return (
        <View style={[s.checkBadge, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      );
    }

    const { current, required } = getAdProgress(featureId);
    const hasProgress = current > 0;

    return (
      <View style={[
        s.progressBadge,
        { backgroundColor: hasProgress ? colors.primary : (isDark ? '#333' : '#E5E5EA') }
      ]}>
        <Text style={[
          s.progressText,
          { color: hasProgress ? '#fff' : colors.text, fontFamily: fonts.semiBold }
        ]}>
          {hasProgress ? `${current}/${required}` : required}
        </Text>
      </View>
    );
  };

  // 기능 아이템 렌더링
  const renderFeatureItem = (feature, onPress) => {
    const featureConfig = LOCKED_FEATURES[feature.id];
    if (!featureConfig) return null;

    const unlocked = !isLocked(feature.id);

    return (
      <TouchableOpacity
        key={feature.id}
        style={[
          s.featureItem,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
          unlocked && { borderColor: colors.success, borderWidth: 2 }
        ]}
        onPress={() => onPress(feature.id)}
        activeOpacity={0.7}
      >
        <View style={[s.featureIconContainer, { backgroundColor: `${feature.color}15` }]}>
          <Ionicons name={feature.icon} size={24} color={feature.color} />
        </View>
        <Text style={[s.featureName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={2}>
          {feature.barcodeName || feature.styleName || t(`proFeatures.features.${feature.id}`) || feature.id}
        </Text>
        {renderProgressBadge(feature.id, unlocked)}
      </TouchableOpacity>
    );
  };

  const handleRemoveAds = () => {
    Alert.alert(
      t('proFeatures.removeAds'),
      t('proFeatures.removeAdsDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proVersion.upgrade'),
          onPress: () => {
            router.push('/pro-version');
          }
        },
      ]
    );
  };

  // 전체 잠금 상태 계산
  const getTotalProgress = () => {
    const allFeatures = Object.keys(LOCKED_FEATURES);
    const unlockedCount = allFeatures.filter(id => !isLocked(id)).length;
    return { unlocked: unlockedCount, total: allFeatures.length };
  };

  const progress = getTotalProgress();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('proFeatures.title') || '기능 잠금 해제'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* 전체 진행률 표시 */}
        <View style={[s.progressCard, { backgroundColor: colors.surface }]}>
          <View style={s.progressHeader}>
            <Ionicons name="lock-open-outline" size={24} color={colors.primary} />
            <Text style={[s.progressTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('proFeatures.unlockProgress') || '해제 진행률'}
            </Text>
          </View>
          <View style={s.progressBarContainer}>
            <View
              style={[
                s.progressBar,
                {
                  backgroundColor: colors.primary,
                  width: `${(progress.unlocked / progress.total) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[s.progressText2, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
            {progress.unlocked} / {progress.total} {t('proFeatures.featuresUnlocked') || '기능 해제됨'}
          </Text>
          {/* 광고 로딩 상태 표시 */}
          <View style={s.adStatusRow}>
            <Ionicons
              name={isAdLoaded ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={isAdLoaded ? colors.success : colors.textSecondary}
            />
            <Text style={[s.adStatusText, { color: isAdLoaded ? colors.success : colors.textSecondary, fontFamily: fonts.regular }]}>
              {isAdLoaded
                ? (t('proFeatures.adReady') || '광고 준비됨')
                : isAdLoading
                  ? (t('proFeatures.adLoading') || '광고 로딩 중...')
                  : (t('proFeatures.adNotLoaded') || '광고 로딩 대기')}
            </Text>
          </View>
        </View>

        {/* 설정 기능 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.settingsFeatures') || '설정 기능'}
          </Text>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.settings.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* 생성 기능 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.generatorFeatures') || '생성 기능'}
          </Text>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.generator.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* 바코드 타입 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.barcodeTypes') || '바코드 타입'}
          </Text>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.barcodeTypes.features.map((feature) =>
              renderFeatureItem(feature, handleFeaturePress)
            )}
          </View>
        </View>

        {/* QR 스타일 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('proFeatures.qrStyles') || 'QR 스타일'}
            </Text>
            <Text style={[s.sectionSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('proFeatures.qrStylesDesc') || '한 번에 모든 스타일 해제'}
            </Text>
          </View>
          <View style={s.featureGrid}>
            {FEATURE_CATEGORIES.qrStyles.features.map((feature) =>
              renderFeatureItem(feature, handleQrStylePress)
            )}
          </View>
        </View>

        {/* 광고 제거 버튼 */}
        <TouchableOpacity
          style={s.removeAdsButton}
          onPress={handleRemoveAds}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.removeAdsGradient}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={[s.removeAdsText, { fontFamily: fonts.bold }]}>
              {t('proFeatures.removeAds') || '광고 제거하기'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* 하단 여백 */}
        <View style={{ height: 40 }} />
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
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  // 진행률 카드
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText2: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  adStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  adStatusText: {
    fontSize: 13,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  featureItem: {
    width: '31%',
    marginHorizontal: '1.16%',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureName: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  adCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  themeItem: {
    width: '31%',
    marginHorizontal: '1.16%',
    marginBottom: 12,
    alignItems: 'center',
  },
  themePreviewContainer: {
    width: '100%',
    position: 'relative',
  },
  themePreview: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: 12,
  },
  themeAdBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeName: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  barcodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  barcodeItem: {
    width: '23%',
    marginHorizontal: '1%',
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  barcodeName: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAdsButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  removeAdsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  removeAdsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
