// screens/BatchScanSettingsScreen.js - 배치 스캔 설정 화면
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
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from '../components/MaterialPressable';

export default function BatchScanSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // 상태
  const [batchScanEnabled, setBatchScanEnabled] = useState(false);
  const [showScanCounter, setShowScanCounter] = useState(true);
  const [duplicateDetection, setDuplicateDetection] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState('alert'); // 'alert', 'skip', 'allow'

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const batchEnabled = await AsyncStorage.getItem('batchScanEnabled');
        const counter = await AsyncStorage.getItem('batchShowScanCounter');
        const duplicate = await AsyncStorage.getItem('batchDuplicateDetection');
        const dupAction = await AsyncStorage.getItem('batchDuplicateAction');

        if (batchEnabled !== null) setBatchScanEnabled(batchEnabled === 'true');
        if (counter !== null) setShowScanCounter(counter === 'true');
        if (duplicate !== null) setDuplicateDetection(duplicate === 'true');
        if (dupAction !== null) setDuplicateAction(dupAction);
      } catch (error) {
        console.error('Load batch scan settings error:', error);
      }
    })();
  }, []);

  // 배치 스캔 활성화 저장
  const handleBatchScanToggle = async (value) => {
    setBatchScanEnabled(value);
    try {
      await AsyncStorage.setItem('batchScanEnabled', value.toString());
    } catch (error) {
      console.error('Save batch scan enabled error:', error);
    }
  };

  // 스캔 카운터 표시 저장
  const handleScanCounterToggle = async (value) => {
    setShowScanCounter(value);
    try {
      await AsyncStorage.setItem('batchShowScanCounter', value.toString());
    } catch (error) {
      console.error('Save scan counter setting error:', error);
    }
  };

  // 중복 감지 저장
  const handleDuplicateDetectionToggle = async (value) => {
    setDuplicateDetection(value);
    try {
      await AsyncStorage.setItem('batchDuplicateDetection', value.toString());
    } catch (error) {
      console.error('Save duplicate detection setting error:', error);
    }
  };

  // 중복 처리 방식 저장
  const handleDuplicateActionChange = async (action) => {
    setDuplicateAction(action);
    try {
      await AsyncStorage.setItem('batchDuplicateAction', action);
    } catch (error) {
      console.error('Save duplicate action setting error:', error);
    }
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: isDark ? '#343A44' : colors.border },
    thumbColor: '#fff',
    ios_backgroundColor: isDark ? '#343A44' : colors.border,
  };
  // 중복 처리 방식 (한 가지 선택)
  const duplicateActions = [
    { id: 'alert', icon: 'alert-circle-outline', labelKey: 'batchScan.actionAlert' },
    { id: 'skip', icon: 'play-skip-forward-outline', labelKey: 'batchScan.actionSkip' },
    { id: 'allow', icon: 'checkmark-done-outline', labelKey: 'batchScan.actionAllow' },
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
          {t('batchScan.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 배치 스캔 활성화 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('batchScan.enable')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('batchScan.enableDesc')}
              </Text>
            </View>
            <Switch
              value={batchScanEnabled}
              onValueChange={handleBatchScanToggle}
              {...switchColors}
            />
          </View>
        </View>

        {/* 배치 스캔 옵션 - 활성화 시에만 표시 */}
        {batchScanEnabled && (
          <>
            {/* 스캔 카운터 */}
            <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('batchScan.displayOptions')}
            </Text>
            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.row, s.rowWithDesc]}>
                <View style={s.rowText}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('batchScan.showCounter')}
                  </Text>
                  <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('batchScan.showCounterDesc')}
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
              {t('batchScan.duplicateSection')}
            </Text>
            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.row, s.rowWithDesc]}>
                <View style={s.rowText}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('batchScan.duplicateDetection')}
                  </Text>
                  <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('batchScan.duplicateDetectionDesc')}
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
                  {t('batchScan.duplicateAction')}
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
                          {t(action.labelKey)}
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
                {t('batchScan.infoMessage')}
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
