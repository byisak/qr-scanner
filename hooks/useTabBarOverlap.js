// hooks/useTabBarOverlap.js - 탭 화면 하단이 탭바에 가려지는 높이
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS 네이티브 탭바(UITabBar)는 반투명이라 화면이 그 밑까지 그려진다 → 탭바 높이(49) + 홈 인디케이터만큼 가려진다.
// Android 네이티브 탭바(Material 하단 내비게이션)는 화면을 탭바 위까지만 그리고 내비게이션 바 여백도 직접 처리한다 → 0.
const IOS_TAB_BAR_HEIGHT = 49;

export function useTabBarOverlap() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom + IOS_TAB_BAR_HEIGHT : 0;
}

export default useTabBarOverlap;
