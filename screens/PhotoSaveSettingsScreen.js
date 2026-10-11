// screens/PhotoSaveSettingsScreen.js - 사진 저장 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';

// 압축률 옵션 (5단계)
const QUALITY_OPTIONS = [
  { key: '1.0', quality: 1.0, label: 'photoSaveSettings.qualityOriginal', desc: 'photoSaveSettings.qualityOriginalDesc', size: '~3MB' },
  { key: '0.8', quality: 0.8, label: 'photoSaveSettings.qualityHigh', desc: 'photoSaveSettings.qualityHighDesc', size: '~1.5MB' },
  { key: '0.6', quality: 0.6, label: 'photoSaveSettings.qualityMedium', desc: 'photoSaveSettings.qualityMediumDesc', size: '~800KB' },
  { key: '0.4', quality: 0.4, label: 'photoSaveSettings.qualityLow', desc: 'photoSaveSettings.qualityLowDesc', size: '~400KB' },
  { key: '0.2', quality: 0.2, label: 'photoSaveSettings.qualityMinimum', desc: 'photoSaveSettings.qualityMinimumDesc', size: '~200KB' },
];

export default function PhotoSaveSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(true); // 기본값: 켬
  const [selectedQuality, setSelectedQuality] = useState('0.8');

  useEffect(() => {
    (async () => {
      try {
        const enabled = await AsyncStorage.getItem('photoSaveEnabled');
        setPhotoSaveEnabled(enabled === null ? true : enabled === 'true');

        const quality = await AsyncStorage.getItem('photoQuality');
        if (quality !== null) {
          setSelectedQuality(quality);
        }
      } catch (error) {
        console.error('Load photo settings error:', error);
      }
    })();
  }, []);

  // 사진 저장 토글 변경 시 저장
  const handleToggleChange = async (value) => {
    setPhotoSaveEnabled(value);
    try {
      await AsyncStorage.setItem('photoSaveEnabled', value.toString());
    } catch (error) {
      console.error('Save photo enabled settings error:', error);
      setPhotoSaveEnabled(!value);
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 압축률 선택 시 저장
  const selectQuality = async (key) => {
    const prevQuality = selectedQuality;
    setSelectedQuality(key);
    try {
      await AsyncStorage.setItem('photoQuality', key);
    } catch (error) {
      console.error('Save photo quality settings error:', error);
      setSelectedQuality(prevQuality);
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
          {t('photoSaveSettings.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 사진 저장 토글 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('photoSaveSettings.enablePhotoSave')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('photoSaveSettings.enablePhotoSaveDesc')}
              </Text>
            </View>
            <Switch
              value={photoSaveEnabled}
              onValueChange={handleToggleChange}
              {...switchColors}
            />
          </View>
        </View>

        {/* 압축률 선택 (사진 저장 활성화 시에만 표시) */}
        {photoSaveEnabled && (
          <>
            <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('photoSaveSettings.compressionLevel')}
            </Text>
            <Text style={[s.sectionInfo, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('photoSaveSettings.compressionInfo')}
            </Text>

            <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {QUALITY_OPTIONS.map((option, index) => {
                const isSelected = selectedQuality === option.key;

                return (
                  <MaterialPressable
                    key={option.key}
                    style={[
                      s.row,
                      s.rowWithDesc,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
                    ]}
                    onPress={() => selectQuality(option.key)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={s.rowText}>
                      <View style={s.qualityHeader}>
                        <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                          {t(option.label)}
                        </Text>
                        <Text style={[s.qualitySize, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                          {option.size}
                        </Text>
                      </View>
                      <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                        {t(option.desc)}
                      </Text>
                    </View>
                    <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.textTertiary }]}>
                      {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                    </View>
                  </MaterialPressable>
                );
              })}
            </View>

            <View style={[s.infoBox, { backgroundColor: colors.raised }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('photoSaveSettings.note')}
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
  sectionInfo: {
    fontSize: 13,
    lineHeight: 18,
    marginHorizontal: 4,
  },
  qualityHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  qualitySize: {
    fontSize: 12,
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
