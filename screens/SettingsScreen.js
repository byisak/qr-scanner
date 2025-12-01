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

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { themeMode, isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [on, setOn] = useState(false);
  const [url, setUrl] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(false);
  const [batchScanEnabled, setBatchScanEnabled] = useState(false);
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(6);

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const u = await SecureStore.getItemAsync('baseUrl');
        const h = await AsyncStorage.getItem('hapticEnabled');
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
          const savedServerUrl = await AsyncStorage.getItem('serverUrl');
          const savedSessionId = await AsyncStorage.getItem('sessionId');
          if (savedServerUrl) {
            setServerUrl(savedServerUrl);
            // 서버 연결
            websocketClient.connect(savedServerUrl);
          }
          if (savedSessionId) {
            setSessionId(savedSessionId);
            websocketClient.setSessionId(savedSessionId);
          }
        }
      } catch (error) {
        console.error('Load settings error:', error);
      }
    })();
  }, []);

  // 화면이 포커스될 때마다 바코드 개수 업데이트
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const b = await AsyncStorage.getItem('selectedBarcodes');
          if (b) {
            const parsed = JSON.parse(b);
            setSelectedBarcodesCount(parsed.length || 6);
          }
        } catch (error) {
          console.error('Load barcode count error:', error);
        }
      })();
    }, [])
  );

  useEffect(() => {
    SecureStore.setItemAsync('scanLinkEnabled', on.toString());
    if (!on) {
      SecureStore.deleteItemAsync('baseUrl');
      setUrl('');
    }
  }, [on]);

  useEffect(() => {
    if (on && url.trim()) {
      const t = setTimeout(() => SecureStore.setItemAsync('baseUrl', url.trim()), 500);
      return () => clearTimeout(t);
    }
  }, [url, on]);

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

  // 실시간 서버전송 설정 저장 및 연결 관리
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('realtimeSyncEnabled', realtimeSyncEnabled.toString());

        if (!realtimeSyncEnabled) {
          // 비활성화 시 연결 해제
          websocketClient.disconnect();
          setIsConnected(false);
          setSessionId('');
          await AsyncStorage.removeItem('sessionId');
        }
      } catch (error) {
        console.error('Save realtime sync settings error:', error);
      }
    })();
  }, [realtimeSyncEnabled]);

  // 서버 URL 저장
  useEffect(() => {
    if (realtimeSyncEnabled && serverUrl.trim()) {
      const timer = setTimeout(async () => {
        await AsyncStorage.setItem('serverUrl', serverUrl.trim());
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [serverUrl, realtimeSyncEnabled]);

  // 웹소켓 연결 상태 추적
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleSessionCreated = async (data) => {
      setSessionId(data.sessionId);
      setIsCreatingSession(false);
      await AsyncStorage.setItem('sessionId', data.sessionId);
      Alert.alert(t('settings.success'), t('settings.sessionCreated'));
    };

    const handleError = (error) => {
      setIsCreatingSession(false);
      Alert.alert(t('settings.error'), t('settings.connectionError'));
    };

    websocketClient.on('connect', handleConnect);
    websocketClient.on('disconnect', handleDisconnect);
    websocketClient.on('sessionCreated', handleSessionCreated);
    websocketClient.on('error', handleError);

    return () => {
      websocketClient.off('connect', handleConnect);
      websocketClient.off('disconnect', handleDisconnect);
      websocketClient.off('sessionCreated', handleSessionCreated);
      websocketClient.off('error', handleError);
    };
  }, [t]);

  // 서버 연결
  const handleConnectToServer = () => {
    if (!serverUrl.trim()) {
      Alert.alert(t('settings.error'), t('settings.enterServerUrl'));
      return;
    }

    websocketClient.connect(serverUrl.trim());
  };

  // 세션 생성
  const handleCreateSession = () => {
    if (!isConnected) {
      Alert.alert(t('settings.error'), t('settings.notConnected'));
      return;
    }

    setIsCreatingSession(true);
    const success = websocketClient.createSession();
    if (!success) {
      setIsCreatingSession(false);
      Alert.alert(t('settings.error'), t('settings.sessionCreateFailed'));
    }
  };

  // URL 복사
  const handleCopyUrl = async () => {
    if (!sessionId) return;

    const fullUrl = `${serverUrl.trim()}/session/${sessionId}`;
    await Clipboard.setStringAsync(fullUrl);
    Alert.alert(t('settings.success'), t('settings.urlCopied'));
  };

  return (
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
              {hapticEnabled && <Text style={[s.ok, { color: colors.success }]}>{t('settings.enabled')}</Text>}
            </View>
            <Switch
              value={hapticEnabled}
              onValueChange={setHapticEnabled}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.hapticFeedback')}
            />
          </View>

          {/* 사진 저장 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.photoSave')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.photoSaveDesc')}</Text>
              {photoSaveEnabled && <Text style={[s.ok, { color: colors.success }]}>{t('settings.enabled')}</Text>}
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
              {batchScanEnabled && <Text style={[s.ok, { color: colors.success }]}>{t('settings.enabled')}</Text>}
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

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.useScanUrl')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.useScanUrlDesc')}</Text>
              {on && <Text style={[s.ok, { color: colors.success }]}>{t('settings.enabled')}</Text>}
            </View>
            <Switch
              value={on}
              onValueChange={setOn}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.useScanUrl')}
            />
          </View>

          {on && (
            <>
              <Text style={[s.urlInfo, { color: colors.textSecondary }]}>
                {t('settings.urlInfo')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={url}
                onChangeText={setUrl}
                placeholder={t('settings.urlPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
                accessibilityLabel={t('settings.useScanUrl')}
              />
              <Text style={[s.save, { color: colors.success }]}>{t('settings.autoSaved')}</Text>

              <View style={[s.exampleBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <Text style={[s.exampleTitle, { color: colors.textSecondary }]}>{t('settings.exampleTitle')}</Text>
                <Text style={[s.exampleText, { color: colors.primary }]}>{t('settings.exampleUrl')}</Text>
                <Text style={[s.exampleDesc, { color: colors.textTertiary }]}>
                  {t('settings.exampleDesc')}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 실시간 서버전송 설정 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{t('settings.realtimeSync')}</Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.enableRealtimeSync')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.realtimeSyncDesc')}</Text>
              {realtimeSyncEnabled && <Text style={[s.ok, { color: colors.success }]}>{t('settings.enabled')}</Text>}
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
              {/* 서버 URL 입력 */}
              <Text style={[s.urlInfo, { color: colors.textSecondary }]}>
                {t('settings.serverUrlInfo')}
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder={t('settings.serverUrlPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
                accessibilityLabel={t('settings.serverUrl')}
              />

              {/* 연결 버튼 */}
              {!isConnected && serverUrl.trim() && (
                <TouchableOpacity
                  style={[s.connectButton, { backgroundColor: colors.primary }]}
                  onPress={handleConnectToServer}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cloud-outline" size={20} color="#fff" />
                  <Text style={s.connectButtonText}>{t('settings.connectToServer')}</Text>
                </TouchableOpacity>
              )}

              {/* 연결 상태 */}
              <View style={s.connectionStatus}>
                <View style={[s.statusDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
                <Text style={[s.statusText, { color: colors.text }]}>
                  {isConnected ? t('settings.connected') : t('settings.disconnected')}
                </Text>
              </View>

              {/* 세션 생성 버튼 */}
              {isConnected && !sessionId && (
                <TouchableOpacity
                  style={[s.sessionButton, { backgroundColor: colors.success }, isCreatingSession && s.sessionButtonDisabled]}
                  onPress={handleCreateSession}
                  disabled={isCreatingSession}
                  activeOpacity={0.8}
                >
                  {isCreatingSession ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={20} color="#fff" />
                      <Text style={s.sessionButtonText}>{t('settings.generateSessionUrl')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* 생성된 세션 URL */}
              {sessionId && (
                <View style={[s.sessionUrlBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <View style={s.sessionUrlHeader}>
                    <Ionicons name="cloud-done" size={20} color={colors.success} />
                    <Text style={[s.sessionUrlTitle, { color: colors.text }]}>{t('settings.sessionUrlGenerated')}</Text>
                  </View>
                  <Text style={[s.sessionUrl, { color: colors.primary }]}>
                    {serverUrl.trim()}/session/{sessionId}
                  </Text>
                  <TouchableOpacity
                    style={[s.copyButton, { backgroundColor: colors.primary }]}
                    onPress={handleCopyUrl}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={18} color="#fff" />
                    <Text style={s.copyButtonText}>{t('settings.copyUrl')}</Text>
                  </TouchableOpacity>
                  <Text style={[s.sessionInfo, { color: colors.textTertiary }]}>
                    {t('settings.sessionInfo')}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
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
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingVertical: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  sessionButtonDisabled: {
    opacity: 0.6,
  },
  sessionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sessionUrlBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sessionUrlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionUrlTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  sessionUrl: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 12,
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionInfo: {
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});
