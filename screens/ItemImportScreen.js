// screens/ItemImportScreen.js - 품목 불러오기 미리보기: 열 맞추기 → 새로·갱신·오류 건수 확인 → 저장
// 파일에서 온 행은 itemImportSession 으로 받고, 붙여 넣기(mode=paste)는 이 화면에서 글을 받는다
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, Alert, Platform, ActionSheetIOS, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { IMPORT_FIELDS, rowsFromText, detectMapping, buildRecords } from '../utils/itemImport';
import { takePendingImport } from '../utils/itemImportSession';
import { loadItems, upsertItems, codeKey } from '../utils/itemMaster';
import { trackEvent } from '../utils/analytics';

const POLICIES = ['overwrite', 'fill', 'skip'];

export default function ItemImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;

  const [fileImport] = useState(() => (params.mode === 'paste' ? null : takePendingImport()));
  const [text, setText] = useState('');
  const rows = useMemo(() => (fileImport ? fileImport.rows : rowsFromText(text)), [fileImport, text]);

  const [hasHeader, setHasHeader] = useState(false);
  const [mapping, setMapping] = useState([]);
  // 행이 바뀌면(파일을 받았거나 붙여 넣은 글이 바뀜) 열을 다시 맞춘다
  const rowsSignature = rows.length ? `${rows.length}:${rows[0].join('\u0001')}` : '';
  useEffect(() => {
    const detected = detectMapping(rows);
    setHasHeader(detected.hasHeader);
    setMapping(detected.mapping);
  }, [rowsSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const [existingKeys, setExistingKeys] = useState(null);
  useEffect(() => { loadItems().then(list => setExistingKeys(new Set(list.map(it => codeKey(it.code))))); }, []);

  const result = useMemo(() => buildRecords(rows, mapping, hasHeader), [rows, mapping, hasHeader]);
  const updateCount = existingKeys ? result.records.filter(r => existingKeys.has(codeKey(r.code))).length : 0;
  const newCount = result.records.length - updateCount;
  const [policy, setPolicy] = useState('overwrite');
  const [saving, setSaving] = useState(false);

  const width = Math.max(0, ...rows.slice(0, 20).map(r => r.length));
  const columns = Array.from({ length: width }, (_, i) => ({
    index: i,
    title: hasHeader ? (rows[0]?.[i] || t('itemMaster.columnN', { n: i + 1 })) : t('itemMaster.columnN', { n: i + 1 }),
    sample: (hasHeader ? rows[1] : rows[0])?.[i] || '',
  }));

  const fieldLabel = (f) => (f ? t(`itemMaster.fields.${f}`) : t('itemMaster.ignoreColumn'));

  const chooseField = (col) => {
    const options = [null, ...IMPORT_FIELDS];
    const apply = (field) => setMapping(prev => {
      const next = Array.from({ length: Math.max(prev.length, width) }, (_, i) => prev[i] ?? null);
      // 한 필드는 한 열에만: 다른 열에 같은 필드가 있으면 비운다
      if (field) for (let i = 0; i < next.length; i++) if (next[i] === field) next[i] = null;
      next[col] = field;
      return next;
    });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: columns[col]?.title, options: [...options.map(fieldLabel), t('common.cancel')], cancelButtonIndex: options.length },
        (i) => { if (i < options.length) apply(options[i]); }
      );
    } else {
      Alert.alert(columns[col]?.title, undefined, [
        ...options.map(f => ({ text: fieldLabel(f), onPress: () => apply(f) })),
        { text: t('common.cancel'), style: 'cancel' },
      ], { cancelable: true });
    }
  };

  const save = async () => {
    if (!result.records.length || saving) return;
    setSaving(true);
    try {
      const stats = await upsertItems(result.records, policy);
      trackEvent('item_master_imported', {
        source: fileImport ? 'file' : 'paste',
        added: stats.added, updated: stats.updated, skipped: stats.skipped, errors: result.errors.length,
      });
      feedback.success(t('itemMaster.importDone', { added: stats.added, updated: stats.updated }));
      router.back();
    } catch (e) {
      console.warn('[itemImport] save failed:', e?.message);
      feedback.error(t('itemMaster.saveFailed'));
      setSaving(false);
    }
  };

  const paste = async () => {
    const value = await Clipboard.getStringAsync();
    if (value) setText(prev => (prev.trim() ? `${prev.trim()}\n${value}` : value));
  };

  const errorText = (e) => t(`itemMaster.errors.${e.reason}`, { line: e.line, value: e.value });
  const hasCodeColumn = mapping.includes('code');
  const hasNameColumn = mapping.includes('name');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {fileImport ? fileImport.fileName : t('itemMaster.pasteTitle')}
        </Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {!fileImport && (
          <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.rowBetween}>
              <Text style={[s.label, s.labelInRow, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('itemMaster.pasteLabel')}</Text>
              <MaterialPressable onPress={paste} style={[s.smallButton, { backgroundColor: colors.raised, borderColor: colors.border }]} accessibilityRole="button">
                <Ionicons name="clipboard-outline" size={16} color={colors.primaryText} />
                <Text style={[s.smallButtonText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('itemMaster.paste')}</Text>
              </MaterialPressable>
            </View>
            <Text style={[s.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('itemMaster.pasteHint')}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('itemMaster.pastePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.input, s.textarea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground, fontFamily: fonts.regular }]}
            />
          </View>
        )}

        {rows.length > 0 && (
          <>
            {/* 열 맞추기 */}
            <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('itemMaster.columnsTitle')}</Text>
              <View style={[s.rowBetween, s.headerToggle]}>
                <Text style={[s.toggleText, { color: colors.text, fontFamily: fonts.medium }]}>{t('itemMaster.firstRowIsHeader')}</Text>
                <Switch value={hasHeader} onValueChange={setHasHeader} trackColor={{ true: colors.primary, false: colors.switchOff }} thumbColor="#fff" ios_backgroundColor={colors.switchOff} accessibilityLabel={t('itemMaster.firstRowIsHeader')} />
              </View>
              {columns.map(col => {
                const field = mapping[col.index] || null;
                return (
                  <MaterialPressable
                    key={col.index}
                    style={[s.columnRow, { borderTopColor: colors.borderLight }]}
                    onPress={() => chooseField(col.index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${col.title}: ${fieldLabel(field)}`}
                  >
                    <View style={s.columnText}>
                      <Text style={[s.columnTitle, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{col.title}</Text>
                      {!!col.sample && <Text style={[s.columnSample, { color: colors.textTertiary }]} numberOfLines={1}>{col.sample}</Text>}
                    </View>
                    <View style={[s.fieldChip, { backgroundColor: field ? colors.primarySoft : colors.raised }]}>
                      <Text style={[s.fieldChipText, { color: field ? colors.primaryText : colors.textSecondary, fontFamily: fonts.semiBold }]}>{fieldLabel(field)}</Text>
                      <Ionicons name="chevron-down" size={14} color={field ? colors.primaryText : colors.textSecondary} />
                    </View>
                  </MaterialPressable>
                );
              })}
              {(!hasCodeColumn || !hasNameColumn) && (
                <Text style={[s.warn, { color: colors.error, fontFamily: fonts.medium }]}>{t('itemMaster.needCodeAndName')}</Text>
              )}
            </View>

            {/* 결과 요약 */}
            <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.stats}>
                <Stat label={t('itemMaster.statNew')} value={newCount} color={colors.success} colors={colors} fonts={fonts} />
                <Stat label={t('itemMaster.statUpdate')} value={updateCount} color={colors.primaryText} colors={colors} fonts={fonts} />
                <Stat label={t('itemMaster.statError')} value={result.errors.length} color={result.errors.length ? colors.error : colors.textTertiary} colors={colors} fonts={fonts} />
              </View>
              {result.duplicateCount > 0 && (
                <Text style={[s.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('itemMaster.duplicateInFile', { count: result.duplicateCount })}</Text>
              )}

              {updateCount > 0 && (
                <>
                  <Text style={[s.label, s.policyLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('itemMaster.policyTitle')}</Text>
                  <View style={[s.segment, { backgroundColor: colors.raised }]} accessibilityRole="radiogroup">
                    {POLICIES.map(p => (
                      <MaterialPressable
                        key={p}
                        style={[s.segmentItem, policy === p && { backgroundColor: colors.surface }]}
                        onPress={() => setPolicy(p)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: policy === p }}
                      >
                        <Text style={[s.segmentText, { color: policy === p ? colors.text : colors.textSecondary, fontFamily: fonts.semiBold }]}>{t(`itemMaster.policy.${p}`)}</Text>
                      </MaterialPressable>
                    ))}
                  </View>
                </>
              )}

              {result.records.slice(0, 5).map(r => (
                <View key={r.code} style={[s.previewRow, { borderTopColor: colors.borderLight }]}>
                  <Text style={[s.previewName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[s.previewCode, { color: colors.textSecondary }]} numberOfLines={1}>{r.code}</Text>
                </View>
              ))}
              {result.records.length > 5 && (
                <Text style={[s.hint, s.more, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('itemMaster.andMore', { count: result.records.length - 5 })}</Text>
              )}
            </View>

            {result.errors.length > 0 && (
              <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.label, { color: colors.error, fontFamily: fonts.semiBold }]}>{t('itemMaster.errorsTitle', { count: result.errors.length })}</Text>
                {result.errors.slice(0, 8).map(e => (
                  <Text key={`${e.line}-${e.reason}`} style={[s.errorLine, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{errorText(e)}</Text>
                ))}
                {result.errors.some(e => e.reason === 'scientific') && (
                  <Text style={[s.hint, s.more, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('itemMaster.scientificHelp')}</Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[s.footer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <MaterialPressable
          style={[s.primaryButton, { backgroundColor: result.records.length && !saving ? colors.primary : colors.textTertiary }]}
          onPress={save}
          disabled={!result.records.length || saving}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('itemMaster.saveCount', { count: result.records.length })}</Text>
        </MaterialPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, color, colors, fonts }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color, fontFamily: fonts.bold }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerSpacer: { width: SIZE.touch },
  content: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  section: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, marginBottom: SPACE.section },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  label: { ...TYPE.sectionHeader, marginBottom: 8 },
  labelInRow: { flex: 1, marginBottom: 0 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  more: { marginTop: 10 },
  input: { borderWidth: 1, borderRadius: RADIUS.control, minHeight: SIZE.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginTop: 10 },
  textarea: { minHeight: 160, textAlignVertical: 'top' },
  smallButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: SIZE.touch, borderRadius: RADIUS.control, borderWidth: 1, overflow: 'hidden' },
  smallButtonText: { fontSize: 13 },
  headerToggle: { justifyContent: 'space-between', marginBottom: 4 },
  toggleText: { fontSize: 15, flex: 1 },
  columnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.row, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  columnText: { flex: 1, minWidth: 0 },
  columnTitle: { fontSize: 15 },
  columnSample: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
  fieldChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: SIZE.chip, borderRadius: RADIUS.chip },
  fieldChipText: { fontSize: 13 },
  warn: { fontSize: 13, marginTop: 10 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 12, marginTop: 2 },
  policyLabel: { marginTop: 16 },
  segment: { flexDirection: 'row', borderRadius: RADIUS.control, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: RADIUS.control - 3, overflow: 'hidden' },
  segmentText: { fontSize: 13 },
  previewRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, marginTop: 4 },
  previewName: { fontSize: 14 },
  previewCode: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
  errorLine: { fontSize: 13, lineHeight: 20 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SPACE.screen, paddingTop: 8 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: SIZE.primaryButton, borderRadius: RADIUS.button, overflow: 'hidden' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16 },
});
