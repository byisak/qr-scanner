// screens/StocktakeDetailScreen.js - 재고 실사 진행: 진행률, 상태별 목록(누락·부족·완료·초과·목록 외), 수량 고치기, 보고서
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Platform, Alert } from 'react-native';
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
import MaterialPressable from '../components/MaterialPressable';
import {
  loadStocktakes, upsertStocktake, deleteStocktake, setActiveStocktake, summarizeStocktake,
  stocktakeStatusOf, setStocktakeCount, stocktakeCsv, ACTIVE_STOCKTAKE_KEY,
} from '../utils/stocktake';

const FILTERS = ['todo', 'missing', 'partial', 'complete', 'over', 'extra', 'all'];
const STATUS_COLOR = { missing: '#FF3B30', partial: '#FF9500', complete: '#34C759', over: '#AF52DE', extra: '#8E8E93' };

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

  const renderRow = ({ item }) => (
    <View style={[s.row, { backgroundColor: colors.surface }]}>
      <View style={[s.dot, { backgroundColor: STATUS_COLOR[item.status] }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.code, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1} ellipsizeMode="middle">{item.code}</Text>
        <Text style={[s.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
          {item.name ? `${item.name} · ` : ''}{t(`stocktake.status.${item.status}`)}
        </Text>
      </View>
      {!stocktake.finishedAt && (
        <MaterialPressable style={[s.qtyButton, { borderColor: colors.border }]} onPress={() => persist(setStocktakeCount(stocktake, item.code, item.scanned - 1))} accessibilityLabel={t('quantity.decrease')}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </MaterialPressable>
      )}
      <Text style={[s.qty, { color: colors.text, fontFamily: fonts.bold }]}>
        {item.scanned}{item.expected !== undefined ? <Text style={{ color: colors.textTertiary, fontFamily: fonts.regular }}>/{item.expected}</Text> : null}
      </Text>
      {!stocktake.finishedAt && (
        <MaterialPressable style={[s.qtyButton, { borderColor: colors.border }]} onPress={() => persist(setStocktakeCount(stocktake, item.code, item.scanned + 1))} accessibilityLabel={t('quantity.increase')}>
          <Ionicons name="add" size={18} color={colors.text} />
        </MaterialPressable>
      )}
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{stocktake.name}</Text>
        <MaterialPressable onPress={exportReport} style={s.iconButton} accessibilityLabel={t('stocktake.report')}>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </MaterialPressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.status}-${r.code}`}
        renderItem={renderRow}
        contentContainerStyle={[s.content, { paddingBottom: 24 + insets.bottom }]}
        ListHeaderComponent={
          <View>
            <View style={[s.summary, { backgroundColor: colors.surface }]}>
              <Text style={[s.bigNumber, { color: colors.text, fontFamily: fonts.bold }]}>
                {Math.round(sum.progress * 100)}%
              </Text>
              <Text style={[s.meta, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('stocktake.progress', { done: sum.complete + sum.over, total: sum.total })} · {t('stocktake.qtyProgress', { scanned: sum.scannedQty, expected: sum.expectedQty })}
              </Text>
              <View style={[s.bar, { backgroundColor: colors.inputBackground }]}>
                <View style={[s.barFill, { width: `${Math.round(sum.progress * 100)}%`, backgroundColor: colors.primary }]} />
              </View>
              {!stocktake.finishedAt ? (
                <View style={s.actions}>
                  <MaterialPressable style={[s.actionButton, { backgroundColor: isActive ? colors.inputBackground : colors.primary }]} onPress={toggleActive} accessibilityRole="button">
                    <Ionicons name={isActive ? 'pause' : 'play'} size={16} color={isActive ? colors.text : '#fff'} />
                    <Text style={[s.actionText, { color: isActive ? colors.text : '#fff', fontFamily: fonts.semiBold }]}>
                      {isActive ? t('stocktake.pause') : t('stocktake.resume')}
                    </Text>
                  </MaterialPressable>
                  <MaterialPressable style={[s.actionButton, { backgroundColor: colors.inputBackground }]} onPress={finish} accessibilityRole="button">
                    <Ionicons name="checkmark-done" size={16} color={colors.text} />
                    <Text style={[s.actionText, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('stocktake.finish')}</Text>
                  </MaterialPressable>
                </View>
              ) : (
                <Text style={[s.meta, { color: colors.success, fontFamily: fonts.semiBold, marginTop: 10 }]}>{t('stocktake.finished')}</Text>
              )}
              {isActive && (
                <Text style={[s.hint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('stocktake.activeHint')}</Text>
              )}
            </View>

            <View style={s.filters}>
              {FILTERS.map((f) => {
                const selected = filter === f;
                return (
                  <MaterialPressable
                    key={f}
                    style={[s.filterChip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }]}
                    onPress={() => setFilter(f)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.filterText, { color: selected ? '#fff' : colors.text, fontFamily: selected ? fonts.semiBold : fonts.regular }]}>
                      {t(`stocktake.filter.${f}`)} {filterCount(f)}
                    </Text>
                  </MaterialPressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[s.emptyText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('stocktake.emptyFilter')}</Text>
        }
        ListFooterComponent={
          <MaterialPressable style={s.deleteButton} onPress={remove} accessibilityRole="button">
            <Text style={[s.deleteText, { color: colors.error || '#FF3B30', fontFamily: fonts.medium }]}>{t('stocktake.delete')}</Text>
          </MaterialPressable>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, overflow: 'hidden' },
  headerTitle: { fontSize: 18, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { padding: 16 },
  summary: { borderRadius: 12, padding: 16, marginBottom: 12 },
  bigNumber: { fontSize: 34 },
  meta: { fontSize: 13, marginTop: 2 },
  hint: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  bar: { height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 22, overflow: 'hidden' },
  actionText: { fontSize: 14 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, minHeight: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center', overflow: 'hidden' },
  filterText: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  code: { fontSize: 15 },
  qty: { fontSize: 16, minWidth: 48, textAlign: 'center' },
  qtyButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emptyText: { textAlign: 'center', marginVertical: 24, fontSize: 14 },
  deleteButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 16, borderRadius: 8, overflow: 'hidden' },
  deleteText: { fontSize: 15 },
});
