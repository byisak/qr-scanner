// screens/ScanRulesScreen.js - 스캔 후 자동 동작 규칙 목록 (켜기/끄기, 순서, 삭제, 값으로 시험하기)
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import MaterialPressable from '../components/MaterialPressable';
import { evaluateRules, describeCondition, describeAction } from '../utils/scanRules';
import { loadScanRules, saveScanRules, setScanRulesEnabled } from '../utils/scanRulesStore';
import { loadLabelSettings } from '../utils/labelCategories';
import { parseLabel } from '../utils/labelParser';

const ACTION_ICONS = {
  saveToGroup: 'folder-outline',
  skip: 'close-circle-outline',
  copy: 'copy-outline',
  openUrl: 'link-outline',
  setLocation: 'location-outline',
  feedback: 'pulse-outline',
};

export default function ScanRulesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  const [rules, setRules] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [testValue, setTestValue] = useState('');

  const load = useCallback(async () => {
    try {
      const [{ rules: loadedRules, enabled: loadedEnabled }, groupsJson, labelSettings] = await Promise.all([
        loadScanRules(),
        AsyncStorage.getItem('scanGroups'),
        loadLabelSettings(),
      ]);
      setRules(loadedRules);
      setEnabled(loadedEnabled);
      const parsedGroups = groupsJson ? JSON.parse(groupsJson) : [];
      setGroups(parsedGroups.length ? parsedGroups : [{ id: 'default', name: t('groupEdit.defaultGroup') }]);
      setCategories(labelSettings.categories);
    } catch (error) {
      console.error('Load scan rules error:', error);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const context = useMemo(() => ({ groups, categories }), [groups, categories]);

  const persist = useCallback(async (next) => {
    try {
      const saved = await saveScanRules(next);
      setRules(saved);
    } catch (error) {
      console.error('Save scan rules error:', error);
    }
  }, []);

  const toggleAll = useCallback(async (value) => {
    setEnabled(value);
    try {
      await setScanRulesEnabled(value);
    } catch (error) {
      console.error('Save scanRulesEnabled error:', error);
    }
  }, []);

  const toggleRule = useCallback((id, value) => {
    persist(rules.map(r => (r.id === id ? { ...r, enabled: value } : r)));
  }, [rules, persist]);

  const move = useCallback((index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = rules.slice();
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }, [rules, persist]);

  // 확인 없이 지우고 실행 취소로 되돌린다
  const remove = useCallback((rule, index) => {
    const snapshot = rules;
    persist(rules.filter(r => r.id !== rule.id));
    feedback.warning(t('scanRules.deleted', { name: rule.name }), {
      actionLabel: t('common.undo'),
      onAction: () => persist(snapshot),
    });
  }, [rules, persist, feedback, t]);

  // 값으로 시험하기: 라벨 카테고리까지 적용해서 실제 스캔과 같은 입력을 만든다
  const testResult = useMemo(() => {
    const value = testValue.trim();
    if (!value) return null;
    const parsed = parseLabel(value, categories);
    const input = { code: value, type: 'qr', categoryId: parsed ? parsed.categoryId : null, values: parsed ? parsed.values : [] };
    const { matched, decision } = evaluateRules(rules.filter(r => r.enabled !== false), input);
    if (matched.length === 0) return { text: t('scanRules.testNoMatch'), matched: false };
    const parts = [t('scanRules.testMatched', { names: matched.map(r => r.name).join(', ') })];
    if (decision.skip) parts.push(t('scanRules.actions.skip'));
    if (decision.targetGroupId) {
      const group = groups.find(g => g.id === decision.targetGroupId);
      parts.push(t('scanRules.summary.saveToGroup', { group: group ? group.name : '?' }));
    }
    decision.actions.forEach(a => parts.push(describeAction(a, context, t)));
    return { text: parts.join(' · '), matched: true };
  }, [testValue, rules, categories, groups, context, t]);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('scanRules.title')}</Text>
        <MaterialPressable onPress={() => router.push('/scan-rule-edit')} style={s.backButton} accessibilityLabel={t('scanRules.addRule')}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </MaterialPressable>
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('scanRules.enableAll')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRules.description')}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleAll}
              trackColor={{ true: Platform.OS === 'android' ? colors.primary + '99' : colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {rules.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.surface }]}>
            <Ionicons name="git-branch-outline" size={40} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('scanRules.emptyTitle')}</Text>
            <Text style={[s.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.emptyDesc')}</Text>
            <Text style={[s.example, { color: colors.textTertiary, fontFamily: fonts.regular }]}>• {t('scanRules.example1')}</Text>
            <Text style={[s.example, { color: colors.textTertiary, fontFamily: fonts.regular }]}>• {t('scanRules.example2')}</Text>
            <MaterialPressable style={[s.addButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/scan-rule-edit')} accessibilityRole="button">
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={[s.addButtonText, { fontFamily: fonts.semiBold }]}>{t('scanRules.addRule')}</Text>
            </MaterialPressable>
          </View>
        ) : (
          rules.map((rule, index) => {
            const conditionText = rule.conditions.map(c => describeCondition(c, context, t)).filter(Boolean).join(' + ');
            const dimmed = !enabled || rule.enabled === false;
            return (
              <View key={rule.id} style={[s.ruleCard, { backgroundColor: colors.surface, opacity: dimmed ? 0.6 : 1 }]}>
                <MaterialPressable
                  style={s.ruleMain}
                  onPress={() => router.push({ pathname: '/scan-rule-edit', params: { id: rule.id } })}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.ruleName, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{rule.name}</Text>
                    <Text style={[s.ruleCondition, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={2}>{conditionText}</Text>
                    <View style={s.actionRow}>
                      {rule.actions.map((a, i) => (
                        <View key={i} style={[s.actionChip, { backgroundColor: colors.primary + '15' }]}>
                          <Ionicons name={ACTION_ICONS[a.type] || 'ellipse-outline'} size={12} color={colors.primary} />
                          <Text style={[s.actionChipText, { color: colors.primary, fontFamily: fonts.medium }]} numberOfLines={1}>{describeAction(a, context, t)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Switch
                    value={rule.enabled !== false}
                    onValueChange={(v) => toggleRule(rule.id, v)}
                    trackColor={{ true: Platform.OS === 'android' ? colors.primary + '99' : colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                    thumbColor="#fff"
                  />
                </MaterialPressable>
                <View style={[s.ruleTools, { borderTopColor: colors.borderLight }]}>
                  <MaterialPressable style={s.toolButton} onPress={() => move(index, -1)} disabled={index === 0} accessibilityLabel={t('scanRules.moveUp')}>
                    <Ionicons name="chevron-up" size={20} color={index === 0 ? colors.textTertiary : colors.textSecondary} />
                  </MaterialPressable>
                  <MaterialPressable style={s.toolButton} onPress={() => move(index, 1)} disabled={index === rules.length - 1} accessibilityLabel={t('scanRules.moveDown')}>
                    <Ionicons name="chevron-down" size={20} color={index === rules.length - 1 ? colors.textTertiary : colors.textSecondary} />
                  </MaterialPressable>
                  <View style={{ flex: 1 }} />
                  {rule.stopAfterMatch !== false && (
                    <Text style={[s.stopHint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRules.stopAfterMatch')}</Text>
                  )}
                  <MaterialPressable style={s.toolButton} onPress={() => remove(rule, index)} accessibilityLabel={t('scanRules.delete')}>
                    <Ionicons name="trash-outline" size={20} color={colors.error || '#FF3B30'} />
                  </MaterialPressable>
                </View>
              </View>
            );
          })
        )}

        {/* 값으로 시험하기 */}
        <View style={[s.section, { backgroundColor: colors.surface, marginTop: 8 }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('scanRules.testTitle')}</Text>
          <TextInput
            value={testValue}
            onChangeText={setTestValue}
            placeholder={t('scanRules.testPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {testResult && (
            <Text style={[s.testResult, { color: testResult.matched ? colors.primary : colors.textTertiary, fontFamily: fonts.medium }]}>
              {testResult.text}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'android' ? { borderRadius: 20, overflow: 'hidden' } : {}),
  },
  headerTitle: { fontSize: 18 },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, marginBottom: 10, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  label: { fontSize: 16 },
  desc: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  empty: { borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, marginTop: 12 },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  example: { fontSize: 13, marginTop: 6, alignSelf: 'flex-start', lineHeight: 18 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, minHeight: 44, borderRadius: 22, marginTop: 16, overflow: 'hidden' },
  addButtonText: { color: '#fff', fontSize: 15 },
  ruleCard: { borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  ruleMain: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  ruleName: { fontSize: 16 },
  ruleCondition: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, maxWidth: '100%' },
  actionChipText: { fontSize: 12, flexShrink: 1 },
  ruleTools: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  toolButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, overflow: 'hidden' },
  stopHint: { fontSize: 11, marginRight: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  testResult: { fontSize: 14, marginTop: 10, lineHeight: 20 },
});
