// components/LockIcon.js - 자물쇠 아이콘 컴포넌트
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

// 핫핑크 색상
const HOT_PINK = '#FF1493';

/**
 * 자물쇠 아이콘 컴포넌트
 *
 * @param {string} featureId - 잠금 기능 ID (lockedFeatures.js 참조)
 * @param {number} size - 아이콘 크기 (기본: 14)
 * @param {string} color - 아이콘 색상 (기본: 핫핑크)
 * @param {object} style - 추가 스타일
 * @param {boolean} locked - 직접 잠금 상태 지정 (featureId 대신 사용)
 * @param {boolean} badge - 원형 배지 스타일 사용 (설정 화면용)
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
}) => {
  const { isLocked } = useFeatureLock();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // featureId가 있으면 Context에서 확인, 없으면 lockedProp 사용
  const isFeatureLocked = featureId ? isLocked(featureId) : lockedProp;

  // 잠겨있지 않으면 아무것도 렌더링하지 않음
  if (!isFeatureLocked) {
    return null;
  }

  const iconColor = color || HOT_PINK;

  // 배지 스타일 (설정 화면용)
  if (badge) {
    return (
      <View style={[styles.badgeContainer, style]}>
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
  badgeContainer: {
    marginLeft: 8,
  },
});

export default LockIcon;
