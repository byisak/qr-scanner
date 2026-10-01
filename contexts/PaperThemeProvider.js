// contexts/PaperThemeProvider.js - Material 3(react-native-paper) 테마를 앱 색상·다크모드에 맞춘다
import React, { useMemo } from 'react';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from './ThemeContext';
import { Colors } from '../constants/Colors';

export function buildPaperTheme(isDark) {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  const c = isDark ? Colors.dark : Colors.light;
  return {
    ...base,
    roundness: 3,
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: '#fff',
      primaryContainer: c.primary + '26',
      onPrimaryContainer: c.primary,
      secondaryContainer: c.primary + '26',
      onSecondaryContainer: c.primary,
      background: c.background,
      onBackground: c.text,
      surface: c.surface,
      onSurface: c.text,
      surfaceVariant: c.inputBackground,
      onSurfaceVariant: c.textSecondary,
      outline: c.border,
      outlineVariant: c.borderLight,
      error: c.error,
      // 스낵바(inverseSurface)는 화면과 반대 톤으로
      inverseSurface: isDark ? '#E6E6EB' : '#2C2C2E',
      inverseOnSurface: isDark ? '#1C1C1E' : '#F2F2F7',
      inversePrimary: isDark ? '#0060DF' : '#66B0FF',
      elevation: {
        ...base.colors.elevation,
        level1: c.surface,
        level2: c.surface,
        level3: c.surface,
      },
    },
  };
}

export default function PaperThemeProvider({ children }) {
  const { isDark } = useTheme();
  const theme = useMemo(() => buildPaperTheme(isDark), [isDark]);
  return (
    <PaperProvider
      theme={theme}
      // 아이콘은 이미 번들된 @expo/vector-icons를 쓴다 (react-native-vector-icons 별도 설치 불필요)
      settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
    >
      {children}
    </PaperProvider>
  );
}
