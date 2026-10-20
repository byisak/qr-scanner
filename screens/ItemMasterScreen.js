// screens/ItemMasterScreen.js - 품목 관리: 코드 → 품명 사전. 엑셀·CSV 불러오기, 붙여 넣기, 서식 파일, 내보내기
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Alert, ActivityIndicator, Platform, ActionSheetIOS } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { loadItems, subscribeItems, clearItems } from '../utils/itemMaster';
import { readRowsFromFile, buildTemplateBase64, buildExportXlsxBase64, buildExportCsv } from '../utils/itemImport';
import { setPendingImport } from '../utils/itemImportSession';
import { trackEvent } from '../utils/analytics';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { ITEM_MASTER_FREE_LIMIT } from '../config/lockedFeatures';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ItemMasterScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const colors = isDark ? Colors.dark : Colors.light;
  const { isLocked } = useFeatureLock();
  const limited = isLocked('itemMasterUnlimited');
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => loadItems().then(list => { if (alive) setItems(list.slice()); });
    refresh();
    const unsubscribe = subscribeItems(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      it.code.toLowerCase().includes(q) ||
      it.name.toLowerCase().includes(q) ||
      (it.spec || '').toLowerCase().includes(q) ||
      (it.location || '').toLowerCase().includes(q) ||
      (it.altCodes || []).some(c => c.toLowerCase().includes(q)));
  }, [items, query]);

  const shareFile = async (fileName, content, encoding, mimeType) => {
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, content, { encoding });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName });
    } else {
      Alert.alert(t('itemMaster.saved'), uri);
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if (!/\.(xlsx|xlsm|xls|csv|txt|tsv)$/i.test(asset.name || '')) {
        feedback.error(t('itemMaster.unsupportedFile'));
        return;
      }
      setBusy(true);
      const rows = await readRowsFromFile({ uri: asset.uri, name: asset.name });
      if (!rows.length) {
        feedback.error(t('itemMaster.emptyFile'));
        return;
      }
      setPendingImport({ rows, source: 'file', fileName: asset.name });
      router.push('/item-import');
    } catch (e) {
      console.warn('[itemMaster] read file failed:', e?.message);
      feedback.error(t('itemMaster.readFailed'));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await shareFile(t('itemMaster.templateFileName'), buildTemplateBase64(t), FileSystem.EncodingType.Base64, XLSX_MIME);
      trackEvent('item_template_downloaded');
    } catch (e) {
      feedback.error(t('itemMaster.exportFailed'));
    }
  };

  const exportAs = async (format) => {
    if (!items?.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      if (format === 'xlsx') {
        await shareFile(`items_${stamp}.xlsx`, buildExportXlsxBase64(items, t), FileSystem.EncodingType.Base64, XLSX_MIME);
      } else {
        await shareFile(`items_${stamp}.csv`, buildExportCsv(items, t), FileSystem.EncodingType.UTF8, 'text/csv');
      }
      trackEvent('item_master_exported', { format, item_count: items.length });
    } catch (e) {
      feedback.error(t('itemMaster.exportFailed'));
    }
  };

  const confirmClear = () => {
    Alert.alert(t('itemMaster.clearTitle'), t('itemMaster.clearMessage', { count: items?.length || 0 }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('itemMaster.clearAll'), style: 'destructive', onPress: async () => { await clearItems(); feedback.success(t('itemMaster.cleared')); } },
    ]);
  };

  // 더보기: iOS는 액션 시트, Android는 알림 창 목록
  const openMore = () => {
    const actions = [
      { label: t('itemMaster.downloadTemplate'), run: downloadTemplate },
      ...(items?.length ? [
        { label: t('itemMaster.exportXlsx'), run: () => exportAs('xlsx') },
        { label: t('itemMaster.exportCsv'), run: () => exportAs('csv') },
        { label: t('itemMaster.clearAll'), run: confirmClear, destructive: true },
      ] : []),
    ];
    if (Platform.OS === 'ios') {
      const destructiveButtonIndex = actions.findIndex(a => a.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...actions.map(a => a.label), t('common.cancel')], cancelButtonIndex: actions.length, destructiveButtonIndex: destructiveButtonIndex === -1 ? undefined : destructiveButtonIndex },
        (i) => { if (i < actions.length) actions[i].run(); }
      );
    } else {
      Alert.alert(t('itemMaster.title'), undefined, [
        ...actions.map(a => ({ text: a.label, style: a.destructive ? 'destructive' : 'default', onPress: a.run })),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const renderItem = useCallback(({ item }) => {
    const meta = [item.spec, item.unit, item.location].filter(Boolean).join(' · ');
    return (
      <MaterialPressable
        style={[s.row, { borderBottomColor: colors.borderLight }]}
        onPress={() => router.push({ pathname: '/item-edit', params: { code: item.code } })}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.code}`}
      >
        <View style={s.rowText}>
          <Text style={[s.rowName, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[s.rowCode, { color: colors.textSecondary }]} numberOfLines={1}>{item.code}</Text>
          {!!meta && <Text style={[s.rowMeta, { color: colors.textTertiary, fontFamily: fonts.regular }]} numberOfLines={1}>{meta}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </MaterialPressable>
    );
  }, [colors, fonts, router]);

  const actionButton = (icon, label, onPress, primary) => (
    <MaterialPressable
      style={[s.action, primary ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={18} color={primary ? '#FFFFFF' : colors.primaryText} />
      <Text style={[s.actionText, { color: primary ? '#FFFFFF' : colors.primaryText, fontFamily: fonts.semiBold }]} numberOfLines={1}>{label}</Text>
    </MaterialPressable>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable onPress={() => router.back()} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('itemMaster.title')}</Text>
        <MaterialPressable onPress={openMore} style={s.iconButton} accessibilityRole="button" accessibilityLabel={t('itemMaster.more')}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </MaterialPressable>
      </View>

      <View style={s.actions}>
        {actionButton('document-outline', t('itemMaster.importFile'), pickFile, true)}
        {actionButton('clipboard-outline', t('itemMaster.paste'), () => router.push({ pathname: '/item-import', params: { mode: 'paste' } }))}
        {actionButton('add', t('itemMaster.add'), () => router.push('/item-edit'))}
      </View>

      {items === null || busy ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="pricetags-outline" size={44} color={colors.textTertiary} />
          <Text style={[s.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('itemMaster.emptyTitle')}</Text>
          <Text style={[s.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('itemMaster.emptyDesc')}</Text>
          <MaterialPressable style={[s.templateButton, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={downloadTemplate} accessibilityRole="button">
            <Ionicons name="download-outline" size={18} color={colors.primaryText} />
            <Text style={[s.actionText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>{t('itemMaster.downloadTemplate')}</Text>
          </MaterialPressable>
          <Text style={[s.emptyHint, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('itemMaster.sendToPhoneHint')}</Text>
        </View>
      ) : (
        <>
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
              returnKeyType="search"
            />
          </View>
          <Text style={[s.count, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
            {query.trim()
              ? t('itemMaster.searchCount', { count: filtered.length, total: items.length })
              : limited ? t('itemMaster.countOfLimit', { count: items.length, limit: ITEM_MASTER_FREE_LIMIT }) : t('itemMaster.count', { count: items.length })}
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.code}
            renderItem={renderItem}
            initialNumToRender={20}
            windowSize={10}
            keyboardShouldPersistTaps="handled"
            style={[s.list, { backgroundColor: colors.surface, borderColor: colors.border }]}
            contentContainerStyle={{ paddingBottom: 8 }}
            ListFooterComponent={<View style={{ height: insets.bottom }} />}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  actions: { flexDirection: 'row', gap: SPACE.gap, paddingHorizontal: SPACE.screen, marginBottom: SPACE.section },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.button, borderRadius: RADIUS.control, overflow: 'hidden', paddingHorizontal: 8 },
  actionText: { fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACE.screen, borderWidth: 1, borderRadius: RADIUS.control, paddingHorizontal: 12, height: SIZE.input },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  count: { fontSize: 12, marginHorizontal: SPACE.screen + 4, marginTop: 10, marginBottom: 6 },
  list: { flex: 1, marginHorizontal: SPACE.screen, borderWidth: 1, borderRadius: RADIUS.group, marginBottom: SPACE.screen },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.rowWithDesc, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15 },
  rowCode: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 56 },
  emptyTitle: { fontSize: 16, marginTop: 12 },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  emptyHint: { fontSize: 12, marginTop: 14, textAlign: 'center', lineHeight: 18 },
  templateButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingHorizontal: 18, height: SIZE.button, borderRadius: RADIUS.control, borderWidth: 1, overflow: 'hidden' },
});
