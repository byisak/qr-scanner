// screens/ScanRegionSelectionScreen.js - 스캔 영역 선택 (전체 / 가운데 사각형 / 가로 띠)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { SCAN_REGION_MODES, computeScanRegion } from '../components/ScanRegionOverlay';

export const SCAN_REGION_MODE_KEY = 'scanRegionMode';

const PREVIEW_BORDER = 1.5;

// 작은 미리보기: 화면 모양 안에 영역을 그린다
function RegionPreview({ mode, active, colors }) {
  const W = 30;
  const H = 48;
  // 안쪽 사각형은 테두리 안쪽(패딩 박스) 기준으로 놓이므로, 테두리 두께를 뺀 크기로 계산해야 가운데에 온다
  // (바깥 크기로 계산하면 테두리만큼 오른쪽 아래로 밀리고 오른쪽 끝이 잘렸다)
  const region = computeScanRegion(mode, W - PREVIEW_BORDER * 2, H - PREVIEW_BORDER * 2);
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
          {t('scanRegion.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={[s.info, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('scanRegion.description')}
        </Text>

        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {SCAN_REGION_MODES.map((mode, index) => {
            const isSelected = selectedMode === mode;
            const isLast = index === SCAN_REGION_MODES.length - 1;
            return (
              <MaterialPressable
                key={mode}
                style={[s.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
                onPress={() => selectMode(mode)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, checked: isSelected }}
              >
                <RegionPreview mode={mode} active={isSelected} colors={colors} />
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t(`scanRegion.${mode}`)}
                  </Text>
                  <Text style={[s.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
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
  preview: {
    borderWidth: PREVIEW_BORDER,
    borderRadius: 6,
    overflow: 'hidden',
  },
  previewRegion: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 3,
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
