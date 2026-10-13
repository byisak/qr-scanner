import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/Colors';

// iOS: 시스템 탭바(유리 효과)는 그대로 두고, 색만 Android·디자인 규칙과 맞춘다
// (선택 탭 = 글자색, 나머지 = textTertiary). 지정하지 않으면 시스템 파랑으로 칠해졌다
export default function TabLayout() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <NativeTabs
      tintColor={colors.text}
      iconColor={{ default: colors.textTertiary, selected: colors.text }}
      labelStyle={{
        default: { color: colors.textTertiary },
        selected: { color: colors.text, fontWeight: '600' },
      }}
    >
      <NativeTabs.Trigger name="history">
        <Label>{t('history.title')}</Label>
        <Icon sf="clock" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="generator">
        <Label>{t('generator.title')}</Label>
        <Icon sf="qrcode" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <Label>{t('scanner.title')}</Label>
        <Icon sf="qrcode.viewfinder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>{t('settings.title')}</Label>
        <Icon sf="gear" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
