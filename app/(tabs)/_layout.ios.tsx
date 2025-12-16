import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useLanguage } from '../../contexts/LanguageContext';

export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <NativeTabs>
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
