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
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
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
      style={[s.chip, { backgroundColor: selected ? colors.text : colors.surface, borderColor: selected ? colors.text : colors.border }]}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[s.chipText, { color: selected ? colors.background : colors.text, fontFamily: selected ? fonts.semiBold : fonts.medium, fontWeight: selected ? '600' : '500' }]}>{label}</Text>
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

// 입력칸: 포커스되면 테두리를 강조색으로
function Field({ style, colors, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, focused && { borderColor: colors.primary }]}
    />
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

  // 카드 바로 안의 입력칸은 inputBackground, 조건·동작 하위 카드(raised) 안에서는 surface
  const inputStyle = [s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }];
  const itemInputStyle = [s.input, s.itemInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: MONO }];

  const renderCondition = (condition, index) => {
    const category = categories.find(c => c.id === condition.categoryId);
    const needsValue = condition.type === 'field' ? !['empty', 'notEmpty'].includes(condition.op || 'eq') : !['barcodeType', 'category'].includes(condition.type);
    return (
      <View key={index} style={[s.itemCard, { backgroundColor: colors.raised }]}>
        <View style={s.itemHeader}>
          <Text style={[s.itemIndex, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{index + 1}</Text>
          <View style={{ flex: 1 }} />
          {rule.conditions.length > 1 && (
            <MaterialPressable style={s.removeButton} onPress={() => update({ conditions: rule.conditions.filter((_, i) => i !== index) })} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
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
            <Text style={[s.hint, s.itemHint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.noCategories')}</Text>
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
          <Field
            colors={colors}
            value={String(condition.value ?? '')}
            onChangeText={(v) => updateCondition(index, { value: v })}
            placeholder={condition.type === 'regex' ? t('scanRules.regexPlaceholder') : t('scanRules.valuePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={itemInputStyle}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      </View>
    );
  };

  const renderAction = (action, index) => (
    <View key={index} style={[s.itemCard, { backgroundColor: colors.raised }]}>
      <View style={s.itemHeader}>
        <Text style={[s.itemIndex, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{index + 1}</Text>
        <View style={{ flex: 1 }} />
        {rule.actions.length > 1 && (
          <MaterialPressable style={s.removeButton} onPress={() => update({ actions: rule.actions.filter((_, i) => i !== index) })} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
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
          <Field
            colors={colors}
            value={action.url || ''}
            onChangeText={(v) => updateAction(index, { url: v })}
            placeholder={t('scanRules.urlPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={itemInputStyle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[s.hint, s.itemHint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.urlHint')}</Text>
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

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };
  const cardStyle = [s.section, { backgroundColor: colors.surface, borderColor: colors.border }];
  const labelStyle = [s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{editingId ? t('scanRules.editTitle') : t('scanRules.newTitle')}</Text>
        <MaterialPressable onPress={save} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('scanRules.save')}>
          <Ionicons name="checkmark" size={26} color={colors.primaryText} />
        </MaterialPressable>
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={cardStyle}>
          <Text style={labelStyle}>{t('scanRules.name')}</Text>
          <Field
            colors={colors}
            value={rule.name}
            onChangeText={(v) => update({ name: v })}
            placeholder={t('scanRules.namePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={inputStyle}
          />
        </View>

        <View style={cardStyle}>
          <Text style={labelStyle}>{t('scanRules.conditions')}</Text>
          <Text style={[s.hint, s.hintBlock, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.conditionsDesc')}</Text>
          {rule.conditions.map(renderCondition)}
          <MaterialPressable style={s.addRow} onPress={() => update({ conditions: [...rule.conditions, { type: 'contains', value: '' }] })} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.primaryText} />
            <Text style={[s.addRowText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('scanRules.addCondition')}</Text>
          </MaterialPressable>
        </View>

        <View style={cardStyle}>
          <Text style={labelStyle}>{t('scanRules.actionsTitle')}</Text>
          <Text style={[s.hint, s.hintBlock, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.actionsDesc')}</Text>
          {rule.actions.map(renderAction)}
          <MaterialPressable style={s.addRow} onPress={() => update({ actions: [...rule.actions, { type: 'copy' }] })} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.primaryText} />
            <Text style={[s.addRowText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('scanRules.addAction')}</Text>
          </MaterialPressable>
        </View>

        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.row}>
            <View style={s.rowText}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>{t('scanRules.stopAfterMatch')}</Text>
              <Text style={[s.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('scanRules.stopAfterMatchDesc')}</Text>
            </View>
            <Switch
              value={rule.stopAfterMatch !== false}
              onValueChange={(v) => update({ stopAfterMatch: v })}
              {...switchColors}
            />
          </View>
        </View>

        <View style={cardStyle}>
          <Text style={labelStyle}>{t('scanRules.previewTitle')}</Text>
          <Field
            colors={colors}
            value={previewValue}
            onChangeText={setPreviewValue}
            placeholder={t('scanRules.testPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[inputStyle, { fontFamily: MONO }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {previewMatch !== null && (
            <View style={[s.previewRow, { backgroundColor: previewMatch ? colors.successSoft : colors.raised }]}>
              <Ionicons name={previewMatch ? 'checkmark-circle' : 'close-circle'} size={18} color={previewMatch ? colors.success : colors.textSecondary} />
              <Text style={[s.previewText, { color: previewMatch ? colors.success : colors.textSecondary, fontFamily: fonts.medium }]}>
                {previewMatch ? t('scanRules.previewMatch') : t('scanRules.previewNoMatch')}
              </Text>
            </View>
          )}
        </View>

        <MaterialPressable style={[s.saveButton, { backgroundColor: colors.primary }]} onPress={save} accessibilityRole="button">
          <Text style={[s.saveButtonText, { fontFamily: fonts.semiBold }]}>{t('scanRules.save')}</Text>
        </MaterialPressable>
        {editingId && (
          <MaterialPressable style={[s.deleteButton, { backgroundColor: colors.errorSoft }]} onPress={remove} accessibilityRole="button">
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[s.deleteButtonText, { color: colors.error, fontFamily: fonts.semiBold }]}>{t('scanRules.delete')}</Text>
          </MaterialPressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  section: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, marginBottom: SPACE.section },
  sectionTitle: { ...TYPE.sectionHeader, marginBottom: 8 },
  group: { borderRadius: RADIUS.group, borderWidth: 1, overflow: 'hidden', marginBottom: SPACE.section },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: SIZE.rowWithDesc, paddingVertical: 10, paddingHorizontal: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...TYPE.body },
  hint: { ...TYPE.caption, lineHeight: 17 },
  hintBlock: { marginBottom: 12 },
  itemHint: { marginTop: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS.control, height: 48, paddingHorizontal: 14, fontSize: 15 },
  itemInput: { marginTop: 8 },
  itemCard: { borderRadius: RADIUS.control, padding: 12, marginBottom: SPACE.gap },
  itemHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 32, marginBottom: 2 },
  itemIndex: { fontSize: 12, fontWeight: '600' },
  removeButton: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginVertical: -6, marginRight: -8 },
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  chip: { height: SIZE.chip, paddingHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 1, justifyContent: 'center', overflow: 'hidden' },
  chipText: { fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: SIZE.touch, borderRadius: RADIUS.control, overflow: 'hidden' },
  addRowText: { fontSize: 14, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderRadius: RADIUS.control, paddingHorizontal: 12, paddingVertical: 10 },
  previewText: { flex: 1, fontSize: 13 },
  saveButton: { height: SIZE.primaryButton, borderRadius: RADIUS.button, alignItems: 'center', justifyContent: 'center', marginTop: 4, overflow: 'hidden' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  deleteButton: { flexDirection: 'row', gap: 6, height: SIZE.button, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.section, borderRadius: RADIUS.control, overflow: 'hidden' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
});
