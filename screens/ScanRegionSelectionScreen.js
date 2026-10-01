// screens/ScanRegionSelectionScreen.js - 스캔 영역 선택 (전체 / 가운데 사각형 / 가로 띠)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import MaterialPressable from '../components/MaterialPressable';
import { SCAN_REGION_MODES, computeScanRegion } from '../components/ScanRegionOverlay';

export const SCAN_REGION_MODE_KEY = 'scanRegionMode';

// 작은 미리보기: 화면 모양 안에 영역을 그린다
function RegionPreview({ mode, active, colors }) {
  const W = 40;
  const H = 64;
  const region = computeScanRegion(mode, W, H);
  const line = active ? colors.primary : colors.textSecondary;
  return (
    <View style={[s.preview, { width: W, height: H, borderColor: line }]}>
      {region ? (
        <View style={[s.previewRegion, { left: region.x, top: region.y, width: region.width, height: region.height, borderColor: line }]} />
      ) : (
        <View style={[s.previewRegion, { left: 3, top: 3, right: 3, bottom: 3, borderColor: line, borderStyle: 'dashed' }]} />
      )}
    </View>
  );
}

export default function ScanRegionSelectionScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const [selectedMode, setSelectedMode] = useState('full');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(SCAN_REGION_MODE_KEY);
        if (saved && SCAN_REGION_MODES.includes(saved)) setSelectedMode(saved);
      } catch (error) {
        console.error('Load scan region mode error:', error);
      }
    })();
  }, []);

  const selectMode = async (mode) => {
    try {
      await AsyncStorage.setItem(SCAN_REGION_MODE_KEY, mode);
      setSelectedMode(mode);
    } catch (error) {
      console.error('Save scan region mode error:', error);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('scanRegion.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        <View style={s.section}>
          <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('scanRegion.description')}
          </Text>

          {SCAN_REGION_MODES.map((mode) => {
            const isSelected = selectedMode === mode;
            return (
              <MaterialPressable
                key={mode}
                style={[
                  s.modeItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { borderColor: colors.primary, backgroundColor: isDark ? '#0A1929' : '#f0f8ff' },
                ]}
                onPress={() => selectMode(mode)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <RegionPreview mode={mode} active={isSelected} colors={colors} />
                <View style={s.modeInfo}>
                  <Text style={[s.modeName, { color: isSelected ? colors.primary : colors.text, fontFamily: fonts.semiBold }]}>
                    {t(`scanRegion.${mode}`)}
                  </Text>
                  <Text style={[s.modeDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t(`scanRegion.${mode}Desc`)}
                  </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'android' ? { borderRadius: 20, overflow: 'hidden' } : {}),
  },
  headerTitle: {
    fontSize: 18,
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
    ...(Platform.OS === 'android' ? { minHeight: 56 } : {}),
  },
  preview: {
    borderWidth: 1.5,
    borderRadius: 6,
    marginRight: 16,
    overflow: 'hidden',
  },
  previewRegion: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 3,
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    fontSize: 17,
    marginBottom: 4,
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
