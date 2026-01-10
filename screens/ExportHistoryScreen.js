// screens/ExportHistoryScreen.js - 기록 내보내기 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

const DEFAULT_GROUP_ID = 'default';

export default function ExportHistoryScreen() {
  const router = useRouter();
  const { t, fonts, language } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [groups, setGroups] = useState([]);
  const [scanHistory, setScanHistory] = useState({});
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingTxt, setIsExportingTxt] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const groupsData = await AsyncStorage.getItem('scanGroups');
        const historyData = await AsyncStorage.getItem('scanHistoryByGroup');

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
    let csv = '\uFEFF' + t('exportHistory.csvHeader') + '\n';

    selectedGroups.forEach((groupId) => {
      const group = groups.find(g => g.id === groupId);
      const groupName = group?.name || t('groupEdit.defaultGroup');
      const history = scanHistory[groupId] || [];

      history.forEach((item) => {
        const date = formatDate(item.timestamp);
        const code = `"${item.code.replace(/"/g, '""')}"`;
        const scanCount = item.scanCount || 1;
        csv += `${groupName},${code},${date},${scanCount}\n`;
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
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('exportHistory.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.info, { color: colors.textSecondary }]}>
              {t('exportHistory.selectedCount', { count: selectedGroups.length })}
            </Text>
            <TouchableOpacity onPress={toggleAll} style={[s.toggleAllBtn, { backgroundColor: colors.primary }]}>
              <Text style={s.toggleAllText}>{allSelected ? t('exportHistory.deselectAll') : t('exportHistory.selectAll')}</Text>
            </TouchableOpacity>
          </View>

          {groups.map((group) => {
            const isSelected = selectedGroups.includes(group.id);
            const isOnlyOne = selectedGroups.length === 1 && isSelected;
            const scanCount = getGroupScanCount(group.id);

            return (
              <TouchableOpacity
                key={group.id}
                style={[
                  s.groupItem,
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
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[s.exportButton, { backgroundColor: isExporting ? colors.borderLight : colors.primary }]}
          onPress={handleExport}
          disabled={isExporting}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={s.exportButtonText}>
            {isExporting ? t('exportHistory.exporting') : t('exportHistory.exportCSV')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.exportButton, { backgroundColor: isExportingTxt ? colors.borderLight : colors.success }]}
          onPress={handleExportTXT}
          disabled={isExportingTxt}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={s.exportButtonText}>
            {isExportingTxt ? t('exportHistory.exporting') : t('exportHistory.exportTXT')}
          </Text>
        </TouchableOpacity>
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
    paddingTop: 60,
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
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
