// screens/DeveloperOptionsScreen.js - 개발자 옵션 화면
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
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
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';

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

  // 스캔 영역 디버그: 영역 밖으로 판정된 코드를 빨간 테두리로 보여준다 (좌표 변환 확인용)
  const [scanRegionDebug, setScanRegionDebug] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('scanRegionDebug').then(v => setScanRegionDebug(v === 'true')).catch(() => {});
  }, []);
  const toggleScanRegionDebug = async (value) => {
    setScanRegionDebug(value);
    try {
      await AsyncStorage.setItem('scanRegionDebug', value ? 'true' : 'false');
    } catch (error) {
      console.error('Save scanRegionDebug error:', error);
    }
  };

  // 스캔 처리 시간: 네이티브 단계별(ML Kit·반전·ZXing) ms를 스캔 화면 구석에 보여준다 (Android)
  const [scanTimingDebug, setScanTimingDebug] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('scanTimingDebug').then(v => setScanTimingDebug(v === 'true')).catch(() => {});
  }, []);
  const toggleScanTimingDebug = async (value) => {
    setScanTimingDebug(value);
    try {
      await AsyncStorage.setItem('scanTimingDebug', value ? 'true' : 'false');
    } catch (error) {
      console.error('Save scanTimingDebug error:', error);
    }
  };

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

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: isDark ? '#343A44' : colors.border },
    thumbColor: '#fff',
    ios_backgroundColor: isDark ? '#343A44' : colors.border,
  };

  const renderFeatureGroup = (groupKey, group) => (
    <View key={groupKey} style={s.featureGroup}>
      <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
        {t(group.titleKey)}
      </Text>
      <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {group.features.map((featureId, index) => (
          <View
            key={featureId}
            style={[
              s.row,
              s.rowWithDesc,
              index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight },
            ]}
          >
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t(FEATURE_NAME_KEYS[featureId])}
              </Text>
              <Text style={[s.featureId, { color: colors.textSecondary }]}>
                {featureId}
              </Text>
            </View>
            <Switch
              value={devModeEnabled || isFeatureUnlocked(featureId)}
              onValueChange={(value) => handleToggleFeature(featureId, value)}
              disabled={devModeEnabled}
              {...switchColors}
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={s.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('settings.developerOptions')}
        </Text>
        <View style={s.placeholder} />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* 경고 배너 */}
        <View style={[s.warningBanner, { backgroundColor: colors.warningSoft }]}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={[s.warningText, { color: colors.warning, fontFamily: fonts.medium }]}>
            {t('developerOptions.warning')}
          </Text>
        </View>

        {/* 개발 모드 마스터 토글 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <Ionicons name="code-slash" size={20} color={colors.warning} />
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('settings.devMode')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('developerOptions.devModeDesc')}
              </Text>
            </View>
            <Switch
              value={devModeEnabled}
              onValueChange={toggleDevMode}
              {...switchColors}
            />
          </View>
        </View>

        {/* 스캔 디버그 */}
        <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {t('developerOptions.scanDebug')}
        </Text>
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('developerOptions.scanRegionDebug')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('developerOptions.scanRegionDebugDesc')}
              </Text>
            </View>
            <Switch
              value={scanRegionDebug}
              onValueChange={toggleScanRegionDebug}
              {...switchColors}
            />
          </View>
          <View style={[s.separator, { backgroundColor: colors.borderLight }]} />
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('developerOptions.scanTimingDebug')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('developerOptions.scanTimingDebugDesc')}
              </Text>
            </View>
            <Switch
              value={scanTimingDebug}
              onValueChange={toggleScanTimingDebug}
              {...switchColors}
            />
          </View>
        </View>

        {/* 빠른 액션 버튼들 */}
        <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {t('developerOptions.quickActions')}
        </Text>
        <View style={s.actions}>
          <MaterialPressable
            style={[s.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
            onPress={handleUnlockAll}
            disabled={devModeEnabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: devModeEnabled }}
          >
            <Ionicons name="lock-open-outline" size={18} color={devModeEnabled ? colors.textTertiary : colors.text} />
            <Text style={[s.actionButtonText, { color: devModeEnabled ? colors.textTertiary : colors.text, fontFamily: fonts.semiBold }]}>
              {t('developerOptions.unlockAll')}
            </Text>
          </MaterialPressable>

          <MaterialPressable
            style={[s.destructiveButton, { backgroundColor: colors.errorSoft }]}
            onPress={handleResetAll}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={18} color={colors.error} />
            <Text style={[s.actionButtonText, { color: colors.error, fontFamily: fonts.semiBold }]}>
              {t('settings.resetLocks')}
            </Text>
          </MaterialPressable>
        </View>

        {/* 개별 기능 토글 */}
        <Text accessibilityRole="header" style={[s.groupHeader, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {t('developerOptions.individualFeatures')}
        </Text>

        {Object.entries(FEATURE_GROUPS).map(([groupKey, group]) =>
          renderFeatureGroup(groupKey, group)
        )}
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  placeholder: {
    width: SIZE.touch,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 8,
    gap: SPACE.gap,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.control,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  featureGroup: {
    gap: SPACE.gap,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowWithDesc: {
    minHeight: SIZE.rowWithDesc,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  featureId: {
    fontSize: 12,
    fontFamily: MONO,
  },
  actions: {
    gap: SPACE.gap,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  destructiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  groupHeader: {
    ...TYPE.screenTitle,
    marginTop: 20,
    marginHorizontal: 4,
  },
});
