// screens/LabelCategoriesScreen.js - 라벨 카테고리 목록 (자동 분리 토글 · 발견된 형식 · 카테고리 · 묻지 않기한 형식)
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
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
  const switchTrack = {
    true: Platform.OS === 'android' ? colors.primary + '99' : colors.success,
    false: isDark ? '#39393d' : '#E5E5EA',
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

  const cardStyle = [styles.card, { backgroundColor: colors.surface }];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('labelCategories.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* 자동 분리 토글 */}
        <View style={cardStyle}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.label, { color: colors.text, fontFamily: fonts.bold }]}>
                {t('labelCategories.autoSplit')}
              </Text>
              <Text style={[styles.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('labelCategories.autoSplitDesc')}
              </Text>
            </View>
            <Switch
              value={autoSplit}
              onValueChange={handleAutoSplit}
              trackColor={switchTrack}
              thumbColor="#fff"
              accessibilityLabel={t('labelCategories.autoSplit')}
            />
          </View>
        </View>

        {/* 안내 */}
        <View style={cardStyle}>
          <Text style={[styles.intro, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('labelCategories.intro')}
          </Text>
        </View>

        {/* 발견된 형식 */}
        {discovered.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
              {t('labelCategories.discovered')}
            </Text>
            <View style={cardStyle}>
              <Text style={[styles.desc, { color: colors.textTertiary, fontFamily: fonts.regular, marginBottom: 4 }]}>
                {t('labelCategories.discoveredDesc')}
              </Text>
              {discovered.map((item, index) => (
                <View
                  key={item.signature}
                  style={[
                    styles.discoveredItem,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight },
                  ]}
                >
                  <Text style={[styles.itemTitle, { color: colors.text, fontFamily: fonts.bold }]}>
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
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={[styles.actionButtonText, { color: '#fff', fontFamily: fonts.medium }]}>
                        {t('labelCategories.create')}
                      </Text>
                    </MaterialPressable>
                    <MaterialPressable
                      onPress={() => handleIgnore(item.signature)}
                      style={[styles.actionButton, styles.actionButtonOutline, { borderColor: colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('labelCategories.neverAsk')}
                    >
                      <Text style={[styles.actionButtonText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
          {t('labelCategories.title')}
        </Text>
        {categories.length === 0 ? (
          <View style={[cardStyle, styles.emptyCard]}>
            <Ionicons name="pricetags-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('labelCategories.noCategories')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
              {t('labelCategories.noCategoriesDesc')}
            </Text>
          </View>
        ) : (
          <View style={[cardStyle, styles.listCard]}>
            {categories.map((category, index) => {
              const preview = previewOf(category);
              return (
                <View
                  key={category.id}
                  style={[
                    styles.categoryRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight },
                  ]}
                >
                  <MaterialPressable
                    onPress={() => router.push({ pathname: '/label-category-edit', params: { id: category.id } })}
                    style={styles.categoryMain}
                    accessibilityRole="button"
                    accessibilityLabel={`${category.name} · ${t('labelCategories.edit')}`}
                  >
                    <Text style={[styles.itemTitle, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                      {describeSignature(category.signature)} · {t('labelCategories.savedCount', { count: category.count || 0 })}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textTertiary, fontFamily: fonts.regular }]} numberOfLines={1}>
                      {t('labelCategories.keyField')}: {keyFieldLabel(category)}
                    </Text>
                    {!!preview && (
                      <Text
                        style={[styles.preview, { color: colors.textSecondary, fontFamily: fonts.regular }]}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {preview}
                      </Text>
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
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
              {t('labelCategories.ignoredPatterns')}
            </Text>
            <View style={[cardStyle, styles.listCard]}>
              {ignored.map((signature, index) => (
                <View
                  key={signature}
                  style={[
                    styles.ignoredRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight },
                  ]}
                >
                  <Text style={[styles.itemTitle, { color: colors.text, fontFamily: fonts.medium, flex: 1 }]}>
                    {describeSignature(signature) || signature}
                  </Text>
                  <MaterialPressable
                    onPress={() => handleRestore(signature)}
                    style={[styles.actionButton, styles.actionButtonOutline, { borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('labelCategories.restore')}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.primary, fontFamily: fonts.medium }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    ...(Platform.OS === 'android' ? { borderRadius: 16, overflow: 'hidden' } : {}),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 36,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'android' ? { elevation: 1 } : {}),
  },
  listCard: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  discoveredItem: {
    paddingVertical: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  mono: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    marginTop: 3,
  },
  preview: {
    fontSize: 13,
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    overflow: 'hidden',
  },
  actionButtonOutline: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryMain: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 20,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' } : {}),
  },
  ignoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
});
