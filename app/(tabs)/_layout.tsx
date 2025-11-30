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
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      if (!hapticEnabled) return;

      // iOS에서는 카메라 활성화 시 햅틱이 작동하지 않으므로
      // 스캔 탭(index)과 관련된 전환에서는 햅틱을 실행하지 않음
      if (Platform.OS === 'ios') {
        const state = navigation.getState();
        const currentRoute = state?.routes[state?.index];
        const targetRoute = e.target;

        // 현재 탭이나 이동할 탭이 'index'(스캔 탭)인 경우 햅틱 비활성화
        if (currentRoute?.name === 'index' || targetRoute?.includes('index')) {
          return;
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
