// screens/LabelCategoriesScreen.js - 라벨 카테고리 목록 (자동 분리 토글 · 발견된 형식 · 카테고리 · 묻지 않기한 형식)
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import {
  describeSignature,
  splitLabel,
  fieldNameAt,
  formatLabelSummary,
} from '../utils/labelParser';
import {
  loadLabelSettings,
  createCategoryFromCode,
  deleteCategory,
  ignorePattern,
  restorePattern,
  setAutoSplit,
} from '../utils/labelCategories';

export default function LabelCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };

  const [categories, setCategories] = useState([]);
  const [ignored, setIgnored] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [autoSplit, setAutoSplitState] = useState(true);

  const reload = useCallback(async () => {
    try {
      const settings = await loadLabelSettings();
      setCategories(settings.categories);
      setIgnored(settings.ignored);
      setDiscovered(settings.discovered);
      setAutoSplitState(settings.autoSplit);
    } catch (error) {
      console.error('[LabelCategories] load error:', error);
    }
  }, []);

  // 편집 화면에서 돌아올 때마다 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleAutoSplit = async (value) => {
    setAutoSplitState(value);
    try {
      await setAutoSplit(value);
    } catch (error) {
      console.error('[LabelCategories] autoSplit error:', error);
    }
  };

  const handleCreateFromDiscovered = async (item) => {
    try {
      const category = await createCategoryFromCode(item.sample, t);
      await reload();
      if (category) {
        feedback.success(t('labelCategories.created', { name: category.name }));
      }
    } catch (error) {
      console.error('[LabelCategories] create error:', error);
    }
  };

  const handleIgnore = async (signature) => {
    try {
      await ignorePattern(signature);
      await reload();
    } catch (error) {
      console.error('[LabelCategories] ignore error:', error);
    }
  };

  const handleRestore = async (signature) => {
    try {
      await restorePattern(signature);
      await reload();
    } catch (error) {
      console.error('[LabelCategories] restore error:', error);
    }
  };

  const handleDelete = (category) => {
    Alert.alert(
      t('labelCategories.deleteConfirmTitle'),
      t('labelCategories.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              await reload();
            } catch (error) {
              console.error('[LabelCategories] delete error:', error);
            }
          },
        },
      ]
    );
  };

  const previewOf = (category) => {
    if (!category.sample) return '';
    return formatLabelSummary(
      { category, values: splitLabel(category.sample, category.delimiter) },
      3,
      t
    );
  };

  const keyFieldLabel = (category) => {
    const key = Number.isInteger(category.keyField) ? category.keyField : 0;
    return fieldNameAt(category, key, t);
  };

  const groupStyle = [styles.group, { backgroundColor: colors.surface, borderColor: colors.border }];
  const separator = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight };
  const sectionHeaderStyle = [styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('labelCategories.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* 자동 분리 토글 */}
        <View style={groupStyle}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('labelCategories.autoSplit')}
              </Text>
              <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('labelCategories.autoSplitDesc')}
              </Text>
            </View>
            <Switch
              value={autoSplit}
              onValueChange={handleAutoSplit}
              {...switchColors}
              accessibilityLabel={t('labelCategories.autoSplit')}
            />
          </View>
        </View>

        {/* 안내 */}
        <View style={[styles.infoBox, { backgroundColor: colors.raised }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.intro, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('labelCategories.intro')}
          </Text>
        </View>

        {/* 발견된 형식 */}
        {discovered.length > 0 && (
          <>
            <Text accessibilityRole="header" style={sectionHeaderStyle}>
              {t('labelCategories.discovered')}
            </Text>
            <View style={groupStyle}>
              <Text style={[styles.desc, styles.groupDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('labelCategories.discoveredDesc')}
              </Text>
              {discovered.map((item) => (
                <View key={item.signature} style={[styles.discoveredItem, separator]}>
                  <Text style={[styles.itemTitle, { color: colors.text, fontFamily: fonts.medium }]}>
                    {describeSignature(item.signature)}
                  </Text>
                  <Text
                    style={[styles.mono, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {item.sample}
                  </Text>
                  <View style={styles.buttonRow}>
                    <MaterialPressable
                      onPress={() => handleCreateFromDiscovered(item)}
                      style={[styles.actionButton, { backgroundColor: colors.primary }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('labelCategories.create')}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={[styles.actionButtonText, { color: '#FFFFFF', fontFamily: fonts.semiBold }]}>
                        {t('labelCategories.create')}
                      </Text>
                    </MaterialPressable>
                    <MaterialPressable
                      onPress={() => handleIgnore(item.signature)}
                      style={[styles.actionButton, styles.actionButtonOutline, { backgroundColor: colors.raised, borderColor: colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('labelCategories.neverAsk')}
                    >
                      <Text style={[styles.actionButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                        {t('labelCategories.neverAsk')}
                      </Text>
                    </MaterialPressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 카테고리 목록 */}
        <Text accessibilityRole="header" style={sectionHeaderStyle}>
          {t('labelCategories.title')}
        </Text>
        {categories.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="pricetags-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('labelCategories.noCategories')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('labelCategories.noCategoriesDesc')}
            </Text>
          </View>
        ) : (
          <View style={groupStyle}>
            {categories.map((category, index) => {
              const preview = previewOf(category);
              return (
                <View
                  key={category.id}
                  style={[styles.categoryRow, index > 0 && separator]}
                >
                  <MaterialPressable
                    onPress={() => router.push({ pathname: '/label-category-edit', params: { id: category.id } })}
                    style={styles.categoryMain}
                    accessibilityRole="button"
                    accessibilityLabel={`${category.name} · ${t('labelCategories.edit')}`}
                  >
                    <Text style={[styles.itemTitle, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                      {describeSignature(category.signature)} · {t('labelCategories.savedCount', { count: category.count || 0 })}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                      {t('labelCategories.keyField')}: {keyFieldLabel(category)}
                    </Text>
                    {!!preview && (
                      <View style={[styles.previewBox, { backgroundColor: colors.raised }]}>
                        <Text
                          style={[styles.preview, { color: colors.textSecondary, fontFamily: fonts.regular }]}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {preview}
                        </Text>
                      </View>
                    )}
                  </MaterialPressable>
                  <MaterialPressable
                    onPress={() => handleDelete(category)}
                    style={styles.deleteButton}
                    borderless
                    accessibilityRole="button"
                    accessibilityLabel={`${t('common.delete')} ${category.name}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </MaterialPressable>
                </View>
              );
            })}
          </View>
        )}

        {/* 묻지 않기한 형식 */}
        {ignored.length > 0 && (
          <>
            <Text accessibilityRole="header" style={sectionHeaderStyle}>
              {t('labelCategories.ignoredPatterns')}
            </Text>
            <View style={groupStyle}>
              {ignored.map((signature, index) => (
                <View
                  key={signature}
                  style={[styles.ignoredRow, index > 0 && separator]}
                >
                  <Text style={[styles.itemTitle, { color: colors.text, fontFamily: fonts.medium, flex: 1 }]}>
                    {describeSignature(signature) || signature}
                  </Text>
                  <MaterialPressable
                    onPress={() => handleRestore(signature)}
                    style={[styles.actionButton, styles.actionButtonOutline, { backgroundColor: colors.raised, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('labelCategories.restore')}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>
                      {t('labelCategories.restore')}
                    </Text>
                  </MaterialPressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerRight: { width: SIZE.touch },
  container: { flex: 1 },
  content: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  sectionHeader: { ...TYPE.sectionHeader, marginTop: 14, marginHorizontal: 4, marginBottom: 8 },
  group: { borderRadius: RADIUS.group, borderWidth: 1, overflow: 'hidden' },
  groupDesc: { paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: SIZE.rowWithDesc, paddingVertical: 10, paddingHorizontal: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...TYPE.body },
  desc: { ...TYPE.caption, lineHeight: 17 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: RADIUS.control, paddingHorizontal: 14, paddingVertical: 12, marginTop: SPACE.gap },
  intro: { flex: 1, fontSize: 13, lineHeight: 19 },
  discoveredItem: { paddingVertical: 12, paddingHorizontal: 16 },
  itemTitle: { ...TYPE.body },
  mono: { fontSize: 13, fontFamily: MONO, marginTop: 4 },
  meta: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  previewBox: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: RADIUS.badge, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  preview: { fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: SPACE.gap, marginTop: 10 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: SIZE.touch, paddingHorizontal: 14, borderRadius: RADIUS.control, gap: 4, overflow: 'hidden' },
  actionButtonOutline: { borderWidth: 1 },
  actionButtonText: { fontSize: 13, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.rowWithDesc, paddingRight: 6 },
  categoryMain: { flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 16, paddingRight: 8 },
  deleteButton: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ignoredRow: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.row, paddingVertical: 6, paddingHorizontal: 16, gap: 10 },
  emptyCard: { borderRadius: RADIUS.card, borderWidth: 1, alignItems: 'center', padding: SPACE.card, paddingVertical: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});
