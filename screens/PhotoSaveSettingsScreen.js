// screens/PhotoSaveSettingsScreen.js - 사진 저장 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

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
  const { isDark } = useTheme();
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
    }
  };

  // 압축률 선택 시 저장
  const selectQuality = async (key) => {
    setSelectedQuality(key);
    try {
      await AsyncStorage.setItem('photoQuality', key);
    } catch (error) {
      console.error('Save photo quality settings error:', error);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {t('photoSaveSettings.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* 사진 저장 토글 */}
        <View style={[s.toggleSection, { backgroundColor: colors.surface }]}>
          <View style={s.toggleRow}>
            <View style={s.toggleInfo}>
              <Text style={[s.toggleLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('photoSaveSettings.enablePhotoSave')}
              </Text>
              <Text style={[s.toggleDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('photoSaveSettings.enablePhotoSaveDesc')}
              </Text>
            </View>
            <Switch
              value={photoSaveEnabled}
              onValueChange={handleToggleChange}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 압축률 선택 (사진 저장 활성화 시에만 표시) */}
        {photoSaveEnabled && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
              {t('photoSaveSettings.compressionLevel')}
            </Text>
            <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('photoSaveSettings.compressionInfo')}
            </Text>

            {QUALITY_OPTIONS.map((option) => {
              const isSelected = selectedQuality === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    s.qualityItem,
                    { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { backgroundColor: isDark ? 'rgba(0, 122, 255, 0.2)' : '#f0f8ff' }
                  ]}
                  onPress={() => selectQuality(option.key)}
                  activeOpacity={0.7}
                >
                  <View style={s.qualityInfo}>
                    <View style={s.qualityHeader}>
                      <Text style={[s.qualityLabel, { color: isSelected ? colors.primary : colors.text, fontFamily: fonts.semiBold }]}>
                        {t(option.label)}
                      </Text>
                      <Text style={[s.qualitySize, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                        {option.size}
                      </Text>
                    </View>
                    <Text style={[s.qualityDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t(option.desc)}
                    </Text>
                  </View>
                  <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.borderLight }]}>
                    {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={[s.noteBox, { backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : '#fff9e6' }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={[s.noteText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('photoSaveSettings.note')}
              </Text>
            </View>
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  toggleSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  qualityInfo: {
    flex: 1,
  },
  qualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  qualityLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  qualitySize: {
    fontSize: 13,
  },
  qualityDesc: {
    fontSize: 14,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    lineHeight: 18,
  },
});
