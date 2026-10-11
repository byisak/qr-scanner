// screens/ScanUrlSettingsScreen.js - 스캔 연동 URL 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from '../components/MaterialPressable';

export default function ScanUrlSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [enabled, setEnabled] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [urlList, setUrlList] = useState([]); // [{ id: string, name: string, url: string, enabled: boolean }]

  // 수정 모달 상태
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingUrl, setEditingUrl] = useState('');
  const [focusedInput, setFocusedInput] = useState(null); // 입력칸 포커스 테두리용

  // 초기 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const savedUrlList = await SecureStore.getItemAsync('scanUrlList');

        if (e === 'true') {
          setEnabled(true);
        }

        if (savedUrlList) {
          const parsed = JSON.parse(savedUrlList);
          // 기존 데이터에 name 필드가 없으면 추가
          const migratedList = parsed.map((item, index) => ({
            ...item,
            name: item.name || `URL ${index + 1}`,
          }));
          setUrlList(migratedList);
          // 마이그레이션된 데이터 저장
          if (parsed.some(item => !item.name)) {
            await SecureStore.setItemAsync('scanUrlList', JSON.stringify(migratedList));
          }
        } else {
          // 기존 단일 URL 마이그레이션
          const oldUrl = await SecureStore.getItemAsync('baseUrl');
          if (oldUrl) {
            const migratedList = [{ id: Date.now().toString(), name: 'URL 1', url: oldUrl, enabled: true }];
            setUrlList(migratedList);
            await SecureStore.setItemAsync('scanUrlList', JSON.stringify(migratedList));
            await SecureStore.deleteItemAsync('baseUrl');
          }
        }
      } catch (error) {
        console.error('Load scan URL settings error:', error);
      }
    })();
  }, []);

  // 기능 활성화 상태 저장
  useEffect(() => {
    (async () => {
      await SecureStore.setItemAsync('scanLinkEnabled', enabled.toString());

      // 다른 고급 스캔 기능 비활성화 (상호 배타적)
      if (enabled) {
        await AsyncStorage.setItem('continuousScanEnabled', 'false');
        await AsyncStorage.setItem('batchScanEnabled', 'false');
        await AsyncStorage.setItem('multiCodeModeEnabled', 'false');
        await AsyncStorage.setItem('realtimeSyncEnabled', 'false');
        await AsyncStorage.setItem('lotteryScanEnabled', 'false');
      }
    })();
  }, [enabled]);

  // 기능 활성화 시 모든 URL에 대해 그룹 생성
  useEffect(() => {
    if (enabled && urlList.length > 0) {
      // 모든 URL에 대해 그룹 생성/확인
      const createAllGroups = async () => {
        for (const urlItem of urlList) {
          await ensureScanUrlGroup(urlItem);
        }
      };
      createAllGroups();
    }
  }, [enabled, urlList.length]);

  // URL 리스트 변경 시 저장
  useEffect(() => {
    if (urlList.length > 0) {
      SecureStore.setItemAsync('scanUrlList', JSON.stringify(urlList));

      // 활성화된 URL을 baseUrl에도 저장 (하위 호환성)
      const activeUrl = urlList.find(item => item.enabled);
      if (activeUrl) {
        SecureStore.setItemAsync('baseUrl', activeUrl.url);
      } else {
        SecureStore.deleteItemAsync('baseUrl');
      }
    }
  }, [urlList]);

  // URL 추가
  const handleAddUrl = async () => {
    const trimmedName = inputName.trim();
    const trimmedUrl = inputUrl.trim();

    if (!trimmedName) {
      Alert.alert(t('settings.error'), t('settings.urlNameEmptyError'));
      return;
    }

    if (!trimmedUrl) {
      Alert.alert(t('settings.error'), t('settings.urlEmptyError'));
      return;
    }

    // 중복 체크
    const isDuplicate = urlList.some(item => item.url === trimmedUrl);
    if (isDuplicate) {
      Alert.alert(t('settings.error'), t('settings.urlDuplicateError'));
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      name: trimmedName,
      url: trimmedUrl,
      enabled: urlList.length === 0, // 첫 번째 URL은 자동 활성화
    };

    setUrlList(prev => [...prev, newItem]);
    setInputName('');
    setInputUrl('');
    Keyboard.dismiss();

    // URL 추가 시 그룹도 자동 생성
    await ensureScanUrlGroup(newItem);
  };

  // URL 삭제
  const handleDeleteUrl = (id) => {
    Alert.alert(
      t('settings.deleteSession'),
      t('settings.deleteUrlConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setUrlList(prev => prev.filter(item => item.id !== id));
          },
        },
      ]
    );
  };

  // URL 수정 모달 열기
  const handleEditUrl = (item) => {
    setEditingItem(item);
    setEditingName(item.name);
    setEditingUrl(item.url);
    setEditModalVisible(true);
  };

  // URL 수정 저장
  const handleSaveEdit = () => {
    const trimmedName = editingName?.trim();
    const trimmedUrl = editingUrl?.trim();

    if (!trimmedName) {
      Alert.alert(t('settings.error'), t('settings.urlNameEmptyError'));
      return;
    }

    if (!trimmedUrl) {
      Alert.alert(t('settings.error'), t('settings.urlEmptyError'));
      return;
    }
    // 중복 체크 (자기 자신 제외)
    const isDuplicate = urlList.some(u => u.url === trimmedUrl && u.id !== editingItem.id);
    if (isDuplicate) {
      Alert.alert(t('settings.error'), t('settings.urlDuplicateError'));
      return;
    }
    setUrlList(prev => prev.map(u =>
      u.id === editingItem.id ? { ...u, name: trimmedName, url: trimmedUrl } : u
    ));
    setEditModalVisible(false);
    setEditingItem(null);
    setEditingName('');
    setEditingUrl('');
  };

  // 수정 모달 닫기
  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingItem(null);
    setEditingName('');
    setEditingUrl('');
  };

  // 스캔 URL 그룹 생성/확인 함수
  const ensureScanUrlGroup = async (urlItem) => {
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      const defaultGroupName = t('groupEdit.defaultGroup');
      let groups = groupsData ? JSON.parse(groupsData) : [{ id: 'default', name: defaultGroupName, createdAt: Date.now() }];

      // 기본 그룹이 없으면 추가
      if (!groups.find(g => g.id === 'default')) {
        groups.unshift({ id: 'default', name: defaultGroupName, createdAt: Date.now() });
      }

      // scanUrlId로 기존 그룹 검색 (이름이 아닌 ID로 구분)
      const existingGroup = groups.find(g => g.scanUrlId === urlItem.id && !g.isDeleted);

      if (!existingGroup) {
        // 새 그룹 생성
        const newGroup = {
          id: `scan-url-${urlItem.id}`,
          name: urlItem.name,
          createdAt: Date.now(),
          isCloudSync: false,
          isScanUrlGroup: true,
          scanUrlId: urlItem.id,
          isDeleted: false,
        };
        groups.push(newGroup);
        await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));

        // 히스토리 초기화
        const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
        let historyByGroup = historyData ? JSON.parse(historyData) : {};
        historyByGroup[newGroup.id] = [];
        await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

        console.log('[ScanUrlSettings] Created new scan URL group:', newGroup.id);
      } else {
        // 기존 그룹 이름 동기화
        if (existingGroup.name !== urlItem.name) {
          const updatedGroups = groups.map(g =>
            g.scanUrlId === urlItem.id ? { ...g, name: urlItem.name } : g
          );
          await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
          console.log('[ScanUrlSettings] Updated scan URL group name:', urlItem.name);
        }
      }
    } catch (error) {
      console.error('ensureScanUrlGroup error:', error);
    }
  };

  // URL 활성화 토글 (단일 선택만 허용)
  const handleToggleUrl = async (id, value) => {
    const newList = urlList.map(item => ({
      ...item,
      // 선택된 항목만 활성화, 나머지는 비활성화 (라디오 버튼처럼 동작)
      enabled: item.id === id ? value : false,
    }));
    setUrlList(newList);

    // 활성화된 URL에 대한 그룹 생성/확인
    if (value) {
      const activeUrl = newList.find(item => item.id === id);
      if (activeUrl) {
        await ensureScanUrlGroup(activeUrl);
      }
    }
  };

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더: 뒤로 · 제목 */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <View style={s.headerSide}>
          <MaterialPressable
            style={s.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </MaterialPressable>
        </View>
        <Text style={[s.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('settings.useScanUrl')}
        </Text>
        <View style={s.headerSide} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={s.content}
          contentContainerStyle={[s.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        >
          {/* 토글 설정 */}
          <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.row, s.rowWithDesc]}>
              <View style={s.rowText}>
                <Text style={[s.label, { color: colors.text, fontFamily: fonts.medium }]}>{t('settings.useScanUrl')}</Text>
                <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('settings.useScanUrlDesc')}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                {...switchColors}
                accessibilityLabel={t('settings.useScanUrl')}
              />
            </View>
          </View>

          {enabled && (
            <>
              {/* URL 추가 */}
              <View style={[s.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.urlInfo, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('settings.urlInfo')}
                </Text>

                {/* URL 이름 입력 */}
                <Text style={[s.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('settings.urlName')}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.inputBackground, borderColor: focusedInput === 'name' ? colors.primary : colors.border, color: colors.text, fontFamily: fonts.regular }]}
                  value={inputName}
                  onChangeText={setInputName}
                  placeholder={t('settings.urlNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  accessibilityLabel={t('settings.urlName')}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                />

                {/* URL 입력 및 추가 버튼 */}
                <Text style={[s.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('settings.urlAddress')}
                </Text>
                <View style={s.inputRow}>
                  <TextInput
                    style={[s.input, s.inputFlex, { backgroundColor: colors.inputBackground, borderColor: focusedInput === 'url' ? colors.primary : colors.border, color: colors.text, fontFamily: MONO }]}
                    value={inputUrl}
                    onChangeText={setInputUrl}
                    placeholder={t('settings.urlPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="url"
                    accessibilityLabel={t('settings.useScanUrl')}
                    onFocus={() => setFocusedInput('url')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <MaterialPressable
                    style={[s.addButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddUrl}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('productSearch.add')}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                  </MaterialPressable>
                </View>
              </View>

              {/* URL 리스트 */}
              {urlList.length > 0 && (
                <>
                <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('settings.urlListTitle')} ({urlList.length})
                </Text>
                <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {urlList.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          s.urlItem,
                          index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
                        ]}
                      >
                        {/* Row 1: Name + Toggle */}
                        <View style={s.urlItemRow}>
                          <View style={s.rowText}>
                            <Text
                              style={[s.label, { color: item.enabled ? colors.text : colors.textSecondary, fontFamily: fonts.medium }]}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[s.urlItemUrl, { color: item.enabled ? colors.textSecondary : colors.textTertiary }]}
                              numberOfLines={1}
                            >
                              {item.url}
                            </Text>
                          </View>
                          <Switch
                            value={item.enabled}
                            onValueChange={(value) => handleToggleUrl(item.id, value)}
                            {...switchColors}
                          />
                        </View>
                        {/* Row 2: Edit + Delete buttons */}
                        <View style={s.urlItemButtonRow}>
                          <MaterialPressable
                            onPress={() => handleEditUrl(item)}
                            style={[s.actionButton, s.actionButtonSecondary, { backgroundColor: colors.raised, borderColor: colors.border }]}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                          >
                            <Ionicons name="pencil-outline" size={16} color={colors.text} />
                            <Text style={[s.actionButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                              {t('common.edit') || '수정'}
                            </Text>
                          </MaterialPressable>
                          <MaterialPressable
                            onPress={() => handleDeleteUrl(item.id)}
                            style={[s.actionButton, { backgroundColor: colors.errorSoft }]}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                            <Text style={[s.actionButtonText, { color: colors.error, fontFamily: fonts.semiBold }]}>
                              {t('common.delete') || '삭제'}
                            </Text>
                          </MaterialPressable>
                        </View>
                      </View>
                    ))}
                  </View>
                  <Text style={[s.urlListInfo, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.urlToggleInfo')}
                  </Text>
                </>
              )}

              {/* 예시 안내 */}
              <View style={[s.exampleBox, { backgroundColor: colors.raised }]}>
                <View style={s.exampleHeader}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={[s.exampleTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('settings.exampleTitle')}</Text>
                </View>
                <Text style={[s.exampleText, { color: colors.primaryText }]}>{t('settings.exampleUrl')}</Text>
                <Text style={[s.exampleDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('settings.exampleDesc')}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* URL 수정 모달 */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalKeyboardView}
        >
          <TouchableWithoutFeedback onPress={handleCancelEdit}>
            <View style={s.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
                  <Text style={[s.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('settings.editUrlTitle') || 'URL 수정'}
                  </Text>
                  <Text style={[s.modalDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.editUrlDesc') || '이름과 URL을 수정하세요'}
                  </Text>

                  {/* 이름 입력 */}
                  <Text style={[s.modalInputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('settings.urlName') || '이름'}
                  </Text>
                  <TextInput
                    style={[s.modalInput, { backgroundColor: colors.inputBackground, borderColor: focusedInput === 'editName' ? colors.primary : colors.border, color: colors.text, fontFamily: fonts.regular }]}
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholder={t('settings.urlNamePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoFocus
                    onFocus={() => setFocusedInput('editName')}
                    onBlur={() => setFocusedInput(null)}
                  />

                  {/* URL 입력 */}
                  <Text style={[s.modalInputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('settings.urlAddress') || 'URL 주소'}
                  </Text>
                  <TextInput
                    style={[s.modalInput, { backgroundColor: colors.inputBackground, borderColor: focusedInput === 'editUrl' ? colors.primary : colors.border, color: colors.text, fontFamily: MONO }]}
                    value={editingUrl}
                    onChangeText={setEditingUrl}
                    placeholder={t('settings.urlPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="url"
                    onFocus={() => setFocusedInput('editUrl')}
                    onBlur={() => setFocusedInput(null)}
                  />

                  <View style={s.modalButtons}>
                    <MaterialPressable
                      style={[s.modalButton, s.modalCancelButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
                      onPress={handleCancelEdit}
                      accessibilityRole="button"
                    >
                      <Text style={[s.modalButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                        {t('common.cancel')}
                      </Text>
                    </MaterialPressable>
                    <MaterialPressable
                      style={[s.modalButton, { backgroundColor: colors.primary }]}
                      onPress={handleSaveEdit}
                      accessibilityRole="button"
                    >
                      <Text style={[s.modalButtonText, { color: '#fff', fontFamily: fonts.semiBold }]}>
                        {t('common.save') || '저장'}
                      </Text>
                    </MaterialPressable>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flexShrink: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 4,
    gap: SPACE.gap,
  },
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowWithDesc: {
    minHeight: SIZE.rowWithDesc,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  // URL 추가 폼 카드
  formCard: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    padding: 16,
  },
  urlInfo: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    fontSize: 15,
    borderWidth: 1,
  },
  inputFlex: {
    flex: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // URL 목록
  urlItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  urlItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  urlItemUrl: {
    fontSize: 12,
    fontFamily: MONO,
  },
  urlItemButtonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZE.touch,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    gap: 6,
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  urlListInfo: {
    fontSize: 12,
    lineHeight: 17,
    marginHorizontal: 4,
  },
  // 예시 안내 상자
  exampleBox: {
    padding: 12,
    borderRadius: RADIUS.control,
    gap: 6,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exampleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  exampleText: {
    fontSize: 13,
    fontFamily: MONO,
  },
  exampleDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  // 모달 스타일
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.card,
    padding: SPACE.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
