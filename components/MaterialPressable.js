// components/MaterialPressable.js - 누름 피드백을 플랫폼에 맞게: Android는 네이티브 물결(ripple), iOS는 투명도
// TouchableOpacity를 그대로 바꿔 끼울 수 있게 같은 props(style, onPress, activeOpacity, disabled, 접근성)를 받는다.
import React from 'react';
import { Pressable, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function MaterialPressable({
  style,
  activeOpacity = 0.7,
  rippleColor,
  borderless = false,
  children,
  ...rest
}) {
  const { isDark } = useTheme();
  // Material 눌림 상태(onSurface 10~12%)보다 약간 진하게: 실기기에서 옅어서 안 보인다는 피드백
  const color = rippleColor || (isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)');

  if (Platform.OS === 'android') {
    return (
      <Pressable
        android_ripple={{ color, borderless, foreground: true }}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        ...(Array.isArray(style) ? style : [style]),
        pressed && !rest.disabled ? { opacity: activeOpacity } : null,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
