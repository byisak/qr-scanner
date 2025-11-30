import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hapticEnabled, setHapticEnabled] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const haptic = await AsyncStorage.getItem('hapticEnabled');
        setHapticEnabled(haptic === 'true');
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleSettingsPress = async () => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/settings');
  };

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs>
        <NativeTabs.Trigger name="history">
          <Label>{t('history.title')}</Label>
          {Platform.select({
            ios: <Icon sf="clock" />,
            default: <Icon drawable="ic_menu_recent_history" />,
          })}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="generator">
          <Label>{t('generator.title')}</Label>
          {Platform.select({
            ios: <Icon sf="qrcode" />,
            default: <Icon drawable="ic_menu_add" />,
          })}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="index">
          <Label>{t('scanner.title')}</Label>
          {Platform.select({
            ios: <Icon sf="qrcode.viewfinder" />,
            default: <Icon drawable="ic_menu_camera" />,
          })}
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Floating Settings Button with Liquid Glass Effect */}
      <View style={[s.settingsButtonContainer, { bottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={s.settingsButton}
          onPress={handleSettingsPress}
          activeOpacity={0.8}
        >
          <BlurView
            intensity={isDark ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={s.blurContainer}
          >
            <View style={[s.glassOverlay, isDark && s.glassOverlayDark]}>
              <Ionicons
                name="settings-outline"
                size={24}
                color={isDark ? '#fff' : '#000'}
              />
            </View>
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  settingsButtonContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
  },
  settingsButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  blurContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  glassOverlay: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 28,
  },
  glassOverlayDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
