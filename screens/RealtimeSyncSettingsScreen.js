// screens/RealtimeSyncSettingsScreen.js - 실시간 서버전송 설정 화면
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { RADIUS, SPACE, SIZE, TYPE, MONO } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
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
const fetchSessionsFromServer = async (token, status = 'ALL') => {
  try {
    const headers = {};
    let url = `${config.serverUrl}/api/sessions?status=${status}`;

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
  const insets = useSafeAreaInsets();
  const { isLoggedIn, getToken, user, refreshAccessToken } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [sessionUrls, setSessionUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // 탭 상태: 'active' | 'deleted'
  const [activeTab, setActiveTab] = useState('active');

  // 보안 설정 모달 상태 (비밀번호 + 공개/비공개)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedSessionName, setSelectedSessionName] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedIsPublic, setSelectedIsPublic] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // 세션 생성 모달 상태
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionPassword, setNewSessionPassword] = useState('');
  const [newSessionIsPublic, setNewSessionIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null); // 입력칸 포커스 테두리 표시용

  // 활성/삭제된 세션 필터링
  const activeSessions = useMemo(() =>
    sessionUrls.filter(s => s.status !== 'DELETED'),
    [sessionUrls]
  );

  const deletedSessions = useMemo(() =>
    sessionUrls.filter(s => s.status === 'DELETED'),
    [sessionUrls]
  );

  // 삭제된 탭 클릭 시 서버에서 삭제된 세션 실시간 동기화
  const handleDeletedTabClick = useCallback(async () => {
    setActiveTab('deleted');

    if (!isLoggedIn) return;

    try {
      setIsSyncing(true);
      const token = await getToken();

      // 서버에서 삭제된 세션만 가져오기
      const deletedFromServer = await fetchSessionsFromServer(token, 'DELETED');

      if (deletedFromServer && Array.isArray(deletedFromServer)) {
        // 현재 활성 세션 유지하고, 삭제된 세션만 업데이트
        setSessionUrls(prev => {
          const activeOnes = prev.filter(s => s.status !== 'DELETED');

          // 서버에서 가져온 삭제된 세션 변환
          const newDeletedSessions = deletedFromServer.map(session => {
            const sessionId = session.SESSION_ID || session.session_id || session.sessionId;
            const deletedAt = session.DELETED_AT || session.deleted_at || session.deletedAt;
            const createdAt = session.CREATED_AT || session.created_at || session.createdAt;
            const sessionName = session.SESSION_NAME || session.session_name || session.name || null;

            return {
              id: sessionId,
              url: `${config.serverUrl}/session/${sessionId}`,
              createdAt: createdAt ? new Date(createdAt).getTime() : Date.now(),
              status: 'DELETED',
              deletedAt: deletedAt ? new Date(deletedAt).getTime() : null,
              name: sessionName,
            };
          });

          // 활성 + 새로 동기화된 삭제된 세션
          const allSessions = [...activeOnes, ...newDeletedSessions].sort((a, b) => b.createdAt - a.createdAt);

          // 로컬 저장소 업데이트
          AsyncStorage.setItem('sessionUrls', JSON.stringify(allSessions));

          return allSessions;
        });

        console.log(`삭제된 세션 동기화 완료: ${deletedFromServer.length}개`);
      }
    } catch (error) {
      console.error('삭제된 세션 동기화 실패:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isLoggedIn, getToken]);

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
            name: session.name || t('settings.defaultSessionName', { id: session.id.substring(0, 4) }),
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
            name: session.name || t('settings.defaultSessionName', { id: session.id.substring(0, 4) }),
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

    // 로그인한 사용자의 경우, 기존 세션들에 대해 소유권(user_id) 업데이트
    if (user?.id && allSessions.length > 0) {
      try {
        // WebSocket 연결 및 사용자 ID 설정
        websocketClient.setUserId(user.id);
        if (token) {
          websocketClient.setAuthToken(token);
        }

        if (!websocketClient.getConnectionStatus()) {
          websocketClient.connect(config.serverUrl);
          // 연결 대기 (최대 3초)
          await new Promise((resolve) => {
            const checkConnection = setInterval(() => {
              if (websocketClient.getConnectionStatus()) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
            setTimeout(() => {
              clearInterval(checkConnection);
              resolve();
            }, 3000);
          });
        }

        // 활성 세션들에 대해 join-session 이벤트 발송 (user_id 업데이트)
        if (websocketClient.getConnectionStatus()) {
          const activeSessions = allSessions.filter(s => s.status !== 'DELETED');
          for (const session of activeSessions) {
            try {
              await websocketClient.joinSession(session.id);
              console.log(`세션 소유권 업데이트: ${session.id}`);
            } catch (err) {
              console.warn(`세션 ${session.id} 소유권 업데이트 실패:`, err.message);
            }
          }
          console.log(`${activeSessions.length}개 세션 소유권 업데이트 완료`);
        }
      } catch (error) {
        console.warn('세션 소유권 업데이트 중 오류:', error.message);
      }
    }

    return allSessions;
  }, [getToken, user]);

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
          // 다른 고급 스캔 기능 비활성화 (상호 배타적)
          await AsyncStorage.setItem('continuousScanEnabled', 'false');
          await AsyncStorage.setItem('batchScanEnabled', 'false');
          await AsyncStorage.setItem('multiCodeModeEnabled', 'false');
          await SecureStore.setItemAsync('scanLinkEnabled', 'false');
          await AsyncStorage.setItem('lotteryScanEnabled', 'false');
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

  // 세션 생성 모달 열기
  const handleOpenCreateModal = () => {
    setNewSessionName('');
    setNewSessionPassword('');
    setNewSessionIsPublic(true);
    setCreateModalVisible(true);
  };

  // 새 세션 URL 생성 (설정 포함)
  const handleGenerateSessionUrl = async () => {
    setIsCreating(true);

    try {
      const newSessionId = await generateSessionId();
      const token = await getToken();

      // 세션 이름 (입력하지 않으면 세션 ID 앞 4자리로 기본 이름 생성)
      const sessionName = newSessionName.trim() || t('settings.defaultSessionName', { id: newSessionId.substring(0, 4) });

      // 세션 설정
      const sessionSettings = {
        sessionName: sessionName,
        password: newSessionPassword || null,
        isPublic: newSessionIsPublic,
      };

      const newSessionUrl = {
        id: newSessionId,
        url: `${config.serverUrl}/session/${newSessionId}`,
        createdAt: Date.now(),
        status: 'ACTIVE',
        deletedAt: null,
        name: sessionName,
        isPublic: newSessionIsPublic,
        hasPassword: !!newSessionPassword,
      };

      // 비밀번호는 SecureStore에 별도 저장
      if (newSessionPassword) {
        await SecureStore.setItemAsync(`session_pw_${newSessionId}`, newSessionPassword);
      }

      setSessionUrls(prev => [newSessionUrl, ...prev]);

      // 서버에 세션 생성 알림 (설정 포함)
      try {
        // 인증 토큰 및 사용자 ID 설정
        if (token) {
          websocketClient.setAuthToken(token);
        }
        if (user?.id) {
          websocketClient.setUserId(user.id);
        }

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
        await websocketClient.createSession(newSessionId, sessionSettings);
        console.log('서버에 세션 생성 요청:', newSessionId, '설정:', sessionSettings);
      } catch (error) {
        console.warn('서버 세션 생성 실패 (로컬에서는 생성됨):', error.message);
      }

      // 자동으로 scanGroups에 클라우드 동기화 그룹 추가
      try {
        const groupsData = await AsyncStorage.getItem('scanGroups');
        const groups = groupsData ? JSON.parse(groupsData) : [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }];

        const newGroup = {
          id: newSessionId,
          name: sessionName,
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

      setCreateModalVisible(false);
      setNewSessionName('');
      setNewSessionPassword('');
      setNewSessionIsPublic(true);
      setShowNewPassword(false);
      Alert.alert(t('settings.success'), t('settings.sessionCreated'));
    } catch (error) {
      console.error('세션 생성 실패:', error);
      Alert.alert(t('settings.error'), t('settings.sessionCreateFailed') || '세션 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
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
            const token = await getToken();

            // 서버 API 호출 (Soft Delete)
            try {
              const response = await fetch(`${config.serverUrl}/api/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token && { 'Authorization': `Bearer ${token}` }),
                },
              });

              if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                  Alert.alert(t('settings.error'), t('settings.sessionDeleteFailed') || '세션 삭제 권한이 없습니다.');
                  return;
                }
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
    const token = await getToken();

    // 서버 API 호출 (Restore)
    try {
      const response = await fetch(`${config.serverUrl}/api/sessions/${sessionId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          Alert.alert(t('settings.error'), t('settings.sessionRestoreFailed') || '세션 복구 권한이 없습니다.');
          return;
        }
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
            const token = await getToken();

            // 서버 API 호출 (Permanent Delete)
            try {
              const response = await fetch(`${config.serverUrl}/api/sessions/${sessionId}/permanent`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token && { 'Authorization': `Bearer ${token}` }),
                },
              });

              if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                  Alert.alert(t('settings.error'), t('settings.sessionPermanentDeleteFailed') || '세션 영구 삭제 권한이 없습니다.');
                  return;
                }
                console.warn('Server permanent delete failed:', response.status);
              } else {
                console.log('Server permanent delete success:', sessionId);
              }
            } catch (error) {
              console.warn('Server permanent delete error (continuing locally):', error);
            }

            // 로컬 상태 업데이트 (서버 실패해도 진행)
            const updatedUrls = sessionUrls.filter(s => s.id !== sessionId);
            setSessionUrls(updatedUrls);
            await AsyncStorage.setItem('sessionUrls', JSON.stringify(updatedUrls));

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

  // 세션 설정 모달 열기 (이름 + 비밀번호 + 공개/비공개 토글)
  const handleOpenSecurityModal = async (sessionId) => {
    setSelectedSessionId(sessionId);
    const session = sessionUrls.find(s => s.id === sessionId);
    setSelectedSessionName(session?.name || '');
    // 비밀번호는 세션 객체가 아니라 SecureStore에 있다. 빈칸으로 열면 저장 시 null이 서버로 가서 비밀번호가 풀린다
    let savedPassword = '';
    try {
      savedPassword = (await SecureStore.getItemAsync(`session_pw_${sessionId}`)) || '';
    } catch (error) {
      console.error('세션 비밀번호 불러오기 실패:', error);
    }
    setPasswordInput(savedPassword);
    setSelectedIsPublic(session?.isPublic !== false);
    setPasswordModalVisible(true);
  };

  // 세션 설정 저장 (이름 + 비밀번호 + 공개/비공개, 서버 API 연동)
  const handleSaveSecuritySettings = async () => {
    const sessionName = selectedSessionName.trim() || t('settings.defaultSessionName', { id: selectedSessionId.substring(0, 4) });
    console.log('🔐 handleSaveSecuritySettings 시작:', { selectedSessionId, sessionName, selectedIsPublic, hasPassword: !!passwordInput.trim() });
    try {
      // 토큰 갱신 먼저 시도
      let token = await getToken();

      if (!token) {
        console.log('⚠️ 토큰 없음 - 로그인 필요');
        Alert.alert(
          t('common.error') || '오류',
          t('settings.loginRequiredForSettings') || '설정을 변경하려면 로그인이 필요합니다.',
          [{ text: t('common.confirm') || '확인' }]
        );
        setPasswordModalVisible(false);
        return;
      }

      console.log('🔄 토큰 갱신 시도...');
      const refreshResult = await refreshAccessToken();

      if (refreshResult.success) {
        token = await getToken();
        console.log('✅ 토큰 갱신 성공');
      } else {
        console.error('❌ 토큰 갱신 실패:', refreshResult.error);
        // 갱신 실패해도 기존 토큰으로 시도
      }
      console.log('🔑 최종 토큰:', { hasToken: !!token });

      // 서버에 세션 설정 업데이트 요청
      try {
        if (token) {
          websocketClient.setAuthToken(token);
        }
        websocketClient.serverUrl = config.serverUrl;
        console.log('🌐 serverUrl 설정:', config.serverUrl);

        const result = await websocketClient.updateSessionSettings(selectedSessionId, {
          sessionName: sessionName,
          password: passwordInput.trim() || null,
          isPublic: selectedIsPublic,
        });
        console.log('✅ 서버에 세션 설정 저장 성공:', selectedSessionId, result);
      } catch (error) {
        console.error('❌ 서버 세션 설정 저장 실패:', error.message, error);
      }

      // 로컬 상태 업데이트
      const updatedUrls = sessionUrls.map(session => {
        if (session.id === selectedSessionId) {
          return {
            ...session,
            name: sessionName,
            hasPassword: !!passwordInput.trim(),
            isPublic: selectedIsPublic,
          };
        }
        return session;
      });

      // 비밀번호는 SecureStore에 별도 저장
      if (passwordInput.trim()) {
        await SecureStore.setItemAsync(`session_pw_${selectedSessionId}`, passwordInput.trim());
      } else {
        await SecureStore.deleteItemAsync(`session_pw_${selectedSessionId}`);
      }

      setSessionUrls(updatedUrls);
      await AsyncStorage.setItem('sessionUrls', JSON.stringify(updatedUrls));

      // scanGroups에서도 이름 업데이트
      try {
        const groupsJson = await AsyncStorage.getItem('scanGroups');
        if (groupsJson) {
          const groups = JSON.parse(groupsJson);
          const updatedGroups = groups.map(g => {
            if (g.id === selectedSessionId) {
              return { ...g, name: sessionName };
            }
            return g;
          });
          await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));
        }
      } catch (error) {
        console.error('scanGroups 이름 업데이트 실패:', error);
      }

      Alert.alert(t('settings.success'), t('settings.sessionSettingsSaved') || '세션 설정이 저장되었습니다.');
      setPasswordModalVisible(false);
      setSelectedSessionName('');
      setPasswordInput('');
      setSelectedSessionId('');
      setShowPassword(false);
    } catch (error) {
      console.error('세션 설정 저장 실패:', error);
      Alert.alert(t('settings.error'), t('settings.sessionSettingsSaveFailed') || '세션 설정 저장에 실패했습니다.');
    }
  };

  // 공개여부 토글 (서버 API 연동)
  const handleTogglePublic = async (sessionId, currentIsPublic) => {
    try {
      const token = await getToken();
      const newIsPublic = !currentIsPublic;

      // 서버에 공개여부 업데이트 요청
      try {
        if (token) {
          websocketClient.setAuthToken(token);
        }
        websocketClient.serverUrl = config.serverUrl;

        await websocketClient.updateSessionSettings(sessionId, {
          isPublic: newIsPublic,
        });
        console.log('서버에 공개여부 변경 성공:', sessionId, '->', newIsPublic);
      } catch (error) {
        console.warn('서버 공개여부 변경 실패 (로컬에서는 변경됨):', error.message);
      }

      // 로컬 상태 업데이트
      const updatedUrls = sessionUrls.map(session => {
        if (session.id === sessionId) {
          return { ...session, isPublic: newIsPublic };
        }
        return session;
      });

      setSessionUrls(updatedUrls);
      await AsyncStorage.setItem('sessionUrls', JSON.stringify(updatedUrls));
    } catch (error) {
      console.error('공개여부 변경 실패:', error);
      Alert.alert(t('settings.error'), t('settings.togglePublicFailed') || '공개여부 변경에 실패했습니다.');
    }
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

  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: isDark ? '#343A44' : colors.border },
    thumbColor: '#fff',
    ios_backgroundColor: isDark ? '#343A44' : colors.border,
  };

  // 입력칸 테두리: 포커스되면 강조색
  const inputBorder = (field) => ({ borderColor: focusedInput === field ? colors.primary : colors.border });
  const inputFocusProps = (field) => ({
    onFocus: () => setFocusedInput(field),
    onBlur: () => setFocusedInput(null),
  });

  // 활성 세션 아이템 렌더링
  const renderActiveSessionItem = (session, index) => (
    <View
      key={session.id}
      style={[styles.sessionItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}
    >
      <View style={styles.sessionItemHeader}>
        <Ionicons name="link" size={16} color={colors.primaryText} />
        <Text style={[styles.sessionUrl, { color: colors.primaryText }]} numberOfLines={1}>
          {getSessionUrl(session.id)}
        </Text>
      </View>
      <View style={styles.sessionStatusRow}>
        <Text style={[styles.sessionGroupName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
          {session.name || session.id}
        </Text>
        <View style={styles.sessionBadges}>
          {session.hasPassword && (
            <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="lock-closed" size={11} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success, fontFamily: fonts.semiBold }]}>
                {t('settings.passwordProtected') || '비밀번호'}
              </Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: session.isPublic !== false ? colors.primarySoft : colors.errorSoft }]}>
            <Ionicons
              name={session.isPublic !== false ? "globe-outline" : "lock-closed-outline"}
              size={11}
              color={session.isPublic !== false ? colors.primaryText : colors.error}
            />
            <Text style={[styles.badgeText, { color: session.isPublic !== false ? colors.primaryText : colors.error, fontFamily: fonts.semiBold }]}>
              {session.isPublic !== false ? (t('settings.public') || '공개') : (t('settings.private') || '비공개')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sessionItemActions}>
        <MaterialPressable
          style={[styles.iconButton, styles.iconButtonSecondary, { backgroundColor: colors.raised, borderColor: colors.border }]}
          onPress={() => handleOpenSecurityModal(session.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.edit')}
        >
          <Ionicons name="create-outline" size={18} color={colors.text} />
        </MaterialPressable>
        <MaterialPressable
          style={[styles.iconButton, styles.iconButtonSecondary, { backgroundColor: colors.raised, borderColor: colors.border }]}
          onPress={() => handleCopyUrl(getSessionUrl(session.id))}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.copy')}
        >
          <Ionicons name="copy-outline" size={18} color={colors.text} />
        </MaterialPressable>
        <MaterialPressable
          style={[styles.iconButton, { backgroundColor: colors.errorSoft }]}
          onPress={() => handleSoftDelete(session.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </MaterialPressable>
      </View>
    </View>
  );

  // 삭제된 세션 아이템 렌더링
  const renderDeletedSessionItem = (session, index) => {
    const daysRemaining = getDaysRemaining(session.deletedAt);

    return (
      <View
        key={session.id}
        style={[styles.sessionItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}
      >
        <View style={styles.sessionItemHeader}>
          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
          <Text style={[styles.sessionUrl, { color: colors.textTertiary }]} numberOfLines={1}>
            {getSessionUrl(session.id)}
          </Text>
        </View>
        <View style={styles.sessionStatusRow}>
          <Text style={[styles.sessionGroupName, { color: colors.textSecondary, fontFamily: fonts.medium }]} numberOfLines={1}>
            {session.name || session.id}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}>
            <Text style={[styles.badgeText, { color: colors.warning, fontFamily: fonts.semiBold }]}>
              {t('settings.daysRemaining', { days: daysRemaining })}
            </Text>
          </View>
        </View>

        <View style={styles.sessionItemActions}>
          <MaterialPressable
            style={[styles.iconButton, { backgroundColor: colors.successSoft }]}
            onPress={() => handleRestore(session.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={18} color={colors.success} />
          </MaterialPressable>
          <MaterialPressable
            style={[styles.iconButton, { backgroundColor: colors.errorSoft }]}
            onPress={() => handlePermanentDelete(session.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('settings.permanentDelete')}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.error} />
          </MaterialPressable>
        </View>
      </View>
    );
  };

  const createDisabled = isCreating || (!newSessionIsPublic && !newSessionPassword);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 하위 화면 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>{t('settings.realtimeSync')}</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          {/* 동기화 중 인디케이터 */}
          {isSyncing && (
            <View style={[styles.syncingBanner, { backgroundColor: colors.raised }]}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.syncingText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('settings.syncing') || '서버와 동기화 중...'}
              </Text>
            </View>
          )}

          {/* 토글 설정 */}
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>{t('settings.enableRealtimeSync')}</Text>
                <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('settings.realtimeSyncDesc')}</Text>
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
                {...switchColors}
                accessibilityLabel={t('settings.enableRealtimeSync')}
              />
            </View>
          </View>

          {realtimeSyncEnabled && (
            <>
              {/* 주소 생성 버튼 */}
              <MaterialPressable
                style={[styles.generateButton, { backgroundColor: colors.primary }]}
                onPress={handleOpenCreateModal}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={[styles.generateButtonText, { fontFamily: fonts.semiBold }]}>{t('settings.generateSessionUrl')}</Text>
              </MaterialPressable>

              {/* 탭 컨트롤 */}
              <View style={[styles.tabContainer, { backgroundColor: colors.raised }]}>
                <MaterialPressable
                  style={[
                    styles.tab,
                    activeTab === 'active' && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setActiveTab('active')}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'active' }}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'active' ? '#FFFFFF' : colors.text, fontFamily: fonts.semiBold }
                  ]}>
                    {t('settings.activeTab')} ({activeSessions.length})
                  </Text>
                </MaterialPressable>
                <MaterialPressable
                  style={[
                    styles.tab,
                    activeTab === 'deleted' && { backgroundColor: colors.primary },
                  ]}
                  onPress={handleDeletedTabClick}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'deleted' }}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'deleted' ? '#FFFFFF' : colors.text, fontFamily: fonts.semiBold }
                  ]}>
                    {t('settings.deletedTab')} ({deletedSessions.length})
                  </Text>
                </MaterialPressable>
              </View>

              {/* 세션 목록 */}
              {activeTab === 'active' ? (
                // 활성 세션 목록
                activeSessions.length > 0 ? (
                  <>
                    <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('settings.generatedUrls')}</Text>
                    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {activeSessions.map(renderActiveSessionItem)}
                    </View>
                    <Text style={[styles.sessionInfo, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t('settings.sessionInfoNew')}
                    </Text>
                  </>
                ) : (
                  <View style={[styles.group, styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="link-outline" size={40} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t('settings.noActiveSessions')}
                    </Text>
                  </View>
                )
              ) : (
                // 삭제된 세션 목록
                deletedSessions.length > 0 ? (
                  <>
                    <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('settings.deletedSessions')}</Text>
                    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {deletedSessions.map(renderDeletedSessionItem)}
                    </View>
                    <Text style={[styles.sessionInfo, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t('settings.deletedSessionsInfo')}
                    </Text>
                  </>
                ) : (
                  <View style={[styles.group, styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="trash-outline" size={40} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t('settings.noDeletedSessions')}
                    </Text>
                  </View>
                )
              )}
            </>
          )}

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
                  <MaterialPressable
                    style={[styles.priceTag, { backgroundColor: colors.primary }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.priceText, { color: '#fff', fontFamily: fonts.bold }]}>
                      {t('settings.upgradeToPro')}
                    </Text>
                  </MaterialPressable>
                </View>
              </View>
            </View>
          </View>
          */}
        </ScrollView>
      </TouchableWithoutFeedback>
      )}

      {/* 세션 설정 모달 (이름 + 비밀번호 + 공개/비공개) */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPasswordModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeader}>
                  <Ionicons name="create-outline" size={20} color={colors.primaryText} />
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('settings.editSession') || '세션 설정'}
                  </Text>
                </View>

                <Text style={[styles.modalDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('settings.editSessionDesc') || '세션의 이름과 보안 설정을 관리합니다.'}
                </Text>

                {/* 세션 이름 입력 */}
                <View style={styles.sessionNameSection}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('settings.sessionName') || '세션 이름'}
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }, inputBorder('editName')]}>
                    <TextInput
                      style={[styles.inputField, { color: colors.text, fontFamily: fonts.regular }]}
                      value={selectedSessionName}
                      onChangeText={setSelectedSessionName}
                      placeholder={t('settings.sessionNamePlaceholder') || '세션 이름 입력'}
                      placeholderTextColor={colors.textTertiary}
                      maxLength={50}
                      {...inputFocusProps('editName')}
                    />
                  </View>
                </View>

                {/* 공개/비공개 토글 */}
                <View style={[styles.optionRow, { borderTopColor: colors.borderLight }]}>
                  <Ionicons
                    name={selectedIsPublic ? "globe-outline" : "lock-closed-outline"}
                    size={20}
                    color={colors.textSecondary}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                      {selectedIsPublic ? (t('settings.public') || '공개') : (t('settings.private') || '비공개')}
                    </Text>
                    <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {selectedIsPublic
                        ? (t('settings.publicDesc') || '누구나 링크로 접근 가능')
                        : (t('settings.privateDesc') || '링크로 접근 불가')}
                    </Text>
                  </View>
                  <Switch
                    value={selectedIsPublic}
                    onValueChange={setSelectedIsPublic}
                    {...switchColors}
                  />
                </View>

                {/* 비밀번호 설정 */}
                <View style={[styles.optionRow, { borderTopColor: colors.borderLight }]}>
                  <Ionicons
                    name={passwordInput.trim() ? "key" : "key-outline"}
                    size={20}
                    color={passwordInput.trim() ? colors.success : colors.textSecondary}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                      {t('settings.password') || '비밀번호'}
                    </Text>
                    <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t('settings.passwordDescShort') || '접근 시 비밀번호 필요'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.inputContainer, styles.passwordInputSpacing, { backgroundColor: colors.inputBackground }, inputBorder('editPassword')]}>
                  <TextInput
                    style={[styles.inputField, { color: colors.text, fontFamily: fonts.regular }]}
                    value={passwordInput}
                    onChangeText={setPasswordInput}
                    placeholder={t('settings.passwordPlaceholder') || '비밀번호 입력 (비워두면 해제)'}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    {...inputFocusProps('editPassword')}
                  />
                  <MaterialPressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </MaterialPressable>
                </View>

                <View style={styles.modalButtons}>
                  <MaterialPressable
                    style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
                    onPress={() => {
                      setPasswordModalVisible(false);
                      setSelectedSessionName('');
                      setPasswordInput('');
                      setSelectedSessionId('');
                      setShowPassword(false);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {t('common.cancel')}
                    </Text>
                  </MaterialPressable>

                  <MaterialPressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleSaveSecuritySettings}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalButtonText, { color: '#FFFFFF', fontFamily: fonts.semiBold }]}>
                      {t('common.save')}
                    </Text>
                  </MaterialPressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 세션 생성 모달 */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCreateModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeader}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primaryText} />
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('settings.createSession') || '새 세션 생성'}
                  </Text>
                </View>

                <Text style={[styles.modalDescription, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('settings.createSessionDescription') || '세션의 이름, 공개 여부와 비밀번호를 설정하세요.'}
                </Text>

                {/* 세션 이름 입력 */}
                <View style={styles.sessionNameSection}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('settings.sessionName') || '세션 이름'}
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }, inputBorder('newName')]}>
                    <TextInput
                      style={[styles.inputField, { color: colors.text, fontFamily: fonts.regular }]}
                      value={newSessionName}
                      onChangeText={setNewSessionName}
                      placeholder={t('settings.sessionNamePlaceholder') || '세션 이름 입력 (선택사항)'}
                      placeholderTextColor={colors.textTertiary}
                      maxLength={50}
                      {...inputFocusProps('newName')}
                    />
                  </View>
                  <Text style={[styles.inputHint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.sessionNameHint') || '비워두면 자동으로 이름이 생성됩니다.'}
                  </Text>
                </View>

                {/* 공개여부 설정 */}
                <View style={[styles.optionRow, styles.optionRowSpaced, { borderTopColor: colors.borderLight, borderBottomColor: colors.borderLight }]}>
                  <Ionicons
                    name={newSessionIsPublic ? "globe-outline" : "lock-closed-outline"}
                    size={20}
                    color={colors.textSecondary}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                      {t('settings.publicSession') || '공개 세션'}
                    </Text>
                    <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {newSessionIsPublic
                        ? (t('settings.publicSessionDesc') || '누구나 세션에 참여할 수 있습니다')
                        : (t('settings.privateSessionDesc') || '비밀번호가 필요합니다')}
                    </Text>
                  </View>
                  <Switch
                    value={newSessionIsPublic}
                    onValueChange={setNewSessionIsPublic}
                    {...switchColors}
                  />
                </View>

                {/* 비밀번호 설정 */}
                <View style={styles.passwordSection}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('settings.sessionPassword') || '세션 비밀번호'} {!newSessionIsPublic && <Text style={{ color: colors.error }}>*</Text>}
                  </Text>
                  <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }, inputBorder('newPassword')]}>
                    <TextInput
                      style={[styles.inputField, { color: colors.text, fontFamily: fonts.regular }]}
                      value={newSessionPassword}
                      onChangeText={setNewSessionPassword}
                      placeholder={t('settings.passwordPlaceholder') || '비밀번호 입력 (선택사항)'}
                      placeholderTextColor={colors.textTertiary}
                      secureTextEntry={!showNewPassword}
                      {...inputFocusProps('newPassword')}
                    />
                    <MaterialPressable
                      style={styles.eyeButton}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </MaterialPressable>
                  </View>
                  <Text style={[styles.inputHint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                    {t('settings.passwordHint') || '비밀번호를 설정하면 세션 접근 시 입력이 필요합니다.'}
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <MaterialPressable
                    style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
                    onPress={() => {
                      setCreateModalVisible(false);
                      setNewSessionName('');
                      setNewSessionPassword('');
                      setNewSessionIsPublic(true);
                      setShowNewPassword(false);
                    }}
                    activeOpacity={0.7}
                    disabled={isCreating}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {t('common.cancel')}
                    </Text>
                  </MaterialPressable>

                  <MaterialPressable
                    style={[styles.modalButton, { backgroundColor: createDisabled ? colors.raised : colors.primary }]}
                    onPress={handleGenerateSessionUrl}
                    activeOpacity={0.7}
                    disabled={createDisabled}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: createDisabled, busy: isCreating }}
                  >
                    {isCreating ? (
                      <ActivityIndicator size="small" color={colors.textTertiary} />
                    ) : (
                      <Text style={[styles.modalButtonText, { color: createDisabled ? colors.textTertiary : '#FFFFFF', fontFamily: fonts.semiBold }]}>
                        {t('settings.createButton') || '생성'}
                      </Text>
                    )}
                  </MaterialPressable>
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
    paddingHorizontal: 8,
    paddingBottom: 8,
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: SIZE.touch,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.control,
    gap: 8,
  },
  syncingText: {
    fontSize: 13,
    lineHeight: 18,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 8,
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
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    paddingHorizontal: 16,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    gap: 8,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  tab: {
    flex: 1,
    minHeight: SIZE.touch,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  sessionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionUrl: {
    flex: 1,
    fontSize: 13,
    fontFamily: MONO,
    lineHeight: 18,
  },
  sessionGroupName: {
    flex: 1,
    fontSize: 14,
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sessionItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  iconButton: {
    flex: 1,
    height: SIZE.touch,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSecondary: {
    borderWidth: 1,
  },
  sessionInfo: {
    ...TYPE.caption,
    lineHeight: 17,
    marginHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
    marginTop: 6,
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
    borderRadius: RADIUS.card,
    padding: SPACE.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  optionRowSpaced: {
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingLeft: 14,
  },
  passwordInputSpacing: {
    marginBottom: 20,
  },
  inputField: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingRight: 14,
  },
  eyeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    height: SIZE.button,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  passwordSection: {
    marginBottom: 20,
  },
  sessionNameSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputHint: {
    ...TYPE.caption,
    marginTop: 8,
    lineHeight: 16,
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
