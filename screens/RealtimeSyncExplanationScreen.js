// screens/RealtimeSyncExplanationScreen.js - 실시간 서버전송 기능 설명 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RealtimeSyncExplanationScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [enableToggle, setEnableToggle] = useState(false);

  const handleToggle = async (value) => {
    setEnableToggle(value);
    if (value) {
      await AsyncStorage.setItem('realtimeSyncExplained', 'true');
      router.replace('/realtime-sync-settings');
    }
  };

  const features = [
    {
      icon: 'cloud-upload-outline',
      title: t('realtimeSyncExplanation.feature1Title'),
      description: t('realtimeSyncExplanation.feature1Desc'),
    },
    {
      icon: 'flash-outline',
      title: t('realtimeSyncExplanation.feature2Title'),
      description: t('realtimeSyncExplanation.feature2Desc'),
    },
    {
      icon: 'desktop-outline',
      title: t('realtimeSyncExplanation.feature3Title'),
      description: t('realtimeSyncExplanation.feature3Desc'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: t('realtimeSyncExplanation.feature4Title'),
      description: t('realtimeSyncExplanation.feature4Desc'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('settings.enableRealtimeSync')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 대표 아이콘 */}
        <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="sync" size={26} color={colors.primaryText} />
        </View>

        {/* 제목 */}
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('realtimeSyncExplanation.title')}
        </Text>

        {/* 설명 */}
        <Text style={[styles.description, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('realtimeSyncExplanation.description')}
        </Text>

        {/* 기능 목록: 묶음 카드 하나 */}
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {features.map((feature, index) => (
            <View
              key={index}
              style={[styles.featureItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={feature.icon} size={18} color={colors.primaryText} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text, fontFamily: fonts.medium }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 하단 사용해보기 버튼 */}
      <View style={[styles.bottomContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <MaterialPressable
          style={[styles.primaryButton, { backgroundColor: enableToggle ? colors.raised : colors.primary }]}
          onPress={() => handleToggle(true)}
          disabled={enableToggle}
          accessibilityRole="button"
          accessibilityState={{ disabled: enableToggle }}
        >
          <Text style={[styles.primaryButtonText, { color: enableToggle ? colors.textTertiary : '#FFFFFF', fontFamily: fonts.semiBold }]}>
            {t('realtimeSyncExplanation.tryIt')}
          </Text>
        </MaterialPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: SIZE.touch,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  title: {
    ...TYPE.tabTitle,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginHorizontal: 4,
    marginBottom: 24,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  featureTitle: {
    ...TYPE.body,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomContainer: {
    paddingTop: 12,
    paddingHorizontal: SPACE.screen,
  },
  primaryButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
