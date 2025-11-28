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
import { languages } from '../locales';

export default function LanguageSelectionScreen() {
  const router = useRouter();
  const { language, changeLanguage, t } = useLanguage();

  const selectLanguage = async (languageCode) => {
    await changeLanguage(languageCode);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('languageSelection.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <Text style={s.info}>
            {t('languageSelection.description')}
          </Text>

          {languages.map((lang) => {
            const isSelected = language === lang.code;

            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.languageItem, isSelected && s.languageItemSelected]}
                onPress={() => selectLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <View style={s.languageIcon}>
                  <Ionicons
                    name="language"
                    size={32}
                    color={isSelected ? '#007AFF' : '#666'}
                  />
                </View>
                <View style={s.languageInfo}>
                  <View style={s.languageHeader}>
                    <Text style={[s.languageName, isSelected && s.languageNameSelected]}>
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
                  <Text style={s.languageDesc}>{lang.nativeName}</Text>
                </View>
                <View style={[s.radio, isSelected && s.radioSelected]}>
                  {isSelected && <View style={s.radioDot} />}
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
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    color: '#000',
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
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  languageItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  languageIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
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
    color: '#333',
  },
  languageNameSelected: {
    color: '#007AFF',
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
    color: '#666',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
});
