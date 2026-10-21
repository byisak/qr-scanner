// screens/LabelPrintScreen.js - 품목 라벨 인쇄: 품목을 골라 A4 라벨지(3×7·4×10·2×5)에 바코드·QR 라벨로 인쇄하거나 PDF로 저장
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useSettingsUi, SectionHeader, Group, SettingRow, settingsStyles } from '../components/SettingsKit';
import MaterialPressable from '../components/MaterialPressable';
import { useFeedback } from '../contexts/FeedbackContext';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import { loadItems } from '../utils/itemMaster';
import { LABEL_TEMPLATES, buildLabelHtml, labelPageCount } from '../utils/labelSheet';
import { trackEvent } from '../utils/analytics';

const LIST_MAX = 200; // 한 번에 그리는 목록 수 (그 이상은 검색으로 좁힌다)
const A4_PT = { width: 595, height: 842 };

export default function LabelPrintScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const { t, fonts, colors, switchColors, rowProps } = useSettingsUi();
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [template, setTemplate] = useState('3x7');
  const [mode, setMode] = useState('auto');
  const [showName, setShowName] = useState(true);
  const [showMeta, setShowMeta] = useState(true);
  const [copies, setCopies] = useState(1);
  const [skip, setSkip] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadItems().then(list => {
      setItems(list.slice());
      setSelected(new Set(list.map(i => i.code)));
    });
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q) || (it.location || '').toLowerCase().includes(q));
  }, [items, query]);

  const chosen = useMemo(() => (items || []).filter(i => selected.has(i.code)), [items, selected]);
  const perPage = LABEL_TEMPLATES[template].cols * LABEL_TEMPLATES[template].rows;
  const skipCells = Math.min(skip, perPage - 1);
  const labelCount = chosen.length * copies;
  const pages = labelPageCount(chosen.length, { template, copies, skip: skipCells });

  const toggle = (code) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const allFilteredOn = filtered.length > 0 && filtered.every(i => selected.has(i.code));
  const toggleAllFiltered = () => setSelected(prev => {
    const next = new Set(prev);
    for (const i of filtered) { if (allFilteredOn) next.delete(i.code); else next.add(i.code); }
    return next;
  });

  const html = () => buildLabelHtml(chosen, { template, mode, copies, skip: skipCells, showName, showMeta });

  const run = async (kind) => {
    if (!chosen.length || busy) return;
    setBusy(true);
    try {
      if (kind === 'print') {
        await Print.printAsync({ html: html(), ...A4_PT });
      } else {
        const { uri } = await Print.printToFileAsync({ html: html(), ...A4_PT });
        const target = `${FileSystem.cacheDirectory}labels_${new Date().toISOString().slice(0, 10)}.pdf`;
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: target });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('labelPrint.title') });
      }
      trackEvent('labels_printed', { kind, template, mode, label_count: labelCount });
    } catch (e) {
      // 인쇄 창을 닫은 것은 오류로 보지 않는다
      if (!/cancel/i.test(e?.message || '')) {
        console.warn('[labelPrint] failed:', e?.message);
        feedback.error(t('labelPrint.failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const segment = (value, onChange, options) => (
    <View style={[settingsStyles.segment, { backgroundColor: colors.raised }]}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <MaterialPressable
            key={o.value}
            style={[settingsStyles.segmentItem, on && { backgroundColor: colors.surface }]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[settingsStyles.segmentText, { color: on ? colors.text : colors.textSecondary, fontFamily: on ? fonts.semiBold : fonts.regular }]}>{o.label}</Text>
          </MaterialPressable>
        );
      })}
    </View>
  );

  const stepper = (value, setValue, min, max, label) => (
    <View style={s.stepper}>
      <MaterialPressable style={[s.stepButton, { borderColor: colors.border }]} onPress={() => setValue(Math.max(min, value - 1))} disabled={value <= min} accessibilityRole="button" accessibilityLabel={`${label} -1`}>
        <Ionicons name="remove" size={18} color={value <= min ? colors.textTertiary : colors.text} />
      </MaterialPressable>
      <Text style={[s.stepValue, { color: colors.text, fontFamily: fonts.semiBold }]}>{value}</Text>
      <MaterialPressable style={[s.stepButton, { borderColor: colors.border }]} onPress={() => setValue(Math.min(max, value + 1))} disabled={value >= max} accessibilityRole="button" accessibilityLabel={`${label} +1`}>
        <Ionicons name="add" size={18} color={value >= max ? colors.textTertiary : colors.text} />
      </MaterialPressable>
    </View>
  );

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 4 }]}>
      <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </MaterialPressable>
      <Text accessibilityRole="header" style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('labelPrint.title')}</Text>
      <View style={s.iconButton} />
    </View>
  );

  if (items === null) {
    return <View style={[s.container, { backgroundColor: colors.background }]}>{header}<View style={s.center}><ActivityIndicator color={colors.primary} /></View></View>;
  }

  if (!items.length) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={s.center}>
          <Ionicons name="pricetags-outline" size={44} color={colors.textTertiary} />
          <Text style={[s.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('labelPrint.noItems')}</Text>
        </View>
      </View>
    );
  }

  const shown = filtered.slice(0, LIST_MAX);
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.screen, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <SectionHeader title={t('labelPrint.sheet')} {...rowProps} />
        <Group colors={colors}>
          <View style={s.block}>
            {segment(template, (v) => { setTemplate(v); setSkip(0); }, Object.keys(LABEL_TEMPLATES).map(k => ({
              value: k,
              label: t('labelPrint.templateOption', { layout: k.replace('x', '×'), count: LABEL_TEMPLATES[k].cols * LABEL_TEMPLATES[k].rows }),
            })))}
            <Text style={[settingsStyles.desc, s.blockDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('labelPrint.templateDesc', { w: LABEL_TEMPLATES[template].w, h: LABEL_TEMPLATES[template].h })}
            </Text>
          </View>
          <SettingRow {...rowProps} label={t('labelPrint.skip')} desc={t('labelPrint.skipDesc')}>
            {stepper(skipCells, setSkip, 0, perPage - 1, t('labelPrint.skip'))}
          </SettingRow>
        </Group>

        <SectionHeader title={t('labelPrint.content')} {...rowProps} />
        <Group colors={colors}>
          <View style={s.block}>
            {segment(mode, setMode, [
              { value: 'auto', label: t('labelPrint.modeAuto') },
              { value: 'barcode', label: t('labelPrint.modeBarcode') },
              { value: 'qr', label: 'QR' },
            ])}
            <Text style={[settingsStyles.desc, s.blockDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t(`labelPrint.modeDesc.${mode}`)}
            </Text>
          </View>
          <SettingRow {...rowProps} label={t('labelPrint.showName')}>
            <Switch value={showName} onValueChange={setShowName} {...switchColors} />
          </SettingRow>
          <SettingRow {...rowProps} label={t('labelPrint.showMeta')} desc={t('labelPrint.showMetaDesc')}>
            <Switch value={showMeta} onValueChange={setShowMeta} {...switchColors} />
          </SettingRow>
          <SettingRow {...rowProps} label={t('labelPrint.copies')}>
            {stepper(copies, setCopies, 1, 99, t('labelPrint.copies'))}
          </SettingRow>
        </Group>

        <SectionHeader title={t('labelPrint.items', { count: chosen.length, total: items.length })} {...rowProps} />
        <View style={[s.search, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('itemMaster.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[s.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Group colors={colors}>
          <SettingRow {...rowProps} label={allFilteredOn ? t('labelPrint.deselectAll') : t('labelPrint.selectAll')} onPress={toggleAllFiltered}>
            <Text style={[s.countText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{filtered.length}</Text>
          </SettingRow>
          {shown.map(it => {
            const on = selected.has(it.code);
            return (
              <MaterialPressable key={it.code} style={s.itemRow} onPress={() => toggle(it.code)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${it.name}, ${it.code}`}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.textTertiary} />
                <View style={s.itemText}>
                  <Text style={[s.itemName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{it.name}</Text>
                  <Text style={[s.itemCode, { color: colors.textSecondary }]} numberOfLines={1}>{it.code}</Text>
                </View>
              </MaterialPressable>
            );
          })}
        </Group>
        {filtered.length > LIST_MAX && (
          <Text style={[settingsStyles.desc, s.more, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('labelPrint.listCapped', { shown: LIST_MAX, total: filtered.length })}
          </Text>
        )}
      </ScrollView>

      <View style={[s.bottom, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 10 }]}>
        <Text style={[s.summary, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
          {t('labelPrint.summary', { labels: labelCount, pages })}
        </Text>
        <View style={s.buttons}>
          <MaterialPressable
            style={[s.button, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, opacity: chosen.length ? 1 : 0.5 }]}
            onPress={() => run('pdf')}
            disabled={!chosen.length || busy}
            accessibilityRole="button"
          >
            <Ionicons name="document-outline" size={18} color={colors.primaryText} />
            <Text style={[s.buttonText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('labelPrint.savePdf')}</Text>
          </MaterialPressable>
          <MaterialPressable
            style={[s.button, { backgroundColor: colors.primary, opacity: chosen.length ? 1 : 0.5 }]}
            onPress={() => run('print')}
            disabled={!chosen.length || busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="print-outline" size={18} color="#FFFFFF" />}
            <Text style={[s.buttonText, { color: '#FFFFFF', fontFamily: fonts.semiBold }]}>{t('labelPrint.print')}</Text>
          </MaterialPressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyText: { fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  block: { padding: 12 },
  blockDesc: { marginTop: 8, marginHorizontal: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: RADIUS.control, paddingHorizontal: 12, height: SIZE.input, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  countText: { fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: SIZE.rowWithDesc, paddingVertical: 8 },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 15 },
  itemCode: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
  more: { marginTop: 8, marginHorizontal: 4 },
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.screen, paddingTop: 10 },
  summary: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  buttons: { flexDirection: 'row', gap: SPACE.gap },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.button, borderRadius: RADIUS.control, overflow: 'hidden' },
  buttonText: { fontSize: 15 },
});
