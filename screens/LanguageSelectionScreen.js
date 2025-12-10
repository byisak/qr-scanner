// screens/LanguageSelectionScreen.js - 언어 선택 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../locales';
import { Colors } from '../constants/Colors';

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { language, changeLanguage, t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const selectLanguage = async (languageCode) => {
    await changeLanguage(languageCode);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('languageSelection.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <Text style={[s.info, { color: colors.textSecondary }]}>
            {t('languageSelection.description')}
          </Text>

          {languages.map((lang) => {
            const isSelected = language === lang.code;

            return (
              <TouchableOpacity
                key={lang.code}
                style={[
                  s.languageItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { borderColor: colors.primary, backgroundColor: isDark ? '#0A1929' : '#f0f8ff' }
                ]}
                onPress={() => selectLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <View style={[s.languageIcon, { backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5' }]}>
                  <Ionicons
                    name="language"
                    size={32}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={s.languageInfo}>
                  <View style={s.languageHeader}>
                    <Text style={[s.languageName, { color: isSelected ? colors.primary : colors.text }]}>
                      {lang.name}
                    </Text>
                    {isSelected && (
                      <View style={s.selectedBadge}>
                        <Text style={s.selectedBadgeText}>
                          {t('languageSelection.selected')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.languageDesc, { color: colors.textSecondary }]}>{lang.nativeName}</Text>
                </View>
                <View style={[s.radio, { borderColor: isSelected ? colors.primary : colors.textTertiary }]}>
                  {isSelected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
              </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  info: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  languageIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  languageInfo: {
    flex: 1,
  },
  languageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  languageName: {
    fontSize: 17,
    fontWeight: '600',
  },
  selectedBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#34C759',
    borderRadius: 10,
  },
  selectedBadgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  languageDesc: {
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
});
