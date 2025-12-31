// screens/DeveloperOptionsScreen.js - 개발자 옵션 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { LOCKED_FEATURES } from '../config/lockedFeatures';
import { Colors } from '../constants/Colors';

// 기능 카테고리별 그룹화
const FEATURE_GROUPS = {
  settings: {
    titleKey: 'developerOptions.settingsFeatures',
    features: ['batchScan', 'scanUrlIntegration', 'realtimeSync', 'productSearch'],
  },
  generator: {
    titleKey: 'developerOptions.generatorFeatures',
    features: ['barcodeTab', 'advancedBarcodes'],
  },
  qrStyle: {
    titleKey: 'developerOptions.qrStyleFeatures',
    features: ['qrStyleRounded', 'qrStyleDots', 'qrStyleClassy', 'qrStyleBlueGradient', 'qrStyleSunset', 'qrStyleDarkMode', 'qrStyleNeon'],
  },
};

// 기능 ID에 대한 번역 키 매핑
const FEATURE_NAME_KEYS = {
  batchScan: 'developerOptions.features.batchScan',
  scanUrlIntegration: 'developerOptions.features.scanUrlIntegration',
  realtimeSync: 'developerOptions.features.realtimeSync',
  productSearch: 'developerOptions.features.productSearch',
  barcodeTab: 'developerOptions.features.barcodeTab',
  advancedBarcodes: 'developerOptions.features.advancedBarcodes',
  qrStyleRounded: 'developerOptions.features.qrStyleRounded',
  qrStyleDots: 'developerOptions.features.qrStyleDots',
  qrStyleClassy: 'developerOptions.features.qrStyleClassy',
  qrStyleBlueGradient: 'developerOptions.features.qrStyleBlueGradient',
  qrStyleSunset: 'developerOptions.features.qrStyleSunset',
  qrStyleDarkMode: 'developerOptions.features.qrStyleDarkMode',
  qrStyleNeon: 'developerOptions.features.qrStyleNeon',
};

export default function DeveloperOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const {
    devModeEnabled,
    toggleDevMode,
    unlockedFeatures,
    toggleFeatureLock,
    unlockAllFeatures,
    resetAllLocks,
  } = useFeatureLock();

  const isFeatureUnlocked = (featureId) => {
    return unlockedFeatures.includes(featureId);
  };

  const handleToggleFeature = async (featureId, value) => {
    await toggleFeatureLock(featureId, value);
  };

  const handleUnlockAll = async () => {
    await unlockAllFeatures();
    Alert.alert(t('common.success'), t('developerOptions.allUnlocked'));
  };

  const handleResetAll = () => {
    Alert.alert(
      t('settings.resetLocks'),
      t('settings.resetLocksConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            await resetAllLocks();
            Alert.alert(t('common.success'), t('settings.resetLocksSuccess'));
          },
        },
      ]
    );
  };

  const renderFeatureGroup = (groupKey, group) => (
    <View key={groupKey} style={[s.section, { backgroundColor: colors.surface }]}>
      <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
        {t(group.titleKey)}
      </Text>
      {group.features.map((featureId, index) => (
        <View
          key={featureId}
          style={[
            s.featureItem,
            index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight },
          ]}
        >
          <View style={s.featureInfo}>
            <Text style={[s.featureName, { color: colors.text, fontFamily: fonts.medium }]}>
              {t(FEATURE_NAME_KEYS[featureId])}
            </Text>
            <Text style={[s.featureId, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
              {featureId}
            </Text>
          </View>
          <Switch
            value={devModeEnabled || isFeatureUnlocked(featureId)}
            onValueChange={(value) => handleToggleFeature(featureId, value)}
            disabled={devModeEnabled}
            trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('settings.developerOptions')}
        </Text>
        <View style={s.placeholder} />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.content}>
        {/* 경고 배너 */}
        <View style={[s.warningBanner, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="warning" size={20} color="#FF9500" />
          <Text style={[s.warningText, { fontFamily: fonts.medium }]}>
            {t('developerOptions.warning')}
          </Text>
        </View>

        {/* 개발 모드 마스터 토글 */}
        <View style={[s.section, { backgroundColor: colors.surface, borderWidth: 2, borderColor: '#FF9500' }]}>
          <View style={s.masterToggle}>
            <View style={s.masterToggleInfo}>
              <View style={s.masterToggleHeader}>
                <Ionicons name="code-slash" size={24} color="#FF9500" />
                <Text style={[s.masterToggleTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                  {t('settings.devMode')}
                </Text>
              </View>
              <Text style={[s.masterToggleDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('developerOptions.devModeDesc')}
              </Text>
            </View>
            <Switch
              value={devModeEnabled}
              onValueChange={toggleDevMode}
              trackColor={{ true: '#FF9500', false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 빠른 액션 버튼들 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
            {t('developerOptions.quickActions')}
          </Text>

          <TouchableOpacity
            style={[s.actionButton, { borderColor: colors.success }]}
            onPress={handleUnlockAll}
            disabled={devModeEnabled}
          >
            <Ionicons name="lock-open-outline" size={20} color={colors.success} />
            <Text style={[s.actionButtonText, { color: colors.success, fontFamily: fonts.semiBold }]}>
              {t('developerOptions.unlockAll')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionButton, { borderColor: colors.error, marginTop: 10 }]}
            onPress={handleResetAll}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.error} />
            <Text style={[s.actionButtonText, { color: colors.error, fontFamily: fonts.semiBold }]}>
              {t('settings.resetLocks')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 개별 기능 토글 */}
        <Text style={[s.groupHeader, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
          {t('developerOptions.individualFeatures')}
        </Text>

        {Object.entries(FEATURE_GROUPS).map(([groupKey, group]) =>
          renderFeatureGroup(groupKey, group)
        )}

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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  masterToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  masterToggleTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  masterToggleDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  featureInfo: {
    flex: 1,
  },
  featureName: {
    fontSize: 15,
    marginBottom: 2,
  },
  featureId: {
    fontSize: 12,
  },
});
