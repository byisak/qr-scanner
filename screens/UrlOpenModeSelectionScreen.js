// screens/UrlOpenModeSelectionScreen.js - URL open mode selection screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

const urlOpenModes = [
  {
    id: 'inApp',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'browser',
    icon: 'globe-outline',
  },
];

export default function UrlOpenModeSelectionScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [selectedMode, setSelectedMode] = useState('inApp');

  useEffect(() => {
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem('urlOpenMode');
        if (savedMode) {
          setSelectedMode(savedMode);
        }
      } catch (error) {
        console.error('Load URL open mode error:', error);
      }
    })();
  }, []);

  const selectMode = async (mode) => {
    try {
      await AsyncStorage.setItem('urlOpenMode', mode);
      setSelectedMode(mode);
    } catch (error) {
      console.error('Save URL open mode error:', error);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('urlOpenMode.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <Text style={[s.info, { color: colors.textSecondary }]}>
            {t('urlOpenMode.description')}
          </Text>

          {urlOpenModes.map((mode) => {
            const isSelected = selectedMode === mode.id;

            return (
              <TouchableOpacity
                key={mode.id}
                style={[
                  s.modeItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { borderColor: colors.primary, backgroundColor: isDark ? '#0A1929' : '#f0f8ff' }
                ]}
                onPress={() => selectMode(mode.id)}
                activeOpacity={0.7}
              >
                <View style={[s.modeIcon, { backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5' }]}>
                  <Ionicons
                    name={mode.icon}
                    size={32}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={s.modeInfo}>
                  <View style={s.modeHeader}>
                    <Text style={[s.modeName, { color: isSelected ? colors.primary : colors.text }]}>
                      {t(`urlOpenMode.${mode.id}`)}
                    </Text>
                    {isSelected && (
                      <View style={s.selectedBadge}>
                        <Text style={s.selectedBadgeText}>
                          {t('urlOpenMode.selected')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.modeDesc, { color: colors.textSecondary }]}>
                    {t(`urlOpenMode.${mode.id}Desc`)}
                  </Text>
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
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modeInfo: {
    flex: 1,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeName: {
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
  modeDesc: {
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
