// components/LockIcon.js - 자물쇠 아이콘 컴포넌트
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { RADIUS } from '../constants/Design';

// 예전 핑크 색상: 다른 화면(GeneratorScreen)이 아직 가져다 쓰므로 내보내기만 유지한다.
// 이 컴포넌트는 테마 토큰(colors.error / colors.textSecondary)을 쓴다
const HOT_PINK = '#FF1493';
const LIGHT_PINK = '#FFB6C1';

/**
 * 자물쇠 아이콘 컴포넌트
 *
 * @param {string} featureId - 잠금 기능 ID (lockedFeatures.js 참조)
 * @param {number} size - 아이콘 크기 (기본: 14)
 * @param {string} color - 아이콘 색상 (기본: colors.error, 광고 시청 진행 중이면 colors.textSecondary)
 * @param {object} style - 추가 스타일
 * @param {boolean} locked - 직접 잠금 상태 지정 (featureId 대신 사용)
 * @param {boolean} badge - 연한 오류색 배지 스타일 사용 (설정 화면용)
 * @param {number} progress - 직접 진행률 지정 (0~1, featureId 대신 사용)
 *
 * 사용법:
 * <LockIcon featureId="barcodeTab" />
 * <LockIcon featureId="photoSave" badge />
 * <LockIcon locked={isLocked} size={16} />
 */
const LockIcon = ({
  featureId,
  size = 14,
  color,
  style,
  locked: lockedProp,
  badge = false,
  progress: progressProp,
}) => {
  const { isLocked, getAdProgress } = useFeatureLock();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // featureId가 있으면 Context에서 확인, 없으면 lockedProp 사용
  const isFeatureLocked = featureId ? isLocked(featureId) : lockedProp;

  // 잠겨있지 않으면 아무것도 렌더링하지 않음
  if (!isFeatureLocked) {
    return null;
  }

  // 광고 시청 진행률 확인
  let hasProgress = false;
  if (featureId) {
    const { current } = getAdProgress(featureId);
    hasProgress = current > 0;
  } else if (progressProp !== undefined) {
    hasProgress = progressProp > 0;
  }

  // 색상 결정: 사용자 지정 > 진행 중이면 보조 글자색 > 기본 오류색
  const iconColor = color || (hasProgress ? colors.textSecondary : colors.error);

  // 배지 스타일 (설정 화면용)
  if (badge) {
    return (
      <View style={[styles.badgeContainer, { backgroundColor: colors.errorSoft }, style]}>
        <Ionicons name="lock-closed" size={size} color={iconColor} />
      </View>
    );
  }

  // 기본 스타일
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="lock-closed" size={size} color={iconColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginLeft: 6,
  },
  // 연한 오류색 배지 (style로 바탕·여백 덮어쓰기 가능)
  badgeContainer: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LockIcon;
export { HOT_PINK, LIGHT_PINK };
