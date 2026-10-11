// screens/StocktakesScreen.js - 재고 실사 목록 (진행 중 / 끝난 실사)
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
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
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('stocktake.title')}</Text>
        <MaterialPressable onPress={() => router.push('/stocktake-new')} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('stocktake.new')}>
          <Ionicons name="add" size={26} color={colors.primaryText} />
        </MaterialPressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 24 + insets.bottom }]}>
        {list.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="clipboard-outline" size={40} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('stocktake.emptyTitle')}</Text>
            <Text style={[s.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('stocktake.emptyDesc')}</Text>
            <MaterialPressable style={[s.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/stocktake-new')} accessibilityRole="button">
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={[s.primaryButtonText, { fontFamily: fonts.semiBold }]}>{t('stocktake.new')}</Text>
            </MaterialPressable>
          </View>
        ) : (
          <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {list.map((st, index) => {
              const sum = summarizeStocktake(st);
              const isActive = st.id === activeId && !st.finishedAt;
              const tone = isActive
                ? { bg: colors.successSoft, fg: colors.success }
                : st.finishedAt
                  ? { bg: colors.primarySoft, fg: colors.primaryText }
                  : { bg: colors.raised, fg: colors.textSecondary };
              return (
                <MaterialPressable
                  key={st.id}
                  style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
                  onPress={() => router.push({ pathname: '/stocktake-detail', params: { id: st.id } })}
                  accessibilityRole="button"
                >
                  <View style={s.rowTop}>
                    <Text style={[s.rowTitle, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{st.name}</Text>
                    <View style={[s.badge, { backgroundColor: tone.bg }]}>
                      {isActive && <View style={[s.badgeDot, { backgroundColor: tone.fg }]} />}
                      <Text style={[s.badgeText, { color: tone.fg, fontFamily: fonts.semiBold }]}>
                        {isActive ? t('stocktake.active') : st.finishedAt ? t('stocktake.finished') : t('stocktake.paused')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.rowMeta, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                    {formatDate(st.createdAt)} · {t('stocktake.progress', { done: sum.complete + sum.over, total: sum.total })}
                    {sum.missing ? ` · ${t('stocktake.status.missing')} ${sum.missing}` : ''}
                    {sum.extra ? ` · ${t('stocktake.status.extra')} ${sum.extra}` : ''}
                  </Text>
                  <View style={[s.bar, { backgroundColor: colors.border }]}>
                    <View style={[s.barFill, { width: `${Math.round(sum.progress * 100)}%`, backgroundColor: colors.success }]} />
                  </View>
                </MaterialPressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { paddingHorizontal: SPACE.screen, paddingTop: 4 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 72 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, height: SIZE.primaryButton, borderRadius: RADIUS.button, marginTop: 20, overflow: 'hidden' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  group: { borderRadius: RADIUS.group, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: SIZE.rowWithDesc, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { ...TYPE.body, flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 22, paddingHorizontal: 8, borderRadius: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  rowMeta: { fontSize: 13 },
  bar: { height: 4, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
});
