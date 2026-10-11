// screens/ResultWindowSettingsScreen.js - 결과창 자동 열림 설정 화면
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
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from '../components/MaterialPressable';

export default function ResultWindowSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // 상태 - 기본값은 true (자동 열림)
  const [resultWindowAutoOpen, setResultWindowAutoOpen] = useState(true);

  // 설정 로드
  useEffect(() => {
    (async () => {
      try {
        const autoOpen = await AsyncStorage.getItem('resultWindowAutoOpen');
        // 값이 없으면 기본값 true (기존 동작 유지)
        if (autoOpen !== null) {
          setResultWindowAutoOpen(autoOpen === 'true');
        }
      } catch (error) {
        console.error('Load result window settings error:', error);
      }
    })();
  }, []);

  // 설정 저장
  const handleToggle = async (value) => {
    setResultWindowAutoOpen(value);
    try {
      await AsyncStorage.setItem('resultWindowAutoOpen', value.toString());
    } catch (error) {
      console.error('Save result window setting error:', error);
      setResultWindowAutoOpen(!value);
      feedback.error(t('settings.saveFailed'));
    }
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: isDark ? '#343A44' : colors.border },
    thumbColor: '#fff',
    ios_backgroundColor: isDark ? '#343A44' : colors.border,
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
          {t('resultWindowSettings.title')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 결과창 자동 열림 활성화 */}
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('resultWindowSettings.enable')}
              </Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('resultWindowSettings.enableDesc')}
              </Text>
            </View>
            <Switch
              value={resultWindowAutoOpen}
              onValueChange={handleToggle}
              {...switchColors}
            />
          </View>
        </View>

        {/* 안내 메시지 */}
        <View style={[s.infoBox, { backgroundColor: colors.raised }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('resultWindowSettings.infoMessage')}
          </Text>
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
    gap: SPACE.gap,
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
