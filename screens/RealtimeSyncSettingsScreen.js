// screens/RealtimeSyncSettingsScreen.js - 실시간 서버전송 설정 화면
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// 보관 기간 (일)
const RETENTION_DAYS = 30;

// 남은 일수 계산
const getDaysRemaining = (deletedAt) => {
  if (!deletedAt) return RETENTION_DAYS;
  const deletedDate = new Date(deletedAt);
  const expiryDate = new Date(deletedDate.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

export default function RealtimeSyncSettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [sessionUrls, setSessionUrls] = useState([]);

  // 탭 상태: 'active' | 'deleted'
  const [activeTab, setActiveTab] = useState('active');

  // 비밀번호 모달 상태
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // 활성/삭제된 세션 필터링
  const activeSessions = useMemo(() =>
    sessionUrls.filter(s => s.status !== 'DELETED'),
    [sessionUrls]
  );

  const deletedSessions = useMemo(() =>
    sessionUrls.filter(s => s.status === 'DELETED'),
    [sessionUrls]
  );

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
          const parsed = JSON.parse(savedSessionUrls);
          // 기존 데이터 마이그레이션: status 필드가 없으면 ACTIVE로 설정
          const migrated = parsed.map(session => ({
            ...session,
            status: session.status || 'ACTIVE',
          }));
          setSessionUrls(migrated);
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
            const parsed = JSON.parse(savedSessionUrls);
            const migrated = parsed.map(session => ({
              ...session,
              status: session.status || 'ACTIVE',
            }));
            setSessionUrls(migrated);
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
        }
      } catch (error) {
        console.error('Save realtime sync settings error:', error);
      }
    })();
  }, [realtimeSyncEnabled]);

  // 세션 URL 목록 저장
  useEffect(() => {
    if (sessionUrls.length > 0) {
      AsyncStorage.setItem('sessionUrls', JSON.stringify(sessionUrls));
    }
  }, [sessionUrls]);

  // 새 세션 URL 생성
  const handleGenerateSessionUrl = async () => {
    const newSessionId = generateSessionId();
    const newSessionUrl = {
      id: newSessionId,
      url: `${config.serverUrl}/${newSessionId}`,
      createdAt: Date.now(),
      status: 'ACTIVE',
      deletedAt: null,
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

  // Soft Delete - 세션을 삭제 상태로 변경
  const handleSoftDelete = async (sessionId) => {
    Alert.alert(
      t('settings.deleteSession'),
      t('settings.softDeleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            // 세션 상태를 DELETED로 변경
            setSessionUrls(prev => prev.map(session => {
              if (session.id === sessionId) {
                return {
                  ...session,
                  status: 'DELETED',
                  deletedAt: Date.now(),
                };
              }
              return session;
            }));

            // scanGroups에서 해당 그룹 비활성화 (삭제하지 않고 숨김)
            try {
              const groupsJson = await AsyncStorage.getItem('scanGroups');
              if (groupsJson) {
                const groups = JSON.parse(groupsJson);
                const updatedGroups = groups.map(g => {
                  if (g.id === sessionId) {
                    return { ...g, isDeleted: true };
                  }
                  return g;
                });
                await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
              }
            } catch (error) {
              console.error('Failed to soft delete cloud sync group:', error);
            }

            Alert.alert(t('settings.success'), t('settings.sessionMovedToTrash'));
          },
        },
      ]
    );
  };

  // 세션 복구
  const handleRestore = async (sessionId) => {
    // 세션 상태를 ACTIVE로 복원
    setSessionUrls(prev => prev.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          status: 'ACTIVE',
          deletedAt: null,
        };
      }
      return session;
    }));

    // scanGroups에서 해당 그룹 복원
    try {
      const groupsJson = await AsyncStorage.getItem('scanGroups');
      if (groupsJson) {
        const groups = JSON.parse(groupsJson);
        const updatedGroups = groups.map(g => {
          if (g.id === sessionId) {
            return { ...g, isDeleted: false };
          }
          return g;
        });
        await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
      }
    } catch (error) {
      console.error('Failed to restore cloud sync group:', error);
    }

    Alert.alert(t('settings.success'), t('settings.sessionRestored'));
  };

  // 영구 삭제
  const handlePermanentDelete = async (sessionId) => {
    Alert.alert(
      t('settings.permanentDelete'),
      t('settings.permanentDeleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.permanentDeleteButton'),
          style: 'destructive',
          onPress: async () => {
            // 세션 완전 삭제
            setSessionUrls(prev => prev.filter(s => s.id !== sessionId));

            // scanGroups, scanHistoryByGroup에서도 완전 삭제
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
              console.error('Failed to permanently delete session:', error);
            }

            Alert.alert(t('settings.success'), t('settings.sessionPermanentlyDeleted'));
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

  // 활성 세션 아이템 렌더링
  const renderActiveSessionItem = (session) => (
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
          onPress={() => handleSoftDelete(session.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // 삭제된 세션 아이템 렌더링
  const renderDeletedSessionItem = (session) => {
    const daysRemaining = getDaysRemaining(session.deletedAt);

    return (
      <View
        key={session.id}
        style={[
          styles.sessionItem,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
            opacity: 0.8,
          }
        ]}
      >
        <View style={styles.sessionItemContent}>
          <View style={styles.sessionItemHeader}>
            <Ionicons
              name="trash"
              size={18}
              color={colors.textTertiary}
            />
            <Text style={[styles.sessionUrl, { color: colors.textTertiary, flex: 1 }]} numberOfLines={1}>
              {session.url}
            </Text>
          </View>
          <View style={styles.deletedInfoRow}>
            <Text style={[styles.sessionGroupName, { color: colors.textTertiary }]}>
              세션 {session.id.substring(0, 4)}
            </Text>
            <Text style={[styles.daysRemaining, { color: colors.warning }]}>
              {t('settings.daysRemaining', { days: daysRemaining })}
            </Text>
          </View>
        </View>

        <View style={styles.sessionItemActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.success }]}
            onPress={() => handleRestore(session.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.error }]}
            onPress={() => handlePermanentDelete(session.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
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

                {/* 탭 컨트롤 */}
                <View style={[styles.tabContainer, { backgroundColor: colors.inputBackground }]}>
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      activeTab === 'active' && { backgroundColor: colors.surface },
                    ]}
                    onPress={() => setActiveTab('active')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.tabText,
                      { color: activeTab === 'active' ? colors.primary : colors.textTertiary }
                    ]}>
                      {t('settings.activeTab')} ({activeSessions.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      activeTab === 'deleted' && { backgroundColor: colors.surface },
                    ]}
                    onPress={() => setActiveTab('deleted')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.tabText,
                      { color: activeTab === 'deleted' ? colors.error : colors.textTertiary }
                    ]}>
                      {t('settings.deletedTab')} ({deletedSessions.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 세션 목록 */}
                {activeTab === 'active' ? (
                  // 활성 세션 목록
                  activeSessions.length > 0 ? (
                    <View style={styles.sessionListContainer}>
                      <Text style={[styles.sessionListTitle, { color: colors.text }]}>{t('settings.generatedUrls')}</Text>
                      {activeSessions.map(renderActiveSessionItem)}
                      <Text style={[styles.sessionInfo, { color: colors.textTertiary }]}>
                        {t('settings.sessionInfoNew')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="link-outline" size={48} color={colors.textTertiary} />
                      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                        {t('settings.noActiveSessions')}
                      </Text>
                    </View>
                  )
                ) : (
                  // 삭제된 세션 목록
                  deletedSessions.length > 0 ? (
                    <View style={styles.sessionListContainer}>
                      <Text style={[styles.sessionListTitle, { color: colors.text }]}>{t('settings.deletedSessions')}</Text>
                      {deletedSessions.map(renderDeletedSessionItem)}
                      <Text style={[styles.sessionInfo, { color: colors.textTertiary }]}>
                        {t('settings.deletedSessionsInfo')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="trash-outline" size={48} color={colors.textTertiary} />
                      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                        {t('settings.noDeletedSessions')}
                      </Text>
                    </View>
                  )
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
  tabContainer: {
    flexDirection: 'row',
    marginTop: 20,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionListContainer: {
    marginTop: 16,
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
  deletedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  daysRemaining: {
    fontSize: 12,
    fontWeight: '500',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
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
