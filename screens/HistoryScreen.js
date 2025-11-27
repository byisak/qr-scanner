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
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

const DEFAULT_GROUP_ID = 'default';

export default function HistoryScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
  const [selectedGroupId, setSelectedGroupId] = useState(DEFAULT_GROUP_ID);
  const [scanHistory, setScanHistory] = useState({ [DEFAULT_GROUP_ID]: [] });
  const [query, setQuery] = useState('');
  const [filteredList, setFilteredList] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

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

  // 그룹 추가
  const addGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('오류', '그룹 이름을 입력해주세요');
      return;
    }

    const newGroup = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      createdAt: Date.now(),
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

    // 새 그룹의 빈 히스토리 초기화
    const updatedHistory = { ...scanHistory, [newGroup.id]: [] };
    setScanHistory(updatedHistory);
    await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(updatedHistory));

    setNewGroupName('');
    setShowGroupModal(false);
    setSelectedGroupId(newGroup.id);
    await AsyncStorage.setItem('selectedGroupId', newGroup.id);
  };

  // 그룹 삭제
  const deleteGroup = async (groupId) => {
    if (groupId === DEFAULT_GROUP_ID) {
      Alert.alert('오류', '기본 그룹은 삭제할 수 없습니다');
      return;
    }

    Alert.alert('그룹 삭제', '이 그룹과 모든 스캔 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const updatedGroups = groups.filter(g => g.id !== groupId);
          setGroups(updatedGroups);
          await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

          const updatedHistory = { ...scanHistory };
          delete updatedHistory[groupId];
          setScanHistory(updatedHistory);
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(updatedHistory));

          if (selectedGroupId === groupId) {
            setSelectedGroupId(DEFAULT_GROUP_ID);
            await AsyncStorage.setItem('selectedGroupId', DEFAULT_GROUP_ID);
          }
        },
      },
    ]);
  };

  // 그룹 선택
  const selectGroup = async (groupId) => {
    setSelectedGroupId(groupId);
    await AsyncStorage.setItem('selectedGroupId', groupId);
    setQuery('');
  };

  // 현재 그룹의 히스토리 삭제
  const clearCurrentGroupHistory = async () => {
    const groupName = groups.find(g => g.id === selectedGroupId)?.name || '그룹';
    Alert.alert('기록 삭제', `${groupName}의 모든 스캔 기록을 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
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
      }
    });
  };

  const currentHistory = getCurrentHistory();
  const currentGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <View style={s.c}>
      {/* 검색 */}
      <View style={s.search}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={s.input}
          placeholder="코드 또는 URL 검색"
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="검색 입력"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="검색어 지우기">
            <Ionicons name="close-circle" size={22} color="#888" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 그룹 선택 탭 */}
      <View style={s.groupTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupTabs}>
          {groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[s.groupTab, selectedGroupId === group.id && s.groupTabActive]}
              onPress={() => selectGroup(group.id)}
              onLongPress={() => group.id !== DEFAULT_GROUP_ID && deleteGroup(group.id)}
            >
              <Text style={[s.groupTabText, selectedGroupId === group.id && s.groupTabTextActive]}>
                {group.name}
              </Text>
              {selectedGroupId === group.id && group.id !== DEFAULT_GROUP_ID && (
                <TouchableOpacity
                  onPress={() => deleteGroup(group.id)}
                  style={s.groupDeleteBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color="#007AFF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.addGroupTab} onPress={() => setShowGroupModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.title}>
          {currentGroup?.name || '스캔 기록'} {filteredList.length > 0 && `(${filteredList.length})`}
        </Text>
        {currentHistory.length > 0 && (
          <TouchableOpacity onPress={clearCurrentGroupHistory} accessibilityLabel="전체 삭제">
            <Text style={s.del}>전체 삭제</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 히스토리 목록 */}
      {filteredList.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="file-tray-outline" size={64} color="#ccc" />
          <Text style={s.emptyText}>{query ? '검색 결과 없음' : '기록이 없습니다'}</Text>
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
              accessibilityLabel={`스캔 기록: ${item.code}`}
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

      {/* 그룹 추가 모달 */}
      <Modal
        visible={showGroupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>새 그룹 추가</Text>
            <TextInput
              style={s.modalInput}
              placeholder="그룹 이름"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonCancel]}
                onPress={() => {
                  setShowGroupModal(false);
                  setNewGroupName('');
                }}
              >
                <Text style={s.modalButtonTextCancel}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonConfirm]}
                onPress={addGroup}
              >
                <Text style={s.modalButtonTextConfirm}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  groupDeleteBtn: {
    marginLeft: 6,
  },
  addGroupTab: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
