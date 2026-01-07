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
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import websocketClient from '../utils/websocket';
import config from '../config/config';

// 암호학적으로 안전한 세션 ID 생성 함수 (16자리)
const generateSessionId = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(randomBytes[i] % chars.length);
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

// 서버에서 세션 목록 가져오기 (인증된 사용자의 세션만)
const fetchSessionsFromServer = async (token) => {
  try {
    const headers = {};
    let url = `${config.serverUrl}/api/sessions?status=ALL`;

    // 토큰이 있으면 내 세션만 조회
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      url += '&mine=true';
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn('Failed to fetch sessions from server:', response.status);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Error fetching sessions from server:', error);
    return null;
  }
};

export default function RealtimeSyncSettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { isLoggedIn, getToken } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [sessionUrls, setSessionUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // 로컬 세션들에 대한 그룹 생성 보장 함수
  const ensureGroupsForSessions = async (sessions) => {
    if (!sessions || sessions.length === 0) return;

    try {
      const groupsJson = await AsyncStorage.getItem('scanGroups');
      let groups = groupsJson ? JSON.parse(groupsJson) : [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }];
      const groupIds = new Set(groups.map(g => g.id));
      let hasNewGroups = false;

      // 기본 그룹이 없으면 추가
      if (!groups.find(g => g.id === 'default')) {
        groups.unshift({ id: 'default', name: '기본 그룹', createdAt: Date.now() });
        groupIds.add('default');
        hasNewGroups = true;
      }

      for (const session of sessions) {
        if (!groupIds.has(session.id)) {
          groups.push({
            id: session.id,
            name: session.name || `세션 ${session.id.substring(0, 4)}`,
            createdAt: session.createdAt || Date.now(),
            isCloudSync: true,
            isDeleted: session.status === 'DELETED',
          });
          groupIds.add(session.id);
          hasNewGroups = true;
        }
      }

      if (hasNewGroups) {
        await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));

        // scanHistoryByGroup에도 그룹 초기화
        const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
        const historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };
        for (const session of sessions) {
          if (!historyByGroup[session.id]) {
            historyByGroup[session.id] = [];
          }
        }
        await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
      }
    } catch (error) {
      console.error('ensureGroupsForSessions error:', error);
    }
  };

  // 서버에서 세션 목록을 가져와 로컬과 동기화하는 함수
  const syncSessionsFromServer = useCallback(async (localSessions) => {
    // 인증 토큰 가져오기
    const token = await getToken();
    const serverSessions = await fetchSessionsFromServer(token);
    if (!serverSessions || !Array.isArray(serverSessions)) {
      // 서버 연결 실패해도 로컬 세션에 대한 그룹은 생성
      await ensureGroupsForSessions(localSessions);
      return localSessions;
    }

    // 서버 세션 ID 목록 (DB 컬럼명 대소문자 호환)
    const serverSessionMap = new Map();
    serverSessions.forEach(session => {
      const sessionId = session.SESSION_ID || session.session_id || session.sessionId;
      const status = session.STATUS || session.status || 'ACTIVE';
      const deletedAt = session.DELETED_AT || session.deleted_at || session.deletedAt;
      const createdAt = session.CREATED_AT || session.created_at || session.createdAt;
      const sessionName = session.SESSION_NAME || session.session_name || session.name || null;

      serverSessionMap.set(sessionId, {
        id: sessionId,
        status: status,
        deletedAt: deletedAt,
        createdAt: createdAt,
        name: sessionName,
      });
    });

    // 로컬 세션 ID 목록
    const localSessionIds = new Set(localSessions.map(s => s.id));

    // 로컬 세션을 서버 상태와 동기화
    const updatedSessions = localSessions.map(session => {
      const serverData = serverSessionMap.get(session.id);
      if (serverData) {
        return {
          ...session,
          status: serverData.status,
          deletedAt: serverData.deletedAt ? new Date(serverData.deletedAt).getTime() : null,
          // 서버에 이름이 있으면 동기화, 없으면 기존 이름 유지
          name: serverData.name || session.name,
        };
      }
      return session;
    });

    // 서버에만 있는 세션을 로컬에 추가
    const newSessions = [];
    serverSessionMap.forEach((serverData, sessionId) => {
      if (!localSessionIds.has(sessionId)) {
        newSessions.push({
          id: sessionId,
          url: `${config.serverUrl}/session/${sessionId}`,
          createdAt: serverData.createdAt ? new Date(serverData.createdAt).getTime() : Date.now(),
          status: serverData.status,
          deletedAt: serverData.deletedAt ? new Date(serverData.deletedAt).getTime() : null,
          name: serverData.name,
        });
      }
    });

    // 새 세션을 추가하고 최신순 정렬
    const allSessions = [...updatedSessions, ...newSessions].sort((a, b) => b.createdAt - a.createdAt);

    // 업데이트된 세션 목록 저장
    if (allSessions.length > 0) {
      await AsyncStorage.setItem('sessionUrls', JSON.stringify(allSessions));
    }

    // scanGroups도 동기화 (삭제된 세션 그룹 isDeleted 업데이트 + 새 그룹 추가 + 이름 동기화)
    try {
      const groupsJson = await AsyncStorage.getItem('scanGroups');
      let groups = groupsJson ? JSON.parse(groupsJson) : [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }];
      const groupIds = new Set(groups.map(g => g.id));

      // 기존 그룹 상태 및 이름 업데이트
      groups = groups.map(g => {
        const serverData = serverSessionMap.get(g.id);
        if (serverData && g.isCloudSync) {
          return {
            ...g,
            isDeleted: serverData.status === 'DELETED',
            // 서버에 이름이 있으면 동기화
            name: serverData.name || g.name,
          };
        }
        return g;
      });

      // 기본 그룹이 없으면 추가
      if (!groups.find(g => g.id === 'default')) {
        groups.unshift({ id: 'default', name: '기본 그룹', createdAt: Date.now() });
        groupIds.add('default');
      }

      // 모든 세션에 대한 그룹 추가 (로컬 + 서버 모두)
      for (const session of allSessions) {
        if (!groupIds.has(session.id)) {
          groups.push({
            id: session.id,
            name: session.name || `세션 ${session.id.substring(0, 4)}`,
            createdAt: session.createdAt,
            isCloudSync: true,
            isDeleted: session.status === 'DELETED',
          });
          groupIds.add(session.id);
        }
      }

      await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));

      // scanHistoryByGroup에도 모든 세션 그룹 초기화
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      const historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };
      for (const session of allSessions) {
        if (!historyByGroup[session.id]) {
          historyByGroup[session.id] = [];
        }
      }
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
    } catch (error) {
      console.error('Failed to sync scanGroups:', error);
    }

    console.log(`서버 동기화 완료: 기존 ${localSessions.length}개, 새로 추가 ${newSessions.length}개`);
    return allSessions;
  }, [getToken]);

  // 초기 로드
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
        const isEnabled = realtimeSync === 'true';
        if (isEnabled) {
          setRealtimeSyncEnabled(true);
        }

        const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
        let localSessions = [];
        if (savedSessionUrls) {
          const parsed = JSON.parse(savedSessionUrls);
          // 기존 데이터 마이그레이션: status 필드가 없으면 ACTIVE로 설정
          localSessions = parsed.map(session => ({
            ...session,
            status: session.status || 'ACTIVE',
          }));
        }

        // 실시간 동기화가 활성화된 경우 서버에서 세션 목록 동기화
        if (isEnabled) {
          setIsSyncing(true);
          const synced = await syncSessionsFromServer(localSessions);
          setSessionUrls(synced);
          setIsSyncing(false);
        } else {
          setSessionUrls(localSessions);
        }
      } catch (error) {
        console.error('Load realtime sync settings error:', error);
        Alert.alert(t('settings.error'), t('settings.loadError') || '설정을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [syncSessionsFromServer, t]);

  // 화면 포커스 시 데이터 다시 로드 (서버 동기화 포함)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
          const isEnabled = realtimeSync === 'true';

          const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
          let localSessions = [];
          if (savedSessionUrls) {
            const parsed = JSON.parse(savedSessionUrls);
            localSessions = parsed.map(session => ({
              ...session,
              status: session.status || 'ACTIVE',
            }));
          }

          // 실시간 동기화가 활성화된 경우 서버에서 세션 목록 동기화 (삭제된 항목 포함)
          if (isEnabled) {
            const synced = await syncSessionsFromServer(localSessions);
            setSessionUrls(synced);
            console.log('포커스 복귀: 서버에서 세션 목록 동기화 완료 (삭제된 항목 포함)');
          } else {
            setSessionUrls(localSessions);
          }
        } catch (error) {
          console.error('Load session URLs error:', error);
        }
      })();
    }, [syncSessionsFromServer])
  );

  // 실시간 서버전송 설정 저장
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('realtimeSyncEnabled', realtimeSyncEnabled.toString());

        if (realtimeSyncEnabled) {
          // 실시간 서버 전송이 켜지면 스캔 연동 URL 끄기 (상호 배타적)
          await SecureStore.setItemAsync('scanLinkEnabled', 'false');
          // 토글 활성화 시 서버에서 세션 목록 동기화
          const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
          let localSessions = [];
          if (savedSessionUrls) {
            const parsed = JSON.parse(savedSessionUrls);
            localSessions = parsed.map(session => ({
              ...session,
              status: session.status || 'ACTIVE',
            }));
          }

          const synced = await syncSessionsFromServer(localSessions);
          setSessionUrls(synced);
          console.log('토글 활성화: 서버에서 세션 목록 동기화 완료');
        } else {
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
  }, [realtimeSyncEnabled, syncSessionsFromServer]);

  // 세션 URL 목록 저장
  useEffect(() => {
    if (sessionUrls.length > 0) {
      AsyncStorage.setItem('sessionUrls', JSON.stringify(sessionUrls));
    }
  }, [sessionUrls]);

  // 새 세션 URL 생성
  const handleGenerateSessionUrl = async () => {
    const newSessionId = await generateSessionId();
    const newSessionUrl = {
      id: newSessionId,
      url: `${config.serverUrl}/session/${newSessionId}`,
      createdAt: Date.now(),
      status: 'ACTIVE',
      deletedAt: null,
    };

    setSessionUrls(prev => [newSessionUrl, ...prev]);

    // 서버에 세션 생성 알림
    try {
      if (!websocketClient.getConnectionStatus()) {
        websocketClient.connect(config.serverUrl);
        // 연결 완료 대기 (최대 3초)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 3000);

          const checkConnection = setInterval(() => {
            if (websocketClient.getConnectionStatus()) {
              clearInterval(checkConnection);
              clearTimeout(timeout);
              resolve();
            }
          }, 100);
        });
      }
      await websocketClient.createSession(newSessionId);
      console.log('서버에 세션 생성 요청:', newSessionId);
    } catch (error) {
      console.warn('서버 세션 생성 실패 (로컬에서는 생성됨):', error.message);
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
            const deletedAt = Date.now();

            // 서버 API 호출 (Soft Delete)
            try {
              const response = await fetch(`${config.serverUrl}/api/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                console.warn('Server soft delete failed:', response.status);
              } else {
                console.log('Server soft delete success:', sessionId);
              }
            } catch (error) {
              console.warn('Server soft delete error (continuing locally):', error);
            }

            // 로컬 상태 업데이트 (서버 실패해도 진행)
            setSessionUrls(prev => prev.map(session => {
              if (session.id === sessionId) {
                return {
                  ...session,
                  status: 'DELETED',
                  deletedAt,
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
    // 서버 API 호출 (Restore)
    try {
      const response = await fetch(`${config.serverUrl}/api/sessions/${sessionId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Server restore failed:', response.status);
      } else {
        console.log('Server restore success:', sessionId);
      }
    } catch (error) {
      console.warn('Server restore error (continuing locally):', error);
    }

    // 로컬 상태 업데이트 (서버 실패해도 진행)
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
            // 서버 API 호출 (Permanent Delete)
            try {
              const response = await fetch(`${config.serverUrl}/api/sessions/${sessionId}/permanent`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                console.warn('Server permanent delete failed:', response.status);
              } else {
                console.log('Server permanent delete success:', sessionId);
              }
            } catch (error) {
              console.warn('Server permanent delete error (continuing locally):', error);
            }

            // 로컬 상태 업데이트 (서버 실패해도 진행)
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

  // 세션 URL 동적 생성 (항상 최신 서버 주소 사용)
  const getSessionUrl = useCallback((sessionId) => {
    return `${config.serverUrl}/session/${sessionId}`;
  }, []);

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
            {getSessionUrl(session.id)}
          </Text>
        </View>
        <Text style={[styles.sessionGroupName, { color: colors.textSecondary }]}>
          {session.name || session.id}
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
          onPress={() => handleCopyUrl(getSessionUrl(session.id))}
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
              {getSessionUrl(session.id)}
            </Text>
          </View>
          <View style={styles.deletedInfoRow}>
            <Text style={[styles.sessionGroupName, { color: colors.textTertiary }]}>
              {session.name || session.id}
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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.realtimeSync')}</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* 동기화 중 인디케이터 */}
          {isSyncing && (
            <View style={[styles.syncingBanner, { backgroundColor: colors.primary + '20' }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.syncingText, { color: colors.primary }]}>
                {t('settings.syncing') || '서버와 동기화 중...'}
              </Text>
            </View>
          )}

          {/* 토글 설정 */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{t('settings.enableRealtimeSync')}</Text>
                <Text style={[styles.desc, { color: colors.textTertiary }]}>{t('settings.realtimeSyncDesc')}</Text>
              </View>
              <Switch
                value={realtimeSyncEnabled}
                onValueChange={(value) => {
                  // 켜려고 할 때만 로그인 체크
                  if (value && !isLoggedIn) {
                    // 로그인되지 않은 경우 로그인 화면으로 이동
                    router.push('/login');
                    return;
                  }
                  setRealtimeSyncEnabled(value);
                }}
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

          {/* 구독 플랜 안내 - 임시 주석 처리
          <View style={[styles.section, { backgroundColor: colors.surface, marginTop: 16 }]}>
            <View style={styles.planHeader}>
              <Ionicons name="diamond-outline" size={24} color={colors.primary} />
              <Text style={[styles.planTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                {t('settings.subscriptionPlans')}
              </Text>
            </View>
            <Text style={[styles.planDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('settings.subscriptionPlansDesc')}
            </Text>

            <View style={[styles.freePlanBox, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="gift-outline" size={20} color={colors.success} />
              <Text style={[styles.freePlanText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('settings.freePlanNotice')}
              </Text>
            </View>

            <View style={styles.planTableContainer}>
              <View style={[styles.planTableRow, styles.planTableHeader, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.planTableCell, styles.planTableLabelCell]}>
                  <Text style={[styles.planTableHeaderText, { color: colors.textTertiary, fontFamily: fonts.medium }]}>
                    {' '}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableHeaderText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('settings.planFree')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableHeaderText, { color: colors.primary, fontFamily: fonts.semiBold }]}>
                    {t('settings.planPro')}
                  </Text>
                </View>
              </View>

              <View style={[styles.planTableRow, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.planTableCell, styles.planTableLabelCell]}>
                  <Text style={[styles.planTableLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('settings.planFeatureSessions')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableValue, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.planFreeSessionLimit')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableValue, { color: colors.primary, fontFamily: fonts.semiBold }]}>
                    {t('settings.planProSessionLimit')}
                  </Text>
                </View>
              </View>

              <View style={[styles.planTableRow, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.planTableCell, styles.planTableLabelCell]}>
                  <Text style={[styles.planTableLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('settings.planFeatureTransmissions')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableValue, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.planFreeTransmitLimit')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableValue, { color: colors.primary, fontFamily: fonts.semiBold }]}>
                    {t('settings.planProTransmitLimit')}
                  </Text>
                </View>
              </View>

              <View style={[styles.planTableRow, { borderBottomColor: colors.borderLight }]}>
                <View style={[styles.planTableCell, styles.planTableLabelCell]}>
                  <Text style={[styles.planTableLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('settings.planFeatureRetention')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableValue, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.planFreeRetentionLimit')}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <Text style={[styles.planTableValue, { color: colors.primary, fontFamily: fonts.semiBold }]}>
                    {t('settings.planProRetentionLimit')}
                  </Text>
                </View>
              </View>

              <View style={[styles.planTableRow, styles.planTableFooter]}>
                <View style={[styles.planTableCell, styles.planTableLabelCell]}>
                  <Text style={[styles.planTableLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {' '}
                  </Text>
                </View>
                <View style={styles.planTableCell}>
                  <View style={[styles.priceTag, { backgroundColor: colors.textTertiary + '20' }]}>
                    <Text style={[styles.priceText, { color: colors.textSecondary, fontFamily: fonts.bold }]}>
                      {t('settings.planPriceFree')}
                    </Text>
                  </View>
                </View>
                <View style={styles.planTableCell}>
                  <TouchableOpacity
                    style={[styles.priceTag, { backgroundColor: colors.primary }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.priceText, { color: '#fff', fontFamily: fonts.bold }]}>
                      {t('settings.upgradeToPro')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          */}
        </ScrollView>
      </TouchableWithoutFeedback>
      )}

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
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 10,
    gap: 8,
  },
  syncingText: {
    fontSize: 14,
    fontWeight: '500',
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
  // 구독 플랜 스타일
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  planDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  freePlanBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  freePlanText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  planTableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  planTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  planTableHeader: {
    paddingVertical: 12,
  },
  planTableFooter: {
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  planTableCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  planTableLabelCell: {
    flex: 1.2,
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  planTableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  planTableLabel: {
    fontSize: 13,
  },
  planTableValue: {
    fontSize: 13,
    textAlign: 'center',
  },
  priceTag: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
