// screens/SettingsScreen.js - 설정 화면
// 첫 화면은 계정 카드 + 묶음 이동 행만 둔다. 세부 항목은 묶음별 하위 화면으로 옮겼다
//   스캔 → ScanSettingsScreen · 소리·진동 → SoundSettingsScreen · 업무 기능 → WorkFeaturesScreen
//   데이터 → DataSettingsScreen · 일반 → GeneralSettingsScreen · 정보 → AboutSettingsScreen
// 복권 인식 행은 숨겼다 (코드와 저장된 값은 그대로: /lottery-scan-settings, lotteryScanEnabled)
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialPressable from '../components/MaterialPressable';
import { loadHapticSettings } from '../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTabBarOverlap } from '../hooks/useTabBarOverlap';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { languages } from '../locales';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner, { AD_ENABLED } from '../components/AdBanner';
import { SectionHeader, Group, SettingRow, NavRight } from '../components/SettingsKit';
import { loadWorkFeatureStates, COUNTED_WORK_FEATURES } from './WorkFeaturesScreen';
import { APP_VERSION } from './AboutSettingsScreen';

// 로컬 테스트 빌드에서만 개발자 옵션 메뉴를 보인다 (EXPO_PUBLIC_DEV_OPTIONS=1 로 빌드). 스토어 빌드(EAS)는 이 값이 없다
const SHOW_DEV_OPTIONS = process.env.EXPO_PUBLIC_DEV_OPTIONS === '1';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, t, fonts } = useLanguage();
  const { themeMode, isDark } = useTheme();
  const { user, isLoggedIn } = useAuth();
  const { devModeEnabled } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const tabBarOverlap = useTabBarOverlap(); // 탭바에 가려지는 높이 (목록 끝 여백)

  // 노치 없는 SE(inset 20)부터 Dynamic Island(59)까지 대응하도록 insets 기준으로 계산
  const statusBarHeight = insets.top + (Platform.OS === 'ios' ? 23 : 20);

  // 묶음 행 요약용 상태 (읽기만 한다. 바꾸는 건 하위 화면)
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [hapticIntensity, setHapticIntensity] = useState('medium');
  const [workOnCount, setWorkOnCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [[, ss], [, h]] = await AsyncStorage.multiGet(['scanSoundEnabled', 'hapticEnabled']);
          setScanSoundEnabled(ss === null ? true : ss === 'true');
          setHapticEnabled(h === null ? true : h === 'true');
          const { intensity } = await loadHapticSettings();
          setHapticIntensity(intensity);
          const states = await loadWorkFeatureStates();
          setWorkOnCount(COUNTED_WORK_FEATURES.filter(key => states[key]).length);
        } catch (error) {
          console.error('Load settings summary error:', error);
        }
      })();
    }, [])
  );

  // 상단 그라데이션은 화면 바탕색에서 투명으로
  const bgRgb = [1, 3, 5].map(i => parseInt(colors.background.slice(i, i + 2), 16)).join(',');
  const rowProps = { colors, fonts };
  const profileInitial = (user?.name || '').trim().charAt(0).toUpperCase();

  const soundSummary = t('settingsHub.soundSummary', {
    sound: scanSoundEnabled ? t('settings.statusOn') : t('settings.statusOff'),
    haptic: hapticEnabled ? t(`settings.hapticIntensities.${hapticIntensity}`) : t('settings.statusOff'),
  });
  const workSummary = workOnCount > 0 ? t('settingsHub.workOnCount', { count: workOnCount }) : t('settingsHub.workNoneOn');
  const languageName = languages.find(lang => lang.code === language)?.name || '한국어';
  const generalSummary = `${languageName} · ${t(`displayModeSelection.${themeMode}`)}`;

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

        {/* 스캔 묶음 */}
        <SectionHeader {...rowProps} title={t('settingsHub.sectionScan')} />
        <Group colors={colors}>
          <SettingRow {...rowProps} iconBox
            icon="scan-outline"
            label={t('settingsHub.scan')}
            desc={t('settingsHub.scanSummary')}
            onPress={() => router.push('/settings-scan')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
          <SettingRow {...rowProps} iconBox
            icon="volume-high-outline"
            label={t('settingsHub.sound')}
            desc={soundSummary}
            onPress={() => router.push('/settings-sound')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
          <SettingRow {...rowProps} iconBox
            icon="briefcase-outline"
            label={t('settingsHub.work')}
            desc={workSummary}
            onPress={() => router.push('/settings-work')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
        </Group>

        {/* 앱 묶음 */}
        <SectionHeader {...rowProps} title={t('settingsHub.sectionApp')} />
        <Group colors={colors}>
          <SettingRow {...rowProps} iconBox
            icon="folder-outline"
            label={t('settingsHub.data')}
            desc={t('settingsHub.dataSummary')}
            onPress={() => router.push('/settings-data')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
          <SettingRow {...rowProps} iconBox
            icon="options-outline"
            label={t('settingsHub.general')}
            desc={generalSummary}
            onPress={() => router.push('/settings-general')}
          >
            <NavRight {...rowProps} />
          </SettingRow>
          <SettingRow {...rowProps} iconBox
            icon="information-circle-outline"
            label={t('settingsHub.info')}
            desc={t('settingsHub.infoSummary', { version: APP_VERSION })}
            onPress={() => router.push('/settings-about')}
          >
            <NavRight {...rowProps} />
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
  devGroup: {
    marginTop: 14,
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
