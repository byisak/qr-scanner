// screens/LanguageSelectionScreen.js - 언어 선택 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../locales';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { language, changeLanguage, t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  const selectLanguage = async (languageCode) => {
    await changeLanguage(languageCode);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            onPress={() => router.back()}
            style={s.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('languageSelection.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('languageSelection.description')}
        </Text>

        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {languages.map((lang, index) => {
            const isSelected = language === lang.code;
            const isLast = index === languages.length - 1;

            return (
              <MaterialPressable
                key={lang.code}
                style={[s.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
                onPress={() => selectLanguage(lang.code)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {lang.name}
                  </Text>
                  <Text style={[s.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{lang.nativeName}</Text>
                </View>
                <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.textTertiary }]}>
                  {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
              </MaterialPressable>
            );
          })}
        </View>
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
  },
  info: {
    fontSize: 14,
    lineHeight: 21,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    ...TYPE.body,
  },
  rowDesc: {
    ...TYPE.caption,
    lineHeight: 17,
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
