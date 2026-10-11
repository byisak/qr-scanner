// screens/ScanRulesScreen.js - 스캔 후 자동 동작 규칙 목록 (켜기/끄기, 순서, 삭제, 값으로 시험하기)
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
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
  const [testFocused, setTestFocused] = useState(false);

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

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('scanRules.title')}</Text>
        <MaterialPressable onPress={() => router.push('/scan-rule-edit')} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('scanRules.addRule')}>
          <Ionicons name="add" size={26} color={colors.primaryText} />
        </MaterialPressable>
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.row, s.rowWithDesc]}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>{t('scanRules.enableAll')}</Text>
              <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.description')}</Text>
            </View>
            <Switch value={enabled} onValueChange={toggleAll} {...switchColors} />
          </View>
        </View>

        {rules.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="git-branch-outline" size={40} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('scanRules.emptyTitle')}</Text>
            <Text style={[s.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.emptyDesc')}</Text>
            <View style={[s.exampleBox, { backgroundColor: colors.raised }]}>
              <Text style={[s.example, { color: colors.textSecondary, fontFamily: fonts.regular }]}>• {t('scanRules.example1')}</Text>
              <Text style={[s.example, { color: colors.textSecondary, fontFamily: fonts.regular }]}>• {t('scanRules.example2')}</Text>
            </View>
            <MaterialPressable style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/scan-rule-edit')} accessibilityRole="button">
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('scanRules.addRule')}</Text>
            </MaterialPressable>
          </View>
        ) : (
          <View style={[s.group, s.rulesGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {rules.map((rule, index) => {
              const conditionText = rule.conditions.map(c => describeCondition(c, context, t)).filter(Boolean).join(' + ');
              const dimmed = !enabled || rule.enabled === false;
              return (
                <View key={rule.id} style={index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }}>
                  <View style={{ opacity: dimmed ? 0.6 : 1 }}>
                    <MaterialPressable
                      style={s.ruleMain}
                      onPress={() => router.push({ pathname: '/scan-rule-edit', params: { id: rule.id } })}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                    >
                      <View style={s.rowText}>
                        <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{rule.name}</Text>
                        <Text style={[s.ruleCondition, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={2}>{conditionText}</Text>
                        <View style={s.actionRow}>
                          {rule.actions.map((a, i) => (
                            <View key={i} style={[s.actionChip, { backgroundColor: colors.primarySoft }]}>
                              <Ionicons name={ACTION_ICONS[a.type] || 'ellipse-outline'} size={12} color={colors.primaryText} />
                              <Text style={[s.actionChipText, { color: colors.primaryText, fontFamily: fonts.semiBold }]} numberOfLines={1}>{describeAction(a, context, t)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <Switch
                        value={rule.enabled !== false}
                        onValueChange={(v) => toggleRule(rule.id, v)}
                        {...switchColors}
                      />
                    </MaterialPressable>
                  </View>
                  <View style={s.ruleTools}>
                    <MaterialPressable style={s.toolButton} onPress={() => move(index, -1)} disabled={index === 0} accessibilityLabel={t('scanRules.moveUp')}>
                      <Ionicons name="chevron-up" size={20} color={index === 0 ? colors.border : colors.textSecondary} />
                    </MaterialPressable>
                    <MaterialPressable style={s.toolButton} onPress={() => move(index, 1)} disabled={index === rules.length - 1} accessibilityLabel={t('scanRules.moveDown')}>
                      <Ionicons name="chevron-down" size={20} color={index === rules.length - 1 ? colors.border : colors.textSecondary} />
                    </MaterialPressable>
                    <View style={{ flex: 1 }} />
                    {rule.stopAfterMatch !== false && (
                      <Text style={[s.stopHint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRules.stopAfterMatch')}</Text>
                    )}
                    <MaterialPressable style={s.toolButton} onPress={() => remove(rule, index)} accessibilityLabel={t('scanRules.delete')}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </MaterialPressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 값으로 시험하기 */}
        <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('scanRules.testTitle')}</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={testValue}
            onChangeText={setTestValue}
            onFocus={() => setTestFocused(true)}
            onBlur={() => setTestFocused(false)}
            placeholder={t('scanRules.testPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[s.input, { color: colors.text, borderColor: testFocused ? colors.primary : colors.border, backgroundColor: colors.inputBackground, fontFamily: MONO }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {testResult && (
            <View style={[s.testResult, { backgroundColor: testResult.matched ? colors.primarySoft : colors.raised }]}>
              <Ionicons name={testResult.matched ? 'checkmark-circle-outline' : 'information-circle-outline'} size={16} color={testResult.matched ? colors.primaryText : colors.textSecondary} />
              <Text style={[s.testResultText, { color: testResult.matched ? colors.primaryText : colors.textSecondary, fontFamily: fonts.medium }]}>
                {testResult.text}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  sectionHeader: { ...TYPE.sectionHeader, marginTop: 14, marginHorizontal: 4, marginBottom: 8 },
  group: { borderRadius: RADIUS.group, borderWidth: 1, overflow: 'hidden' },
  rulesGroup: { marginTop: SPACE.section },
  card: { borderRadius: RADIUS.group, borderWidth: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: SIZE.row, paddingVertical: 10, paddingHorizontal: 16 },
  rowWithDesc: { minHeight: SIZE.rowWithDesc },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...TYPE.body },
  desc: { ...TYPE.caption, lineHeight: 17 },
  empty: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, alignItems: 'center', marginTop: SPACE.section },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  exampleBox: { alignSelf: 'stretch', borderRadius: RADIUS.control, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14, gap: 4 },
  example: { fontSize: 13, lineHeight: 18 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: SIZE.primaryButton, borderRadius: RADIUS.button, marginTop: 16, overflow: 'hidden' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  ruleMain: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 4, paddingHorizontal: 16, gap: 12 },
  ruleCondition: { fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.badge, maxWidth: '100%' },
  actionChipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  ruleTools: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 4 },
  toolButton: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  stopHint: { fontSize: 11, marginRight: 4 },
  input: { borderWidth: 1, borderRadius: RADIUS.control, height: 48, paddingHorizontal: 14, fontSize: 15 },
  testResult: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: RADIUS.control, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  testResultText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
