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
  Platform,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import MaterialPressable from '../components/MaterialPressable';
import { loadHardwareKeySettings, confirmKeyOf } from '../utils/hardwareKeys';
import haptics, { loadHapticSettings, saveHapticSettings, HAPTIC_INTENSITIES, HAPTIC_PATTERNS } from '../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTabBarOverlap } from '../hooks/useTabBarOverlap';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { languages } from '../locales';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import LockIcon from '../components/LockIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner, { AD_ENABLED } from '../components/AdBanner';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';

// 로컬 테스트 빌드에서만 개발자 옵션 메뉴를 보인다 (EXPO_PUBLIC_DEV_OPTIONS=1 로 빌드). 스토어 빌드(EAS)는 이 값이 없다
const SHOW_DEV_OPTIONS = process.env.EXPO_PUBLIC_DEV_OPTIONS === '1';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t, fonts } = useLanguage();
  const { themeMode, isDark } = useTheme();
  const { user, isLoggedIn } = useAuth();
  const { isLocked, showUnlockAlert, devModeEnabled, toggleDevMode, resetAllLocks } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const tabBarOverlap = useTabBarOverlap(); // 탭바에 가려지는 높이 (목록 끝 여백)

  // 노치 없는 SE(inset 20)부터 Dynamic Island(59)까지 대응하도록 insets 기준으로 계산
  const statusBarHeight = insets.top + (Platform.OS === 'ios' ? 23 : 20);

  const [on, setOn] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true);
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(true); // 기본값: 켬
  const [continuousScanEnabled, setContinuousScanEnabled] = useState(false);
  const [multiCodeModeEnabled, setMultiCodeModeEnabled] = useState(false); // 여러 코드 인식 모드
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false); // 복권 인식
  const [resultWindowAutoOpen, setResultWindowAutoOpen] = useState(true); // 결과창 자동 열림 (기본값: true)
  const [singleCodeShowValue, setSingleCodeShowValue] = useState(false); // 일반 스캔에서도 인식된 값 표시
  const [quantityMode, setQuantityMode] = useState(false); // 같은 코드 → 수량 +1
  const [nfcReadEnabled, setNfcReadEnabled] = useState(true); // NFC 태그 읽기
  // 진동 세기·패턴 (Android 기본 진동이 약하고 탁하다는 피드백)
  const [hapticIntensity, setHapticIntensity] = useState('medium');
  const [hapticPattern, setHapticPattern] = useState('tap');
  useEffect(() => {
    loadHapticSettings().then(({ intensity, pattern }) => {
      setHapticIntensity(intensity);
      setHapticPattern(pattern);
    });
  }, []);
  // 고르면 바로 그 느낌으로 한 번 울린다
  const changeHaptic = async (next) => {
    const intensity = next.intensity || hapticIntensity;
    const pattern = next.pattern || hapticPattern;
    setHapticIntensity(intensity);
    setHapticPattern(pattern);
    await saveHapticSettings({ intensity, pattern });
    haptics.scan({ intensity, pattern });
  };
  const [selectedBarcodesCount, setSelectedBarcodesCount] = useState(13); // 기본값: 모든 바코드 타입 (13개)

  // 실시간 서버전송 상태 (켬/끔 표시용)
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  // URL 열기 방식 상태
  const [urlOpenMode, setUrlOpenMode] = useState('inApp');
  const [scanRegionMode, setScanRegionMode] = useState('full');
  const [hardwareKeySettings, setHardwareKeySettings] = useState({ keyMap: {}, scanConfirmMode: 'auto' });
  // 사진 압축률 상태
  const [photoQuality, setPhotoQuality] = useState('0.5'); // 기본값: 중간
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
          setSelectedBarcodesCount(parsed.length || 13);
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
        const savedScanRegion = await AsyncStorage.getItem('scanRegionMode');
        setScanRegionMode(savedScanRegion || 'full');
        loadHardwareKeySettings().then(setHardwareKeySettings).catch(() => {});

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
            setSelectedBarcodesCount(parsed.length || 13);
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
          const savedScanRegion = await AsyncStorage.getItem('scanRegionMode');
          setScanRegionMode(savedScanRegion || 'full');
        loadHardwareKeySettings().then(setHardwareKeySettings).catch(() => {});

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
          setSingleCodeShowValue((await AsyncStorage.getItem('singleCodeShowValue')) === 'true');
          setQuantityMode((await AsyncStorage.getItem('quantityMode')) === 'true');
          setNfcReadEnabled((await AsyncStorage.getItem('nfcReadEnabled')) !== 'false');

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

          // 서버와 광고 기록 동기화는 탭 레이아웃에서 처리 (_layout.tsx/android.tsx)
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

  // 지금 켜져 있는 고급 스캔 모드 (상호 배타)
  const activeScanMode = continuousScanEnabled
    ? { icon: 'repeat', labelKey: 'continuousScan.title' }
    : multiCodeModeEnabled
      ? { icon: 'grid-outline', labelKey: 'settings.multiCodeMode' }
      : lotteryScanEnabled
        ? { icon: 'ticket-outline', labelKey: 'settings.lotteryScan' }
        : realtimeSyncEnabled
          ? { icon: 'cloud-upload-outline', labelKey: 'settings.enableRealtimeSync' }
          : on
            ? { icon: 'link-outline', labelKey: 'settings.useScanUrl' }
            : { icon: 'scan-outline', labelKey: 'settings.normalScanMode' };


  // 공통 디자인 규칙: 스위치는 강조색 하나, 꺼짐 트랙은 테두리 톤
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };
  // 상단 그라데이션은 화면 바탕색에서 투명으로
  const bgRgb = [1, 3, 5].map(i => parseInt(colors.background.slice(i, i + 2), 16)).join(',');
  const rowProps = { colors, fonts };
  const statusProps = (enabled) => ({
    value: enabled ? t('settings.statusOn') : t('settings.statusOff'),
    valueColor: enabled ? colors.success : colors.textSecondary,
  });
  const profileInitial = (user?.name || '').trim().charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 상단 그라데이션 */}
      <LinearGradient
        colors={[`rgba(${bgRgb},1)`, `rgba(${bgRgb},0.95)`, `rgba(${bgRgb},0.7)`, `rgba(${bgRgb},0.3)`, `rgba(${bgRgb},0)`]}
        locations={[0, 0.3, 0.6, 0.85, 1]}
        style={[s.statusBarGradient, { height: statusBarHeight }]}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={[s.c, { backgroundColor: colors.background }]} contentContainerStyle={[s.content, { paddingBottom: tabBarOverlap + 32 }]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.bold }]}>{t('settings.title')}</Text>
        </View>

        {/* 로그인/프로필 섹션 */}
        {isLoggedIn ? (
          // 로그인된 상태 - 프로필 표시
          <MaterialPressable accessibilityRole="button"
            style={[s.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/profile-settings')}
            activeOpacity={0.7}
          >
            <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
              {profileInitial ? (
                <Text style={[s.avatarInitial, { color: colors.primaryText, fontFamily: fonts.bold }]}>{profileInitial}</Text>
              ) : (
                <Ionicons name="person" size={22} color={colors.primaryText} />
              )}
            </View>
            <View style={s.accountText}>
              <View style={s.profileNameRow}>
                <Text style={[s.accountTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
                  {user?.name || 'User'}
                </Text>
                <Text style={[s.profileNameSuffix, { color: colors.text, fontFamily: fonts.regular }]}>
                  {' '}{language === 'ko' ? '님' : ''}
                </Text>
              </View>
              {!!user?.email && (
                <Text style={[s.accountSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </MaterialPressable>
        ) : (
          // 로그인 안된 상태 - 로그인 유도
          <MaterialPressable accessibilityRole="button"
            style={[s.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
          >
            <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="person" size={22} color={colors.primaryText} />
            </View>
            <View style={s.accountText}>
              <Text style={[s.accountTitle, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>
                {t('auth.loginSignup')}
              </Text>
              <Text style={[s.accountSubtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('auth.loginPrompt')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </MaterialPressable>
        )}

        {/* 배너 광고 - AD_ENABLED일 때만 표시 */}
        {AD_ENABLED && (
          <View style={[s.adSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AdBanner />
          </View>
        )}

        {/* Pro 버전 - TODO: 추후 프로버전 출시 시 주석 해제
        <View style={s.proSection}>
          <MaterialPressable accessibilityRole="button" onPress={() => router.push('/pro-version')} activeOpacity={0.7}>
            <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.proBanner}>
              <View style={s.proBannerContent}>
                <Ionicons name="diamond" size={24} color="#fff" />
                <View style={s.proBannerText}>
                  <Text style={[s.proTitle, { fontFamily: fonts.semiBold }]}>{t('proVersion.title')}</Text>
                  <Text style={[s.proDesc, { fontFamily: fonts.regular }]}>{t('proVersion.description')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </LinearGradient>
          </MaterialPressable>
          <SettingRow {...rowProps}
            icon="play-circle-outline"
            label={t('proVersion.watchAd')}
            desc={t('proVersion.freeUnlock')}
            onPress={() => router.push('/pro-features')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
        </View>
        */}

        {/* 광고보기 - 기능 잠금 해제 (AD_ENABLED일 때만 표시) */}
        {AD_ENABLED && (
          <MaterialPressable accessibilityRole="button"
            style={s.proSection}
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
                  <Text style={[s.proTitle, { fontFamily: fonts.semiBold }]}>{t('proVersion.watchAd')}</Text>
                  <Text style={[s.proDesc, { fontFamily: fonts.regular }]}>{t('proVersion.freeUnlock')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </LinearGradient>
          </MaterialPressable>
        )}

        {/* 고급 스캔 기능 섹션 */}
        <SectionHeader {...rowProps} title={t('settings.advancedScanFeatures')} />
        <Group colors={colors}>
          {/* 아래 모드들은 하나를 켜면 나머지가 꺼진다. 각각 독립 스위치처럼 보여 헷갈렸으므로 관계를 드러낸다 */}
          <View style={s.infoBoxWrap}>
            <View style={[s.infoBox, { backgroundColor: colors.raised }]}>
              <Ionicons name={activeScanMode.icon} size={20} color={colors.textSecondary} />
              <View style={s.infoBoxText}>
                <Text style={[s.infoBoxTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {t('settings.currentScanMode', { mode: t(activeScanMode.labelKey) })}
                </Text>
                <Text style={[s.infoBoxDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('settings.scanModeExclusiveHint')}
                </Text>
              </View>
            </View>
          </View>

          {/* 자동 규칙 */}
          <SettingRow {...rowProps}
            label={t('scanRules.title')}
            desc={t('settings.scanRulesDesc')}
            onPress={() => router.push('/scan-rules')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 재고 실사 */}
          <SettingRow {...rowProps}
            label={t('stocktake.title')}
            desc={t('settings.stocktakeDesc')}
            onPress={() => router.push('/stocktakes')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 연속 스캔 모드 */}
          <SettingRow {...rowProps}
            label={t('continuousScan.title') || t('settings.batchScanMode')}
            desc={t('continuousScan.description') || t('settings.batchScanModeDesc')}
            onPress={() => {
              if (isLocked('batchScan')) {
                showUnlockAlert('batchScan', () => router.push('/continuous-scan-settings'));
              } else {
                router.push('/continuous-scan-settings');
              }
            }}
          >
            <NavRight {...rowProps} lockFeature="batchScan" {...statusProps(continuousScanEnabled)} />
          </SettingRow>

          {/* 여러 코드 인식 모드 */}
          <SettingRow {...rowProps}
            label={t('settings.multiCodeMode')}
            desc={t('settings.multiCodeModeDesc')}
            onPress={() => router.push('/multi-code-mode-settings')}
          >
            <NavRight {...rowProps} {...statusProps(multiCodeModeEnabled)} />
          </SettingRow>

          {/* 스캔 연동 URL (+ 활성화 시 URL 목록) */}
          <View>
            <SettingRow {...rowProps}
              label={t('settings.useScanUrl')}
              desc={t('settings.useScanUrlDesc')}
              onPress={() => {
                if (isLocked('scanUrlIntegration')) {
                  showUnlockAlert('scanUrlIntegration', () => router.push('/scan-url-settings'));
                } else {
                  router.push('/scan-url-settings');
                }
              }}
            >
              <NavRight {...rowProps} lockFeature="scanUrlIntegration" {...statusProps(on)} />
            </SettingRow>

            {/* 스캔 연동 URL 목록 - 활성화 시에만 표시 */}
            {on && scanUrlList.length > 0 && (
              <View style={s.urlListWrap}>
                <View style={[s.urlListContainer, { backgroundColor: colors.raised }]}>
                  {scanUrlList.map((item, index) => (
                    <View key={item.id} style={[s.urlListItem, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View style={[s.urlStatusDot, { backgroundColor: item.enabled ? colors.success : colors.textTertiary }]} />
                      <View style={s.urlListItemText}>
                        <Text style={[s.urlListItemName, { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[s.urlListItemUrl, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                          {item.url}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* 실시간 서버전송 */}
          <SettingRow {...rowProps}
            label={t('settings.enableRealtimeSync')}
            desc={t('settings.realtimeSyncDesc')}
            onPress={() => {
              if (isLocked('realtimeSync')) {
                showUnlockAlert('realtimeSync', () => {
                  // 설명은 처음 한 번만 보여 주고, 그다음부터는 바로 설정으로
                  router.push(realtimeSyncExplained ? '/realtime-sync-settings' : '/realtime-sync-explanation');
                });
              } else {
                // 설명은 처음 한 번만 보여 주고, 그다음부터는 바로 설정으로
                router.push(realtimeSyncExplained ? '/realtime-sync-settings' : '/realtime-sync-explanation');
              }
            }}
          >
            <NavRight {...rowProps} lockFeature="realtimeSync" {...statusProps(realtimeSyncEnabled)} />
          </SettingRow>

          {/* 복권 인식 */}
          <SettingRow {...rowProps}
            label={t('settings.lotteryScan')}
            desc={t('settings.lotteryScanDesc')}
            onPress={() => {
              if (isLocked('lotteryScan')) {
                showUnlockAlert('lotteryScan', () => router.push('/lottery-scan-settings'));
              } else {
                router.push('/lottery-scan-settings');
              }
            }}
          >
            <NavRight {...rowProps} lockFeature="lotteryScan" {...statusProps(lotteryScanEnabled)} />
          </SettingRow>
        </Group>

        {/* 알림 섹션 */}
        <SectionHeader {...rowProps} title={t('settings.scanFeedback')} />
        <Group colors={colors}>
          {/* 햅틱 피드백 (+ 켜져 있을 때 세기·패턴) */}
          <View>
            <SettingRow {...rowProps}
              label={t('settings.hapticFeedback')}
              desc={t('settings.hapticDesc')}
            >
              <Switch
                value={hapticEnabled}
                onValueChange={setHapticEnabled}
                {...switchColors}
                accessibilityLabel={t('settings.hapticFeedback')}
              />
            </SettingRow>

            {/* 진동 세기 · 패턴 (진동이 켜져 있을 때만) */}
            {hapticEnabled && (
              <View style={s.hapticOptions}>
                <Text style={[s.hapticOptionLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>{t('settings.hapticIntensity')}</Text>
                <View style={[s.segment, { backgroundColor: colors.raised }]}>
                  {HAPTIC_INTENSITIES.map(level => {
                    const selected = hapticIntensity === level;
                    return (
                      <MaterialPressable
                        key={level}
                        style={[s.segmentItem, selected && { backgroundColor: colors.primary }]}
                        onPress={() => changeHaptic({ intensity: level })}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[s.segmentText, { color: selected ? '#fff' : colors.text, fontFamily: fonts.semiBold }]}>
                          {t(`settings.hapticIntensities.${level}`)}
                        </Text>
                      </MaterialPressable>
                    );
                  })}
                </View>
                <Text style={[s.hapticOptionLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold, marginTop: 14 }]}>{t('settings.hapticPattern')}</Text>
                <View style={[s.segment, { backgroundColor: colors.raised }]}>
                  {HAPTIC_PATTERNS.map(pattern => {
                    const selected = hapticPattern === pattern;
                    return (
                      <MaterialPressable
                        key={pattern}
                        style={[s.segmentItem, selected && { backgroundColor: colors.primary }]}
                        onPress={() => changeHaptic({ pattern })}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[s.segmentText, { color: selected ? '#fff' : colors.text, fontFamily: fonts.semiBold }]}>
                          {t(`settings.hapticPatterns.${pattern}`)}
                        </Text>
                      </MaterialPressable>
                    );
                  })}
                </View>
                <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 8 }]}>{t('settings.hapticPatternDesc')}</Text>
              </View>
            )}
          </View>

          {/* 스캔 소리 */}
          <SettingRow {...rowProps}
            label={t('settings.scanSound')}
            desc={t('settings.scanSoundDesc')}
          >
            <Switch
              value={scanSoundEnabled}
              onValueChange={setScanSoundEnabled}
              {...switchColors}
              accessibilityLabel={t('settings.scanSound')}
            />
          </SettingRow>
        </Group>

        {/* 스캔 섹션 */}
        <SectionHeader {...rowProps} title={t('settings.scan')} />
        <Group colors={colors}>
          {/* 바코드 선택 */}
          <SettingRow {...rowProps}
            label={t('settings.selectBarcodes')}
            desc={`${selectedBarcodesCount}${t('settings.selectedCount')}`}
            onPress={() => router.push('/barcode-selection')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 카메라 선택 */}
          <SettingRow {...rowProps}
            label={t('settings.cameraSelection')}
            desc={t('settings.cameraSelectionDesc')}
            onPress={() => router.push('/camera-selection')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 사진 저장 */}
          <SettingRow {...rowProps}
            label={t('settings.photoSave')}
            desc={photoSaveEnabled ? getQualityFullLabel(photoQuality) : t('settings.photoSaveDesc')}
            onPress={() => {
              if (isLocked('photoSave')) {
                showUnlockAlert('photoSave', () => router.push('/photo-save-settings'));
              } else {
                router.push('/photo-save-settings');
              }
            }}
          >
            <NavRight {...rowProps} lockFeature="photoSave" {...statusProps(photoSaveEnabled)} />
          </SettingRow>

          {/* URL 열기 방식 */}
          <SettingRow {...rowProps}
            label={t('urlOpenMode.title')}
            onPress={() => router.push('/url-open-mode-selection')}
          >
            <NavRight {...rowProps} value={t(`urlOpenMode.${urlOpenMode}`)} />
          </SettingRow>

          {/* 하드웨어 키 · 수동 확정 */}
          <SettingRow {...rowProps}
            label={t('hardwareKeys.title')}
            desc={(() => {
              if (hardwareKeySettings.scanConfirmMode !== 'manual') return t('scanConfirm.autoStatus');
              const key = Platform.OS === 'android' ? confirmKeyOf(hardwareKeySettings.keyMap) : null;
              return key ? t('scanConfirm.manualStatus', { key: t(`hardwareKeys.${key}`) }) : t('scanConfirm.manualStatusButton');
            })()}
            onPress={() => router.push('/hardware-keys')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 스캔 영역 제한 */}
          <SettingRow {...rowProps}
            label={t('scanRegion.title')}
            onPress={() => router.push('/scan-region-selection')}
          >
            <NavRight {...rowProps} value={t(`scanRegion.${scanRegionMode}`)} />
          </SettingRow>

          {/* 라벨 카테고리 (구분자로 나뉜 코드를 필드로) */}
          <SettingRow {...rowProps}
            label={t('settings.labelCategories')}
            desc={t('settings.labelCategoriesDesc')}
            onPress={() => router.push('/label-categories')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 수량 누적 */}
          <SettingRow {...rowProps}
            label={t('quantity.mode')}
            desc={t('quantity.modeDesc')}
          >
            <Switch
              value={quantityMode}
              onValueChange={async (value) => {
                setQuantityMode(value);
                try {
                  await AsyncStorage.setItem('quantityMode', value.toString());
                } catch (error) {
                  setQuantityMode(!value);
                }
              }}
              {...switchColors}
              accessibilityLabel={t('quantity.mode')}
            />
          </SettingRow>

          {/* NFC 태그 읽기 */}
          <SettingRow {...rowProps}
            label={t('nfc.setting')}
            desc={Platform.OS === 'ios' ? t('nfc.settingDescIos') : t('nfc.settingDesc')}
          >
            <Switch
              value={nfcReadEnabled}
              onValueChange={async (value) => {
                setNfcReadEnabled(value);
                try {
                  await AsyncStorage.setItem('nfcReadEnabled', value.toString());
                } catch (error) {
                  setNfcReadEnabled(!value);
                }
              }}
              {...switchColors}
              accessibilityLabel={t('nfc.setting')}
            />
          </SettingRow>

          {/* 인식된 코드 값 표시 (일반 스캔) */}
          <SettingRow {...rowProps}
            label={t('settings.singleCodeShowValue')}
            desc={t('settings.singleCodeShowValueDesc')}
          >
            <Switch
              value={singleCodeShowValue}
              onValueChange={async (value) => {
                setSingleCodeShowValue(value);
                try {
                  await AsyncStorage.setItem('singleCodeShowValue', value.toString());
                } catch (error) {
                  console.error('Save singleCodeShowValue error:', error);
                  setSingleCodeShowValue(!value);
                }
              }}
              {...switchColors}
              accessibilityLabel={t('settings.singleCodeShowValue')}
            />
          </SettingRow>

          {/* 결과창 자동 열림 */}
          <SettingRow {...rowProps}
            label={t('settings.resultWindowAutoOpen')}
            desc={t('settings.resultWindowAutoOpenDesc')}
            onPress={() => router.push('/result-window-settings')}
          >
            <NavRight {...rowProps} {...statusProps(resultWindowAutoOpen)} />
          </SettingRow>
        </Group>

        {/* 제품 검색 - 임시 비활성화
        <SectionHeader {...rowProps} title={t('settings.productSearchSection')} />
        <Group colors={colors}>
          <SettingRow {...rowProps}
            label={t('productSearch.title')}
            desc={t('productSearch.description')}
            onPress={() => {
              if (isLocked('productSearch')) {
                showUnlockAlert('productSearch', () => router.push('/product-search-settings'));
              } else {
                router.push('/product-search-settings');
              }
            }}
          >
            <NavRight {...rowProps} lockFeature="productSearch" {...statusProps(productAutoSearch)} />
          </SettingRow>
        </Group>
        */}

        {/* 데이터 섹션 */}
        <SectionHeader {...rowProps} title={t('settings.data')} />
        <Group colors={colors}>
          {/* 기록 내보내기 */}
          <SettingRow {...rowProps}
            label={t('settings.exportHistory')}
            desc={t('settings.exportHistoryDesc')}
            onPress={() => router.push('/export-history')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 백업 내보내기 */}
          <SettingRow {...rowProps}
            label={t('backupExport.title')}
            desc={t('backupExport.description')}
            onPress={() => router.push('/backup-export')}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 백업 가져오기 */}
          <SettingRow {...rowProps}
            label={t('backupImport.title')}
            desc={t('backupImport.description')}
            onPress={() => router.push('/backup-import')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
        </Group>

        {/* 일반 섹션 */}
        <SectionHeader {...rowProps} title={t('settings.general')} />
        <Group colors={colors}>
          {/* 언어 선택 */}
          <SettingRow {...rowProps}
            label={t('settings.languageSelection')}
            onPress={() => router.push('/language-selection')}
          >
            <NavRight {...rowProps} value={languages.find(lang => lang.code === language)?.name || '한국어'} />
          </SettingRow>

          {/* 화면 모드 선택 */}
          <SettingRow {...rowProps}
            label={t('settings.displayMode')}
            onPress={() => router.push('/display-mode-selection')}
          >
            <NavRight {...rowProps} value={t(`displayModeSelection.${themeMode}`)} />
          </SettingRow>

          {/* 인증/보안 */}
          <SettingRow {...rowProps}
            label={t('security.title') || '인증/보안'}
            desc={t('security.settingsDesc') || '앱 잠금, 생체인증 설정'}
            onPress={() => router.push('/security-settings')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
        </Group>

        {/* 앱 정보 및 지원 */}
        <SectionHeader {...rowProps} title={t('settings.appInfo')} />
        <Group colors={colors}>
          {/* 개선제안하기 - 임시 주석처리
          <SettingRow {...rowProps}
            label={t('settings.suggestImprovement')}
            desc={t('settings.suggestImprovementDesc')}
            onPress={() => Alert.alert(t('settings.suggestImprovement'), '준비 중입니다')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
          */}

          {/* 1:1 문의하기 - 임시 주석처리
          <SettingRow {...rowProps}
            label={t('settings.oneOnOneInquiry')}
            desc={t('settings.oneOnOneInquiryDesc')}
            onPress={() => Alert.alert(t('settings.oneOnOneInquiry'), '준비 중입니다')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
          */}

          {/* 서비스 이용약관 */}
          <SettingRow {...rowProps}
            label={t('settings.termsOfService')}
            desc={t('settings.termsOfServiceDesc')}
            onPress={() => router.push({
              pathname: '/webview',
              params: { url: `https://scanview.app/legal/terms?lang=${language}&theme=${isDark ? 'dark' : 'light'}` }
            })}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 개인정보 처리방침 */}
          <SettingRow {...rowProps}
            label={t('settings.privacyPolicy')}
            desc={t('settings.privacyPolicyDesc')}
            onPress={() => router.push({
              pathname: '/webview',
              params: { url: `https://scanview.app/legal/privacy?lang=${language}&theme=${isDark ? 'dark' : 'light'}` }
            })}
          >
            <NavRight {...rowProps} />
          </SettingRow>

          {/* 사용 분석 동의 */}
          <SettingRow {...rowProps}
            label={t('settings.analyticsConsent') || '사용 분석 동의'}
            desc={t('settings.analyticsConsentDesc') || '앱 개선을 위한 익명 사용 데이터 수집'}
          >
            <Switch
              value={analyticsEnabled}
              onValueChange={handleAnalyticsToggle}
              {...switchColors}
              accessibilityLabel={t('settings.analyticsConsent')}
            />
          </SettingRow>

          {/* 버전정보 */}
          <SettingRow {...rowProps}
            label={t('settings.versionInfo')}
            desc={t('settings.currentVersion')}
          >
            <Text style={[s.value, { color: colors.textSecondary, fontFamily: fonts.medium }]}>1.1.2</Text>
          </SettingRow>

          {/* 캐시 삭제 */}
          <SettingRow {...rowProps}
            label={t('settings.clearCache') || '캐시 삭제'}
            desc={t('settings.clearCacheDesc') || '저장된 스캔 사진을 삭제합니다'}
            onPress={handleClearCache}
          >
            <NavRight {...rowProps} value={isCalculatingCache ? '...' : formatCacheSize(cacheSize)} />
          </SettingRow>
        </Group>

        {/* 개발자 옵션: 스토어 빌드에는 안 보인다 (기능 잠금 해제가 들어 있어서).
            로컬 테스트 빌드만 EXPO_PUBLIC_DEV_OPTIONS=1 로 빌드하면 보인다 — 번들 시점에 값이 박힌다 */}
        {SHOW_DEV_OPTIONS && (
        <Group colors={colors} style={s.devGroup}>
          <SettingRow {...rowProps}
            icon="code-slash"
            iconColor={colors.warning}
            labelColor={colors.warning}
            label={t('settings.developerOptions')}
            desc={t('settings.devModeDesc')}
            onPress={() => router.push('/developer-options')}
          >
            {devModeEnabled && (
              <View style={[s.softBadge, { backgroundColor: colors.warningSoft }]}>
                <Text style={[s.softBadgeText, { color: colors.warning, fontFamily: fonts.semiBold }]}>{t('settings.statusOn')}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </SettingRow>
        </Group>
        )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

// 섹션 머리글: 카드 밖, 보조 글자색
function SectionHeader({ title, colors, fonts }) {
  return (
    <Text accessibilityRole="header" style={[s.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
      {title}
    </Text>
  );
}

// 묶음 카드: 행 사이에 얇은 구분선
function Group({ colors, style, children }) {
  const items = React.Children.toArray(children);
  return (
    <View style={[s.group, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {items.map((child, i) => (
        <React.Fragment key={child.key ?? i}>
          {i > 0 && <View style={[s.separator, { backgroundColor: colors.borderLight }]} />}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

// 목록 행: 왼쪽 라벨(+설명), 오른쪽 값·스위치·화살표. onPress가 있으면 누를 수 있는 행
function SettingRow({ colors, fonts, label, desc, onPress, icon, iconColor, labelColor, children }) {
  const hasRight = React.Children.toArray(children).length > 0;
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={20} color={iconColor || colors.textSecondary} /> : null}
      <View style={s.rowText}>
        <Text style={[s.label, { color: labelColor || colors.text, fontFamily: fonts.medium }]}>{label}</Text>
        {!!desc && <Text style={[s.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{desc}</Text>}
      </View>
      {hasRight ? <View style={s.rowRight}>{children}</View> : null}
    </>
  );
  const rowStyle = [s.row, desc ? s.rowWithDesc : null];
  if (onPress) {
    return (
      <MaterialPressable accessibilityRole="button" style={rowStyle} onPress={onPress} activeOpacity={0.7}>
        {content}
      </MaterialPressable>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

// 이동 행 오른쪽: (잠금 배지) 값 글자 + 화살표
function NavRight({ colors, fonts, value, valueColor, lockFeature }) {
  return (
    <>
      {lockFeature ? (
        <LockIcon featureId={lockFeature} size={12} badge style={[s.softBadge, s.lockBadge, { backgroundColor: colors.errorSoft }]} />
      ) : null}
      {value ? (
        <Text style={[s.value, { color: valueColor || colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </>
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
    paddingHorizontal: SPACE.screen,
    paddingBottom: 120, // 실제 값은 탭바 높이 기준으로 인라인에서 덮어쓴다
    gap: SPACE.gap,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  title: {
    ...TYPE.tabTitle,
  },
  // 계정 카드
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
  },
  accountText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  profileNameSuffix: {
    fontSize: 15,
  },
  accountSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  // 섹션 · 묶음 카드
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
  separator: {
    height: 1,
  },
  devGroup: {
    marginTop: 14,
  },
  // 목록 행
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    maxWidth: '50%',
  },
  label: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  value: {
    fontSize: 13,
    flexShrink: 1,
  },
  softBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
  },
  softBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lockBadge: {
    marginLeft: 0,
    paddingHorizontal: 6,
  },
  // 안내 상자 (스캔 모드 상호 배타 안내)
  infoBoxWrap: {
    padding: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.control,
  },
  infoBoxText: {
    flex: 1,
    gap: 2,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBoxDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  // 진동 세기 · 패턴
  hapticOptions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  hapticOptionLabel: {
    ...TYPE.sectionHeader,
    marginBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: SIZE.touch,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 14,
  },
  // URL 목록
  urlListWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  urlListContainer: {
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
  },
  urlListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
  // 광고
  adSection: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
    overflow: 'hidden',
  },
  proSection: {
    borderRadius: RADIUS.group,
    overflow: 'hidden',
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: SIZE.rowWithDesc,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  proDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
});
