// screens/PrivacyPolicyScreen.js - 개인정보 처리방침 화면
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

export default function PrivacyPolicyScreen() {
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
          {t('settings.privacyPolicy') || '개인정보 처리방침'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {t('privacyContent.lastUpdated')}
        </Text>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section1Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section1Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section2Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section2Content')}{'\n\n'}
            <Text style={[styles.bold, { fontFamily: fonts.semiBold }]}>{t('privacyContent.section2Required')}</Text>{'\n'}
            {t('privacyContent.section2RequiredItems')}{'\n\n'}
            <Text style={[styles.bold, { fontFamily: fonts.semiBold }]}>{t('privacyContent.section2Optional')}</Text>{'\n'}
            {t('privacyContent.section2OptionalItems')}{'\n\n'}
            <Text style={[styles.bold, { fontFamily: fonts.semiBold }]}>{t('privacyContent.section2Auto')}</Text>{'\n'}
            {t('privacyContent.section2AutoItems')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section3Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section3Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section4Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section4Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section5Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section5Content')}{'\n\n'}
            <Text style={[styles.bold, { fontFamily: fonts.semiBold }]}>{t('privacyContent.section5Procedure')}</Text>{'\n'}
            {t('privacyContent.section5ProcedureContent')}{'\n\n'}
            <Text style={[styles.bold, { fontFamily: fonts.semiBold }]}>{t('privacyContent.section5Method')}</Text>{'\n'}
            {t('privacyContent.section5MethodContent')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section6Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section6Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section7Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section7Content')}{'\n\n'}
            <Text style={[styles.bold, { fontFamily: fonts.semiBold }]}>{t('privacyContent.section7Officer')}</Text>{'\n'}
            {t('privacyContent.section7OfficerInfo')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section8Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section8Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.section9Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.section9Content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('privacyContent.supplementTitle')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('privacyContent.supplementContent')}
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
  bold: {
    fontWeight: '600',
  },
});
