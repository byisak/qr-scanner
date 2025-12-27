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
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// 고급 기능 목록 (adCount: 필요한 광고 시청 횟수)
const ADVANCED_FEATURES = [
  { key: 'batchScan', icon: 'layers-outline', color: '#007AFF', adCount: 2 },
  { key: 'deleteScannedBarcode', icon: 'trash-outline', color: '#FF3B30', adCount: 2 },
  { key: 'copyToClipboard', icon: 'copy-outline', color: '#34C759', adCount: 2 },
  { key: 'manualScanConfirm', icon: 'hand-left-outline', color: '#FF9500', adCount: 2 },
  { key: 'icloudSync', icon: 'cloud-outline', color: '#5856D6', adCount: 4 },
  { key: 'unlimitedExport', icon: 'download-outline', color: '#AF52DE', adCount: 2 },
  { key: 'businessScannerMode', icon: 'briefcase-outline', color: '#00C7BE', adCount: 4 },
];

// 추가 테마 목록
const EXTRA_THEMES = [
  { key: 'oceanBreeze', colors: ['#0077B6', '#00B4D8', '#90E0EF'], adCount: 2 },
  { key: 'classicLook', colors: ['#6B705C', '#A5A58D', '#B7B7A4'], adCount: 2 },
  { key: 'urbanVibe', colors: ['#2D3436', '#636E72', '#B2BEC3'], adCount: 2 },
  { key: 'darkPlanet', colors: ['#1A1A2E', '#16213E', '#0F3460'], adCount: 2 },
  { key: 'custom', colors: ['#667EEA', '#764BA2', '#F093FB'], adCount: 4 },
];

// 추가 형식 생성 (바코드 타입)
const BARCODE_FORMATS = [
  { key: 'ean13', name: 'EAN-13', adCount: 2 },
  { key: 'upca', name: 'UPC-A', adCount: 2 },
  { key: 'upce', name: 'UPC-E', adCount: 2 },
  { key: 'ean8', name: 'EAN-8', adCount: 2 },
  { key: 'code39', name: 'Code 39', adCount: 2 },
  { key: 'code128', name: 'Code 128', adCount: 2 },
  { key: 'itf', name: 'ITF', adCount: 2 },
  { key: 'datamatrix', name: 'Data Matrix', adCount: 2, unlocked: true },
  { key: 'aztec', name: 'Aztec', adCount: 2 },
  { key: 'pdf417', name: 'PDF417', adCount: 2 },
  { key: 'microqr', name: 'Micro\nQR code', adCount: 2 },
  { key: 'micropdf417', name: 'Micro\nPDF417', adCount: 2 },
];

export default function ProFeaturesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const handleFeaturePress = (featureKey, adCount) => {
    Alert.alert(
      t('proFeatures.watchAdToUnlock'),
      t('proFeatures.watchAdDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proVersion.watchAd'),
          onPress: () => {
            Alert.alert(t('common.notice'), t('proFeatures.adComingSoon'));
          }
        },
      ]
    );
  };

  const handleThemePress = (themeKey, adCount) => {
    Alert.alert(
      t('proFeatures.watchAdToUnlock'),
      t('proFeatures.watchAdDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proVersion.watchAd'),
          onPress: () => {
            Alert.alert(t('common.notice'), t('proFeatures.adComingSoon'));
          }
        },
      ]
    );
  };

  const handleBarcodePress = (barcodeKey, unlocked) => {
    if (unlocked) {
      Alert.alert(t('common.notice'), t('proFeatures.alreadyUnlocked'));
      return;
    }
    Alert.alert(
      t('proFeatures.watchAdToUnlock'),
      t('proFeatures.watchAdDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proVersion.watchAd'),
          onPress: () => {
            Alert.alert(t('common.notice'), t('proFeatures.adComingSoon'));
          }
        },
      ]
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

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('proFeatures.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* 설명 */}
        <Text style={[s.description, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('proFeatures.description')}
        </Text>

        {/* 고급 기능 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.advancedFeatures')}
          </Text>
          <View style={s.featureGrid}>
            {ADVANCED_FEATURES.map((feature) => (
              <TouchableOpacity
                key={feature.key}
                style={[s.featureItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                onPress={() => handleFeaturePress(feature.key, feature.adCount)}
                activeOpacity={0.7}
              >
                <View style={[s.featureIconContainer, { backgroundColor: `${feature.color}15` }]}>
                  <Ionicons name={feature.icon} size={24} color={feature.color} />
                </View>
                <Text style={[s.featureName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={2}>
                  {t(`proFeatures.features.${feature.key}`)}
                </Text>
                <View style={[s.adCountBadge, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]}>
                  <Text style={[s.adCountText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {feature.adCount}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 추가 테마 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.extraThemes')}
          </Text>
          <View style={s.themeGrid}>
            {EXTRA_THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={s.themeItem}
                onPress={() => handleThemePress(theme.key, theme.adCount)}
                activeOpacity={0.7}
              >
                <View style={s.themePreviewContainer}>
                  <LinearGradient
                    colors={theme.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.themePreview}
                  />
                  <View style={[s.themeAdBadge, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]}>
                    <Text style={[s.adCountText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {theme.adCount}
                    </Text>
                  </View>
                </View>
                <Text style={[s.themeName, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t(`proFeatures.themes.${theme.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 추가 형식 생성 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('proFeatures.additionalFormats')}
          </Text>
          <View style={s.barcodeGrid}>
            {BARCODE_FORMATS.map((barcode) => (
              <TouchableOpacity
                key={barcode.key}
                style={[
                  s.barcodeItem,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                  barcode.unlocked && { borderColor: colors.success, borderWidth: 2 }
                ]}
                onPress={() => handleBarcodePress(barcode.key, barcode.unlocked)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="barcode-outline"
                  size={28}
                  color={barcode.unlocked ? colors.success : colors.textSecondary}
                />
                <Text
                  style={[
                    s.barcodeName,
                    { color: colors.text, fontFamily: fonts.medium }
                  ]}
                  numberOfLines={2}
                >
                  {barcode.name}
                </Text>
                {barcode.unlocked ? (
                  <View style={[s.checkBadge, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                ) : (
                  <View style={[s.adCountBadge, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]}>
                    <Text style={[s.adCountText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {barcode.adCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
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
              {t('proFeatures.removeAds')}
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
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
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
