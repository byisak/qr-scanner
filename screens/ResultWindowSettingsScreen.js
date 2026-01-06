// screens/ResultWindowSettingsScreen.js - 결과창 자동 열림 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResultWindowSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
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
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {t('resultWindowSettings.title')}
        </Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* 결과창 자동 열림 활성화 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={[s.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="open-outline" size={22} color={colors.primary} />
              </View>
              <View style={s.rowTextContainer}>
                <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {t('resultWindowSettings.enable')}
                </Text>
                <Text style={[s.rowDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('resultWindowSettings.enableDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={resultWindowAutoOpen}
              onValueChange={handleToggle}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 안내 메시지 */}
        <View style={[s.infoBox, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[s.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('resultWindowSettings.infoMessage')}
          </Text>
        </View>

        <View style={{ height: 40 }} />
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
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
