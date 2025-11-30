// screens/HistoryScreen.js - 그룹별 히스토리 관리
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';

const DEFAULT_GROUP_ID = 'default';

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
  const [selectedGroupId, setSelectedGroupId] = useState(DEFAULT_GROUP_ID);
  const [scanHistory, setScanHistory] = useState({ [DEFAULT_GROUP_ID]: [] });
  const [query, setQuery] = useState('');
  const [filteredList, setFilteredList] = useState([]);

  // 그룹 데이터 로드
  const loadGroups = async () => {
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      const selectedId = await AsyncStorage.getItem('selectedGroupId');

      if (groupsData) {
        const parsed = JSON.parse(groupsData);
        setGroups(parsed.length > 0 ? parsed : [{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
      }

      if (historyData) {
        const parsed = JSON.parse(historyData);
        setScanHistory(parsed);
      } else {
        // 기존 히스토리 데이터 마이그레이션
        const oldHistory = await AsyncStorage.getItem('scanHistory');
        if (oldHistory) {
          const parsed = JSON.parse(oldHistory);
          const migrated = { [DEFAULT_GROUP_ID]: parsed };
          setScanHistory(migrated);
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(migrated));
        }
      }

      if (selectedId) {
        setSelectedGroupId(selectedId);
      }
    } catch (error) {
      console.error('Load groups error:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadGroups();
    }, [])
  );

  // 선택된 그룹의 히스토리 가져오기
  const getCurrentHistory = () => {
    const history = scanHistory[selectedGroupId] || [];
    return history.sort((a, b) => b.timestamp - a.timestamp);
  };

  // 검색 필터
  useEffect(() => {
    const currentHistory = getCurrentHistory();
    if (!query) {
      setFilteredList(currentHistory);
      return;
    }
    const q = query.toLowerCase();
    setFilteredList(
      currentHistory.filter(
        (i) => i.code.toLowerCase().includes(q) || (i.url && i.url.toLowerCase().includes(q)),
      ),
    );
  }, [query, scanHistory, selectedGroupId]);

  // 그룹 선택
  const selectGroup = async (groupId) => {
    setSelectedGroupId(groupId);
    await AsyncStorage.setItem('selectedGroupId', groupId);
    setQuery('');
  };

  // 현재 그룹의 히스토리 삭제
  const clearCurrentGroupHistory = async () => {
    const groupName = groups.find(g => g.id === selectedGroupId)?.name || t('groupEdit.defaultGroup');
    Alert.alert(t('history.deleteConfirmTitle'), `${groupName}${t('history.deleteConfirmMessage')}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const updatedHistory = { ...scanHistory, [selectedGroupId]: [] };
          setScanHistory(updatedHistory);
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(updatedHistory));
          setQuery('');
        },
      },
    ]);
  };

  const formatDateTime = (timestamp) => {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}.${month}.${day}  ${hours}:${minutes}:${seconds}`;
  };

  const handleItemPress = (item) => {
    router.push({
      pathname: '/result',
      params: {
        code: item.code,
        url: item.url,
        isDuplicate: item.count && item.count > 1 ? 'true' : 'false',
        scanCount: (item.count || 1).toString(),
        timestamp: item.timestamp.toString(),
        scanTimes: item.scanTimes ? JSON.stringify(item.scanTimes) : JSON.stringify([item.timestamp]),
        photoUri: item.photos && item.photos.length > 0 ? item.photos[0] : '',
        groupId: selectedGroupId, // 그룹 ID 전달
        fromHistory: 'true', // 히스토리에서 왔음을 표시
      }
    });
  };

  const currentHistory = getCurrentHistory();
  const currentGroup = groups.find(g => g.id === selectedGroupId);

  // 각 그룹의 스캔 개수 계산
  const getGroupScanCount = (groupId) => {
    const history = scanHistory[groupId] || [];
    return history.length;
  };

  return (
    <View style={s.c}>
      {/* 검색 */}
      <View style={s.search}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={s.input}
          placeholder={t('history.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t('common.search')}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel={t('history.clearSearch')}>
            <Ionicons name="close-circle" size={22} color="#888" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 그룹 선택 탭 */}
      <View style={s.groupTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupTabs}>
          {groups.map((group) => {
            const scanCount = getGroupScanCount(group.id);
            return (
              <TouchableOpacity
                key={group.id}
                style={[s.groupTab, selectedGroupId === group.id && s.groupTabActive]}
                onPress={() => selectGroup(group.id)}
              >
                <Text style={[s.groupTabText, selectedGroupId === group.id && s.groupTabTextActive]}>
                  {group.name}
                </Text>
                {scanCount > 0 && (
                  <View style={[s.groupCountBadge, selectedGroupId === group.id && s.groupCountBadgeActive]}>
                    <Text style={[s.groupCountBadgeText, selectedGroupId === group.id && s.groupCountBadgeTextActive]}>
                      {scanCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={s.editGroupTab} onPress={() => router.push('/group-edit')}>
            <Ionicons name="settings-outline" size={20} color="#007AFF" />
            <Text style={s.editGroupTabText}>{t('history.editGroups')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.title}>
          {currentGroup?.name || t('history.scanRecord')} {filteredList.length > 0 && `(${filteredList.length})`}
        </Text>
        {currentHistory.length > 0 && (
          <TouchableOpacity onPress={clearCurrentGroupHistory} accessibilityLabel={t('history.deleteAll')}>
            <Text style={s.del}>{t('history.deleteAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 히스토리 목록 */}
      {filteredList.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="file-tray-outline" size={64} color="#ccc" />
          <Text style={s.emptyText}>{query ? t('history.noSearchResults') : t('history.emptyList')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.item}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
              accessibilityLabel={`${t('history.scanRecord')}: ${item.code}`}
              accessibilityRole="button"
            >
              <View style={s.itemHeader}>
                <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
                <Text style={s.code} numberOfLines={1}>
                  {item.code}
                </Text>
                {item.count && item.count > 1 && (
                  <View style={s.countBadge}>
                    <Ionicons name="repeat" size={12} color="#FF9500" />
                    <Text style={s.countBadgeText}>{item.count}</Text>
                  </View>
                )}
              </View>
              <Text style={s.time}>{formatDateTime(item.timestamp)}</Text>
              {item.url && (
                <Text style={s.url} numberOfLines={1}>
                  {item.url}
                </Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={s.listContent}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#f9f9f9' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    marginTop: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 16 },
  groupTabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  groupTabs: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  groupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  groupTabActive: {
    backgroundColor: '#007AFF',
  },
  groupTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  groupTabTextActive: {
    color: '#fff',
  },
  groupCountBadge: {
    backgroundColor: '#007AFF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  groupCountBadgeActive: {
    backgroundColor: '#fff',
  },
  groupCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  groupCountBadgeTextActive: {
    color: '#007AFF',
  },
  editGroupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    gap: 4,
  },
  editGroupTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  del: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
    marginTop: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 6,
    padding: 16,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  code: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
    color: '#000',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9500',
    marginLeft: 4,
  },
  time: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  url: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
  },
});
