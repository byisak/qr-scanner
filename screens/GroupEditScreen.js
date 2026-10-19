// screens/GroupEditScreen.js - 그룹 편집 화면
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 순서 바꾸기: New Architecture 에서 드래그 중 행 내용이 사라지던 draggable-flatlist 대신 reorderable-list
import ReorderableList, { reorderItems, useReorderableDrag, useIsActive } from 'react-native-reorderable-list';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { deleteGroups, countRecordsByGroup } from '../utils/groupStore';
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

// 그룹 한 행. 각 행이 따로 그려져 드래그 중에도 이름이 사라지지 않는다
function GroupRow({ item, isFirst, isLast, editMode, selected, onToggle, onEdit, onDelete, onEnterSelect, colors, fonts, t }) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const isDefault = item.id === DEFAULT_GROUP_ID;
  const swipeRef = useRef(null);

  let iconName = 'folder';
  let tone = { bg: colors.primarySoft, fg: colors.primaryText };
  if (item.isCloudSync) iconName = 'cloud';
  else if (item.isScanUrlGroup) { iconName = 'link'; tone = { bg: colors.successSoft, fg: colors.success }; }
  else if (isDefault) iconName = 'home';

  const startDrag = () => {
    if (editMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    drag();
  };

  const row = (
    <MaterialPressable
      activeOpacity={0.9}
      onPress={editMode ? () => !isDefault && onToggle(item.id) : undefined}
      // 안드로이드: 행을 길게 누르면 선택 모드로 (순서 바꾸기는 ≡ 손잡이)
      // 편집 모드에서도 onLongPress를 떼지 않는다: 길게 누른 직후 핸들러가 사라지면 손을 뗄 때 onPress가 불려 방금 고른 항목이 풀린다
      onLongPress={Platform.OS === 'android' && !isDefault ? () => { if (!editMode) onEnterSelect(item.id); } : undefined}
      disabled={!editMode && Platform.OS !== 'android'}
      accessibilityRole={editMode ? 'checkbox' : undefined}
      accessibilityState={editMode ? { checked: selected, disabled: isDefault } : undefined}
      style={[
        s.reorderItem,
        { backgroundColor: selected ? colors.primarySoft : colors.surface },
        isFirst && s.reorderItemFirst,
        isLast && s.reorderItemLast,
        !isFirst && !isActive && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
        isActive && [s.rowActive, { borderColor: colors.primary, shadowColor: '#000' }],
      ]}
    >
      {editMode ? (
        <View style={s.dragHandle}>
          <Ionicons
            name={isDefault ? 'ellipse-outline' : selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isDefault ? colors.border : selected ? colors.primary : colors.textTertiary}
          />
        </View>
      ) : (
        <MaterialPressable
          onLongPress={startDrag}
          onPressIn={Platform.OS === 'ios' ? startDrag : undefined}
          delayLongPress={150}
          style={s.dragHandle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t('groupEdit.dragToReorder')}
        >
          <Ionicons name="menu" size={22} color={colors.textTertiary} />
        </MaterialPressable>
      )}

      <View style={[s.reorderItemIcon, { backgroundColor: tone.bg }]}>
        <Ionicons name={iconName} size={20} color={tone.fg} />
      </View>

      <View style={s.reorderItemTextContainer}>
        <Text style={[s.reorderItemText, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{item.name}</Text>
        {isDefault && (
          <Text style={[s.reorderItemSubtext, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('groupEdit.defaultGroup') || '기본'}
          </Text>
        )}
        {item.isCloudSync && (
          <Text style={[s.reorderItemSubtext, { color: colors.primaryText, fontFamily: fonts.medium }]}>Cloud Sync</Text>
        )}
      </View>

      {!editMode && (
        <View style={s.groupActions}>
          <MaterialPressable
            style={[s.actionButton, isDefault && s.actionButtonDisabled]}
            onPress={() => onEdit(item)}
            disabled={isDefault}
            accessibilityLabel={t('common.edit')}
          >
            <Ionicons name="create-outline" size={20} color={isDefault ? colors.textTertiary : colors.textSecondary} />
          </MaterialPressable>
          {Platform.OS === 'android' && (
            <MaterialPressable
              style={[s.actionButton, isDefault && s.actionButtonDisabled]}
              onPress={() => onDelete(item.id)}
              disabled={isDefault}
              accessibilityLabel={t('common.delete')}
            >
              <Ionicons name="trash-outline" size={20} color={isDefault ? colors.textTertiary : colors.error} />
            </MaterialPressable>
          )}
        </View>
      )}
    </MaterialPressable>
  );

  // iOS: 행을 왼쪽으로 밀어 삭제 (기본 그룹·선택 모드 제외)
  if (Platform.OS === 'ios' && !editMode && !isDefault) {
    return (
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <MaterialPressable
            style={[s.swipeDelete, { backgroundColor: colors.error }, isFirst && { borderTopRightRadius: RADIUS.group }, isLast && { borderBottomRightRadius: RADIUS.group }]}
            onPress={() => { swipeRef.current?.close(); onDelete(item.id); }}
            accessibilityLabel={t('common.delete')}
          >
            <Ionicons name="trash" size={20} color="#FFFFFF" />
            <Text style={[s.swipeDeleteText, { fontFamily: fonts.semiBold }]}>{t('common.delete')}</Text>
          </MaterialPressable>
        )}
      >
        {row}
      </ReanimatedSwipeable>
    );
  }
  return row;
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

  // ───────── 삭제: 확인 → 목록에서 바로 숨김 → 5초 뒤 확정 (그 사이 '실행 취소') ─────────
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [pending, setPending] = useState(null); // { ids: string[] }
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const commitPending = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setPending(null);
    await deleteGroups(p.ids);
    setGroups(prev => prev.filter(g => !p.ids.includes(g.id)));
  }, []);

  const undoPending = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = null;
    setPending(null);
    Haptics.selectionAsync().catch(() => {});
  };

  // 화면을 떠나거나 닫히면 미뤄 둔 삭제를 바로 확정한다
  useFocusEffect(useCallback(() => () => { commitPending(); }, [commitPending]));
  useEffect(() => () => { commitPending(); }, [commitPending]);

  // 플랫폼에 맞는 확인 창: iOS 는 아래에서 올라오는 시트(빨간 삭제), 안드로이드는 대화상자
  const confirmDelete = (title, message, onConfirm) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, message, options: [t('common.cancel'), t('common.delete')], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (index) => { if (index === 1) onConfirm(); }
      );
    } else {
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const requestDelete = async (ids) => {
    const targets = ids.filter(id => id !== DEFAULT_GROUP_ID);
    if (targets.length === 0) {
      Alert.alert(t('common.error') || '오류', t('groupEdit.cannotDeleteDefault'));
      return;
    }
    await commitPending(); // 앞서 미뤄 둔 삭제가 있으면 먼저 확정
    const counts = await countRecordsByGroup();
    const records = targets.reduce((n, id) => n + (counts[id] || 0), 0);
    const one = targets.length === 1 ? groups.find(g => g.id === targets[0]) : null;
    const title = one ? t('groupEdit.deleteConfirmTitle') : t('groupEdit.deleteManyTitle', { count: targets.length });
    const message = one
      ? t(records ? 'groupEdit.deleteOneMessage' : 'groupEdit.deleteOneEmpty', { name: one.name, records })
      : t(records ? 'groupEdit.deleteManyMessage' : 'groupEdit.deleteManyEmpty', { records });
    confirmDelete(title, message, () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      pendingRef.current = { ids: targets };
      setPending({ ids: targets });
      setSelected(new Set());
      setEditMode(false);
      timerRef.current = setTimeout(() => { commitPending(); }, 5000);
    });
  };

  const deleteGroup = (groupId) => requestDelete([groupId]);

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
  // 미뤄 둔 삭제 대상은 목록에서 바로 숨긴다
  const visibleGroups = useMemo(
    () => (pending ? groups.filter(g => !pending.ids.includes(g.id)) : groups),
    [groups, pending]
  );
  // 그룹이 빠지거나 더해지면 목록을 새로 그린다. ReorderableList는 칸 위치를 인덱스로 기억해서,
  // 앞쪽 항목이 사라지면 남은 행이 옛 자리(빈칸) 그대로 남는다. 순서만 바뀔 때는 그대로 둔다.
  const listKey = useMemo(() => visibleGroups.map(g => g.id).sort().join('|'), [visibleGroups]);
  const selectable = useMemo(() => visibleGroups.filter(g => g.id !== DEFAULT_GROUP_ID), [visibleGroups]);
  const allSelected = selectable.length > 0 && selectable.every(g => selected.has(g.id));

  const handleReorder = async ({ from, to }) => {
    const next = reorderItems(visibleGroups, from, to);
    const hidden = groups.filter(g => !visibleGroups.includes(g));
    const full = [...next, ...hidden];
    setGroups(full);
    Haptics.selectionAsync().catch(() => {});
    await saveGroups(full);
  };

  const toggleSelect = useCallback((id) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const enterSelect = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditMode(true);
    setSelected(new Set(id ? [id] : []));
  }, []);

  const exitSelect = () => { setEditMode(false); setSelected(new Set()); };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map(g => g.id)));

  const renderItem = ({ item, index }) => (
    <GroupRow
      item={item}
      isFirst={index === 0}
      isLast={index === visibleGroups.length - 1}
      editMode={editMode}
      selected={selected.has(item.id)}
      onToggle={toggleSelect}
      onEdit={openEditModal}
      onDelete={deleteGroup}
      onEnterSelect={enterSelect}
      colors={colors}
      fonts={fonts}
      t={t}
    />
  );

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
          <MaterialPressable
            style={s.headerTextButton}
            onPress={editMode ? exitSelect : () => enterSelect(null)}
            disabled={!editMode && selectable.length === 0}
            accessibilityRole="button"
          >
            <Text style={[s.headerTextButtonLabel, { color: !editMode && selectable.length === 0 ? colors.textTertiary : colors.primaryText, fontFamily: fonts.semiBold }]}>
              {editMode ? t('groupEdit.done') : t('groupEdit.edit')}
            </Text>
          </MaterialPressable>
        </View>

        {/* 서브타이틀 - 드래그 안내 */}
        <View style={s.subtitleContainer}>
          <Text style={[s.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {editMode ? t('groupEdit.selectHint') : t('groupEdit.dragToReorder')}
          </Text>
        </View>

        {/* 그룹 목록 (≡ 를 끌어 순서 바꾸기) - 한 묶음 카드 */}
        <ReorderableList
          key={listKey}
          data={visibleGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onReorder={handleReorder}
          dragEnabled={!editMode}
          cellAnimations={{ opacity: 1 }}
          style={s.listContainer}
          contentContainerStyle={[s.listContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
        />

        {/* 실행 취소 알림 (삭제 후 5초) */}
        {pending && (
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(160)}
            style={[s.snackbar, { backgroundColor: isDark ? '#F2F3F5' : '#1F232A', bottom: insets.bottom + SIZE.primaryButton + 32 }]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[s.snackbarText, { color: isDark ? '#15181D' : '#FFFFFF', fontFamily: fonts.medium }]}>
              {t('groupEdit.deletedCount', { count: pending.ids.length })}
            </Text>
            <MaterialPressable onPress={undoPending} style={s.snackbarAction} accessibilityRole="button">
              <Text style={[s.snackbarActionText, { color: isDark ? '#1E5BD8' : '#8DB4FF', fontFamily: fonts.semiBold }]}>{t('groupEdit.undo')}</Text>
            </MaterialPressable>
          </Animated.View>
        )}

        {editMode ? (
          <View key="select-bar" style={[s.addButtonContainer, s.selectBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <MaterialPressable
              style={[s.selectBarButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
              onPress={toggleAll}
              accessibilityRole="button"
            >
              <Text style={[s.selectBarText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {allSelected ? t('groupEdit.deselectAll') : t('groupEdit.selectAll')}
              </Text>
            </MaterialPressable>
            <MaterialPressable
              style={[s.selectBarButton, { backgroundColor: selected.size ? colors.error : colors.raised, borderColor: selected.size ? colors.error : colors.border }]}
              onPress={() => requestDelete([...selected])}
              disabled={selected.size === 0}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={18} color={selected.size ? '#FFFFFF' : colors.textTertiary} />
              <Text style={[s.selectBarText, { color: selected.size ? '#FFFFFF' : colors.textTertiary, fontFamily: fonts.semiBold }]}>
                {t('groupEdit.deleteSelected', { count: selected.size })}
              </Text>
            </MaterialPressable>
          </View>
        ) : (
          <View key="add-bar" style={[s.addButtonContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <MaterialPressable
              style={[s.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={22} color="#FFFFFF" />
              <Text style={[s.addButtonText, { fontFamily: fonts.semiBold }]}>{t('groupEdit.addGroup')}</Text>
            </MaterialPressable>
          </View>
        )}

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
  // 끌고 있는 행: 떠 보이게 (이름은 그대로 보인다)
  rowActive: {
    borderWidth: 1,
    borderRadius: RADIUS.control,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  swipeDelete: { width: 88, alignItems: 'center', justifyContent: 'center', gap: 2 },
  swipeDeleteText: { color: '#FFFFFF', fontSize: 12 },
  headerTextButton: { minWidth: SIZE.touch, height: SIZE.touch, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: SIZE.touch / 2, overflow: 'hidden' },
  headerTextButtonLabel: { fontSize: 16 },
  selectBar: { flexDirection: 'row', gap: SPACE.gap },
  selectBarButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectBarText: { fontSize: 16 },
  snackbar: {
    position: 'absolute',
    left: SPACE.screen,
    right: SPACE.screen,
    minHeight: 52,
    borderRadius: RADIUS.control,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  snackbarText: { fontSize: 14, flex: 1 },
  snackbarAction: { paddingHorizontal: 12, height: 40, justifyContent: 'center', borderRadius: 20, overflow: 'hidden' },
  snackbarActionText: { fontSize: 14 },
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
