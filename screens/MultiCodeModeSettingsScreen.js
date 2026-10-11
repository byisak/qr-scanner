// screens/MultiCodeModeSettingsScreen.js - 여러 코드 인식 모드 설정 화면
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

export default function MultiCodeModeSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // 상태
  const [multiCodeModeEnabled, setMultiCodeModeEnabled] = useState(false);
  const [showBarcodeValues, setShowBarcodeValues] = useState(true);

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const multiCodeMode = await AsyncStorage.getItem('multiCodeModeEnabled');
        const showValues = await AsyncStorage.getItem('multiCodeShowValues');

        if (multiCodeMode !== null) setMultiCodeModeEnabled(multiCodeMode === 'true');
        if (showValues !== null) setShowBarcodeValues(showValues === 'true');
        else setShowBarcodeValues(true); // 기본값: true
      } catch (error) {
        console.error('Load multi-code mode settings error:', error);
      }
    })();
  }, []);

  // 여러 코드 인식 모드 활성화 저장
  const handleMultiCodeModeToggle = async (value) => {
    setMultiCodeModeEnabled(value);
    try {
      await AsyncStorage.setItem('multiCodeModeEnabled', value.toString());

      // 다른 고급 스캔 기능 비활성화 (상호 배타적)
      if (value) {
        await AsyncStorage.setItem('continuousScanEnabled', 'false');
        await AsyncStorage.setItem('batchScanEnabled', 'false');
        await SecureStore.setItemAsync('scanLinkEnabled', 'false');
        await AsyncStorage.setItem('realtimeSyncEnabled', 'false');
        await AsyncStorage.setItem('lotteryScanEnabled', 'false');
      }
    } catch (error) {
      console.error('Save multi-code mode enabled error:', error);
      // 여러 키가 연쇄로 바뀌므로 상태는 되돌리지 않고 안내만
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 바코드 값 표시 저장
  const handleShowBarcodeValuesToggle = async (value) => {
    setShowBarcodeValues(value);
    try {
      await AsyncStorage.setItem('multiCodeShowValues', value.toString());
    } catch (error) {
      console.error('Save show barcode values setting error:', error);
      setShowBarcodeValues(!value);
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };

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
          {t('multiCodeMode.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 여러 코드 인식 모드 활성화 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('multiCodeMode.enable')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('multiCodeMode.enableDesc')}
              </Text>
            </View>
            <Switch
              value={multiCodeModeEnabled}
              onValueChange={handleMultiCodeModeToggle}
              {...switchColors}
            />
          </View>
        </View>

        {/* 여러 코드 인식 모드 옵션 - 활성화 시에만 표시 */}
        {multiCodeModeEnabled && (
          <>
            {/* 표시 옵션 */}
            <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('multiCodeMode.displayOptions')}
            </Text>
            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.row, s.rowWithDesc]}>
                <View style={s.rowText}>
                  <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('multiCodeMode.showValues')}
                  </Text>
                  <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('multiCodeMode.showValuesDesc')}
                  </Text>
                </View>
                <Switch
                  value={showBarcodeValues}
                  onValueChange={handleShowBarcodeValuesToggle}
                  {...switchColors}
                />
              </View>
            </View>

            {/* 안내 메시지 */}
            <View style={[s.infoBox, { backgroundColor: colors.raised }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('multiCodeMode.infoMessage')}
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
});
