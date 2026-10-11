// screens/ContinuousScanSettingsScreen.js - 연속 스캔 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from '../components/MaterialPressable';

export default function ContinuousScanSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // 상태
  const [continuousScanEnabled, setContinuousScanEnabled] = useState(false);
  const [showScanCounter, setShowScanCounter] = useState(true);
  const [duplicateDetection, setDuplicateDetection] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState('alert'); // 'alert', 'skip', 'allow'

  // 설정 로드 (기존 batchScan 설정도 마이그레이션)
  useEffect(() => {
    (async () => {
      try {
        // 새로운 키로 먼저 확인
        let continuousEnabled = await AsyncStorage.getItem('continuousScanEnabled');

        // 기존 batchScan 또는 scanResultMode에서 마이그레이션
        if (continuousEnabled === null) {
          const batchEnabled = await AsyncStorage.getItem('batchScanEnabled');
          const scanResultMode = await AsyncStorage.getItem('scanResultMode');

          if (batchEnabled === 'true' || scanResultMode === 'toast') {
            continuousEnabled = 'true';
            await AsyncStorage.setItem('continuousScanEnabled', 'true');
          }
        }

        const counter = await AsyncStorage.getItem('continuousShowScanCounter')
          || await AsyncStorage.getItem('batchShowScanCounter');
        const duplicate = await AsyncStorage.getItem('continuousDuplicateDetection')
          || await AsyncStorage.getItem('batchDuplicateDetection');
        const dupAction = await AsyncStorage.getItem('continuousDuplicateAction')
          || await AsyncStorage.getItem('batchDuplicateAction');

        if (continuousEnabled !== null) setContinuousScanEnabled(continuousEnabled === 'true');
        if (counter !== null) setShowScanCounter(counter === 'true');
        if (duplicate !== null) setDuplicateDetection(duplicate === 'true');
        if (dupAction !== null) setDuplicateAction(dupAction);
      } catch (error) {
        console.error('Load continuous scan settings error:', error);
      }
    })();
  }, []);

  // 연속 스캔 활성화 저장
  const handleContinuousScanToggle = async (value) => {
    setContinuousScanEnabled(value);
    try {
      await AsyncStorage.setItem('continuousScanEnabled', value.toString());
      // 호환성을 위해 기존 키도 업데이트
      await AsyncStorage.setItem('batchScanEnabled', value.toString());
      await AsyncStorage.setItem('scanResultMode', value ? 'toast' : 'popup');

      // 다른 고급 스캔 기능 비활성화 (상호 배타적)
      if (value) {
        await AsyncStorage.setItem('multiCodeModeEnabled', 'false');
        await SecureStore.setItemAsync('scanLinkEnabled', 'false');
        await AsyncStorage.setItem('realtimeSyncEnabled', 'false');
        await AsyncStorage.setItem('lotteryScanEnabled', 'false');
      }
    } catch (error) {
      console.error('Save continuous scan enabled error:', error);
      // 여러 키가 연쇄로 바뀌므로 상태는 되돌리지 않고 안내만
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 스캔 카운터 표시 저장
  const handleScanCounterToggle = async (value) => {
    setShowScanCounter(value);
    try {
      await AsyncStorage.setItem('continuousShowScanCounter', value.toString());
      await AsyncStorage.setItem('batchShowScanCounter', value.toString());
    } catch (error) {
      console.error('Save scan counter setting error:', error);
      setShowScanCounter(!value);
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 중복 감지 저장
  const handleDuplicateDetectionToggle = async (value) => {
    setDuplicateDetection(value);
    try {
      await AsyncStorage.setItem('continuousDuplicateDetection', value.toString());
      await AsyncStorage.setItem('batchDuplicateDetection', value.toString());
    } catch (error) {
      console.error('Save duplicate detection setting error:', error);
      setDuplicateDetection(!value);
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 중복 처리 방식 저장
  const handleDuplicateActionChange = async (action) => {
    const prevAction = duplicateAction;
    setDuplicateAction(action);
    try {
      await AsyncStorage.setItem('continuousDuplicateAction', action);
      await AsyncStorage.setItem('batchDuplicateAction', action);
    } catch (error) {
      console.error('Save duplicate action setting error:', error);
      setDuplicateAction(prevAction);
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };
  // 중복 처리 방식 (한 가지 선택)
  const duplicateActions = [
    { id: 'alert', icon: 'alert-circle-outline', label: t('continuousScan.actionAlert') || t('batchScan.actionAlert') },
    { id: 'skip', icon: 'play-skip-forward-outline', label: t('continuousScan.actionSkip') || t('batchScan.actionSkip') },
    { id: 'allow', icon: 'checkmark-done-outline', label: t('continuousScan.actionAllow') || t('batchScan.actionAllow') },
  ];

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            style={s.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('continuousScan.title') || t('batchScan.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 연속 스캔 활성화 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('continuousScan.enable') || t('batchScan.enable')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('continuousScan.enableDesc') || t('batchScan.enableDesc')}
              </Text>
            </View>
            <Switch
              value={continuousScanEnabled}
              onValueChange={handleContinuousScanToggle}
              {...switchColors}
            />
          </View>
        </View>

        {/* 연속 스캔 옵션 - 활성화 시에만 표시 */}
        {continuousScanEnabled && (
          <>
            {/* 스캔 카운터 */}
            <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('continuousScan.displayOptions') || t('batchScan.displayOptions')}
            </Text>
            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.row, s.rowWithDesc]}>
                <View style={s.rowText}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('continuousScan.showCounter') || t('batchScan.showCounter')}
                  </Text>
                  <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('continuousScan.showCounterDesc') || t('batchScan.showCounterDesc')}
                  </Text>
                </View>
                <Switch
                  value={showScanCounter}
                  onValueChange={handleScanCounterToggle}
                  {...switchColors}
                />
              </View>
            </View>

            {/* 중복 감지 */}
            <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('continuousScan.duplicateSection') || t('batchScan.duplicateSection')}
            </Text>
            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.row, s.rowWithDesc]}>
                <View style={s.rowText}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('continuousScan.duplicateDetection') || t('batchScan.duplicateDetection')}
                  </Text>
                  <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('continuousScan.duplicateDetectionDesc') || t('batchScan.duplicateDetectionDesc')}
                  </Text>
                </View>
                <Switch
                  value={duplicateDetection}
                  onValueChange={handleDuplicateDetectionToggle}
                  {...switchColors}
                />
              </View>
            </View>

            {/* 중복 처리 방식 - 중복 감지 활성화 시에만 표시 */}
            {duplicateDetection && (
              <>
                <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('continuousScan.duplicateAction') || t('batchScan.duplicateAction')}
                </Text>
                <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {duplicateActions.map((action, index) => {
                    const isSelected = duplicateAction === action.id;
                    return (
                      <MaterialPressable
                        key={action.id}
                        style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
                        onPress={() => handleDuplicateActionChange(action.id)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Ionicons name={action.icon} size={20} color={colors.textSecondary} />
                        <Text style={[s.label, s.rowText, { color: colors.text, fontFamily: fonts.medium }]}>
                          {action.label}
                        </Text>
                        <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.textTertiary }]}>
                          {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                        </View>
                      </MaterialPressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* 안내 메시지 */}
            <View style={[s.infoBox, { backgroundColor: colors.raised }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('continuousScan.infoMessage') || t('batchScan.infoMessage')}
              </Text>
            </View>
          </>
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
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
    flexShrink: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
    gap: SPACE.gap,
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.control,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
