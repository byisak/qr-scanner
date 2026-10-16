// screens/GeneralSettingsScreen.js - 설정 > 일반: 언어 · 화면 모드 · 앱 잠금
// 행은 예전 SettingsScreen.js "일반" 섹션에서 그대로 옮겨 왔다
import React from 'react';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../locales';
import { SettingsSubScreen, Group, SettingRow, NavRight, useSettingsUi } from '../components/SettingsKit';

export default function GeneralSettingsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { themeMode } = useTheme();
  const { t, colors, rowProps } = useSettingsUi();

  return (
    <SettingsSubScreen title={t('settingsHub.general')}>
      <Group colors={colors}>
        {/* 언어 선택 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.language')}
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
          label={t('settingsHub.appLock')}
          desc={t('security.settingsDesc') || '앱 잠금, 생체인증 설정'}
          onPress={() => router.push('/security-settings')}
        >
          <NavRight {...rowProps} />
        </SettingRow>
      </Group>
    </SettingsSubScreen>
  );
}
