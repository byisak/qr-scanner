import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/Colors';

// iOS용 NativeTabs (unstable API)
let NativeTabs: any = null;
if (Platform.OS === 'ios') {
  try {
    NativeTabs = require('expo-router/unstable-native-tabs').Tabs;
  } catch (e) {
    NativeTabs = null;
  }
}

export default function TabLayout() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // iOS: NativeTabs 사용 (네이티브 탭 모양 + SF Symbol)
  if (Platform.OS === 'ios' && NativeTabs) {
    return (
      <NativeTabs
        screenOptions={{
          headerShown: false,
        }}
      >
        <NativeTabs.Screen
          name="history"
          options={{
            title: t('history.title'),
            tabBarIcon: () => ({ sfSymbol: 'clock' }),
          }}
        />
        <NativeTabs.Screen
          name="generator"
          options={{
            title: t('generator.title'),
            tabBarIcon: () => ({ sfSymbol: 'qrcode' }),
          }}
        />
        <NativeTabs.Screen
          name="index"
          options={{
            title: t('scanner.title'),
            tabBarIcon: () => ({ sfSymbol: 'viewfinder' }),
          }}
        />
        <NativeTabs.Screen
          name="settings"
          options={{
            title: t('settings.title'),
            tabBarIcon: () => ({ sfSymbol: 'gearshape' }),
          }}
        />
      </NativeTabs>
    );
  }

  // Android 또는 iOS fallback: 일반 Tabs 사용 (블러 탭 스타일)
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
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
