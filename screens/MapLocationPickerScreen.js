// screens/MapLocationPickerScreen.js - Map location picker placeholder
// TODO: Uncomment expo-maps code when using development build
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';

export default function MapLocationPickerScreen() {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          {t('generator.selectLocation') || 'Select Location'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Development Build Required Message */}
      <View style={s.messageContainer}>
        <View style={[s.iconContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="map-outline" size={64} color={colors.primary} />
        </View>

        <Text style={[s.title, { color: colors.text }]}>
          개발 빌드 필요
        </Text>

        <Text style={[s.description, { color: colors.textSecondary }]}>
          지도 기능은 Expo Go에서 사용할 수 없습니다.{'\n'}
          개발 빌드가 필요합니다.
        </Text>

        <View style={[s.infoBox, { backgroundColor: colors.surface }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[s.infoText, { color: colors.textSecondary }]}>
            개발 빌드를 사용하려면:{'\n'}
            <Text style={{ color: colors.text, fontWeight: '600' }}>npm run android</Text> 또는{' '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>npm run ios</Text>
          </Text>
        </View>

        <Text style={[s.note, { color: colors.textTertiary }]}>
          expo-maps는 네이티브 모듈이므로{'\n'}
          Expo Go 앱에서는 지원되지 않습니다.
        </Text>
      </View>
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
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
});

/*
==========================================================================
EXPO-MAPS CODE (For Development Build)
==========================================================================
Uncomment the code below when using development build (npm run android/ios)

import { GoogleMaps, AppleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Add all the state management and map rendering code here
// See git history for the full implementation

==========================================================================
*/
