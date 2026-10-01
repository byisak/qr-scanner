// screens/ExportHistoryScreen.js - 기록 내보내기 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { labelOfItem, fieldNameAt } from '../utils/labelParser';
import { loadLabelSettings } from '../utils/labelCategories';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
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
    let csv = '\uFEFF' + t('exportHistory.csvHeader');
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

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + (Platform.OS === 'ios' ? 13 : 12) }]}>
        <MaterialPressable onPress={() => router.back()} style={[s.backButton, Platform.OS === 'android' && s.androidIconButton]}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('exportHistory.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={[s.scrollContent, { paddingBottom: 16 + insets.bottom }]}>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.info, { color: colors.textSecondary }]}>
              {t('exportHistory.selectedCount', { count: selectedGroups.length })}
            </Text>
            <MaterialPressable onPress={toggleAll} style={[s.toggleAllBtn, Platform.OS === 'android' && s.androidClip, { backgroundColor: colors.primary }]}>
              <Text style={s.toggleAllText}>{allSelected ? t('exportHistory.deselectAll') : t('exportHistory.selectAll')}</Text>
            </MaterialPressable>
          </View>

          {groups.map((group) => {
            const isSelected = selectedGroups.includes(group.id);
            const isOnlyOne = selectedGroups.length === 1 && isSelected;
            const scanCount = getGroupScanCount(group.id);

            return (
              <MaterialPressable
                key={group.id}
                style={[
                  s.groupItem,
                  Platform.OS === 'android' && s.groupItemAndroid,
                  { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                  isSelected && { backgroundColor: isDark ? 'rgba(0, 122, 255, 0.2)' : '#f0f8ff' }
                ]}
                onPress={() => toggleGroup(group.id)}
                disabled={isOnlyOne}
                activeOpacity={0.7}
              >
                <View style={s.groupInfo}>
                  <View style={s.groupHeader}>
                    <Text style={[s.groupName, { color: isSelected ? colors.primary : colors.text }]}>
                      {group.name}
                    </Text>
                    {scanCount > 0 && (
                      <View style={[s.countBadge, { backgroundColor: colors.success }]}>
                        <Text style={s.countBadgeText}>{t('exportHistory.countBadge', { count: scanCount })}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.groupDesc, { color: colors.textSecondary }]}>
                    {scanCount > 0 ? t('exportHistory.scanRecords', { count: scanCount }) : t('exportHistory.noRecords')}
                  </Text>
                </View>
                <View style={[s.checkbox, { borderColor: isSelected ? colors.primary : colors.borderLight, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                  {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
              </MaterialPressable>
            );
          })}
        </View>

        <MaterialPressable
          style={[s.exportButton, Platform.OS === 'android' && s.androidClip, { backgroundColor: isExporting ? colors.borderLight : colors.primary }]}
          onPress={handleExport}
          disabled={isExporting}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={s.exportButtonText}>
            {isExporting ? t('exportHistory.exporting') : t('exportHistory.exportCSV')}
          </Text>
        </MaterialPressable>

        <MaterialPressable
          style={[s.exportButton, Platform.OS === 'android' && s.androidClip, { backgroundColor: isExportingTxt ? colors.borderLight : colors.success }]}
          onPress={handleExportTXT}
          disabled={isExportingTxt}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={s.exportButtonText}>
            {isExportingTxt ? t('exportHistory.exporting') : t('exportHistory.exportTXT')}
          </Text>
        </MaterialPressable>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  info: {
    fontSize: 14,
    flex: 1,
  },
  toggleAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleAllText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  groupInfo: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  groupDesc: {
    fontSize: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  // Android 전용 Material 3 규격 (iOS 값은 기본 스타일 그대로)
  groupItemAndroid: {
    borderRadius: 12,
    elevation: 1,
    overflow: 'hidden', // 물결이 카드 모서리 안에 머물게
  },
  androidIconButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  androidClip: {
    overflow: 'hidden',
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
