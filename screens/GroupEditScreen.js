// screens/GroupEditScreen.js - 그룹 편집 화면
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import * as Haptics from 'expo-haptics';

const DEFAULT_GROUP_ID = 'default';
const ITEM_HEIGHT = 64; // 각 아이템의 대략적인 높이

export default function GroupEditScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [groups, setGroups] = useState([{ id: DEFAULT_GROUP_ID, name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // 드래그 애니메이션 값들
  const dragY = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const draggingIndexRef = useRef(null);
  const groupsRef = useRef(groups);

  // groupsRef 동기화
  React.useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  // 햅틱 설정 로드
  React.useEffect(() => {
    (async () => {
      try {
        const h = await AsyncStorage.getItem('hapticEnabled');
        if (h !== null) {
          setHapticEnabled(h === 'true');
        }
      } catch (error) {
        console.error('Load haptic settings error:', error);
      }
    })();
  }, []);

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

    if (editingGroup.isCloudSync) {
      Alert.alert(t('common.error') || '오류', '클라우드 동기화 그룹의 이름은 변경할 수 없습니다.');
      return;
    }

    const updatedGroups = groups.map(g =>
      g.id === editingGroup.id ? { ...g, name: newGroupName.trim() } : g
    );
    setGroups(updatedGroups);
    await saveGroups(updatedGroups);

    setNewGroupName('');
    setEditingGroup(null);
    setShowEditModal(false);
  };

  // 그룹 순서 변경
  const moveGroup = async (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= groups.length) return;

    const updatedGroups = [...groups];
    const [movedItem] = updatedGroups.splice(fromIndex, 1);
    updatedGroups.splice(toIndex, 0, movedItem);

    setGroups(updatedGroups);
    await saveGroups(updatedGroups);
  };

  // 그룹 이름 변경 모달 열기
  const openEditModal = (group) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setShowEditModal(true);
  };

  // 드래그 가능한 그룹 아이템 컴포넌트
  const DraggableGroupItem = ({ item, index }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scale = useRef(new Animated.Value(1)).current;
    const zIndex = useRef(new Animated.Value(0)).current;
    const isDragging = useRef(false);
    const startY = useRef(0);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return isDragging.current && Math.abs(gestureState.dy) > 5;
        },
        onPanResponderGrant: () => {
          pan.setOffset({
            x: 0,
            y: pan.y._value,
          });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_, gestureState) => {
          if (!isDragging.current) return;
          pan.y.setValue(gestureState.dy);

          // 이동 거리에 따라 새 인덱스 계산
          const newIndex = Math.round(gestureState.dy / ITEM_HEIGHT) + index;
          if (newIndex !== index && newIndex >= 0 && newIndex < groupsRef.current.length) {
            if (hapticEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        },
        onPanResponderRelease: async (_, gestureState) => {
          if (!isDragging.current) return;

          pan.flattenOffset();

          // 새 인덱스 계산
          const moveAmount = Math.round(gestureState.dy / ITEM_HEIGHT);
          const newIndex = Math.min(Math.max(0, index + moveAmount), groupsRef.current.length - 1);

          // 애니메이션으로 원래 위치로 돌아가기
          Animated.parallel([
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();

          zIndex.setValue(0);
          isDragging.current = false;
          setDraggingIndex(null);

          // 순서 변경
          if (newIndex !== index) {
            await moveGroup(index, newIndex);
          }
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();

          zIndex.setValue(0);
          isDragging.current = false;
          setDraggingIndex(null);
        },
      })
    ).current;

    const handleLongPress = () => {
      isDragging.current = true;
      setDraggingIndex(index);
      zIndex.setValue(100);

      if (hapticEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      Animated.spring(scale, {
        toValue: 1.05,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          s.groupItem,
          { backgroundColor: colors.surface },
          {
            transform: [
              { translateY: pan.y },
              { scale: scale },
            ],
            zIndex: draggingIndex === index ? 100 : 0,
            elevation: draggingIndex === index ? 10 : 2,
          },
          draggingIndex === index && s.groupItemDragging,
        ]}
      >
        {/* 드래그 핸들 */}
        <TouchableOpacity
          style={s.dragHandle}
          onLongPress={handleLongPress}
          delayLongPress={200}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={22} color={draggingIndex === index ? colors.primary : colors.textTertiary} />
        </TouchableOpacity>

        <View style={s.groupInfo}>
          {item.isCloudSync && (
            <Ionicons name="cloud" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          )}
          <Text style={[s.groupName, { color: colors.text }]}>{item.name}</Text>
          {item.id === DEFAULT_GROUP_ID && (
            <View style={[s.badge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[s.badgeText, { color: colors.primary }]}>
                {t('groupEdit.defaultGroup').split(' ')[0] || '기본'}
              </Text>
            </View>
          )}
          {item.isCloudSync && (
            <View style={[s.badge, { backgroundColor: colors.primary, marginLeft: 6 }]}>
              <Text style={[s.badgeText, { color: '#fff' }]}>Cloud</Text>
            </View>
          )}
        </View>

        <View style={s.groupActions}>
          {/* 순서 변경 버튼 */}
          <View style={s.reorderButtons}>
            <TouchableOpacity
              style={[s.reorderButton, index === 0 && s.iconButtonDisabled]}
              onPress={() => moveGroup(index, index - 1)}
              disabled={index === 0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={index === 0 ? colors.borderLight : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.reorderButton, index === groups.length - 1 && s.iconButtonDisabled]}
              onPress={() => moveGroup(index, index + 1)}
              disabled={index === groups.length - 1}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={index === groups.length - 1 ? colors.borderLight : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* 이름 변경 버튼 */}
          <TouchableOpacity
            style={[s.iconButton, (item.isCloudSync || item.id === DEFAULT_GROUP_ID) && s.iconButtonDisabled]}
            onPress={() => openEditModal(item)}
            disabled={item.isCloudSync || item.id === DEFAULT_GROUP_ID}
          >
            <Ionicons
              name="create-outline"
              size={22}
              color={(item.isCloudSync || item.id === DEFAULT_GROUP_ID) ? colors.borderLight : colors.primary}
            />
          </TouchableOpacity>

          {/* 삭제 버튼 */}
          <TouchableOpacity
            style={[s.iconButton, item.id === DEFAULT_GROUP_ID && s.iconButtonDisabled]}
            onPress={() => deleteGroup(item.id)}
            disabled={item.id === DEFAULT_GROUP_ID}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={item.id === DEFAULT_GROUP_ID ? colors.borderLight : colors.error}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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

      {/* 그룹 목록 */}
      <View style={s.listContainer}>
        <View style={s.listContent}>
          {groups.map((item, index) => (
            <DraggableGroupItem key={item.id} item={item} index={index} />
          ))}
        </View>
      </View>

      {/* 그룹 추가 버튼 */}
      <View style={[s.addButtonContainer, { backgroundColor: colors.background }]}>
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
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
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
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
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
        </View>
      </Modal>
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 15,
    paddingBottom: 120,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 8,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  groupItemDragging: {
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  dragHandle: {
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  groupInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: 4,
  },
  reorderButton: {
    padding: 2,
  },
  iconButton: {
    padding: 8,
  },
  iconButtonDisabled: {
    opacity: 0.3,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    alignItems: 'center',
    paddingTop: 120,
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
