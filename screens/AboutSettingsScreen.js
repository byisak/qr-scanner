// screens/AboutSettingsScreen.js - 설정 > 정보: 문의하기 / 이용약관 · 개인정보처리방침 · 사용 분석 동의 · 버전
// 약관·방침·분석 동의 행은 예전 SettingsScreen.js "앱 정보 및 지원" 섹션에서 그대로 옮겨 왔다.
// "준비 중"만 뜨던 개선 제안·1:1 문의는 메일 앱을 여는 "문의하기" 하나로 바꿨다
import React, { useState, useEffect } from 'react';
import { Text, Switch, Alert, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';
import { SettingsSubScreen, Group, SettingRow, NavRight, settingsStyles as s, useSettingsUi } from '../components/SettingsKit';

export const SUPPORT_EMAIL = 'support@scanview.app';
export const APP_VERSION = Constants.expoConfig?.version || '';

export default function AboutSettingsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const feedback = useFeedback();
  const { t, colors, fonts, isDark, switchColors, rowProps } = useSettingsUi();

  // 분석 동의 상태
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  useEffect(() => {
    getAnalyticsConsent().then(setAnalyticsEnabled).catch(() => {});
  }, []);

  // 분석 동의 토글
  const handleAnalyticsToggle = async (value) => {
    setAnalyticsEnabled(value);
    await setAnalyticsConsent(value);
  };

  // 메일 앱을 연다. 메일 앱이 없으면 주소를 보여 주고 복사할 수 있게 한다
  const handleContact = async () => {
    const subject = `${t('settingsHub.contactSubject')} (v${APP_VERSION}, ${Platform.OS})`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        t('settingsHub.noMailTitle'),
        t('settingsHub.noMailMessage', { email: SUPPORT_EMAIL }),
        [
          { text: t('common.close'), style: 'cancel' },
          {
            text: t('settingsHub.copyEmail'),
            onPress: async () => {
              await Clipboard.setStringAsync(SUPPORT_EMAIL);
              feedback.success(t('settingsHub.emailCopied'));
            },
          },
        ]
      );
    }
  };

  return (
    <SettingsSubScreen title={t('settingsHub.info')}>
      <Group colors={colors}>
        {/* 문의하기 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.contact')}
          desc={SUPPORT_EMAIL}
          onPress={handleContact}
        >
          <NavRight {...rowProps} />
        </SettingRow>
      </Group>

      <Group colors={colors} style={{ marginTop: 6 }}>
        {/* 서비스 이용약관 */}
        <SettingRow {...rowProps}
          label={t('settings.termsOfService')}
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
          label={t('settingsHub.version')}
        >
          <Text style={[s.value, { color: colors.textSecondary, fontFamily: fonts.medium }]}>{APP_VERSION}</Text>
        </SettingRow>
      </Group>
    </SettingsSubScreen>
  );
}
