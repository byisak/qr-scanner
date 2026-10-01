// hooks/useTabBarOverlap.js - 탭 화면 하단이 탭바에 가려지는 높이
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 두 플랫폼 모두 네이티브 탭바 밑까지 화면이 그려진다 (탭바가 화면 위에 겹친다).
// iOS UITabBar: 49pt + 홈 인디케이터. Android Material 3 하단 내비게이션: 80dp + 내비게이션 바(제스처/3버튼).
// (에뮬레이터 실측: 탭바 104dp = 80 + 하단 inset 24)
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 80;

export function useTabBarOverlap() {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT;
}

export default useTabBarOverlap;
