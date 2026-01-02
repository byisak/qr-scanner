// screens/GroupEditScreen.js - 그룹 편집 화면
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../config/config';

const DEFAULT_GROUP_ID = 'default';

export default function GroupEditScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
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
        // 기본 그룹 이름을 현재 언어로 표시
        const updatedGroups = parsed.map(g => {
          if (g.id === DEFAULT_GROUP_ID) {
            return { ...g, name: t('groupEdit.defaultGroup') };
          }
          return g;
        });
        setGroups(updatedGroups.length > 0 ? updatedGroups : [{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
      } else {
        setGroups([{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
      }
    } catch (error) {
      console.error('Load groups error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [t])
  );

  // 그룹 저장 헬퍼 함수
  const saveGroups = async (updatedGroups) => {
    const groupsToSave = updatedGroups.map(g => {
      if (g.id === DEFAULT_GROUP_ID) {
        return { ...g, name: 'default' };
      }
      return g;
    });
    await AsyncStorage.setItem('scanGroups', JSON.stringify(groupsToSave));
  };

  // 그룹 추가
  const addGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(t('common.error') || '오류', t('groupEdit.emptyName'));
      return;
    }

    const newGroup = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      createdAt: Date.now(),
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    await saveGroups(updatedGroups);

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
      Alert.alert(t('common.error') || '오류', t('groupEdit.cannotDeleteDefault'));
      return;
    }

    Alert.alert(t('groupEdit.deleteConfirmTitle'), t('groupEdit.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const groupToDelete = groups.find(g => g.id === groupId);
          const isCloudSyncGroup = groupToDelete?.isCloudSync;

          const updatedGroups = groups.filter(g => g.id !== groupId);
          setGroups(updatedGroups);
          await saveGroups(updatedGroups);

          // 히스토리에서도 삭제
          const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
          const historyByGroup = historyData ? JSON.parse(historyData) : {};
          delete historyByGroup[groupId];
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

          // scanHistory에서도 삭제
          try {
            const historyJson = await AsyncStorage.getItem('scanHistory');
            if (historyJson) {
              const history = JSON.parse(historyJson);
              const updatedHistory = history.filter(item => item.groupId !== groupId);
              await AsyncStorage.setItem('scanHistory', JSON.stringify(updatedHistory));
            }
          } catch (error) {
            console.error('Failed to delete history:', error);
          }

          // 클라우드 동기화 그룹이면 해당 세션 URL도 삭제
          if (isCloudSyncGroup) {
            try {
              const sessionUrlsJson = await AsyncStorage.getItem('sessionUrls');
              if (sessionUrlsJson) {
                const sessionUrls = JSON.parse(sessionUrlsJson);
                const updatedSessionUrls = sessionUrls.filter(s => s.id !== groupId);
                await AsyncStorage.setItem('sessionUrls', JSON.stringify(updatedSessionUrls));

                const activeSessionId = await AsyncStorage.getItem('activeSessionId');
                if (activeSessionId === groupId) {
                  if (updatedSessionUrls.length > 0) {
                    const newActiveId = updatedSessionUrls[0].id;
                    await AsyncStorage.setItem('activeSessionId', newActiveId);
                  } else {
                    await AsyncStorage.removeItem('activeSessionId');
                  }
                }
              }
            } catch (error) {
              console.error('Failed to delete session URL:', error);
            }
          }

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
      Alert.alert(t('common.error') || '오류', t('groupEdit.emptyName'));
      return;
    }

    if (editingGroup.id === DEFAULT_GROUP_ID) {
      Alert.alert(t('common.error') || '오류', t('groupEdit.cannotDeleteDefault'));
      return;
    }

    const trimmedName = newGroupName.trim();

    // 클라우드 동기화 그룹이면 서버에 이름 업데이트
    if (editingGroup.isCloudSync) {
      try {
        const response = await fetch(`${config.serverUrl}/api/sessions/${editingGroup.id}/name`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: trimmedName }),
        });

        if (!response.ok) {
          console.warn('Server name update failed:', response.status);
        } else {
          console.log('Server name update success:', editingGroup.id, trimmedName);
        }
      } catch (error) {
        console.warn('Server name update error (continuing locally):', error);
      }

      // sessionUrls에도 이름 업데이트
      try {
        const sessionUrlsJson = await AsyncStorage.getItem('sessionUrls');
        if (sessionUrlsJson) {
          const sessionUrls = JSON.parse(sessionUrlsJson);
          const updatedSessionUrls = sessionUrls.map(s =>
            s.id === editingGroup.id ? { ...s, name: trimmedName } : s
          );
          await AsyncStorage.setItem('sessionUrls', JSON.stringify(updatedSessionUrls));
        }
      } catch (error) {
        console.error('Failed to update session URL name:', error);
      }
    }

    const updatedGroups = groups.map(g =>
      g.id === editingGroup.id ? { ...g, name: trimmedName } : g
    );
    setGroups(updatedGroups);
    await saveGroups(updatedGroups);

    setNewGroupName('');
    setEditingGroup(null);
    setShowEditModal(false);
  };

  // 드래그로 그룹 순서 변경
  const handleDragEnd = async ({ data }) => {
    setGroups(data);
    await saveGroups(data);
  };

  // 그룹 아이템 렌더링
  const renderItem = useCallback(({ item, drag, isActive }) => {
    // 아이콘 및 색상 결정
    let iconName = 'folder';
    let iconColor = colors.primary;
    if (item.isCloudSync) {
      iconName = 'cloud';
      iconColor = colors.primary;
    } else if (item.isScanUrlGroup) {
      iconName = 'link';
      iconColor = colors.success;
    } else if (item.id === DEFAULT_GROUP_ID) {
      iconName = 'home';
      iconColor = colors.primary;
    }

    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={drag}
          disabled={isActive}
          style={[
            s.reorderItem,
            {
              backgroundColor: isActive ? colors.primary + '20' : colors.surface,
              borderColor: colors.border,
            },
            isActive && { shadowOpacity: 0.3, elevation: 8, borderColor: colors.primary }
          ]}
        >
          {/* 드래그 핸들 */}
          <TouchableOpacity
            onPressIn={drag}
            style={s.dragHandle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={22} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 아이콘 */}
          <View style={[s.reorderItemIcon, { backgroundColor: iconColor + '15' }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>

          {/* 그룹 이름 */}
          <View style={s.reorderItemTextContainer}>
            <Text style={[s.reorderItemText, { color: colors.text }]}>{item.name}</Text>
            {item.id === DEFAULT_GROUP_ID && (
              <Text style={[s.reorderItemSubtext, { color: colors.textSecondary }]}>
                {t('groupEdit.defaultGroup') || '기본'}
              </Text>
            )}
            {item.isCloudSync && (
              <Text style={[s.reorderItemSubtext, { color: colors.primary }]}>
                Cloud Sync
              </Text>
            )}
          </View>

          {/* 액션 버튼들 */}
          <View style={s.groupActions}>
            {/* 이름 변경 버튼 */}
            <TouchableOpacity
              style={[s.actionButton, item.id === DEFAULT_GROUP_ID && s.actionButtonDisabled]}
              onPress={() => openEditModal(item)}
              disabled={item.id === DEFAULT_GROUP_ID}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={item.id === DEFAULT_GROUP_ID ? colors.textTertiary : colors.primary}
              />
            </TouchableOpacity>

            {/* 삭제 버튼 */}
            <TouchableOpacity
              style={[s.actionButton, item.id === DEFAULT_GROUP_ID && s.actionButtonDisabled]}
              onPress={() => deleteGroup(item.id)}
              disabled={item.id === DEFAULT_GROUP_ID}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={item.id === DEFAULT_GROUP_ID ? colors.textTertiary : colors.error}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }, [colors, t]);

  // 그룹 이름 변경 모달 열기
  const openEditModal = (group) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setShowEditModal(true);
  };

  const headerPaddingTop = Platform.OS === 'ios' ? 60 : insets.top + 10;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* 헤더 */}
        <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: headerPaddingTop }]}>
          <TouchableOpacity
            style={s.backButton}
            onPress={() => router.back()}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t('groupEdit.title')}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* 서브타이틀 - 드래그 안내 */}
        <View style={s.subtitleContainer}>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {t('groupEdit.dragToReorder') || '≡ 아이콘을 길게 눌러 순서를 변경하세요'}
          </Text>
        </View>

        {/* 그룹 목록 (드래그 가능) */}
        <DraggableFlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
          contentContainerStyle={s.listContent}
          activationDistance={10}
        />

        {/* 그룹 추가 버튼 */}
        <View style={[s.addButtonContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[s.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={s.addButtonText}>{t('groupEdit.addGroup')}</Text>
          </TouchableOpacity>
        </View>

      {/* 그룹 추가 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowAddModal(false);
            setNewGroupName('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'position' : 'height'}
            style={s.bottomSheetWrapper}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[s.bottomSheetContent, { backgroundColor: colors.surface }]}>
                <Text style={[s.modalTitle, { color: colors.text }]}>{t('groupEdit.addGroup')}</Text>
                <TextInput
                  style={[s.modalInput, {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  placeholder={t('groupEdit.groupNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
                />
                <View style={s.modalButtons}>
                  <TouchableOpacity
                    style={[s.modalButton, s.modalButtonCancel, { backgroundColor: colors.inputBackground }]}
                    onPress={() => {
                      setShowAddModal(false);
                      setNewGroupName('');
                    }}
                  >
                    <Text style={[s.modalButtonTextCancel, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalButton, s.modalButtonConfirm, { backgroundColor: colors.primary }]}
                    onPress={addGroup}
                  >
                    <Text style={s.modalButtonTextConfirm}>{t('groupEdit.create')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 그룹 이름 변경 모달 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowEditModal(false);
            setNewGroupName('');
            setEditingGroup(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'position' : 'height'}
            style={s.bottomSheetWrapper}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[s.bottomSheetContent, { backgroundColor: colors.surface }]}>
                <Text style={[s.modalTitle, { color: colors.text }]}>{t('common.edit')}</Text>
                <TextInput
                  style={[s.modalInput, {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }]}
                  placeholder={t('groupEdit.groupNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
                />
                <View style={s.modalButtons}>
                  <TouchableOpacity
                    style={[s.modalButton, s.modalButtonCancel, { backgroundColor: colors.inputBackground }]}
                    onPress={() => {
                      setShowEditModal(false);
                      setNewGroupName('');
                      setEditingGroup(null);
                    }}
                  >
                    <Text style={[s.modalButtonTextCancel, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalButton, s.modalButtonConfirm, { backgroundColor: colors.primary }]}
                    onPress={editGroupName}
                  >
                    <Text style={s.modalButtonTextConfirm}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
      </View>
    </GestureHandlerRootView>
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  subtitle: {
    fontSize: 14,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 200,
  },
  reorderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  reorderItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reorderItemTextContainer: {
    flex: 1,
  },
  reorderItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  reorderItemSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  dragHandle: {
    padding: 8,
    marginRight: 8,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  bottomSheetWrapper: {
    width: '100%',
  },
  bottomSheetContent: {
    borderRadius: 20,
    padding: 24,
    paddingTop: 20,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    marginRight: 8,
  },
  modalButtonConfirm: {
    marginLeft: 8,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
