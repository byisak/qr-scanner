// screens/ExportHistoryScreen.js - 기록 내보내기 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { labelOfItem, fieldNameAt } from '../utils/labelParser';
import { parseGs1, formatGs1Summary } from '../utils/gs1';
import { loadLabelSettings } from '../utils/labelCategories';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';

const DEFAULT_GROUP_ID = 'default';

export default function ExportHistoryScreen() {
  const router = useRouter();
  const { t, fonts, language } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  const [groups, setGroups] = useState([]);
  const [scanHistory, setScanHistory] = useState({});
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingTxt, setIsExportingTxt] = useState(false);
  const [labelCategories, setLabelCategories] = useState([]);

  // 선택한 그룹에 실제로 쓰인 카테고리의 필드 이름을 모아 열로 만든다 (같은 이름은 한 열로)
  const labelColumns = () => {
    const used = new Set();
    selectedGroups.forEach((groupId) => {
      (scanHistory[groupId] || []).forEach((item) => {
        const label = labelOfItem(item, labelCategories);
        if (label) used.add(label.category.id);
      });
    });
    const columns = [];
    labelCategories.filter(c => used.has(c.id)).forEach((category) => {
      category.fields.forEach((name, index) => {
        const column = fieldNameAt(category, index, t);
        if (!columns.includes(column)) columns.push(column);
      });
    });
    return columns;
  };

  useEffect(() => {
    (async () => {
      try {
        const groupsData = await AsyncStorage.getItem('scanGroups');
        const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
        loadLabelSettings().then(ls => setLabelCategories(ls.categories)).catch(() => {});

        if (groupsData) {
          const parsed = JSON.parse(groupsData);
          setGroups(parsed.length > 0 ? parsed : [{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
          // 기본적으로 모든 그룹 선택
          setSelectedGroups(parsed.map(g => g.id));
        } else {
          setGroups([{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
          setSelectedGroups([DEFAULT_GROUP_ID]);
        }

        if (historyData) {
          const parsed = JSON.parse(historyData);
          setScanHistory(parsed);
        }
      } catch (error) {
        console.error('Load export data error:', error);
      }
    })();
  }, []);

  // 그룹 선택 토글
  const toggleGroup = (groupId) => {
    setSelectedGroups((prev) => {
      if (prev.includes(groupId)) {
        // 최소 1개는 선택되어야 함
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((id) => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([groups[0]?.id || DEFAULT_GROUP_ID]); // 최소 1개는 유지
    } else {
      setSelectedGroups(groups.map((g) => g.id));
    }
  };

  const allSelected = selectedGroups.length === groups.length;

  // 날짜 포맷
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const locale = language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : language === 'vi' ? 'vi-VN' : 'en-US';
    return date.toLocaleString(locale);
  };

  // CSV 생성
  const generateCSV = () => {
    // UTF-8 BOM 추가 (한글 깨짐 방지)
    const columns = labelColumns();
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    // 위치 열은 위치가 기록된 항목이 하나라도 있을 때만
    const hasLocation = selectedGroups.some(groupId => (scanHistory[groupId] || []).some(item => item.location));
    const anyItem = (fn) => selectedGroups.some(groupId => (scanHistory[groupId] || []).some(fn));
    const hasQuantity = anyItem(item => typeof item.quantity === 'number');
    const hasMemo = anyItem(item => item.memo);
    const gs1Of = (item) => item.gs1 || parseGs1(item.code);
    const hasGs1 = anyItem(item => gs1Of(item));
    let csv = '\uFEFF' + t('exportHistory.csvHeader');
    if (hasLocation) csv += ',' + quote(t('exportHistory.locationColumn'));
    if (hasQuantity) csv += ',' + quote(t('quantity.title'));
    if (hasMemo) csv += ',' + quote(t('memo.title'));
    if (hasGs1) csv += ',' + ['GTIN', t('gs1.ai10'), t('gs1.ai17'), t('gs1.ai30')].map(quote).join(',');
    if (columns.length) csv += ',' + [t('exportHistory.categoryColumn'), ...columns].map(quote).join(',');
    csv += '\n';

    selectedGroups.forEach((groupId) => {
      const group = groups.find(g => g.id === groupId);
      const groupName = group?.name || t('groupEdit.defaultGroup');
      const history = scanHistory[groupId] || [];

      history.forEach((item) => {
        const date = formatDate(item.timestamp);
        const code = `"${item.code.replace(/"/g, '""')}"`;
        const scanCount = item.scanCount || 1;
        csv += `${groupName},${code},${date},${scanCount}`;
        if (hasLocation) csv += ',' + quote(item.location || '');
        if (hasQuantity) csv += ',' + quote(typeof item.quantity === 'number' ? item.quantity : '');
        if (hasMemo) csv += ',' + quote(item.memo || '');
        if (hasGs1) {
          const g = gs1Of(item) || {};
          csv += ',' + [g.gtin, g.lot, g.expiry, g.qty].map(quote).join(',');
        }
        if (columns.length) {
          const label = labelOfItem(item, labelCategories);
          const cells = columns.map((column) => {
            if (!label) return '';
            const index = label.category.fields.findIndex((name, i) => fieldNameAt(label.category, i, t) === column);
            return index === -1 ? '' : (label.values[index] ?? '');
          });
          csv += ',' + [label ? label.category.name : '', ...cells].map(quote).join(',');
        }
        csv += '\n';
      });
    });

    return csv;
  };

  // CSV 내보내기
  const handleExport = async () => {
    if (selectedGroups.length === 0) {
      Alert.alert(t('common.notice'), t('exportHistory.alertSelectGroup'));
      return;
    }

    setIsExporting(true);
    try {
      const csv = generateCSV();
      const fileName = `scan_history_${Date.now()}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 공유
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: t('exportHistory.exportCSV'),
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert(t('exportHistory.exportSuccess'), `${t('exportHistory.fileSaved')}\n${fileUri}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(t('common.error'), t('exportHistory.exportErrorMsg'));
    } finally {
      setIsExporting(false);
    }
  };

  // TXT 생성
  const generateTXT = () => {
    let txt = '';

    selectedGroups.forEach((groupId, index) => {
      const group = groups.find(g => g.id === groupId);
      const groupName = group?.name || t('groupEdit.defaultGroup');
      const history = scanHistory[groupId] || [];

      if (index > 0) {
        txt += '\n\n';
      }

      txt += '==========================================\n';
      txt += `${t('exportHistory.groupLabel')}: ${groupName}\n`;
      txt += '==========================================\n\n';

      if (history.length === 0) {
        txt += `(${t('exportHistory.noRecords')})\n`;
      } else {
        history.forEach((item, itemIndex) => {
          if (itemIndex > 0) {
            txt += '\n';
          }
          const date = formatDate(item.timestamp);
          const scanCount = item.scanCount || 1;
          txt += `${t('exportHistory.codeLabel')}: ${item.code}\n`;
          txt += `${t('exportHistory.scanDateLabel')}: ${date}\n`;
          txt += `${t('exportHistory.duplicateLabel')}: ${scanCount}\n`;
          if (item.location) txt += `${t('exportHistory.locationColumn')}: ${item.location}\n`;
          if (typeof item.quantity === 'number') txt += `${t('quantity.title')}: ${item.quantity}\n`;
          if (item.memo) txt += `${t('memo.title')}: ${item.memo}\n`;
          {
            const g = item.gs1 || parseGs1(item.code);
            if (g) {
              const gs1Line = formatGs1Summary(g, t);
              if (gs1Line) txt += `GS1: ${gs1Line}\n`;
            }
          }
          const label = labelOfItem(item, labelCategories);
          if (label) {
            txt += `${t('exportHistory.categoryColumn')}: ${label.category.name}\n`;
            label.values.forEach((value, index) => {
              txt += `  ${fieldNameAt(label.category, index, t)}: ${value || '-'}\n`;
            });
          }
        });
      }
    });

    return txt;
  };

  // TXT 내보내기
  const handleExportTXT = async () => {
    if (selectedGroups.length === 0) {
      Alert.alert(t('common.notice'), t('exportHistory.alertSelectGroup'));
      return;
    }

    setIsExportingTxt(true);
    try {
      const txt = generateTXT();
      const fileName = `scan_history_${Date.now()}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, txt, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 공유
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: t('exportHistory.exportTXT'),
          UTI: 'public.plain-text',
        });
      } else {
        Alert.alert(t('exportHistory.exportSuccess'), `${t('exportHistory.fileSaved')}\n${fileUri}`);
      }
    } catch (error) {
      console.error('Export TXT error:', error);
      Alert.alert(t('common.error'), t('exportHistory.exportErrorMsg'));
    } finally {
      setIsExportingTxt(false);
    }
  };

  // 그룹별 스캔 개수 계산
  const getGroupScanCount = (groupId) => {
    const history = scanHistory[groupId] || [];
    return history.length;
  };

  const selectedRecordCount = selectedGroups.reduce((sum, groupId) => sum + getGroupScanCount(groupId), 0);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 · 전체 선택/해제 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            onPress={() => router.back()}
            style={s.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('exportHistory.title')}
        </Text>
        <View style={[s.headerSide, s.headerSideRight]}>
          <MaterialPressable onPress={toggleAll} style={s.headerAction} accessibilityRole="button">
            <Text style={[s.headerActionText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>
              {allSelected ? t('exportHistory.deselectAll') : t('exportHistory.selectAll')}
            </Text>
          </MaterialPressable>
        </View>
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        {/* 요약: 선택한 그룹의 기록 수 */}
        <View style={[s.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.summaryTile, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="download-outline" size={22} color={colors.primaryText} />
          </View>
          <View style={s.rowText}>
            <Text style={[s.summaryTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              {t('exportHistory.scanRecords', { count: selectedRecordCount })}
            </Text>
            <Text style={[s.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('exportHistory.selectedCount', { count: selectedGroups.length })}
            </Text>
          </View>
        </View>

        <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {t('exportHistory.selectGroup')}
        </Text>
        <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {groups.map((group, index) => {
            const isSelected = selectedGroups.includes(group.id);
            const isOnlyOne = selectedGroups.length === 1 && isSelected;
            const scanCount = getGroupScanCount(group.id);

            return (
              <MaterialPressable
                key={group.id}
                style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}
                onPress={() => toggleGroup(group.id)}
                disabled={isOnlyOne}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: isOnlyOne }}
              >
                <View
                  style={[
                    s.checkbox,
                    isSelected
                      ? { backgroundColor: colors.primary }
                      : { borderWidth: 2, borderColor: isDark ? '#4A5260' : colors.textTertiary },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={[s.rowDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {scanCount > 0 ? t('exportHistory.scanRecords', { count: scanCount }) : t('exportHistory.noRecords')}
                  </Text>
                </View>
                {scanCount > 0 && (
                  <View style={[s.countBadge, { backgroundColor: colors.successSoft }]}>
                    <Text style={[s.countBadgeText, { color: colors.success, fontFamily: fonts.semiBold }]}>
                      {t('exportHistory.countBadge', { count: scanCount })}
                    </Text>
                  </View>
                )}
              </MaterialPressable>
            );
          })}
        </View>

        <View style={s.actions}>
          <MaterialPressable
            style={[s.primaryButton, { backgroundColor: isExporting ? colors.raised : colors.primary }]}
            onPress={handleExport}
            disabled={isExporting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: isExporting }}
          >
            <Ionicons name="download-outline" size={20} color={isExporting ? colors.textTertiary : '#FFFFFF'} />
            <Text style={[s.primaryButtonText, { color: isExporting ? colors.textTertiary : '#FFFFFF', fontFamily: fonts.semiBold }]}>
              {isExporting ? t('exportHistory.exporting') : t('exportHistory.exportCSV')}
            </Text>
          </MaterialPressable>

          <MaterialPressable
            style={[s.secondaryButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
            onPress={handleExportTXT}
            disabled={isExportingTxt}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: isExportingTxt }}
          >
            <Ionicons name="document-text-outline" size={18} color={isExportingTxt ? colors.textTertiary : colors.text} />
            <Text style={[s.secondaryButtonText, { color: isExportingTxt ? colors.textTertiary : colors.text, fontFamily: fonts.semiBold }]}>
              {isExportingTxt ? t('exportHistory.exporting') : t('exportHistory.exportTXT')}
            </Text>
          </MaterialPressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flexShrink: 1,
    textAlign: 'center',
  },
  headerAction: {
    minHeight: SIZE.touch,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
    gap: SPACE.gap,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: SPACE.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  summaryTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    ...TYPE.body,
  },
  rowDesc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    marginTop: SPACE.section,
    gap: SPACE.gap,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
