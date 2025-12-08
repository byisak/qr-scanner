// screens/SettingsScreen.js - 설정 화면
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
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../locales';
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

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { themeMode, isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [on, setOn] = useState(false);
  const [url, setUrl] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true);
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(false);
  const [batchScanEnabled, setBatchScanEnabled] = useState(false);
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(6);

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [sessionUrls, setSessionUrls] = useState([]); // 생성된 세션 URL 목록

  // 비밀번호 모달 상태
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const u = await SecureStore.getItemAsync('baseUrl');
        const h = await AsyncStorage.getItem('hapticEnabled');
        const ss = await AsyncStorage.getItem('scanSoundEnabled');
        const p = await AsyncStorage.getItem('photoSaveEnabled');
        const bs = await AsyncStorage.getItem('batchScanEnabled');
        const b = await AsyncStorage.getItem('selectedBarcodes');

        if (e === 'true') {
          setOn(true);
          setUrl(u || '');
        }

        if (h !== null) {
          setHapticEnabled(h === 'true');
        }

        if (ss !== null) {
          setScanSoundEnabled(ss === 'true');
        }

        if (p !== null) {
          setPhotoSaveEnabled(p === 'true');
        }

        if (bs !== null) {
          setBatchScanEnabled(bs === 'true');
        }

        if (b) {
          const parsed = JSON.parse(b);
          setSelectedBarcodesCount(parsed.length || 6);
        }

        // 실시간 서버전송 설정 로드
        const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
        if (realtimeSync === 'true') {
          setRealtimeSyncEnabled(true);
        }

        // 생성된 세션 URL 목록 로드
        const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
        if (savedSessionUrls) {
          setSessionUrls(JSON.parse(savedSessionUrls));
        }
      } catch (error) {
        console.error('Load settings error:', error);
      }
    })();
  }, []);

  // 화면이 포커스될 때마다 바코드 개수 및 세션 URL 목록 업데이트
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const b = await AsyncStorage.getItem('selectedBarcodes');
          if (b) {
            const parsed = JSON.parse(b);
            setSelectedBarcodesCount(parsed.length || 6);
          }

          // 세션 URL 목록 다시 로드 (클라우드 그룹 삭제 시 동기화)
          const savedSessionUrls = await AsyncStorage.getItem('sessionUrls');
          if (savedSessionUrls) {
            setSessionUrls(JSON.parse(savedSessionUrls));
          } else {
            setSessionUrls([]);
          }
        } catch (error) {
          console.error('Load settings error:', error);
        }
      })();
    }, [])
  );

  // 화면이 포커스될 때마다 스캔 연동 URL 상태 업데이트
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const e = await SecureStore.getItemAsync('scanLinkEnabled');
          setOn(e === 'true');
        } catch (error) {
          console.error('Load scan URL settings error:', error);
        }
      })();
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('hapticEnabled', hapticEnabled.toString());
      } catch (error) {
        console.error('Save haptic settings error:', error);
      }
    })();
  }, [hapticEnabled]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('scanSoundEnabled', scanSoundEnabled.toString());
      } catch (error) {
        console.error('Save scan sound settings error:', error);
      }
    })();
  }, [scanSoundEnabled]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('photoSaveEnabled', photoSaveEnabled.toString());
      } catch (error) {
        console.error('Save photo save settings error:', error);
      }
    })();
  }, [photoSaveEnabled]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('batchScanEnabled', batchScanEnabled.toString());
      } catch (error) {
        console.error('Save batch scan settings error:', error);
      }
    })();
  }, [batchScanEnabled]);

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

  // 세션 URL 목록 저장 (실시간 동기화가 활성화된 경우에만)
  useEffect(() => {
    if (realtimeSyncEnabled) {
      if (sessionUrls.length > 0) {
        AsyncStorage.setItem('sessionUrls', JSON.stringify(sessionUrls));
      } else {
        // 활성화 상태에서 빈 배열일 때는 AsyncStorage에서 제거
        AsyncStorage.removeItem('sessionUrls');
      }
    }
    // 비활성화 상태에서는 AsyncStorage를 건드리지 않음 (데이터 보존)
  }, [sessionUrls]);

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
      // 서버 URL 설정 (config에서 가져오기)
      if (!websocketClient.getConnectionStatus()) {
        websocketClient.connect(config.serverUrl);
      }
      await websocketClient.createSession(newSessionId);
      console.log('서버에 세션 생성 요청:', newSessionId);
    } catch (error) {
      console.error('서버 세션 생성 실패:', error);
      // 에러가 나도 로컬에는 저장되므로 계속 진행
    }

    // 자동으로 scanGroups에 클라우드 동기화 그룹 추가
    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      const groups = groupsData ? JSON.parse(groupsData) : [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }];

      // 새 클라우드 동기화 그룹 생성
      const newGroup = {
        id: newSessionId,
        name: `세션 ${newSessionId.substring(0, 4)}`,
        createdAt: Date.now(),
        isCloudSync: true,
      };

      const updatedGroups = [...groups, newGroup];
      await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

      // scanHistoryByGroup에 빈 배열 초기화
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
            // 세션 URL 삭제
            setSessionUrls(prev => prev.filter(s => s.id !== sessionId));

            // 해당 세션 ID로 생성된 클라우드 동기화 그룹도 삭제
            try {
              const groupsJson = await AsyncStorage.getItem('scanGroups');
              if (groupsJson) {
                const groups = JSON.parse(groupsJson);
                const updatedGroups = groups.filter(g => g.id !== sessionId);
                await AsyncStorage.setItem('scanGroups', JSON.stringify(updatedGroups));

                console.log(`Deleted session URL and cloud sync group: ${sessionId}`);

                // scanHistoryByGroup에서도 삭제
                const historyByGroupJson = await AsyncStorage.getItem('scanHistoryByGroup');
                if (historyByGroupJson) {
                  const historyByGroup = JSON.parse(historyByGroupJson);
                  delete historyByGroup[sessionId];
                  await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
                }

                // scanHistory에서도 삭제 (레거시)
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

  // 비밀번호 추가 모달 열기
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
    <View style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={[s.c, { backgroundColor: colors.background }]} contentContainerStyle={s.content}>
        <Text style={[s.title, { color: colors.text }]}>{t('settings.title')}</Text>

        {/* 바코드 인식 설정 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{t('settings.barcodeSettings')}</Text>

          {/* 햅틱 피드백 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.hapticFeedback')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.hapticDesc')}</Text>
            </View>
            <Switch
              value={hapticEnabled}
              onValueChange={setHapticEnabled}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.hapticFeedback')}
            />
          </View>

          {/* 스캔 소리 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.scanSound')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.scanSoundDesc')}</Text>
            </View>
            <Switch
              value={scanSoundEnabled}
              onValueChange={setScanSoundEnabled}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.scanSound')}
            />
          </View>

          {/* 사진 저장 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.photoSave')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.photoSaveDesc')}</Text>
            </View>
            <Switch
              value={photoSaveEnabled}
              onValueChange={setPhotoSaveEnabled}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.photoSave')}
            />
          </View>

          {/* 배치 스캔 모드 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.batchScanMode')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.batchScanModeDesc')}</Text>
            </View>
            <Switch
              value={batchScanEnabled}
              onValueChange={setBatchScanEnabled}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.batchScanMode')}
            />
          </View>

          {/* 바코드 선택 (클릭하면 새 페이지로) */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/barcode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.selectBarcodes')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{selectedBarcodesCount}{t('settings.selectedCount')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 기록 내보내기 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/export-history')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.exportHistory')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.exportHistoryDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 카메라 선택 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/camera-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.cameraSelection')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.cameraSelectionDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 언어 선택 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/language-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.languageSelection')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>
                {languages.find(lang => lang.code === language)?.name || '한국어'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 화면 모드 선택 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/display-mode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.displayMode')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>
                {t(`displayModeSelection.${themeMode}`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* URL 연동 설정 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{t('settings.autoMove')}</Text>

          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => router.push('/scan-url-settings')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.useScanUrl')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.useScanUrlDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <Text style={[s.statusText, { color: on ? colors.success : colors.textTertiary }]}>
                {on ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 실시간 서버전송 설정 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{t('settings.realtimeSync')}</Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.enableRealtimeSync')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.realtimeSyncDesc')}</Text>
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
              {/* 주소 생성 버튼 */}
              <TouchableOpacity
                style={[s.generateButton, { backgroundColor: colors.success }]}
                onPress={handleGenerateSessionUrl}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={s.generateButtonText}>{t('settings.generateSessionUrl')}</Text>
              </TouchableOpacity>

              {/* 생성된 세션 URL 목록 */}
              {sessionUrls.length > 0 && (
                <View style={s.sessionListContainer}>
                  <Text style={[s.sessionListTitle, { color: colors.text }]}>{t('settings.generatedUrls')}</Text>
                  {sessionUrls.map((session) => (
                    <View
                      key={session.id}
                      style={[
                        s.sessionItem,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border
                        }
                      ]}
                    >
                      <View style={s.sessionItemContent}>
                        <View style={s.sessionItemHeader}>
                          <Ionicons
                            name="link"
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={[s.sessionUrl, { color: colors.primary, flex: 1 }]} numberOfLines={1}>
                            {session.url}
                          </Text>
                        </View>
                        <Text style={[s.sessionGroupName, { color: colors.textSecondary }]}>
                          세션 {session.id.substring(0, 4)}
                        </Text>
                      </View>

                      <View style={s.sessionItemActions}>
                        <TouchableOpacity
                          style={[s.iconButton, { backgroundColor: session.password ? colors.success : colors.textTertiary }]}
                          onPress={() => handleOpenPasswordModal(session.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={session.password ? "lock-closed" : "lock-open-outline"} size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.iconButton, { backgroundColor: colors.primary }]}
                          onPress={() => handleCopyUrl(session.url)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="copy-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.iconButton, { backgroundColor: colors.error }]}
                          onPress={() => handleDeleteSession(session.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <Text style={[s.sessionInfo, { color: colors.textTertiary }]}>
                    {t('settings.sessionInfoNew')}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* 앱 정보 및 지원 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{t('settings.appInfo')}</Text>

          {/* 개선제안하기 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => Alert.alert(t('settings.suggestImprovement'), '준비 중입니다')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.suggestImprovement')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.suggestImprovementDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 1:1 문의하기 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => Alert.alert(t('settings.oneOnOneInquiry'), '준비 중입니다')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.oneOnOneInquiry')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.oneOnOneInquiryDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 서비스 이용약관 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => Alert.alert(t('settings.termsOfService'), '준비 중입니다')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.termsOfService')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.termsOfServiceDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 개인정보 처리방침 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => Alert.alert(t('settings.privacyPolicy'), '준비 중입니다')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.privacyPolicy')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.privacyPolicyDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 버전정보 */}
          <View style={[s.menuItem, { borderTopColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.versionInfo')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.currentVersion')}</Text>
            </View>
            <Text style={[s.versionText, { color: colors.textSecondary }]}>0.1.0</Text>
          </View>
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
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[s.modalContent, { backgroundColor: colors.background }]}>
                <View style={s.modalHeader}>
                  <Ionicons name="lock-closed" size={24} color={colors.primary} />
                  <Text style={[s.modalTitle, { color: colors.text }]}>
                    {t('settings.addPassword')}
                  </Text>
                </View>

                <Text style={[s.modalDescription, { color: colors.textSecondary }]}>
                  {t('settings.passwordDescription')}
                </Text>

                <TextInput
                  style={[
                    s.passwordInput,
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

                <View style={s.modalButtons}>
                  <TouchableOpacity
                    style={[s.modalButton, s.cancelButton, { backgroundColor: colors.inputBackground }]}
                    onPress={() => {
                      setPasswordModalVisible(false);
                      setPasswordInput('');
                      setSelectedSessionId('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.modalButtonText, { color: colors.text }]}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.modalButton, s.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSavePassword}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.modalButtonText, { color: '#fff' }]}>
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

const s = StyleSheet.create({
  c: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 40,
    marginBottom: 30,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    marginTop: 10,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
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
  ok: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  urlInfo: {
    fontSize: 14,
    marginTop: 20,
    lineHeight: 20,
  },
  input: {
    marginTop: 15,
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  save: {
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
  saveButton: {
    // backgroundColor is set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
