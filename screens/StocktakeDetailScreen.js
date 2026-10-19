// screens/StocktakeDetailScreen.js - 재고 실사 진행: 진행률, 상태별 목록(누락·부족·완료·초과·목록 외), 수량 고치기, 보고서
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import {
  loadStocktakes, upsertStocktake, deleteStocktake, setActiveStocktake, summarizeStocktake,
  stocktakeStatusOf, setStocktakeCount, stocktakeCsv, ACTIVE_STOCKTAKE_KEY,
} from '../utils/stocktake';
import { trackStocktakeFinished } from '../utils/analytics';

const FILTERS = ['todo', 'missing', 'partial', 'complete', 'over', 'extra', 'all'];

export default function StocktakeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  const [stocktake, setStocktake] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [filter, setFilter] = useState('todo');

  useFocusEffect(useCallback(() => {
    (async () => {
      const list = await loadStocktakes();
      const st = list.find(x => x.id === id) || null;
      setStocktake(st);
      setIsActive(!!st && (await AsyncStorage.getItem(ACTIVE_STOCKTAKE_KEY)) === st.id && !st.finishedAt);
    })();
  }, [id]));

  const sum = useMemo(() => (stocktake ? summarizeStocktake(stocktake) : null), [stocktake]);

  const rows = useMemo(() => {
    if (!stocktake) return [];
    const all = [
      ...stocktake.items.map(i => ({ ...i, status: stocktakeStatusOf(i) })),
      ...stocktake.extras.map(e => ({ ...e, name: '', expected: undefined, status: 'extra' })),
    ];
    if (filter === 'all') return all;
    if (filter === 'todo') return all.filter(r => r.status === 'missing' || r.status === 'partial');
    return all.filter(r => r.status === filter);
  }, [stocktake, filter]);

  const persist = async (next) => {
    setStocktake(next);
    await upsertStocktake(next);
  };

  const toggleActive = async () => {
    if (isActive) {
      await setActiveStocktake(null);
      setIsActive(false);
    } else {
      await setActiveStocktake(stocktake.id);
      setIsActive(true);
      feedback.info(t('stocktake.resumedHint'));
    }
  };

  const finish = () => {
    Alert.alert(t('stocktake.finishTitle'), t('stocktake.finishMessage', { missing: sum.missing + sum.partial, extra: sum.extra }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('stocktake.finish'),
        onPress: async () => {
          await persist({ ...stocktake, finishedAt: Date.now() });
          await setActiveStocktake(null);
          trackStocktakeFinished(sum.total, sum.missing + sum.partial, sum.extra);
          setIsActive(false);
        },
      },
    ]);
  };

  const exportReport = async () => {
    try {
      const csv = stocktakeCsv(stocktake, t);
      const uri = `${FileSystem.cacheDirectory}stocktake_${stocktake.id}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: t('stocktake.report') });
    } catch (error) {
      console.error('Stocktake export error:', error);
      feedback.error(t('stocktake.exportError'));
    }
  };

  const remove = () => {
    Alert.alert(t('stocktake.deleteTitle'), t('stocktake.deleteMessage', { name: stocktake.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteStocktake(stocktake.id); router.back(); } },
    ]);
  };

  if (!stocktake || !sum) return <View style={[s.container, { backgroundColor: colors.background }]} />;

  const filterCount = (f) => {
    if (f === 'all') return sum.total + sum.extra;
    if (f === 'todo') return sum.missing + sum.partial;
    return sum[f];
  };

  // 상태 배지: 연한 바탕 + 진한 글자
  const TONE = {
    missing: { bg: colors.raised, fg: colors.textSecondary },
    partial: { bg: colors.warningSoft, fg: colors.warning },
    over: { bg: colors.warningSoft, fg: colors.warning },
    complete: { bg: colors.successSoft, fg: colors.success },
    extra: { bg: colors.errorSoft, fg: colors.error },
  };

  const done = sum.complete + sum.over;
  const percent = Math.round(sum.progress * 100);
  const share = (n) => (sum.total ? `${(n / sum.total) * 100}%` : '0%');
  const statusPill = stocktake.finishedAt
    ? { label: t('stocktake.finished'), bg: colors.primarySoft, fg: colors.primaryText, dot: false }
    : isActive
      ? { label: t('stocktake.active'), bg: colors.successSoft, fg: colors.success, dot: true }
      : { label: t('stocktake.paused'), bg: colors.raised, fg: colors.textSecondary, dot: false };
  const stats = [
    { key: 'complete', count: sum.complete, color: colors.success },
    { key: 'partial', count: sum.partial, color: colors.warning },
    { key: 'missing', count: sum.missing, color: colors.text },
    { key: 'extra', count: sum.extra, color: colors.error },
  ];

  const renderRow = ({ item, index }) => {
    const first = index === 0;
    const last = index === rows.length - 1;
    const tone = TONE[item.status];
    return (
      <View
        style={[
          s.row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderTopWidth: first ? 1 : 0,
            borderBottomWidth: last ? 1 : StyleSheet.hairlineWidth,
            borderBottomColor: last ? colors.border : colors.borderLight,
          },
          first && s.rowFirst,
          last && s.rowLast,
        ]}
      >
        <View style={s.rowText}>
          {item.name ? (
            <>
              <Text style={[s.itemName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[s.itemCode, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">{item.code}</Text>
            </>
          ) : (
            <Text style={[s.itemName, { color: colors.text, fontFamily: MONO }]} numberOfLines={1} ellipsizeMode="middle">{item.code}</Text>
          )}
        </View>
        <View style={s.rowRight}>
          <View style={[s.badge, { backgroundColor: tone.bg }]}>
            <Text style={[s.badgeText, { color: tone.fg, fontFamily: fonts.semiBold }]}>{t(`stocktake.status.${item.status}`)}</Text>
          </View>
          <Text style={[s.qty, { color: colors.text }]}>
            {item.scanned}{item.expected !== undefined ? <Text style={{ color: colors.textSecondary }}>/{item.expected}</Text> : null}
          </Text>
        </View>
        {!stocktake.finishedAt && (
          <View style={[s.stepper, { backgroundColor: colors.raised }]}>
            <MaterialPressable style={s.stepButton} onPress={() => persist(setStocktakeCount(stocktake, item.code, item.scanned - 1))} accessibilityLabel={t('quantity.decrease')}>
              <Ionicons name="remove" size={18} color={colors.text} />
            </MaterialPressable>
            <View style={[s.stepDivider, { backgroundColor: colors.border }]} />
            <MaterialPressable style={s.stepButton} onPress={() => persist(setStocktakeCount(stocktake, item.code, item.scanned + 1))} accessibilityLabel={t('quantity.increase')}>
              <Ionicons name="add" size={18} color={colors.text} />
            </MaterialPressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{stocktake.name}</Text>
        <MaterialPressable onPress={exportReport} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('stocktake.report')}>
          <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
        </MaterialPressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.status}-${r.code}`}
        renderItem={renderRow}
        contentContainerStyle={[s.content, { paddingBottom: 24 + insets.bottom }]}
        ListHeaderComponent={
          <View>
            <View style={[s.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.summaryTop}>
                <View style={[s.pill, { backgroundColor: statusPill.bg }]}>
                  {statusPill.dot && <View style={[s.pillDot, { backgroundColor: statusPill.fg }]} />}
                  <Text style={[s.pillText, { color: statusPill.fg, fontFamily: fonts.semiBold }]}>{statusPill.label}</Text>
                </View>
                <Text style={[s.qtyProgress, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                  {t('stocktake.qtyProgress', { scanned: sum.scannedQty, expected: sum.expectedQty })} · {percent}%
                </Text>
              </View>

              <View style={s.countRow} accessible accessibilityLabel={t('stocktake.progress', { done, total: sum.total })}>
                <Text style={[s.bigNumber, { color: colors.text, fontFamily: fonts.bold }]}>{done}</Text>
                <Text style={[s.bigTotal, { color: colors.textSecondary, fontFamily: fonts.regular }]}>/ {sum.total}</Text>
              </View>

              <View style={[s.bar, { backgroundColor: colors.border }]}>
                <View style={{ width: share(done), backgroundColor: colors.success }} />
                <View style={{ width: share(sum.partial), backgroundColor: colors.warning }} />
              </View>

              <View style={s.stats}>
                {stats.map(st => (
                  <View key={st.key} style={s.stat}>
                    <Text style={[s.statCount, { color: st.color, fontFamily: fonts.bold }]}>{st.count}</Text>
                    <Text style={[s.statLabel, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>{t(`stocktake.status.${st.key}`)}</Text>
                  </View>
                ))}
              </View>

              {!stocktake.finishedAt && (
                <>
                  {!isActive && (
                    <MaterialPressable style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={toggleActive} accessibilityRole="button">
                      <Ionicons name="play" size={18} color="#FFFFFF" />
                      <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('stocktake.resume')}</Text>
                    </MaterialPressable>
                  )}
                  <View style={s.actions}>
                    {isActive && (
                      <MaterialPressable style={[s.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]} onPress={toggleActive} accessibilityRole="button">
                        <Ionicons name="pause" size={16} color={colors.text} />
                        <Text style={[s.secondaryButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('stocktake.pause')}</Text>
                      </MaterialPressable>
                    )}
                    <MaterialPressable style={[s.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]} onPress={finish} accessibilityRole="button">
                      <Ionicons name="checkmark-done" size={16} color={colors.text} />
                      <Text style={[s.secondaryButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('stocktake.finish')}</Text>
                    </MaterialPressable>
                  </View>
                </>
              )}
              {isActive && (
                <Text style={[s.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('stocktake.activeHint')}</Text>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filters}>
              {FILTERS.map((f) => {
                const selected = filter === f;
                return (
                  <MaterialPressable
                    key={f}
                    style={[s.filterChip, { backgroundColor: selected ? colors.text : colors.surface, borderColor: selected ? colors.text : colors.border }]}
                    onPress={() => setFilter(f)}
                    hitSlop={{ top: 4, bottom: 4 }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.filterText, { color: selected ? colors.background : colors.text, fontFamily: selected ? fonts.semiBold : fonts.medium, fontWeight: selected ? '600' : '500' }]}>
                      {t(`stocktake.filter.${f}`)} {filterCount(f)}
                    </Text>
                  </MaterialPressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <Text style={[s.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('stocktake.emptyFilter')}</Text>
        }
        ListFooterComponent={
          <MaterialPressable style={s.deleteButton} onPress={remove} accessibilityRole="button">
            <Text style={[s.deleteText, { color: colors.error, fontFamily: fonts.medium }]}>{t('stocktake.delete')}</Text>
          </MaterialPressable>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  summary: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card, gap: 14, marginBottom: SPACE.section },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  qtyProgress: { fontSize: 13, flexShrink: 1 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigNumber: { fontSize: 40, fontWeight: '700', letterSpacing: -1 },
  bigTotal: { fontSize: 18 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 2 },
  statCount: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: SIZE.primaryButton, borderRadius: RADIUS.button, overflow: 'hidden' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.button, borderRadius: RADIUS.control, borderWidth: 1, overflow: 'hidden' },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  filterScroll: { marginHorizontal: -SPACE.screen, marginBottom: SPACE.section },
  filters: { flexDirection: 'row', gap: SPACE.gap, paddingHorizontal: SPACE.screen, paddingVertical: 4 },
  filterChip: { height: SIZE.chip, paddingHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 1, justifyContent: 'center', overflow: 'hidden' },
  filterText: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: SIZE.rowWithDesc, paddingVertical: 10, paddingHorizontal: 16, borderLeftWidth: 1, borderRightWidth: 1 },
  rowFirst: { borderTopLeftRadius: RADIUS.group, borderTopRightRadius: RADIUS.group },
  rowLast: { borderBottomLeftRadius: RADIUS.group, borderBottomRightRadius: RADIUS.group },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  itemName: { ...TYPE.body },
  itemCode: { fontFamily: MONO, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 6, justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  qty: { fontFamily: MONO, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.control, overflow: 'hidden' },
  stepButton: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center' },
  stepDivider: { width: 1, height: 20 },
  emptyText: { textAlign: 'center', marginVertical: 24, fontSize: 14 },
  deleteButton: { minHeight: SIZE.button, alignItems: 'center', justifyContent: 'center', marginTop: 16, borderRadius: RADIUS.button, overflow: 'hidden' },
  deleteText: { fontSize: 15, fontWeight: '500' },
});
