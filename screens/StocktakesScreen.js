// screens/StocktakesScreen.js - 재고 실사 목록 (진행 중 / 끝난 실사)
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import MaterialPressable from '../components/MaterialPressable';
import { loadStocktakes, summarizeStocktake, ACTIVE_STOCKTAKE_KEY } from '../utils/stocktake';

export default function StocktakesScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const [list, setList] = useState([]);
  const [activeId, setActiveId] = useState(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      setList(await loadStocktakes());
      setActiveId(await AsyncStorage.getItem(ACTIVE_STOCKTAKE_KEY));
    })();
  }, []));

  const formatDate = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('stocktake.title')}</Text>
        <MaterialPressable onPress={() => router.push('/stocktake-new')} style={s.iconButton} accessibilityLabel={t('stocktake.new')}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </MaterialPressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 24 + insets.bottom }]}>
        {list.length === 0 ? (
          <View style={[s.empty, { backgroundColor: colors.surface }]}>
            <Ionicons name="clipboard-outline" size={40} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('stocktake.emptyTitle')}</Text>
            <Text style={[s.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('stocktake.emptyDesc')}</Text>
            <MaterialPressable style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/stocktake-new')} accessibilityRole="button">
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('stocktake.new')}</Text>
            </MaterialPressable>
          </View>
        ) : list.map((st) => {
          const sum = summarizeStocktake(st);
          const isActive = st.id === activeId && !st.finishedAt;
          return (
            <MaterialPressable
              key={st.id}
              style={[s.card, { backgroundColor: colors.surface, borderColor: isActive ? colors.primary : 'transparent' }]}
              onPress={() => router.push({ pathname: '/stocktake-detail', params: { id: st.id } })}
              accessibilityRole="button"
            >
              <View style={s.cardTop}>
                <Text style={[s.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{st.name}</Text>
                <View style={[s.chip, { backgroundColor: isActive ? colors.primary + '20' : st.finishedAt ? colors.success + '20' : colors.inputBackground }]}>
                  <Text style={[s.chipText, { color: isActive ? colors.primary : st.finishedAt ? colors.success : colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {isActive ? t('stocktake.active') : st.finishedAt ? t('stocktake.finished') : t('stocktake.paused')}
                  </Text>
                </View>
              </View>
              <View style={[s.bar, { backgroundColor: colors.inputBackground }]}>
                <View style={[s.barFill, { width: `${Math.round(sum.progress * 100)}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[s.cardMeta, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {formatDate(st.createdAt)} · {t('stocktake.progress', { done: sum.complete + sum.over, total: sum.total })}
                {sum.missing ? ` · ${t('stocktake.status.missing')} ${sum.missing}` : ''}
                {sum.extra ? ` · ${t('stocktake.status.extra')} ${sum.extra}` : ''}
              </Text>
            </MaterialPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, overflow: 'hidden' },
  headerTitle: { fontSize: 18 },
  content: { padding: 16 },
  empty: { borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 16, marginTop: 12 },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, minHeight: 44, borderRadius: 22, marginTop: 16, overflow: 'hidden' },
  primaryButtonText: { color: '#fff', fontSize: 15 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1.5, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText: { fontSize: 12 },
  bar: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  cardMeta: { fontSize: 13, marginTop: 8 },
});
