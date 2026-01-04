// screens/TermsOfServiceScreen.js - 서비스 이용약관 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const statusBarHeight = Platform.OS === 'ios' ? 50 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('settings.termsOfService') || '서비스 이용약관'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
          {t('termsContent.lastUpdated')}
        </Text>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article1Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article1Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article2Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article2Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article3Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article3Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article4Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article4Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article5Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article5Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article6Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article6Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article7Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article7Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article8Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article8Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.article9Title')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.article9Content')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('termsContent.supplementTitle')}
          </Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('termsContent.supplementContent')}
          </Text>
        </View>

        <View style={styles.bottomSpace} />
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
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 24,
  },
  bottomSpace: {
    height: 40,
  },
});
