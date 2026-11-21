// components/FastScanSheet.js - 고속 모드 구성 시트: 읽을 바코드 · 꺼지는 기능 · 켜 둘 기능 · 같은 코드 규칙 · 이 폰에서 잰 속도
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCAN_THEME } from '../constants/scanTheme';
import {
  FAST_PRESET_IDS,
  FAST_REPEAT_RULES,
  ALL_BARCODE_TYPES,
  fastProfileBarcodes,
  fastStatsKey,
  aggregateFastStats,
} from '../utils/fastScan';

const BARCODE_LABELS = {
  qr: 'QR', ean13: 'EAN-13', ean8: 'EAN-8', code128: 'Code 128', code39: 'Code 39', code93: 'Code 93',
  upce: 'UPC-E', upca: 'UPC-A', pdf417: 'PDF417', aztec: 'Aztec', datamatrix: 'Data Matrix', itf14: 'ITF-14', codabar: 'Codabar',
};

const SHEET_BG = '#16191E';
const ROW_BG = 'rgba(255,255,255,0.06)';
const TEXT = '#F2F4F7';
const TEXT2 = 'rgba(242,244,247,0.68)';
const TEXT3 = 'rgba(242,244,247,0.45)';

/**
 * props
 *  visible, t
 *  profile: 저장된 고속 구성 (utils/fastScan DEFAULT_FAST_PROFILE 모양)
 *  rule: 같은 코드 규칙 ('300' | '500' | '1000' | 'once' | 'trigger')
 *  currentBarcodeTypes: 설정 화면에서 고른 바코드 종류
 *  available: { sound, haptic, realtime, scanUrl, pcKeyboard } 일반 설정에서 켜져 있는 것 (꺼져 있으면 항목을 숨긴다)
 *  offFeatures: [{ key, icon }] 고속 모드에서 꺼지는 기능 중 지금 켜져 있는 것 (항상 꺼지는 것은 시트가 직접 넣는다)
 *  statsStore: 이 폰에서 잰 세션 측정값 (aggregateFastStats 입력)
 *  running: 고속 모드가 이미 켜져 있으면 true (버튼이 '적용')
 *  onStart(profile, rule), onClose()
 */
export default function FastScanSheet({ visible, t, profile, rule, currentBarcodeTypes, available, offFeatures, statsStore, running, onStart, onClose, onResetStats }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(profile);
  const [draftRule, setDraftRule] = useState(rule);
  useEffect(() => {
    if (visible) {
      setDraft(profile);
      setDraftRule(rule);
    }
  }, [visible, profile, rule]);

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const statFor = (preset, custom) => {
    const types = fastProfileBarcodes({ ...draft, preset, custom: custom || draft.custom }, currentBarcodeTypes);
    return aggregateFastStats(statsStore, fastStatsKey(types, draft.strictConfirm));
  };

  const formatStat = (stat) => {
    if (!stat) return t('fastScan.sheet.notMeasured');
    const parts = [];
    if (stat.decodeMs !== null) parts.push(t('fastScan.sheet.statDecode', { ms: stat.decodeMs.toFixed(0) }));
    if (stat.gapMs !== null) parts.push(t('fastScan.sheet.statGap', { seconds: (stat.gapMs / 1000).toFixed(2) }));
    parts.push(t('fastScan.sheet.statSessions', { count: String(stat.sessions) }));
    return parts.join(' · ');
  };

  const selectedTypes = fastProfileBarcodes(draft, currentBarcodeTypes);
  const hasDataMatrix = selectedTypes.includes('datamatrix');

  // 지금 고른 구성과 Data Matrix를 뺀 구성의 측정값 비교 (둘 다 잰 적이 있을 때만)
  const dmCompare = useMemo(() => {
    if (!hasDataMatrix || selectedTypes.length < 2) return null;
    const withDm = aggregateFastStats(statsStore, fastStatsKey(selectedTypes, draft.strictConfirm));
    const withoutDm = aggregateFastStats(statsStore, fastStatsKey(selectedTypes.filter((x) => x !== 'datamatrix'), draft.strictConfirm));
    if (!withDm || !withoutDm || withDm.decodeMs === null || withoutDm.decodeMs === null) return null;
    return { withMs: withDm.decodeMs, withoutMs: withoutDm.decodeMs };
  }, [hasDataMatrix, selectedTypes, statsStore, draft.strictConfirm]);

  const alwaysOff = [
    { key: 'resultWindow', icon: 'albums-outline' },
    { key: 'overlay', icon: 'scan-outline' },
    { key: 'rules', icon: 'git-branch-outline' },
  ];
  const offList = [...alwaysOff, ...(offFeatures || [])];

  const toggles = [
    available.sound && { key: 'sound', icon: 'volume-high-outline', cost: 'costTiny' },
    available.haptic && { key: 'haptic', icon: 'phone-portrait-outline', cost: 'costTiny' },
    { key: 'saveHistory', icon: 'time-outline', cost: 'costBackground' },
    available.realtime && { key: 'realtime', icon: 'desktop-outline', cost: 'costBackground' },
    available.scanUrl && { key: 'scanUrl', icon: 'link-outline', cost: 'costBackground' },
    available.pcKeyboard && { key: 'pcKeyboard', icon: 'keypad-outline', cost: 'costBackground' },
    { key: 'strictConfirm', icon: 'shield-checkmark-outline', cost: 'costFrame' },
  ].filter(Boolean);

  const ruleLabel = (r) => (r === 'trigger' ? t('fastScan.ruleTrigger')
    : r === 'once' ? t('fastScan.sheet.ruleOnce')
    : t('fastScan.sheet.ruleEvery', { seconds: String(Number(r) / 1000) }));

  const canStart = selectedTypes.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Ionicons name="flash" size={18} color={SCAN_THEME.primary || '#4C7DF0'} />
            <Text style={styles.title} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.title')}</Text>
          </View>
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.subtitle')}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            {/* ① 읽을 바코드 */}
            <Text style={styles.section} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.barcodes')}</Text>
            <Text style={[styles.hint, { marginTop: -4, marginBottom: 8 }]} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.statsHint')}</Text>
            {FAST_PRESET_IDS.map((id) => {
              const on = draft.preset === id;
              const types = fastProfileBarcodes({ ...draft, preset: id }, currentBarcodeTypes);
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.option, on && styles.optionOn]}
                  onPress={() => set({ preset: id })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? TEXT : TEXT3} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.optionTitle} maxFontSizeMultiplier={1.2}>{t(`fastScan.sheet.preset.${id}`)}</Text>
                    <Text style={styles.optionDesc} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      {id === 'custom' && !on ? t('fastScan.sheet.customHint') : types.map((x) => BARCODE_LABELS[x] || x).join(' · ')}
                    </Text>
                    <Text style={styles.optionStat} maxFontSizeMultiplier={1.2}>{formatStat(statFor(id))}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {draft.preset === 'custom' && (
              <View style={styles.chipWrap}>
                {ALL_BARCODE_TYPES.map((type) => {
                  const on = draft.custom.includes(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => set({ custom: on ? draft.custom.filter((x) => x !== type) : [...draft.custom, type] })}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]} maxFontSizeMultiplier={1.2}>{BARCODE_LABELS[type]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
              {hasDataMatrix ? t('fastScan.sheet.dataMatrixHint') : t('fastScan.sheet.fewerHint')}
            </Text>
            {dmCompare && (
              <Text style={styles.compare} maxFontSizeMultiplier={1.2}>
                {t('fastScan.sheet.dmCompare', { with: dmCompare.withMs.toFixed(0), without: dmCompare.withoutMs.toFixed(0) })}
              </Text>
            )}

            {/* ② 꺼지는 기능 */}
            <Text style={styles.section} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.offTitle')}</Text>
            <View style={styles.group}>
              {offList.map((item) => (
                <View key={item.key} style={styles.row}>
                  <Ionicons name={item.icon} size={18} color={TEXT3} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} maxFontSizeMultiplier={1.2}>{t(`fastScan.sheet.off.${item.key}`)}</Text>
                    <Text style={styles.rowDesc} maxFontSizeMultiplier={1.2}>{t(`fastScan.sheet.offWhy.${item.key}`)}</Text>
                  </View>
                  <Text style={styles.offTag} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.offTag')}</Text>
                </View>
              ))}
            </View>

            {/* ③ 켜 둘 기능 */}
            <Text style={styles.section} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.onTitle')}</Text>
            <View style={styles.group}>
              {toggles.map((item) => (
                <View key={item.key} style={styles.row}>
                  <Ionicons name={item.icon} size={18} color={draft[item.key] ? TEXT : TEXT3} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} maxFontSizeMultiplier={1.2}>{t(`fastScan.sheet.on.${item.key}`)}</Text>
                    <Text style={styles.rowDesc} maxFontSizeMultiplier={1.2}>{t(`fastScan.sheet.${item.cost}`)}</Text>
                  </View>
                  <Switch
                    value={!!draft[item.key]}
                    onValueChange={(v) => set({ [item.key]: v })}
                    accessibilityLabel={t(`fastScan.sheet.on.${item.key}`)}
                  />
                </View>
              ))}
            </View>

            {/* ④ 같은 코드 규칙 */}
            <Text style={styles.section} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.repeatTitle')}</Text>
            <View style={styles.chipWrap}>
              {FAST_REPEAT_RULES.map((r) => {
                const on = draftRule === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setDraftRule(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]} maxFontSizeMultiplier={1.2}>{ruleLabel(r)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.hint, { marginTop: 16 }]} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.reopenHint')}</Text>
            {onResetStats && statsStore && Object.keys(statsStore).length > 0 && (
              <TouchableOpacity style={styles.resetStats} onPress={onResetStats} accessibilityRole="button">
                <Ionicons name="trash-outline" size={14} color={TEXT3} />
                <Text style={styles.resetStatsText} maxFontSizeMultiplier={1.2}>{t('fastScan.sheet.resetStats')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonGhostText} maxFontSizeMultiplier={1.2}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, !canStart && { opacity: 0.4 }]}
              disabled={!canStart}
              onPress={() => onStart(draft, draftRule)}
              accessibilityRole="button"
            >
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={styles.buttonPrimaryText} maxFontSizeMultiplier={1.2}>{running ? t('fastScan.sheet.apply') : t('fastScan.sheet.start')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: SHEET_BG, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: TEXT, fontSize: 18, fontWeight: '700' },
  subtitle: { color: TEXT2, fontSize: 13, marginTop: 4, marginBottom: 6 },
  scroll: { flexGrow: 0 },
  section: { color: TEXT2, fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, backgroundColor: ROW_BG, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  optionOn: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.1)' },
  optionTitle: { color: TEXT, fontSize: 15, fontWeight: '600' },
  optionDesc: { color: TEXT2, fontSize: 12, marginTop: 2 },
  optionStat: { color: TEXT3, fontSize: 11, marginTop: 3, fontVariant: ['tabular-nums'] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: ROW_BG, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  chipOn: { backgroundColor: '#F2F4F7' },
  chipText: { color: TEXT2, fontSize: 13, fontWeight: '500' },
  chipTextOn: { color: '#0B0D10', fontWeight: '700' },
  hint: { color: TEXT3, fontSize: 12, marginTop: 8, lineHeight: 17 },
  compare: { color: TEXT, fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },
  group: { borderRadius: 14, backgroundColor: ROW_BG, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 52 },
  rowTitle: { color: TEXT, fontSize: 14, fontWeight: '500' },
  rowDesc: { color: TEXT3, fontSize: 11, marginTop: 2 },
  offTag: { color: TEXT3, fontSize: 12, fontWeight: '600' },
  resetStats: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 10, marginTop: 4 },
  resetStatsText: { color: TEXT3, fontSize: 12, textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 10 },
  button: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  buttonGhost: { backgroundColor: 'rgba(255,255,255,0.08)' },
  buttonGhostText: { color: TEXT, fontSize: 15, fontWeight: '600' },
  buttonPrimary: { flex: 2, backgroundColor: '#3E6FE0' },
  buttonPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
