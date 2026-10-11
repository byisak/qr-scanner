// screens/GroupEditScreen.js - 그룹 편집 화면
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../config/config';
import MaterialPressable from '../components/MaterialPressable';

const DEFAULT_GROUP_ID = 'default';

// 입력칸: 포커스되면 테두리를 강조색으로
function Field({ style, colors, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, focused && { borderColor: colors.primary }]}
    />
  );
}

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
          // AsyncStorage에서 최신 데이터를 직접 읽어서 삭제 (stale closure 방지)
          const freshGroupsData = await AsyncStorage.getItem('scanGroups');
          const freshGroups = freshGroupsData ? JSON.parse(freshGroupsData) : [];
          const groupToDelete = freshGroups.find(g => g.id === groupId);
          const isCloudSyncGroup = groupToDelete?.isCloudSync;

          const updatedGroups = freshGroups.filter(g => g.id !== groupId);
          setGroups(updatedGroups.map(g => {
            if (g.id === DEFAULT_GROUP_ID) {
              return { ...g, name: t('groupEdit.defaultGroup') };
            }
            return g;
          }));
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
      Alert.alert(t('common.error') || '오류', t('groupEdit.cannotEditDefault') || '기본 그룹은 이름을 변경할 수 없습니다.');
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

  // 그룹 아이템 렌더링 (한 묶음 카드 안의 행)
  const renderItem = useCallback(({ item, drag, isActive }) => {
    // 아이콘 및 색상 결정 (연한 바탕 + 진한 아이콘)
    let iconName = 'folder';
    let tone = { bg: colors.primarySoft, fg: colors.primaryText };
    if (item.isCloudSync) {
      iconName = 'cloud';
    } else if (item.isScanUrlGroup) {
      iconName = 'link';
      tone = { bg: colors.successSoft, fg: colors.success };
    } else if (item.id === DEFAULT_GROUP_ID) {
      iconName = 'home';
    }
    // 순서가 바뀌면 groups가 바뀌어 모든 행이 다시 그려지므로 첫·끝 행 모서리가 맞게 유지된다
    const index = groups.findIndex(g => g.id === item.id);
    const isFirst = index <= 0;
    const isLast = index === groups.length - 1;
    const isDefault = item.id === DEFAULT_GROUP_ID;

    return (
      <ScaleDecorator>
        <MaterialPressable
          activeOpacity={0.9}
          onLongPress={drag}
          disabled={isActive}
          style={[
            s.reorderItem,
            isFirst && s.reorderItemFirst,
            isLast && s.reorderItemLast,
            !isFirst && !isActive && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
            isActive && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: RADIUS.control },
          ]}
        >
          {/* 드래그 핸들 */}
          <MaterialPressable
            onPressIn={drag}
            style={s.dragHandle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={22} color={colors.textTertiary} />
          </MaterialPressable>

          {/* 아이콘 */}
          <View style={[s.reorderItemIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name={iconName} size={20} color={tone.fg} />
          </View>

          {/* 그룹 이름 */}
          <View style={s.reorderItemTextContainer}>
            <Text style={[s.reorderItemText, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{item.name}</Text>
            {isDefault && (
              <Text style={[s.reorderItemSubtext, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('groupEdit.defaultGroup') || '기본'}
              </Text>
            )}
            {item.isCloudSync && (
              <Text style={[s.reorderItemSubtext, { color: colors.primaryText, fontFamily: fonts.medium }]}>
                Cloud Sync
              </Text>
            )}
          </View>

          {/* 액션 버튼들 */}
          <View style={s.groupActions}>
            {/* 이름 변경 버튼 */}
            <MaterialPressable
              style={[s.actionButton, isDefault && s.actionButtonDisabled]}
              onPress={() => openEditModal(item)}
              disabled={isDefault}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={isDefault ? colors.textTertiary : colors.textSecondary}
              />
            </MaterialPressable>

            {/* 삭제 버튼 */}
            <MaterialPressable
              style={[s.actionButton, isDefault && s.actionButtonDisabled]}
              onPress={() => deleteGroup(item.id)}
              disabled={isDefault}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={isDefault ? colors.textTertiary : colors.error}
              />
            </MaterialPressable>
          </View>
        </MaterialPressable>
      </ScaleDecorator>
    );
  }, [colors, t, fonts, groups]);

  // 그룹 이름 변경 모달 열기
  const openEditModal = (group) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setShowEditModal(true);
  };

  const modalInputStyle = [s.modalInput, {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
  }];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* 헤더 */}
        <View style={[s.header, { paddingTop: insets.top + 4 }]}>
          <MaterialPressable
            style={s.iconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </MaterialPressable>
          <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('groupEdit.title')}</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* 서브타이틀 - 드래그 안내 */}
        <View style={s.subtitleContainer}>
          <Text style={[s.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('groupEdit.dragToReorder') || '≡ 아이콘을 길게 눌러 순서를 변경하세요'}
          </Text>
        </View>

        {/* 그룹 목록 (드래그 가능) - 한 묶음 카드 */}
        <DraggableFlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={handleDragEnd}
          containerStyle={s.listContainer}
          contentContainerStyle={[s.listContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activationDistance={10}
        />

        {/* 그룹 추가 버튼 */}
        <View style={[s.addButtonContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <MaterialPressable
            style={[s.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <Text style={[s.addButtonText, { fontFamily: fonts.semiBold }]}>{t('groupEdit.addGroup')}</Text>
          </MaterialPressable>
        </View>

      {/* 그룹 추가 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <MaterialPressable
          style={s.modalOverlay}
          activeOpacity={1}
          rippleColor="transparent"
          onPress={() => {
            setShowAddModal(false);
            setNewGroupName('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'position' : 'height'}
            style={s.bottomSheetWrapper}
          >
            <MaterialPressable activeOpacity={1} rippleColor="transparent" onPress={(e) => e.stopPropagation()}>
              <View style={[s.bottomSheetContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('groupEdit.addGroup')}</Text>
                <Field
                  colors={colors}
                  style={modalInputStyle}
                  placeholder={t('groupEdit.groupNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
                />
                <View style={s.modalButtons}>
                  <MaterialPressable
                    style={[s.modalButton, s.modalButtonCancel, { backgroundColor: colors.raised, borderColor: colors.border }]}
                    onPress={() => {
                      setShowAddModal(false);
                      setNewGroupName('');
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[s.modalButtonTextCancel, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('common.cancel')}</Text>
                  </MaterialPressable>
                  <MaterialPressable
                    style={[s.modalButton, { backgroundColor: colors.primary }]}
                    onPress={addGroup}
                    accessibilityRole="button"
                  >
                    <Text style={[s.modalButtonTextConfirm, { fontFamily: fonts.semiBold }]}>{t('groupEdit.create')}</Text>
                  </MaterialPressable>
                </View>
              </View>
            </MaterialPressable>
          </KeyboardAvoidingView>
        </MaterialPressable>
      </Modal>

      {/* 그룹 이름 변경 모달 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <MaterialPressable
          style={s.modalOverlay}
          activeOpacity={1}
          rippleColor="transparent"
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
            <MaterialPressable activeOpacity={1} rippleColor="transparent" onPress={(e) => e.stopPropagation()}>
              <View style={[s.bottomSheetContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('common.edit')}</Text>
                <Field
                  colors={colors}
                  style={modalInputStyle}
                  placeholder={t('groupEdit.groupNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
                />
                <View style={s.modalButtons}>
                  <MaterialPressable
                    style={[s.modalButton, s.modalButtonCancel, { backgroundColor: colors.raised, borderColor: colors.border }]}
                    onPress={() => {
                      setShowEditModal(false);
                      setNewGroupName('');
                      setEditingGroup(null);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[s.modalButtonTextCancel, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('common.cancel')}</Text>
                  </MaterialPressable>
                  <MaterialPressable
                    style={[s.modalButton, { backgroundColor: colors.primary }]}
                    onPress={editGroupName}
                    accessibilityRole="button"
                  >
                    <Text style={[s.modalButtonTextConfirm, { fontFamily: fonts.semiBold }]}>{t('common.save')}</Text>
                  </MaterialPressable>
                </View>
              </View>
            </MaterialPressable>
          </KeyboardAvoidingView>
        </MaterialPressable>
      </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconButton: { width: SIZE.touch, height: SIZE.touch, justifyContent: 'center', alignItems: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTitle: { ...TYPE.screenTitle, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  headerSpacer: { width: SIZE.touch },
  subtitleContainer: { paddingHorizontal: SPACE.screen + 4, paddingTop: 4, paddingBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  listContainer: { flex: 1 },
  // 묶음 카드: 드래그 중 커지는 행이 잘리지 않게 overflow는 열어 둔다 (첫·끝 행에만 모서리)
  listContent: {
    marginHorizontal: SPACE.screen,
    marginBottom: SPACE.screen,
    borderRadius: RADIUS.group,
    borderWidth: 1,
  },
  reorderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 6,
    overflow: 'hidden',
  },
  reorderItemFirst: { borderTopLeftRadius: RADIUS.group, borderTopRightRadius: RADIUS.group },
  reorderItemLast: { borderBottomLeftRadius: RADIUS.group, borderBottomRightRadius: RADIUS.group },
  reorderItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reorderItemTextContainer: { flex: 1, minWidth: 0 },
  reorderItemText: { ...TYPE.body },
  reorderItemSubtext: { fontSize: 12, marginTop: 2 },
  dragHandle: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    overflow: 'hidden',
  },
  groupActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionButtonDisabled: { opacity: 0.4 },
  addButtonContainer: { paddingHorizontal: SPACE.screen, paddingTop: 8 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
  },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  bottomSheetWrapper: { width: '100%' },
  bottomSheetContent: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.card },
  modalTitle: { fontSize: 17, fontWeight: '600', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderRadius: RADIUS.control,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: SPACE.gap },
  modalButton: {
    flex: 1,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalButtonCancel: { borderWidth: 1 },
  modalButtonTextCancel: { fontSize: 16, fontWeight: '600' },
  modalButtonTextConfirm: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
