// screens/TermsOfServiceScreen.js - 서비스 이용약관 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 · 빈 자리 */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('settings.termsOfService') || '서비스 이용약관'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('termsContent.lastUpdated')}
        </Text>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article1Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article1Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article2Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article2Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article3Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article3Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article4Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article4Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article5Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article5Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article6Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article6Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article7Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article7Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article8Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article8Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.article9Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.article9Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('termsContent.supplementTitle')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('termsContent.supplementContent')}
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerButton: {
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
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 24,
  },
});
