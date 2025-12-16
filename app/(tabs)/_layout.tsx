import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/Colors';

// iOS용 GlassView (iOS 26+에서만 동작, 그 외에는 View로 fallback)
let GlassView: any = null;
let isLiquidGlassAvailable: (() => boolean) | null = null;
if (Platform.OS === 'ios') {
  try {
    const glassEffect = require('expo-glass-effect');
    GlassView = glassEffect.GlassView;
    isLiquidGlassAvailable = glassEffect.isLiquidGlassAvailable;
  } catch (e) {
    GlassView = null;
    isLiquidGlassAvailable = null;
  }
}

// 탭바 배경 컴포넌트
function TabBarBackground() {
  const { isDark } = useTheme();

  // iOS: GlassView 사용 (iOS 26+), 그렇지 않으면 BlurView
  if (Platform.OS === 'ios') {
    // GlassView가 사용 가능한지 확인
    if (GlassView && isLiquidGlassAvailable && isLiquidGlassAvailable()) {
      return (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
        />
      );
    }
    // Fallback: BlurView
    return (
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
      />
    );
  }

  // Android: 반투명 배경
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: isDark
            ? 'rgba(28, 28, 30, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
        },
      ]}
    />
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Tabs
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
