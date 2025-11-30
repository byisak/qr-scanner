import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import * as Haptics from 'expo-haptics';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function TabLayout() {
  const { t } = useLanguage();
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      try {
        const h = await AsyncStorage.getItem('hapticEnabled');
        if (h !== null) {
          setHapticEnabled(h === 'true');
        }
      } catch (error) {
        console.error('Load haptic settings error:', error);
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (hapticEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });

    return unsubscribe;
  }, [navigation, hapticEnabled]);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>{t('scanner.title')}</Label>
        {Platform.select({
          ios: <Icon sf="qrcode.viewfinder" />,
          default: <Icon drawable="ic_menu_camera" />,
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Label>{t('history.title')}</Label>
        {Platform.select({
          ios: <Icon sf="clock" />,
          default: <Icon drawable="ic_menu_recent_history" />,
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>{t('settings.title')}</Label>
        {Platform.select({
          ios: <Icon sf="gear" />,
          default: <Icon drawable="ic_menu_settings" />,
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
