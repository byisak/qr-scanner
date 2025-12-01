// screens/GroupEditScreen.js - 그룹 편집 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

const DEFAULT_GROUP_ID = 'default';

export default function GroupEditScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);

  // 그룹 데이터 로드
  const loadGroups = async () => {
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      if (groupsData) {
        const parsed = JSON.parse(groupsData);
        setGroups(parsed.length > 0 ? parsed : [{ id: DEFAULT_GROUP_ID, name: '기본 그룹', createdAt: Date.now() }]);
      }
    } catch (error) {
      console.error('Load groups error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [])
  );

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
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    const historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };
    historyByGroup[newGroup.id] = [];
    await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

    setNewGroupName('');
    setShowAddModal(false);
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

          // 히스토리에서도 삭제
          const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
          const historyByGroup = historyData ? JSON.parse(historyData) : {};
          delete historyByGroup[groupId];
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

          // 선택된 그룹이 삭제되는 경우 기본 그룹으로 변경
          const selectedGroupId = await AsyncStorage.getItem('selectedGroupId');
          if (selectedGroupId === groupId) {
            await AsyncStorage.setItem('selectedGroupId', DEFAULT_GROUP_ID);
          }
        },
      },
    ]);
  };

  // 그룹 이름 변경
  const editGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('오류', '그룹 이름을 입력해주세요');
      return;
    }

    if (editingGroup.id === DEFAULT_GROUP_ID && newGroupName.trim() !== '기본 그룹') {
      Alert.alert('알림', '기본 그룹의 이름은 "기본 그룹"으로 유지하는 것을 권장합니다.');
    }

    const updatedGroups = groups.map(g =>
      g.id === editingGroup.id ? { ...g, name: newGroupName.trim() } : g
    );
    setGroups(updatedGroups);
    await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

    setNewGroupName('');
    setEditingGroup(null);
    setShowEditModal(false);
  };

  // 그룹 순서 변경 (위로)
  const moveGroupUp = async (index) => {
    if (index === 0) return;

    const updatedGroups = [...groups];
    [updatedGroups[index - 1], updatedGroups[index]] = [updatedGroups[index], updatedGroups[index - 1]];

    setGroups(updatedGroups);
    await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
  };

  // 그룹 순서 변경 (아래로)
  const moveGroupDown = async (index) => {
    if (index === groups.length - 1) return;

    const updatedGroups = [...groups];
    [updatedGroups[index], updatedGroups[index + 1]] = [updatedGroups[index + 1], updatedGroups[index]];

    setGroups(updatedGroups);
    await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
  };

  // 그룹 이름 변경 모달 열기
  const openEditModal = (group) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setShowEditModal(true);
  };

  return (
    <View style={s.container}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
        >
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>그룹 편집</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* 그룹 목록 */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item, index }) => (
          <View style={s.groupItem}>
            <View style={s.groupInfo}>
              {item.isCloudSync && (
                <Ionicons name="cloud" size={18} color="#007AFF" style={{ marginRight: 8 }} />
              )}
              <Text style={s.groupName}>{item.name}</Text>
              {item.id === DEFAULT_GROUP_ID && (
                <Text style={s.defaultBadge}>기본</Text>
              )}
              {item.isCloudSync && (
                <Text style={[s.defaultBadge, { backgroundColor: '#007AFF', marginLeft: 8 }]}>클라우드</Text>
              )}
            </View>

            <View style={s.groupActions}>
              {/* 순서 변경 버튼 */}
              <TouchableOpacity
                style={[s.iconButton, index === 0 && s.iconButtonDisabled]}
                onPress={() => moveGroupUp(index)}
                disabled={index === 0}
              >
                <Ionicons
                  name="chevron-up"
                  size={24}
                  color={index === 0 ? '#ccc' : '#666'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.iconButton, index === groups.length - 1 && s.iconButtonDisabled]}
                onPress={() => moveGroupDown(index)}
                disabled={index === groups.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={24}
                  color={index === groups.length - 1 ? '#ccc' : '#666'}
                />
              </TouchableOpacity>

              {/* 이름 변경 버튼 */}
              <TouchableOpacity
                style={[s.iconButton, item.isCloudSync && s.iconButtonDisabled]}
                onPress={() => openEditModal(item)}
                disabled={item.isCloudSync}
              >
                <Ionicons name="create-outline" size={24} color={item.isCloudSync ? '#ccc' : '#007AFF'} />
              </TouchableOpacity>

              {/* 삭제 버튼 */}
              <TouchableOpacity
                style={[s.iconButton, (item.id === DEFAULT_GROUP_ID || item.isCloudSync) && s.iconButtonDisabled]}
                onPress={() => deleteGroup(item.id)}
                disabled={item.id === DEFAULT_GROUP_ID || item.isCloudSync}
              >
                <Ionicons
                  name="trash-outline"
                  size={24}
                  color={item.id === DEFAULT_GROUP_ID || item.isCloudSync ? '#ccc' : '#FF3B30'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* 그룹 추가 버튼 */}
      <TouchableOpacity
        style={s.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={s.addButtonText}>새 그룹 추가</Text>
      </TouchableOpacity>

      {/* 그룹 추가 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
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
                  setShowAddModal(false);
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

      {/* 그룹 이름 변경 모달 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>그룹 이름 변경</Text>
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
                  setShowEditModal(false);
                  setNewGroupName('');
                  setEditingGroup(null);
                }}
              >
                <Text style={s.modalButtonTextCancel}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonConfirm]}
                onPress={editGroupName}
              >
                <Text style={s.modalButtonTextConfirm}>변경</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  listContent: {
    padding: 15,
    paddingBottom: 100,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  groupInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  defaultBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#007AFF',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 8,
    overflow: 'hidden',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  iconButtonDisabled: {
    opacity: 0.3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    marginHorizontal: 20,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
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
