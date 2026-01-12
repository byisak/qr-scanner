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
  Platform,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { languages } from '../locales';
import { Colors } from '../constants/Colors';
import LockIcon from '../components/LockIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner from '../components/AdBanner';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t, fonts } = useLanguage();
  const { themeMode, isDark } = useTheme();
  const { user, isLoggedIn } = useAuth();
  const { isLocked, showUnlockAlert, devModeEnabled, toggleDevMode, resetAllLocks } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  // iOS는 기존 값 유지, Android는 SafeArea insets 사용
  const statusBarHeight = Platform.OS === 'ios' ? 70 : insets.top + 20;

  const [on, setOn] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true);
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(false); // 기본값: 끔
  const [continuousScanEnabled, setContinuousScanEnabled] = useState(false);
  const [multiCodeModeEnabled, setMultiCodeModeEnabled] = useState(false); // 여러 코드 인식 모드
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false); // 복권 인식
  const [resultWindowAutoOpen, setResultWindowAutoOpen] = useState(true); // 결과창 자동 열림 (기본값: true)
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(6);

  // 실시간 서버전송 상태 (켬/끔 표시용)
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  // URL 열기 방식 상태
  const [urlOpenMode, setUrlOpenMode] = useState('inApp');
  // 사진 압축률 상태
  const [photoQuality, setPhotoQuality] = useState('0.8');
  // 제품 검색 자동 실행 상태
  const [productAutoSearch, setProductAutoSearch] = useState(false);
  // 스캔 연동 URL 목록
  const [scanUrlList, setScanUrlList] = useState([]);
  // 실시간 서버전송 설명 페이지 확인 여부
  const [realtimeSyncExplained, setRealtimeSyncExplained] = useState(false);
  // 스캔 결과 표시 방식 (popup: 결과 화면, toast: 하단 토스트)
  const [scanResultMode, setScanResultMode] = useState('popup');
  // 캐시 크기
  const [cacheSize, setCacheSize] = useState(0);
  const [isCalculatingCache, setIsCalculatingCache] = useState(false);
  // 분석 동의 상태
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  // 캐시 크기 계산
  const calculateCacheSize = useCallback(async () => {
    setIsCalculatingCache(true);
    try {
      const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);

      if (!dirInfo.exists) {
        setCacheSize(0);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      let totalSize = 0;

      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${photoDir}${file}`);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }

      setCacheSize(totalSize);
    } catch (error) {
      console.error('Calculate cache size error:', error);
      setCacheSize(0);
    } finally {
      setIsCalculatingCache(false);
    }
  }, []);

  // 캐시 크기 포맷팅
  const formatCacheSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 캐시 삭제
  const handleClearCache = () => {
    if (cacheSize === 0) {
      Alert.alert(
        t('settings.cache') || '캐시',
        t('settings.noCacheToDelete') || '삭제할 캐시가 없습니다.'
      );
      return;
    }

    Alert.alert(
      t('settings.clearCache') || '캐시 삭제',
      t('settings.clearCacheConfirm') || `저장된 사진 ${formatCacheSize(cacheSize)}를 삭제하시겠습니까?\n\n삭제된 사진은 복구할 수 없습니다.`,
      [
        { text: t('common.cancel') || '취소', style: 'cancel' },
        {
          text: t('common.delete') || '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
              const dirInfo = await FileSystem.getInfoAsync(photoDir);

              if (dirInfo.exists) {
                await FileSystem.deleteAsync(photoDir, { idempotent: true });
                // 폴더 재생성
                await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
              }

              setCacheSize(0);
              Alert.alert(
                t('settings.success') || '성공',
                t('settings.cacheCleared') || '캐시가 삭제되었습니다.'
              );
            } catch (error) {
              console.error('Clear cache error:', error);
              Alert.alert(
                t('settings.error') || '오류',
                t('settings.clearCacheError') || '캐시 삭제 중 오류가 발생했습니다.'
              );
            }
          },
        },
      ]
    );
  };

  // 분석 동의 토글
  const handleAnalyticsToggle = async (value) => {
    setAnalyticsEnabled(value);
    await setAnalyticsConsent(value);
  };

  // 압축률 전체 라벨 반환 (예: "높음 고화질(권장)")
  const getQualityFullLabel = (quality) => {
    const labels = {
      '1.0': `${t('photoSaveSettings.qualityOriginal')} ${t('photoSaveSettings.qualityOriginalDesc')}`,
      '0.8': `${t('photoSaveSettings.qualityHigh')} ${t('photoSaveSettings.qualityHighDesc')}`,
      '0.6': `${t('photoSaveSettings.qualityMedium')} ${t('photoSaveSettings.qualityMediumDesc')}`,
      '0.4': `${t('photoSaveSettings.qualityLow')} ${t('photoSaveSettings.qualityLowDesc')}`,
      '0.2': `${t('photoSaveSettings.qualityMinimum')} ${t('photoSaveSettings.qualityMinimumDesc')}`,
    };
    return labels[quality] || `${t('photoSaveSettings.qualityHigh')} ${t('photoSaveSettings.qualityHighDesc')}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const e = await SecureStore.getItemAsync('scanLinkEnabled');
        const h = await AsyncStorage.getItem('hapticEnabled');
        const ss = await AsyncStorage.getItem('scanSoundEnabled');
        const p = await AsyncStorage.getItem('photoSaveEnabled');
        const cs = await AsyncStorage.getItem('continuousScanEnabled');
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

        // null이면 기본값 true 유지
        setPhotoSaveEnabled(p === null ? true : p === 'true');

        if (cs !== null) {
          setContinuousScanEnabled(cs === 'true');
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

        // URL 열기 방식 로드
        const savedUrlOpenMode = await AsyncStorage.getItem('urlOpenMode');
        if (savedUrlOpenMode) {
          setUrlOpenMode(savedUrlOpenMode);
        }

        // 사진 압축률 로드
        const q = await AsyncStorage.getItem('photoQuality');
        if (q !== null) {
          setPhotoQuality(q);
        }

        // 분석 동의 상태 로드
        const analyticsConsent = await getAnalyticsConsent();
        setAnalyticsEnabled(analyticsConsent);
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

          // 스캔 연동 URL 목록 로드
          const savedUrlList = await SecureStore.getItemAsync('scanUrlList');
          if (savedUrlList) {
            setScanUrlList(JSON.parse(savedUrlList));
          }

          const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
          setRealtimeSyncEnabled(realtimeSync === 'true');

          const savedUrlOpenMode = await AsyncStorage.getItem('urlOpenMode');
          if (savedUrlOpenMode) {
            setUrlOpenMode(savedUrlOpenMode);
          }

          // 사진 저장 설정 로드
          const p = await AsyncStorage.getItem('photoSaveEnabled');
          setPhotoSaveEnabled(p === null ? false : p === 'true');

          const q = await AsyncStorage.getItem('photoQuality');
          if (q !== null) {
            setPhotoQuality(q);
          }

          // 연속 스캔 설정 로드 (두 키를 동기화하여 로드)
          let cs = await AsyncStorage.getItem('continuousScanEnabled');
          const bs = await AsyncStorage.getItem('batchScanEnabled');

          // 두 키가 일치하지 않으면 동기화
          if (cs === null && bs !== null) {
            // continuousScanEnabled가 없으면 batchScanEnabled 값 사용
            cs = bs;
            await AsyncStorage.setItem('continuousScanEnabled', bs);
          } else if (cs !== null && bs !== cs) {
            // 두 값이 다르면 continuousScanEnabled 기준으로 동기화
            await AsyncStorage.setItem('batchScanEnabled', cs);
          }

          setContinuousScanEnabled(cs === 'true');

          // 여러 코드 인식 모드 설정 로드
          const mcm = await AsyncStorage.getItem('multiCodeModeEnabled');
          setMultiCodeModeEnabled(mcm === 'true');

          // 복권 인식 설정 로드
          const ls = await AsyncStorage.getItem('lotteryScanEnabled');
          setLotteryScanEnabled(ls === 'true');

          // 결과창 자동 열림 설정 로드
          const rwa = await AsyncStorage.getItem('resultWindowAutoOpen');
          // null이면 기본값 true 유지
          setResultWindowAutoOpen(rwa === null ? true : rwa === 'true');

          // 제품 검색 자동 실행 설정 로드
          const pas = await AsyncStorage.getItem('productAutoSearch');
          setProductAutoSearch(pas === 'true');

          // 실시간 서버전송 설명 페이지 확인 여부 로드
          const explained = await AsyncStorage.getItem('realtimeSyncExplained');
          setRealtimeSyncExplained(explained === 'true');

          // 스캔 결과 표시 방식 로드
          const resultMode = await AsyncStorage.getItem('scanResultMode');
          if (resultMode) {
            setScanResultMode(resultMode);
          }

          // 캐시 크기 계산
          calculateCacheSize();
        } catch (error) {
          console.error('Load settings error:', error);
        }
      })();
    }, [calculateCacheSize])
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

  // 참고: multiCodeModeEnabled 저장은 MultiCodeModeSettingsScreen에서만 처리
  // 참고: continuousScanEnabled 저장은 ContinuousScanSettingsScreen에서만 처리
  // SettingsScreen에서는 읽기만 하고, 로드 시 동기화만 수행

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 상단 그라데이션 */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(0,0,0,1)', 'rgba(0,0,0,0.95)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']
            : ['rgba(249,249,249,1)', 'rgba(249,249,249,0.95)', 'rgba(249,249,249,0.7)', 'rgba(249,249,249,0.3)', 'rgba(249,249,249,0)']
        }
        locations={[0, 0.3, 0.6, 0.85, 1]}
        style={[s.statusBarGradient, { height: statusBarHeight }]}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={[s.c, { backgroundColor: colors.background }]} contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.bold }]}>{t('settings.title')}</Text>
        </View>

        {/* 로그인/프로필 섹션 */}
        {isLoggedIn ? (
          // 로그인된 상태 - 프로필 표시
          <TouchableOpacity
            style={[s.profileSection, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/profile-settings')}
            activeOpacity={0.7}
          >
            <View style={s.profileInfo}>
              <View style={s.profileNameRow}>
                <Text style={[s.profileName, { color: colors.text, fontFamily: fonts.bold }]}>
                  {user?.name || 'User'}
                </Text>
                <Text style={[s.profileNameSuffix, { color: colors.text, fontFamily: fonts.regular }]}>
                  {' '}{language === 'ko' ? '님' : ''}
                </Text>
              </View>
              <Text style={[s.profileEmail, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {user?.email || ''}
              </Text>
            </View>
            <TouchableOpacity
              style={s.settingsIconButton}
              onPress={() => router.push('/profile-settings')}
            >
              <Ionicons name="settings-outline" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          // 로그인 안된 상태 - 로그인 유도
          <TouchableOpacity
            style={[s.loginSection, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
          >
            <View style={s.loginContent}>
              <Text style={[s.loginTitle, { color: '#E67E22', fontFamily: fonts.bold }]}>
                {t('auth.loginSignup')}
              </Text>
              <Text style={[s.loginDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('auth.loginPrompt')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#E67E22" />
          </TouchableOpacity>
        )}

        {/* 배너 광고 */}
        <View style={[s.adSection, { backgroundColor: colors.surface }]}>
          <AdBanner />
        </View>

        {/* Pro 버전 - TODO: 추후 프로버전 출시 시 주석 해제 */}
        {/* <TouchableOpacity
          style={[s.proSection, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/pro-version')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.proBanner}
          >
            <View style={s.proBannerContent}>
              <Ionicons name="diamond" size={24} color="#fff" />
              <View style={s.proBannerText}>
                <Text style={[s.proTitle, { fontFamily: fonts.bold }]}>{t('proVersion.title')}</Text>
                <Text style={[s.proDesc, { fontFamily: fonts.regular }]}>{t('proVersion.description')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
          <TouchableOpacity
            style={s.watchAdButton}
            onPress={() => router.push('/pro-features')}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
            <Text style={[s.watchAdText, { color: colors.primary, fontFamily: fonts.semiBold }]}>{t('proVersion.watchAd')}</Text>
            <Text style={[s.watchAdSubText, { color: colors.textTertiary, fontFamily: fonts.regular }]}> - {t('proVersion.freeUnlock')}</Text>
          </TouchableOpacity>
        </TouchableOpacity> */}

        {/* 광고보기 - 기능 잠금 해제 */}
        <TouchableOpacity
          style={[s.proSection, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/pro-features')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.proBanner}
          >
            <View style={s.proBannerContent}>
              <Ionicons name="play-circle" size={24} color="#fff" />
              <View style={s.proBannerText}>
                <Text style={[s.proTitle, { fontFamily: fonts.bold }]}>{t('proVersion.watchAd')}</Text>
                <Text style={[s.proDesc, { fontFamily: fonts.regular }]}>{t('proVersion.freeUnlock')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* 알림 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.notification')}</Text>

          {/* 햅틱 피드백 */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.hapticFeedback')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.hapticDesc')}</Text>
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
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.scanSound')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.scanSoundDesc')}</Text>
            </View>
            <Switch
              value={scanSoundEnabled}
              onValueChange={setScanSoundEnabled}
              trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
              thumbColor="#fff"
              accessibilityLabel={t('settings.scanSound')}
            />
          </View>
        </View>

        {/* 스캔 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.scan')}</Text>

          {/* 바코드 선택 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => router.push('/barcode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.selectBarcodes')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{selectedBarcodesCount}{t('settings.selectedCount')}</Text>
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
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.cameraSelection')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.cameraSelectionDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 사진 저장 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => {
              if (isLocked('photoSave')) {
                showUnlockAlert('photoSave', () => router.push('/photo-save-settings'));
              } else {
                router.push('/photo-save-settings');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.photoSave')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {photoSaveEnabled ? getQualityFullLabel(photoQuality) : t('settings.photoSaveDesc')}
              </Text>
            </View>
            <View style={s.menuItemRight}>
              <LockIcon featureId="photoSave" size={12} badge />
              <Text style={[s.statusText, { color: photoSaveEnabled ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {photoSaveEnabled ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* URL 열기 방식 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/url-open-mode-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('urlOpenMode.title')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t(`urlOpenMode.${urlOpenMode}`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 결과창 자동 열림 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/result-window-settings')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.resultWindowAutoOpen')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.resultWindowAutoOpenDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <Text style={[s.statusText, { color: resultWindowAutoOpen ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {resultWindowAutoOpen ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

        </View>

        {/* 고급 스캔 기능 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.advancedScanFeatures')}</Text>

          {/* 연속 스캔 모드 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => {
              if (isLocked('batchScan')) {
                showUnlockAlert('batchScan', () => router.push('/continuous-scan-settings'));
              } else {
                router.push('/continuous-scan-settings');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('continuousScan.title') || t('settings.batchScanMode')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('continuousScan.description') || t('settings.batchScanModeDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <LockIcon featureId="batchScan" size={12} badge />
              <Text style={[s.statusText, { color: continuousScanEnabled ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {continuousScanEnabled ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* 여러 코드 인식 모드 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/multi-code-mode-settings')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.multiCodeMode')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.multiCodeModeDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <Text style={[s.statusText, { color: multiCodeModeEnabled ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {multiCodeModeEnabled ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* 스캔 연동 URL */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => {
              if (isLocked('scanUrlIntegration')) {
                showUnlockAlert('scanUrlIntegration', () => router.push('/scan-url-settings'));
              } else {
                router.push('/scan-url-settings');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.useScanUrl')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.useScanUrlDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <LockIcon featureId="scanUrlIntegration" size={12} badge />
              <Text style={[s.statusText, { color: on ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {on ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* 스캔 연동 URL 목록 - 활성화 시에만 표시 */}
          {on && scanUrlList.length > 0 && (
            <View style={[s.urlListContainer, { borderTopColor: colors.borderLight }]}>
              {scanUrlList.map((item, index) => (
                <View key={item.id} style={[s.urlListItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
                  <View style={s.urlListItemLeft}>
                    <View style={[s.urlStatusDot, { backgroundColor: item.enabled ? colors.success : colors.textTertiary }]} />
                    <View style={s.urlListItemText}>
                      <Text style={[s.urlListItemName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[s.urlListItemUrl, { color: colors.textTertiary, fontFamily: fonts.regular }]} numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 실시간 서버전송 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => {
              if (isLocked('realtimeSync')) {
                showUnlockAlert('realtimeSync', () => {
                  // TODO: 배포 시 아래 주석 해제하고 router.push('/realtime-sync-explanation') 삭제
                  // if (realtimeSyncExplained) {
                  //   router.push('/realtime-sync-settings');
                  // } else {
                  //   router.push('/realtime-sync-explanation');
                  // }
                  router.push('/realtime-sync-explanation');
                });
              } else {
                // TODO: 배포 시 아래 주석 해제하고 router.push('/realtime-sync-explanation') 삭제
                // if (realtimeSyncExplained) {
                //   router.push('/realtime-sync-settings');
                // } else {
                //   router.push('/realtime-sync-explanation');
                // }
                router.push('/realtime-sync-explanation');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.enableRealtimeSync')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.realtimeSyncDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <LockIcon featureId="realtimeSync" size={12} badge />
              <Text style={[s.statusText, { color: realtimeSyncEnabled ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {realtimeSyncEnabled ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>

          {/* 복권 인식 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/lottery-scan-settings')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.lotteryScan')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.lotteryScanDesc')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <Text style={[s.statusText, { color: lotteryScanEnabled ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {lotteryScanEnabled ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 제품 검색 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.productSearchSection')}</Text>

          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => {
              if (isLocked('productSearch')) {
                showUnlockAlert('productSearch', () => router.push('/product-search-settings'));
              } else {
                router.push('/product-search-settings');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('productSearch.title')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('productSearch.description')}</Text>
            </View>
            <View style={s.menuItemRight}>
              <LockIcon featureId="productSearch" size={12} badge />
              <Text style={[s.statusText, { color: productAutoSearch ? colors.success : colors.textTertiary, fontFamily: fonts.medium }]}>
                {productAutoSearch ? t('settings.statusOn') : t('settings.statusOff')}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 데이터 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.data')}</Text>

          {/* 기록 내보내기 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => router.push('/export-history')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.exportHistory')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.exportHistoryDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 백업 내보내기 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/backup-export')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('backupExport.title')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('backupExport.description')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 백업 가져오기 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/backup-import')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('backupImport.title')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('backupImport.description')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 일반 섹션 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.general')}</Text>

          {/* 언어 선택 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => router.push('/language-selection')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.languageSelection')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
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
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.displayMode')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t(`displayModeSelection.${themeMode}`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 앱 정보 및 지원 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.bold }]}>{t('settings.appInfo')}</Text>

          {/* 개선제안하기 - 임시 주석처리
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => Alert.alert(t('settings.suggestImprovement'), '준비 중입니다')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.suggestImprovement')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.suggestImprovementDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
          */}

          {/* 1:1 문의하기 - 임시 주석처리
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => Alert.alert(t('settings.oneOnOneInquiry'), '준비 중입니다')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.oneOnOneInquiry')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.oneOnOneInquiryDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
          */}

          {/* 서비스 이용약관 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopWidth: 0 }]}
            onPress={() => router.push('/terms-of-service')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.termsOfService')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.termsOfServiceDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 개인정보 처리방침 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={() => router.push('/privacy-policy')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.privacyPolicy')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.privacyPolicyDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 사용 분석 동의 */}
          <View style={[s.menuItem, { borderTopColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('settings.analyticsConsent') || '사용 분석 동의'}
              </Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                {t('settings.analyticsConsentDesc') || '앱 개선을 위한 익명 사용 데이터 수집'}
              </Text>
            </View>
            <Switch
              value={analyticsEnabled}
              onValueChange={handleAnalyticsToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* 버전정보 */}
          <View style={[s.menuItem, { borderTopColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.versionInfo')}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.currentVersion')}</Text>
            </View>
            <Text style={[s.versionText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>0.1.0</Text>
          </View>

          {/* 캐시 삭제 */}
          <TouchableOpacity
            style={[s.menuItem, { borderTopColor: colors.borderLight }]}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settings.clearCache') || '캐시 삭제'}</Text>
              <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>{t('settings.clearCacheDesc') || '저장된 스캔 사진을 삭제합니다'}</Text>
            </View>
            <View style={s.menuItemRight}>
              <Text style={[s.cacheSize, { color: colors.primary, fontFamily: fonts.semiBold }]}>
                {isCalculatingCache ? '...' : formatCacheSize(cacheSize)}
              </Text>
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 개발자 옵션 - TODO: 배포 시 제거 또는 숨김 처리 */}
        <TouchableOpacity
          style={[s.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#FF9500' }]}
          onPress={() => router.push('/developer-options')}
          activeOpacity={0.7}
        >
          <View style={s.devOptionHeader}>
            <View style={s.devOptionLeft}>
              <Ionicons name="code-slash" size={24} color="#FF9500" />
              <View style={s.devOptionText}>
                <Text style={[s.sectionTitle, { color: '#FF9500', fontFamily: fonts.bold, marginBottom: 0 }]}>
                  {t('settings.developerOptions')}
                </Text>
                <Text style={[s.desc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('settings.devModeDesc')}
                </Text>
              </View>
            </View>
            <View style={s.devOptionRight}>
              {devModeEnabled && (
                <View style={[s.devModeBadge, { backgroundColor: '#FF9500' }]}>
                  <Text style={[s.devModeBadgeText, { fontFamily: fonts.semiBold }]}>{t('settings.statusOn')}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
            </View>
          </View>
        </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const s = StyleSheet.create({
  c: {
    flex: 1,
  },
  statusBarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // height는 인라인 스타일로 동적 설정
    zIndex: 100,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 6,
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
  sectionNoTitle: {
    paddingTop: 12,
    paddingBottom: 12,
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
  cacheSize: {
    fontSize: 15,
    fontWeight: '600',
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
  // 로그인 섹션 스타일
  loginSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loginContent: {
    flex: 1,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  loginDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  // 프로필 섹션 스타일
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    marginLeft: 14,
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileNameSuffix: {
    fontSize: 16,
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  settingsIconButton: {
    padding: 8,
  },
  // 광고 섹션 스타일
  adSection: {
    borderRadius: 16,
    marginBottom: 20,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  // Pro 버전 섹션 스타일
  proSection: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  proBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  proBannerText: {
    marginLeft: 12,
    flex: 1,
  },
  proTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
  proDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  watchAdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  watchAdTextContainer: {
    alignItems: 'flex-start',
  },
  watchAdText: {
    fontSize: 15,
    fontWeight: '600',
  },
  watchAdSubText: {
    fontSize: 12,
    marginTop: 1,
  },
  // URL 목록 스타일
  urlListContainer: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
    marginLeft: 4,
  },
  urlListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  urlListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  urlStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  urlListItemText: {
    flex: 1,
  },
  urlListItemName: {
    fontSize: 14,
    marginBottom: 2,
  },
  urlListItemUrl: {
    fontSize: 12,
  },
  // 개발자 옵션 스타일
  devOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  devOptionText: {
    flex: 1,
  },
  devOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devModeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devModeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
