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
  TouchableOpacity,
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

export default function ScanUrlSettingsScreen() {
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
    SecureStore.setItemAsync('scanLinkEnabled', enabled.toString());
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
      let groups = groupsData ? JSON.parse(groupsData) : [];

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.useScanUrl')}</Text>
        <View style={styles.headerRight} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* 토글 설정 */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{t('settings.useScanUrl')}</Text>
                <Text style={[styles.desc, { color: colors.textTertiary }]}>{t('settings.useScanUrlDesc')}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                thumbColor="#fff"
                accessibilityLabel={t('settings.useScanUrl')}
              />
            </View>

            {enabled && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                <Text style={[styles.urlInfo, { color: colors.textSecondary }]}>
                  {t('settings.urlInfo')}
                </Text>

                {/* URL 이름 입력 */}
                <TextInput
                  style={[styles.input, styles.inputFullWidth, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text, marginTop: 15 }]}
                  value={inputName}
                  onChangeText={setInputName}
                  placeholder={t('settings.urlNamePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  accessibilityLabel={t('settings.urlName')}
                />

                {/* URL 입력 및 추가 버튼 */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={inputUrl}
                    onChangeText={setInputUrl}
                    placeholder={t('settings.urlPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="url"
                    accessibilityLabel={t('settings.useScanUrl')}
                  />
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddUrl}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* URL 리스트 */}
                {urlList.length > 0 && (
                  <View style={styles.urlListContainer}>
                    <Text style={[styles.urlListTitle, { color: colors.textSecondary }]}>
                      {t('settings.urlListTitle')} ({urlList.length})
                    </Text>
                    {urlList.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.urlItem,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: item.enabled ? colors.success : colors.border
                          }
                        ]}
                      >
                        {/* Row 1: Name + Toggle */}
                        <View style={styles.urlItemRow}>
                          <View style={styles.urlItemTextContainer}>
                            <Text
                              style={[
                                styles.urlItemName,
                                { color: item.enabled ? colors.text : colors.textSecondary }
                              ]}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                styles.urlItemUrl,
                                { color: item.enabled ? colors.textSecondary : colors.textTertiary }
                              ]}
                              numberOfLines={1}
                            >
                              {item.url}
                            </Text>
                          </View>
                          <Switch
                            value={item.enabled}
                            onValueChange={(value) => handleToggleUrl(item.id, value)}
                            trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                            thumbColor="#fff"
                            style={styles.urlItemSwitch}
                          />
                        </View>
                        {/* Row 2: Edit + Delete buttons */}
                        <View style={styles.urlItemButtonRow}>
                          <TouchableOpacity
                            onPress={() => handleEditUrl(item)}
                            style={[styles.actionButton, { borderColor: colors.border }]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                              {t('common.edit') || '수정'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteUrl(item.id)}
                            style={[styles.actionButton, { borderColor: colors.border }]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                            <Text style={[styles.actionButtonText, { color: colors.error }]}>
                              {t('common.delete') || '삭제'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    <Text style={[styles.urlListInfo, { color: colors.textTertiary }]}>
                      {t('settings.urlToggleInfo')}
                    </Text>
                  </View>
                )}

                <View style={[styles.exampleBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Text style={[styles.exampleTitle, { color: colors.textSecondary }]}>{t('settings.exampleTitle')}</Text>
                  <Text style={[styles.exampleText, { color: colors.primary }]}>{t('settings.exampleUrl')}</Text>
                  <Text style={[styles.exampleDesc, { color: colors.textTertiary }]}>
                    {t('settings.exampleDesc')}
                  </Text>
                </View>
              </>
            )}
          </View>
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
          style={styles.modalKeyboardView}
        >
          <TouchableWithoutFeedback onPress={handleCancelEdit}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {t('settings.editUrlTitle') || 'URL 수정'}
                  </Text>
                  <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                    {t('settings.editUrlDesc') || '이름과 URL을 수정하세요'}
                  </Text>

                  {/* 이름 입력 */}
                  <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                    {t('settings.urlName') || '이름'}
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholder={t('settings.urlNamePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoFocus
                  />

                  {/* URL 입력 */}
                  <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                    {t('settings.urlAddress') || 'URL 주소'}
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={editingUrl}
                    onChangeText={setEditingUrl}
                    placeholder={t('settings.urlPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="url"
                  />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                      onPress={handleCancelEdit}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                        {t('common.cancel')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSaveButton, { backgroundColor: colors.primary }]}
                      onPress={handleSaveEdit}
                    >
                      <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                        {t('common.save') || '저장'}
                      </Text>
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 36,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  urlInfo: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 10,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  inputFlex: {
    flex: 1,
  },
  inputFullWidth: {
    width: '100%',
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlListContainer: {
    marginTop: 20,
  },
  urlListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  urlItem: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  urlItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urlItemTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  urlItemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  urlItemUrl: {
    fontSize: 12,
  },
  urlItemSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  urlItemButtonRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  urlListInfo: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  exampleBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  exampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  exampleDesc: {
    fontSize: 12,
    lineHeight: 18,
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
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  modalInput: {
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalSaveButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
