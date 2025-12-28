// screens/RealtimeSyncExplanationScreen.js - 실시간 서버전송 기능 설명 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
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
      // TODO: 배포 시 아래 주석 해제 (개발 중에는 설명 페이지 계속 표시)
      // await AsyncStorage.setItem('realtimeSyncExplained', 'true');
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
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('settings.enableRealtimeSync')}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 메인 아이콘 */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="sync-circle" size={80} color={colors.primary} />
        </View>

        {/* 제목 */}
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('realtimeSyncExplanation.title')}
        </Text>

        {/* 설명 */}
        <Text style={[styles.description, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('realtimeSyncExplanation.description')}
        </Text>

        {/* 기능 목록 */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View
              key={index}
              style={[styles.featureItem, { backgroundColor: colors.surface }]}
            >
              <View style={[styles.featureIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={feature.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={[styles.featureTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
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

      {/* 하단 사용해보기 토글 */}
      <View style={[styles.bottomContainer, {
        backgroundColor: colors.surface,
        paddingBottom: insets.bottom + 16,
        borderTopColor: colors.borderLight,
      }]}>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('realtimeSyncExplanation.tryIt')}
            </Text>
            <Text style={[styles.toggleDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('realtimeSyncExplanation.tryItDesc')}
            </Text>
          </View>
          <Switch
            value={enableToggle}
            onValueChange={handleToggle}
            trackColor={{ true: colors.primary, false: isDark ? '#39393d' : '#E5E5EA' }}
            thumbColor="#fff"
          />
        </View>
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
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  featuresContainer: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomContainer: {
    paddingTop: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
