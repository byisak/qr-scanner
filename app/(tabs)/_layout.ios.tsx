import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFeatureLock } from '../../contexts/FeatureLockContext';
import { Colors } from '../../constants/Colors';

// iOS: 블러 효과가 적용된 탭바 배경 컴포넌트
function TabBarBackground() {
  const { isDark } = useTheme();

  return (
    <BlurView
      intensity={100}
      tint={isDark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { autoSync } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const lastSyncTimeRef = useRef<number>(0);

  return (
    <Tabs
      screenListeners={{
        focus: () => {
          const now = Date.now();
          // 2초 이내 중복 호출 방지
          if (now - lastSyncTimeRef.current > 2000) {
            lastSyncTimeRef.current = now;
            if (autoSync) {
              autoSync(true);
            }
          }
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen
        name="history"
        options={{
          title: t('history.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="generator"
        options={{
          title: t('generator.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('scanner.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
