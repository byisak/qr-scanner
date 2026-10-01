// screens/ScanRuleEditScreen.js - 자동 규칙 편집 (이름 / 조건 / 동작 / 중단 여부 / 미리보기)
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import MaterialPressable from '../components/MaterialPressable';
import {
  CONDITION_TYPES, FIELD_OPS, ACTION_TYPES, FEEDBACK_HAPTICS,
  newRule, validateRule, matchRule,
} from '../utils/scanRules';
import { loadScanRules, upsertScanRule, deleteScanRule } from '../utils/scanRulesStore';
import { loadLabelSettings } from '../utils/labelCategories';
import { parseLabel, fieldNameAt } from '../utils/labelParser';

const BARCODE_TYPES = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'upce', 'upca', 'pdf417', 'aztec', 'datamatrix', 'itf14', 'codabar'];

function Chip({ label, selected, onPress, colors, fonts }) {
  return (
    <MaterialPressable
      style={[s.chip, { backgroundColor: selected ? colors.primary : colors.inputBackground, borderColor: selected ? colors.primary : colors.border }]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[s.chipText, { color: selected ? '#fff' : colors.text, fontFamily: selected ? fonts.semiBold : fonts.regular }]}>{label}</Text>
    </MaterialPressable>
  );
}

function ChipRow({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export default function ScanRuleEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  const editingId = typeof params.id === 'string' ? params.id : null;

  const [rule, setRule] = useState(null);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [previewValue, setPreviewValue] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [{ rules }, groupsJson, labelSettings] = await Promise.all([
          loadScanRules(),
          AsyncStorage.getItem('scanGroups'),
          loadLabelSettings(),
        ]);
        const parsedGroups = groupsJson ? JSON.parse(groupsJson) : [];
        setGroups(parsedGroups.length ? parsedGroups : [{ id: 'default', name: t('groupEdit.defaultGroup') }]);
        setCategories(labelSettings.categories);
        const existing = editingId ? rules.find(r => r.id === editingId) : null;
        setRule(existing ? JSON.parse(JSON.stringify(existing)) : newRule(rules.length));
      } catch (error) {
        console.error('Load rule error:', error);
        setRule(newRule(0));
      }
    })();
  }, [editingId, t]);

  const update = useCallback((patch) => setRule(prev => ({ ...prev, ...patch })), []);
  const updateCondition = useCallback((index, patch) => setRule(prev => ({
    ...prev,
    conditions: prev.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
  })), []);
  const updateAction = useCallback((index, patch) => setRule(prev => ({
    ...prev,
    actions: prev.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
  })), []);

  const previewMatch = useMemo(() => {
    if (!rule || !previewValue.trim()) return null;
    const value = previewValue.trim();
    const parsed = parseLabel(value, categories);
    return matchRule({ ...rule, enabled: true }, { code: value, type: 'qr', categoryId: parsed ? parsed.categoryId : null, values: parsed ? parsed.values : [] });
  }, [rule, previewValue, categories]);

  const save = useCallback(async () => {
    const errors = validateRule(rule, t);
    if (errors.length) {
      feedback.error(errors[0]);
      return;
    }
    try {
      await upsertScanRule({ ...rule, name: rule.name.trim() });
      feedback.success(t('scanRules.saved'));
      router.back();
    } catch (error) {
      console.error('Save rule error:', error);
    }
  }, [rule, t, feedback, router]);

  const remove = useCallback(() => {
    Alert.alert(t('scanRules.deleteConfirmTitle'), t('scanRules.deleteConfirmMessage', { name: rule.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('scanRules.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteScanRule(rule.id);
            router.back();
          } catch (error) {
            console.error('Delete rule error:', error);
          }
        },
      },
    ]);
  }, [rule, t, router]);

  if (!rule) return <View style={[s.container, { backgroundColor: colors.background }]} />;

  const inputStyle = [s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }];

  const renderCondition = (condition, index) => {
    const category = categories.find(c => c.id === condition.categoryId);
    const needsValue = condition.type === 'field' ? !['empty', 'notEmpty'].includes(condition.op || 'eq') : !['barcodeType', 'category'].includes(condition.type);
    return (
      <View key={index} style={[s.itemCard, { borderColor: colors.border }]}>
        <View style={s.itemHeader}>
          <Text style={[s.itemIndex, { color: colors.textTertiary, fontFamily: fonts.medium }]}>{index + 1}</Text>
          <View style={{ flex: 1 }} />
          {rule.conditions.length > 1 && (
            <MaterialPressable style={s.removeButton} onPress={() => update({ conditions: rule.conditions.filter((_, i) => i !== index) })} accessibilityLabel={t('common.delete')}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </MaterialPressable>
          )}
        </View>
        <ChipRow>
          {CONDITION_TYPES.map(type => (
            <Chip key={type} label={t(`scanRules.conditionTypes.${type}`)} selected={condition.type === type} colors={colors} fonts={fonts}
              onPress={() => updateCondition(index, { type, value: '', op: 'eq', categoryId: null, fieldIndex: null })} />
          ))}
        </ChipRow>
        {condition.type === 'barcodeType' && (
          <ChipRow>
            {BARCODE_TYPES.map(bt => (
              <Chip key={bt} label={bt.toUpperCase()} selected={condition.value === bt} colors={colors} fonts={fonts} onPress={() => updateCondition(index, { value: bt })} />
            ))}
          </ChipRow>
        )}
        {(condition.type === 'category' || condition.type === 'field') && (
          categories.length === 0 ? (
            <Text style={[s.hint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRules.noCategories')}</Text>
          ) : (
            <ChipRow>
              {categories.map(c => (
                <Chip key={c.id} label={c.name} colors={colors} fonts={fonts}
                  selected={condition.type === 'category' ? condition.value === c.id : condition.categoryId === c.id}
                  onPress={() => (condition.type === 'category' ? updateCondition(index, { value: c.id }) : updateCondition(index, { categoryId: c.id, fieldIndex: 0 }))} />
              ))}
            </ChipRow>
          )
        )}
        {condition.type === 'field' && category && (
          <>
            <ChipRow>
              {category.fields.map((_, fi) => (
                <Chip key={fi} label={fieldNameAt(category, fi, t)} selected={condition.fieldIndex === fi} colors={colors} fonts={fonts} onPress={() => updateCondition(index, { fieldIndex: fi })} />
              ))}
            </ChipRow>
            <ChipRow>
              {FIELD_OPS.map(op => (
                <Chip key={op} label={t(`scanRules.ops.${op}`)} selected={(condition.op || 'eq') === op} colors={colors} fonts={fonts} onPress={() => updateCondition(index, { op })} />
              ))}
            </ChipRow>
          </>
        )}
        {needsValue && (
          <TextInput
            value={String(condition.value ?? '')}
            onChangeText={(v) => updateCondition(index, { value: v })}
            placeholder={condition.type === 'regex' ? t('scanRules.regexPlaceholder') : t('scanRules.valuePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={inputStyle}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      </View>
    );
  };

  const renderAction = (action, index) => (
    <View key={index} style={[s.itemCard, { borderColor: colors.border }]}>
      <View style={s.itemHeader}>
        <Text style={[s.itemIndex, { color: colors.textTertiary, fontFamily: fonts.medium }]}>{index + 1}</Text>
        <View style={{ flex: 1 }} />
        {rule.actions.length > 1 && (
          <MaterialPressable style={s.removeButton} onPress={() => update({ actions: rule.actions.filter((_, i) => i !== index) })} accessibilityLabel={t('common.delete')}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </MaterialPressable>
        )}
      </View>
      <ChipRow>
        {ACTION_TYPES.map(type => (
          <Chip key={type} label={t(`scanRules.actions.${type}`)} selected={action.type === type} colors={colors} fonts={fonts}
            onPress={() => updateAction(index, { type, groupId: null, url: '', mode: 'open', haptic: 'success' })} />
        ))}
      </ChipRow>
      {action.type === 'saveToGroup' && (
        <ChipRow>
          {groups.map(g => (
            <Chip key={g.id} label={g.name} selected={action.groupId === g.id} colors={colors} fonts={fonts} onPress={() => updateAction(index, { groupId: g.id })} />
          ))}
        </ChipRow>
      )}
      {action.type === 'openUrl' && (
        <>
          <TextInput
            value={action.url || ''}
            onChangeText={(v) => updateAction(index, { url: v })}
            placeholder={t('scanRules.urlPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={inputStyle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[s.hint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRules.urlHint')}</Text>
          <ChipRow>
            {['open', 'send'].map(mode => (
              <Chip key={mode} label={t(`scanRules.urlModes.${mode}`)} selected={(action.mode || 'open') === mode} colors={colors} fonts={fonts} onPress={() => updateAction(index, { mode })} />
            ))}
          </ChipRow>
        </>
      )}
      {action.type === 'feedback' && (
        <ChipRow>
          {FEEDBACK_HAPTICS.map(h => (
            <Chip key={h} label={t(`scanRules.haptics.${h}`)} selected={(action.haptic || 'success') === h} colors={colors} fonts={fonts} onPress={() => updateAction(index, { haptic: h })} />
          ))}
        </ChipRow>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{editingId ? t('scanRules.editTitle') : t('scanRules.newTitle')}</Text>
        <MaterialPressable onPress={save} style={s.backButton} accessibilityLabel={t('scanRules.save')}>
          <Ionicons name="checkmark" size={26} color={colors.primary} />
        </MaterialPressable>
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('scanRules.name')}</Text>
          <TextInput
            value={rule.name}
            onChangeText={(v) => update({ name: v })}
            placeholder={t('scanRules.namePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={inputStyle}
          />
        </View>

        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('scanRules.conditions')}</Text>
          <Text style={[s.hint, { color: colors.textTertiary, fontFamily: fonts.regular, marginBottom: 8 }]}>{t('scanRules.conditionsDesc')}</Text>
          {rule.conditions.map(renderCondition)}
          <MaterialPressable style={s.addRow} onPress={() => update({ conditions: [...rule.conditions, { type: 'contains', value: '' }] })} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[s.addRowText, { color: colors.primary, fontFamily: fonts.medium }]}>{t('scanRules.addCondition')}</Text>
          </MaterialPressable>
        </View>

        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('scanRules.actionsTitle')}</Text>
          <Text style={[s.hint, { color: colors.textTertiary, fontFamily: fonts.regular, marginBottom: 8 }]}>{t('scanRules.actionsDesc')}</Text>
          {rule.actions.map(renderAction)}
          <MaterialPressable style={s.addRow} onPress={() => update({ actions: [...rule.actions, { type: 'copy' }] })} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[s.addRowText, { color: colors.primary, fontFamily: fonts.medium }]}>{t('scanRules.addAction')}</Text>
          </MaterialPressable>
        </View>

        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('scanRules.stopAfterMatch')}</Text>
              <Text style={[s.hint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('scanRules.stopAfterMatchDesc')}</Text>
            </View>
            <Switch
              value={rule.stopAfterMatch !== false}
              onValueChange={(v) => update({ stopAfterMatch: v })}
              trackColor={{ true: Platform.OS === 'android' ? colors.primary + '99' : colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('scanRules.previewTitle')}</Text>
          <TextInput
            value={previewValue}
            onChangeText={setPreviewValue}
            placeholder={t('scanRules.testPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={inputStyle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {previewMatch !== null && (
            <View style={s.previewRow}>
              <Ionicons name={previewMatch ? 'checkmark-circle' : 'close-circle'} size={18} color={previewMatch ? colors.success : colors.textTertiary} />
              <Text style={[s.previewText, { color: previewMatch ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {previewMatch ? t('scanRules.previewMatch') : t('scanRules.previewNoMatch')}
              </Text>
            </View>
          )}
        </View>

        <MaterialPressable style={[s.saveButton, { backgroundColor: colors.primary }]} onPress={save} accessibilityRole="button">
          <Text style={[s.saveButtonText, { fontFamily: fonts.semiBold }]}>{t('scanRules.save')}</Text>
        </MaterialPressable>
        {editingId && (
          <MaterialPressable style={s.deleteButton} onPress={remove} accessibilityRole="button">
            <Text style={[s.deleteButtonText, { color: colors.error || '#FF3B30', fontFamily: fonts.medium }]}>{t('scanRules.delete')}</Text>
          </MaterialPressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  sectionTitle: { fontSize: 13, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 },
  label: { fontSize: 16 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 8 },
  itemCard: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  itemIndex: { fontSize: 12 },
  removeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, minHeight: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center', overflow: 'hidden' },
  chipText: { fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderRadius: 8, overflow: 'hidden' },
  addRowText: { fontSize: 14 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  previewText: { fontSize: 14 },
  saveButton: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4, overflow: 'hidden' },
  saveButtonText: { color: '#fff', fontSize: 16 },
  deleteButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 8, overflow: 'hidden' },
  deleteButtonText: { fontSize: 15 },
});
