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

// 고급 기능 목록
const ADVANCED_FEATURES = [
  { key: 'batchScan', icon: 'layers-outline', color: '#007AFF' },
  { key: 'deleteScannedBarcode', icon: 'trash-outline', color: '#FF3B30' },
  { key: 'copyToClipboard', icon: 'copy-outline', color: '#34C759' },
  { key: 'manualScanConfirm', icon: 'hand-left-outline', color: '#FF9500' },
  { key: 'icloudSync', icon: 'cloud-outline', color: '#5856D6' },
  { key: 'unlimitedExport', icon: 'download-outline', color: '#AF52DE' },
  { key: 'businessScannerMode', icon: 'briefcase-outline', color: '#00C7BE' },
];

// 추가 테마 목록
const EXTRA_THEMES = [
  { key: 'oceanBreeze', colors: ['#0077B6', '#00B4D8', '#90E0EF'] },
  { key: 'classicLook', colors: ['#6B705C', '#A5A58D', '#B7B7A4'] },
  { key: 'urbanVibe', colors: ['#2D3436', '#636E72', '#B2BEC3'] },
  { key: 'darkPlanet', colors: ['#1A1A2E', '#16213E', '#0F3460'] },
  { key: 'custom', colors: ['#667EEA', '#764BA2', '#F093FB'] },
];

export default function ProFeaturesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const handleFeaturePress = (featureKey) => {
    Alert.alert(
      t('proFeatures.watchAdToUnlock'),
      t('proFeatures.watchAdDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proVersion.watchAd'),
          onPress: () => {
            // 광고 시청 로직
            Alert.alert(t('common.notice'), t('proFeatures.adComingSoon'));
          }
        },
      ]
    );
  };

  const handleThemePress = (themeKey) => {
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
                onPress={() => handleFeaturePress(feature.key)}
                activeOpacity={0.7}
              >
                <View style={[s.featureIconContainer, { backgroundColor: `${feature.color}15` }]}>
                  <Ionicons name={feature.icon} size={24} color={feature.color} />
                </View>
                <Text style={[s.featureName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={2}>
                  {t(`proFeatures.features.${feature.key}`)}
                </Text>
                <View style={[s.lockBadge, { backgroundColor: colors.textTertiary }]}>
                  <Ionicons name="lock-closed" size={10} color="#fff" />
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
                onPress={() => handleThemePress(theme.key)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={theme.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.themePreview}
                >
                  <View style={s.themeLockOverlay}>
                    <Ionicons name="lock-closed" size={16} color="#fff" />
                  </View>
                </LinearGradient>
                <Text style={[s.themeName, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t(`proFeatures.themes.${theme.key}`)}
                </Text>
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
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
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
  themePreview: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeLockOverlay: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeName: {
    fontSize: 12,
    textAlign: 'center',
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
