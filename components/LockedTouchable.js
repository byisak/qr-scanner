// components/LockedTouchable.js - 잠금 처리 래퍼 컴포넌트
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useFeatureLock } from '../contexts/FeatureLockContext';

/**
 * 잠금 처리 래퍼 컴포넌트
 * 잠겨있으면 광고 Alert, 해제됐으면 onPress 실행
 *
 * @param {string} featureId - 잠금 기능 ID (lockedFeatures.js 참조)
 * @param {function} onPress - 잠금 해제 시 실행할 함수
 * @param {function} onUnlock - 광고 시청 후 해제됐을 때 추가 콜백 (선택)
 * @param {boolean} disabled - 비활성화 여부
 * @param {object} style - 스타일
 * @param {number} activeOpacity - 터치 시 투명도
 * @param {ReactNode} children - 자식 컴포넌트
 *
 * 사용법:
 * <LockedTouchable
 *   featureId="barcodeTab"
 *   onPress={() => setCodeMode('barcode')}
 * >
 *   <Text>바코드</Text>
 *   <LockIcon featureId="barcodeTab" />
 * </LockedTouchable>
 */
const LockedTouchable = ({
  featureId,
  onPress,
  onUnlock,
  disabled,
  style,
  activeOpacity = 0.7,
  children,
  ...props
}) => {
  const { isLocked, showUnlockAlert } = useFeatureLock();

  const handlePress = () => {
    if (isLocked(featureId)) {
      // 잠겨있으면 광고 Alert 표시
      showUnlockAlert(featureId, () => {
        // 해제 후 onUnlock 또는 onPress 실행
        if (onUnlock) {
          onUnlock();
        } else if (onPress) {
          onPress();
        }
      });
    } else {
      // 잠금 해제됐으면 바로 실행
      if (onPress) {
        onPress();
      }
    }
  };

  return (
    <TouchableOpacity
      style={style}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

export default LockedTouchable;
