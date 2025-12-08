// screens/SettingsScreen.js - 설정 화면
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../locales';
import { Colors } from '../constants/Colors';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { themeMode, isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [on, setOn] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true);
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(false);
  const [batchScanEnabled, setBatchScanEnabled] = useState(false);
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(6);

  // 실시간 서버전송 상태 (켬/끔 표시용)
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const h = await AsyncStorage.getItem('hapticEnabled');
        const ss = await AsyncStorage.getItem('scanSoundEnabled');
        const p = await AsyncStorage.getItem('photoSaveEnabled');
        const bs = await AsyncStorage.getItem('batchScanEnabled');
        const b = await AsyncStorage.getItem('selectedBarcodes');

        if (e === 'true') {
          setOn(true);
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
          console.error('Load settings error:', error);
        }
      })();
    }, [])
  );

  // 화면이 포커스될 때마다 스캔 연동 URL 상태 및 실시간 서버전송 상태 업데이트
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const e = await SecureStore.getItemAsync('scanLinkEnabled');
          setOn(e === 'true');

          const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
          setRealtimeSyncEnabled(realtimeSync === 'true');
        } catch (error) {
          console.error('Load settings error:', error);
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

          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => router.push('/realtime-sync-settings')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text }]}>{t('settings.enableRealtimeSync')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary }]}>{t('settings.realtimeSyncDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <Text style={[s.statusText, { color: realtimeSyncEnabled ? colors.success : colors.textTertiary }]}>
                {realtimeSyncEnabled ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
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
  versionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
