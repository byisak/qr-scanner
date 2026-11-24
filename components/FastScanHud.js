// components/FastScanHud.js - 고속 스캔 모드 현황판: 마지막 값·수량·합계·전송 대기 + 같은 코드 규칙·트리거 버튼
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { SCAN_THEME, SCAN_TEXT } from '../constants/scanTheme';

export default function FastScanHud({
  t,
  stats, // { lastCode, lastQty, total, kinds, intervalMs, delayMs }
  timing, // { fps, avgMs, maxMs, lagMs } | null: 1초 평균 판독 통계
  sendStats, // { pending, failed } | null (전송 기능이 꺼져 있으면 null)
  rule,
  onCycleRule,
  onMinus,
  onSetQuantity,
  onReset,
  onTrigger,
  onOpenSettings, // 구성 시트 열기
  zoom, // 확대 배율 (1 ~ 4)
  onZoomChange, // (value) => void, 손을 뗄 때 저장
}) {
  const [zoomDraft, setZoomDraft] = useState(zoom || 1);
  useEffect(() => { setZoomDraft(zoom || 1); }, [zoom]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => { if (editing) setDraft(String(stats.lastQty || 1)); }, [editing]);

  const hasLast = !!stats.lastCode;
  const ruleLabel = rule === 'trigger' ? t('fastScan.ruleTrigger')
    : rule === 'once' ? t('fastScan.ruleOnce')
    : t('fastScan.ruleInterval', { seconds: String(Number(rule) / 1000) });

  const submitEdit = () => {
    const value = parseInt(draft, 10);
    setEditing(false);
    if (Number.isFinite(value) && value >= 0 && value <= 99999) onSetQuantity(value);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {rule === 'trigger' && (
        <TouchableOpacity style={styles.trigger} onPress={onTrigger} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('fastScan.trigger')}>
          <Ionicons name="scan" size={22} color="#0B0D10" />
          <Text style={styles.triggerText} maxFontSizeMultiplier={1.2}>{t('fastScan.trigger')}</Text>
        </TouchableOpacity>
      )}

      {onZoomChange && (
        <View style={styles.zoomRow}>
          <Ionicons name="remove" size={16} color={SCAN_TEXT.secondary} />
          <Slider
            style={{ flex: 1, height: 32 }}
            minimumValue={1}
            maximumValue={4}
            step={0.1}
            value={zoomDraft}
            onValueChange={(v) => { setZoomDraft(v); onZoomChange(v, false); }}
            onSlidingComplete={(v) => onZoomChange(v, true)}
            minimumTrackTintColor="#F2F4F7"
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#F2F4F7"
            accessibilityLabel={t('fastScan.zoom')}
          />
          <Ionicons name="add" size={16} color={SCAN_TEXT.secondary} />
          <Text style={styles.zoomText} maxFontSizeMultiplier={1.2}>{zoomDraft.toFixed(1)}×</Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.code, !hasLast && styles.dim]} numberOfLines={1} ellipsizeMode="middle" maxFontSizeMultiplier={1.2}>
            {hasLast ? stats.lastCode : t('fastScan.ready')}
          </Text>
          {hasLast && (
            <>
              <TouchableOpacity style={styles.qty} onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={t('fastScan.editQuantity')}>
                <Text style={styles.qtyText} maxFontSizeMultiplier={1.2}>×{stats.lastQty}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.minus} onPress={onMinus} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('fastScan.minusOne')}>
                <Text style={styles.minusText} maxFontSizeMultiplier={1.2}>−1</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.total} maxFontSizeMultiplier={1.2}>
            {t('fastScan.total', { total: String(stats.total), kinds: String(stats.kinds) })}
          </Text>
          {stats.intervalMs > 0 && (
            <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
              {t('fastScan.interval', { ms: String(stats.intervalMs) })}
              {stats.delayMs >= 0 ? ` · ${t('fastScan.delay', { ms: String(stats.delayMs) })}` : ''}
            </Text>
          )}
        </View>

        {timing && (
          <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
            {t('fastScan.decode', { fps: String(timing.fps), avg: timing.avgMs.toFixed(0), max: timing.maxMs.toFixed(0) })}
            {timing.lagMs > 30 ? ` · ${t('fastScan.frameLag', { ms: String(timing.lagMs) })}` : ''}
          </Text>
        )}
        {timing && Number.isFinite(timing.mlMs) && (
          <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
            {t('fastScan.decodeSplit', { ml: timing.mlMs.toFixed(0), extra: (timing.extraMs || 0).toFixed(0) })}
            {timing.size ? ` · ${timing.size}` : ''}
          </Text>
        )}

        <View style={styles.row}>
          <TouchableOpacity style={styles.chip} onPress={onCycleRule} accessibilityRole="button" accessibilityHint={t('fastScan.ruleHint')}>
            <Ionicons name="repeat" size={14} color={SCAN_TEXT.primary} />
            <Text style={styles.chipText} maxFontSizeMultiplier={1.2}>{ruleLabel}</Text>
          </TouchableOpacity>
          {sendStats && (
            <View style={styles.chipPlain}>
              <Ionicons name="cloud-upload-outline" size={14} color={sendStats.failed ? SCAN_THEME.warning : SCAN_TEXT.secondary} />
              <Text style={[styles.chipText, sendStats.failed > 0 && { color: SCAN_THEME.warning }]} maxFontSizeMultiplier={1.2}>
                {t('fastScan.pending', { count: String(sendStats.pending) })}
                {sendStats.failed > 0 ? ` · ${t('fastScan.failed', { count: String(sendStats.failed) })}` : ''}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {onOpenSettings && (
            <TouchableOpacity onPress={onOpenSettings} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('fastScan.sheet.title')}>
              <Ionicons name="options-outline" size={19} color={SCAN_TEXT.secondary} />
            </TouchableOpacity>
          )}
          {stats.total > 0 && (
            <TouchableOpacity onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('fastScan.reset')}>
              <Ionicons name="refresh" size={18} color={SCAN_TEXT.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('fastScan.editQuantity')}</Text>
            <Text style={styles.modalCode} numberOfLines={1} ellipsizeMode="middle">{stats.lastCode}</Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, '').slice(0, 5))}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={submitEdit}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setEditing(false)}>
                <Text style={styles.modalButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={submitEdit}>
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', paddingHorizontal: 16, gap: 12, alignItems: 'center' },
  card: {
    alignSelf: 'stretch',
    backgroundColor: SCAN_THEME.glassCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: 20, backgroundColor: SCAN_THEME.glassCard },
  zoomText: { color: SCAN_TEXT.primary, fontSize: 13, fontWeight: '700', minWidth: 38, textAlign: 'right', fontVariant: ['tabular-nums'] },
  code: { flex: 1, color: SCAN_TEXT.primary, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dim: { color: SCAN_TEXT.tertiary, fontWeight: '400', fontSize: 14 },
  qty: { minWidth: 52, height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: SCAN_THEME.primary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: '#fff', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  minus: { width: 44, height: 36, borderRadius: 10, borderWidth: 1, borderColor: SCAN_THEME.glassBorder, alignItems: 'center', justifyContent: 'center' },
  minusText: { color: SCAN_TEXT.primary, fontSize: 15, fontWeight: '600' },
  total: { flex: 1, color: SCAN_TEXT.primary, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  meta: { color: SCAN_TEXT.tertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: SCAN_THEME.glassLight },
  chipPlain: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30 },
  chipText: { color: SCAN_TEXT.primary, fontSize: 12, fontWeight: '500' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', height: 64, borderRadius: 18, backgroundColor: '#F2F4F7',
  },
  triggerText: { color: '#0B0D10', fontSize: 17, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { alignSelf: 'stretch', backgroundColor: '#1B1F24', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalCode: { color: SCAN_TEXT.secondary, fontSize: 13 },
  input: { height: 52, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  modalButtonPrimary: { backgroundColor: SCAN_THEME.primary },
  modalButtonText: { color: SCAN_TEXT.primary, fontSize: 15, fontWeight: '600' },
});
