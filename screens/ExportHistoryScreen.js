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

const DEFAULT_GROUP_ID = 'default';

export default function ExportHistoryScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [scanHistory, setScanHistory] = useState({});
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const groupsData = await AsyncStorage.getItem('scanGroups');
        const historyData = await AsyncStorage.getItem('scanHistoryByGroup');

        if (groupsData) {
          const parsed = JSON.parse(groupsData);
          setGroups(parsed.length > 0 ? parsed : [{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
          // 기본적으로 모든 그룹 선택
          setSelectedGroups(parsed.map(g => g.id));
        } else {
          setGroups([{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
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

  // CSV 생성
  const generateCSV = () => {
    // UTF-8 BOM 추가 (한글 깨짐 방지)
    let csv = '\uFEFF그룹,코드값,스캔일시,중복횟수\n';

    selectedGroups.forEach((groupId) => {
      const group = groups.find(g => g.id === groupId);
      const groupName = group?.name || '알 수 없는 그룹';
      const history = scanHistory[groupId] || [];

      history.forEach((item) => {
        const date = new Date(item.timestamp).toLocaleString('ko-KR');
        const code = `"${item.code.replace(/"/g, '""')}"`;
        const scanCount = item.scanCount || 1;
        csv += `${groupName},${code},${date},${scanCount}\n`;
      });
    });

    return csv;
  };

  // 내보내기
  const handleExport = async () => {
    if (selectedGroups.length === 0) {
      Alert.alert('알림', '내보낼 그룹을 최소 1개 이상 선택해주세요.');
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
          dialogTitle: '스캔 기록 내보내기',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('성공', `파일이 저장되었습니다:\n${fileUri}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('오류', '내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  // 그룹별 스캔 개수 계산
  const getGroupScanCount = (groupId) => {
    const history = scanHistory[groupId] || [];
    return history.length;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>기록 내보내기</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.info}>
              선택한 그룹의 기록을 내보냅니다 ({selectedGroups.length}개 선택)
            </Text>
            <TouchableOpacity onPress={toggleAll} style={s.toggleAllBtn}>
              <Text style={s.toggleAllText}>{allSelected ? '전체 해제' : '전체 선택'}</Text>
            </TouchableOpacity>
          </View>

          {groups.map((group) => {
            const isSelected = selectedGroups.includes(group.id);
            const isOnlyOne = selectedGroups.length === 1 && isSelected;
            const scanCount = getGroupScanCount(group.id);

            return (
              <TouchableOpacity
                key={group.id}
                style={[s.groupItem, isSelected && s.groupItemSelected]}
                onPress={() => toggleGroup(group.id)}
                disabled={isOnlyOne}
                activeOpacity={0.7}
              >
                <View style={s.groupInfo}>
                  <View style={s.groupHeader}>
                    <Text style={[s.groupName, isSelected && s.groupNameSelected]}>
                      {group.name}
                    </Text>
                    {scanCount > 0 && (
                      <View style={s.countBadge}>
                        <Text style={s.countBadgeText}>{scanCount}개</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.groupDesc}>
                    {scanCount > 0 ? `${scanCount}개의 스캔 기록` : '기록 없음'}
                  </Text>
                </View>
                <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[s.exportButton, isExporting && s.exportButtonDisabled]}
          onPress={handleExport}
          disabled={isExporting}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={s.exportButtonText}>
            {isExporting ? '내보내는 중...' : 'CSV 파일로 내보내기'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    color: '#000',
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
    color: '#666',
    flex: 1,
  },
  toggleAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  groupItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
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
    color: '#333',
  },
  groupNameSelected: {
    color: '#007AFF',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#34C759',
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  groupDesc: {
    fontSize: 14,
    color: '#666',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  exportButtonDisabled: {
    backgroundColor: '#ccc',
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
