// screens/RealtimeSyncSettingsScreen.js - 실시간 서버전송 설정 화면
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import websocketClient from '../utils/websocket';
import config from '../config/config';

// 랜덤 세션 ID 생성 함수 (8자리)
const generateSessionId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function RealtimeSyncSettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [sessionUrls, setSessionUrls] = useState([]);

  // 비밀번호 모달 상태
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // 초기 로드
  useEffect(() => {
    (async () => {
      try {
        const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
        if (realtimeSync === 'true') {
          setRealtimeSyncEnabled(true);
        }

        const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
        if (savedSessionUrls) {
          setSessionUrls(JSON.parse(savedSessionUrls));
        }
      } catch (error) {
        console.error('Load realtime sync settings error:', error);
      }
    })();
  }, []);

  // 화면 포커스 시 데이터 다시 로드
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
          if (savedSessionUrls) {
            setSessionUrls(JSON.parse(savedSessionUrls));
          } else {
            setSessionUrls([]);
          }
        } catch (error) {
          console.error('Load session URLs error:', error);
        }
      })();
    }, [])
  );

  // 실시간 서버전송 설정 저장
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('realtimeSyncEnabled', realtimeSyncEnabled.toString());

        if (!realtimeSyncEnabled) {
          // 비활성화 시 state만 초기화 (AsyncStorage는 유지하여 다시 켤 때 복원 가능)
          setSessionUrls([]);

          // 현재 선택된 그룹이 세션 그룹(클라우드 동기화)인지 확인
          const selectedGroupId = await AsyncStorage.getItem('selectedGroupId');
          if (selectedGroupId) {
            const groupsData = await AsyncStorage.getItem('scanGroups');
            if (groupsData) {
              const groups = JSON.parse(groupsData);
              const selectedGroup = groups.find(g => g.id === selectedGroupId);

              // 선택된 그룹이 세션 그룹이면 기본 그룹으로 변경
              if (selectedGroup && selectedGroup.isCloudSync) {
                await AsyncStorage.setItem('selectedGroupId', 'default');
                console.log('Switched to default group as realtime sync was disabled');
              }
            }
          }
        } else {
          // 활성화 시 저장된 세션 URL 복원
          const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
          if (savedSessionUrls) {
            setSessionUrls(JSON.parse(savedSessionUrls));
          }
        }
      } catch (error) {
        console.error('Save realtime sync settings error:', error);
      }
    })();
  }, [realtimeSyncEnabled]);

  // 세션 URL 목록 저장
  useEffect(() => {
    if (realtimeSyncEnabled) {
      if (sessionUrls.length > 0) {
        AsyncStorage.setItem('sessionUrls', JSON.stringify(sessionUrls));
      } else {
        AsyncStorage.removeItem('sessionUrls');
      }
    }
  }, [sessionUrls, realtimeSyncEnabled]);

  // 새 세션 URL 생성
  const handleGenerateSessionUrl = async () => {
    const newSessionId = generateSessionId();
    const newSessionUrl = {
      id: newSessionId,
      url: `${config.serverUrl}/${newSessionId}`,
      createdAt: Date.now(),
    };

    setSessionUrls(prev => [newSessionUrl, ...prev]);

    // 서버에 세션 생성 알림
    try {
      if (!websocketClient.getConnectionStatus()) {
        websocketClient.connect(config.serverUrl);
      }
      await websocketClient.createSession(newSessionId);
      console.log('서버에 세션 생성 요청:', newSessionId);
    } catch (error) {
      console.error('서버 세션 생성 실패:', error);
    }

    // 자동으로 scanGroups에 클라우드 동기화 그룹 추가
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      const groups = groupsData ? JSON.parse(groupsData) : [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }];

      const newGroup = {
        id: newSessionId,
        name: `세션 ${newSessionId.substring(0, 4)}`,
        createdAt: Date.now(),
        isCloudSync: true,
      };

      const updatedGroups = [...groups, newGroup];
      await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      const historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };
      historyByGroup[newSessionId] = [];
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
    } catch (error) {
      console.error('Failed to create cloud sync group:', error);
    }

    Alert.alert(t('settings.success'), t('settings.sessionCreated'));
  };

  // 세션 삭제
  const handleDeleteSession = async (sessionId) => {
    Alert.alert(
      t('settings.deleteSession'),
      t('settings.deleteSessionConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setSessionUrls(prev => prev.filter(s => s.id !== sessionId));

            try {
              const groupsJson = await AsyncStorage.getItem('scanGroups');
              if (groupsJson) {
                const groups = JSON.parse(groupsJson);
                const updatedGroups = groups.filter(g => g.id !== sessionId);
                await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

                const historyByGroupJson = await AsyncStorage.getItem('scanHistoryByGroup');
                if (historyByGroupJson) {
                  const historyByGroup = JSON.parse(historyByGroupJson);
                  delete historyByGroup[sessionId];
                  await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
                }

                const historyJson = await AsyncStorage.getItem('scanHistory');
                if (historyJson) {
                  const history = JSON.parse(historyJson);
                  const updatedHistory = history.filter(item => item.groupId !== sessionId);
                  await AsyncStorage.setItem('scanHistory', JSON.stringify(updatedHistory));
                }
              }
            } catch (error) {
              console.error('Failed to delete cloud sync group:', error);
            }
          },
        },
      ]
    );
  };

  // 비밀번호 모달 열기
  const handleOpenPasswordModal = (sessionId) => {
    setSelectedSessionId(sessionId);
    const session = sessionUrls.find(s => s.id === sessionId);
    setPasswordInput(session?.password || '');
    setPasswordModalVisible(true);
  };

  // 비밀번호 저장
  const handleSavePassword = async () => {
    if (!passwordInput.trim()) {
      Alert.alert(t('settings.error'), t('settings.passwordRequired'));
      return;
    }

    const updatedUrls = sessionUrls.map(session => {
      if (session.id === selectedSessionId) {
        return { ...session, password: passwordInput.trim() };
      }
      return session;
    });

    setSessionUrls(updatedUrls);
    await AsyncStorage.setItem('sessionUrls', JSON.stringify(updatedUrls));

    Alert.alert(t('settings.success'), t('settings.passwordSaved'));
    setPasswordModalVisible(false);
    setPasswordInput('');
    setSelectedSessionId('');
  };

  // URL 복사
  const handleCopyUrl = async (url) => {
    await Clipboard.setStringAsync(url);
    Alert.alert(t('settings.success'), t('settings.urlCopied'));
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.realtimeSync')}</Text>
        <View style={styles.headerRight} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* 토글 설정 */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{t('settings.enableRealtimeSync')}</Text>
                <Text style={[styles.desc, { color: colors.textTertiary }]}>{t('settings.realtimeSyncDesc')}</Text>
              </View>
              <Switch
                value={realtimeSyncEnabled}
                onValueChange={setRealtimeSyncEnabled}
                trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                thumbColor="#fff"
                accessibilityLabel={t('settings.enableRealtimeSync')}
              />
            </View>

            {realtimeSyncEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                {/* 주소 생성 버튼 */}
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: colors.success }]}
                  onPress={handleGenerateSessionUrl}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>{t('settings.generateSessionUrl')}</Text>
                </TouchableOpacity>

                {/* 생성된 세션 URL 목록 */}
                {sessionUrls.length > 0 && (
                  <View style={styles.sessionListContainer}>
                    <Text style={[styles.sessionListTitle, { color: colors.text }]}>{t('settings.generatedUrls')}</Text>
                    {sessionUrls.map((session) => (
                      <View
                        key={session.id}
                        style={[
                          styles.sessionItem,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border
                          }
                        ]}
                      >
                        <View style={styles.sessionItemContent}>
                          <View style={styles.sessionItemHeader}>
                            <Ionicons
                              name="link"
                              size={18}
                              color={colors.primary}
                            />
                            <Text style={[styles.sessionUrl, { color: colors.primary, flex: 1 }]} numberOfLines={1}>
                              {session.url}
                            </Text>
                          </View>
                          <Text style={[styles.sessionGroupName, { color: colors.textSecondary }]}>
                            세션 {session.id.substring(0, 4)}
                          </Text>
                        </View>

                        <View style={styles.sessionItemActions}>
                          <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: session.password ? colors.success : colors.textTertiary }]}
                            onPress={() => handleOpenPasswordModal(session.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={session.password ? "lock-closed" : "lock-open-outline"} size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: colors.primary }]}
                            onPress={() => handleCopyUrl(session.url)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="copy-outline" size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: colors.error }]}
                            onPress={() => handleDeleteSession(session.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    <Text style={[styles.sessionInfo, { color: colors.textTertiary }]}>
                      {t('settings.sessionInfoNew')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* 비밀번호 입력 모달 */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPasswordModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Ionicons name="lock-closed" size={24} color={colors.primary} />
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {t('settings.addPassword')}
                  </Text>
                </View>

                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                  {t('settings.passwordDescription')}
                </Text>

                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderColor: colors.border
                    }
                  ]}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder={t('settings.passwordPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={true}
                  autoFocus={true}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.inputBackground }]}
                    onPress={() => {
                      setPasswordModalVisible(false);
                      setPasswordInput('');
                      setSelectedSessionId('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text }]}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSavePassword}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                      {t('common.save')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionListContainer: {
    marginTop: 20,
  },
  sessionListTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  sessionItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  sessionItemContent: {
    flex: 1,
  },
  sessionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sessionUrl: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  sessionGroupName: {
    fontSize: 12,
    marginTop: 4,
  },
  sessionItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    flex: 1,
  },
  sessionInfo: {
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
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
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  passwordInput: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
