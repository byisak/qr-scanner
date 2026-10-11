// components/DuplicateConfirmToast.js - 중복 확인 토스트 컴포넌트 (연속 스캔 모드용)
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { SCAN_THEME, SCAN_TEXT } from '../constants/scanTheme';
import { Colors } from '../constants/Colors';
import { RADIUS, MONO } from '../constants/Design';
import { ANIMATION_DURATIONS } from '../constants/Timing';

export default function DuplicateConfirmToast({
  visible,
  data,
  onAdd,
  onSkip,
  bottomOffset = 0,
}) {
  const { t, fonts } = useLanguage();

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(50)).current;

  const showAnimation = useCallback(() => {
    toastOpacity.setValue(0);
    toastTranslateY.setValue(50);

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: ANIMATION_DURATIONS.TOAST_SHOW,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: ANIMATION_DURATIONS.TOAST_SHOW,
        useNativeDriver: true,
      }),
    ]).start();
  }, [toastOpacity, toastTranslateY]);

  const hideAnimation = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATIONS.TOAST_HIDE,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 50,
        duration: ANIMATION_DURATIONS.TOAST_HIDE,
        useNativeDriver: true,
      }),
    ]).start(callback);
  }, [toastOpacity, toastTranslateY]);

  useEffect(() => {
    if (visible && data) {
      showAnimation();
    }
  }, [visible, data, showAnimation]);

  const handleAdd = useCallback(() => {
    hideAnimation(() => {
      onAdd?.();
    });
  }, [hideAnimation, onAdd]);

  const handleSkip = useCallback(() => {
    hideAnimation(() => {
      onSkip?.();
    });
  }, [hideAnimation, onSkip]);

  if (!visible || !data) {
    return null;
  }

  const scanCount = data.scanCount || 1;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset + 20,
          opacity: toastOpacity,
          transform: [{ translateY: toastTranslateY }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={t('batchScan.duplicateAlertTitle')}
    >
      <View style={styles.content}>
        {/* 상단: 중복 아이콘과 정보 */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="copy-outline" size={20} color={SCAN_THEME.warning} />
            {scanCount > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {scanCount > 99 ? '99+' : scanCount}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                {t('batchScan.duplicateAlertTitle')}
              </Text>
              <View style={styles.duplicateBadge}>
                <Text style={[styles.duplicateBadgeText, { fontFamily: fonts.semiBold }]}>
                  {t('scanner.duplicate') || '중복'}
                </Text>
              </View>
            </View>
            <Text
              style={styles.data}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {data.data}
            </Text>
          </View>
        </View>

        {/* 하단: 버튼들 */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={handleSkip}
            activeOpacity={0.8}
            accessibilityLabel={t('batchScan.duplicateAlertCancel')}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={SCAN_TEXT.secondary} />
            <Text style={[styles.buttonText, styles.skipButtonText, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {t('batchScan.duplicateAlertCancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.addButton]}
            onPress={handleAdd}
            activeOpacity={0.8}
            accessibilityLabel={t('batchScan.duplicateAlertAdd')}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color={SCAN_TEXT.primary} />
            <Text style={[styles.buttonText, styles.addButtonText, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {t('batchScan.duplicateAlertAdd')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// 경고색(SCAN_THEME.warning)을 옅게 깐 바탕 (어두운 유리 위)
const WARNING_FILL = SCAN_THEME.warning + '2E';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1001, // ScanToast보다 위에 표시
  },
  // 어두운 유리 카드 (카메라 위)
  content: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: SCAN_THEME.cardRadius,
    backgroundColor: SCAN_THEME.glassCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: WARNING_FILL,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: SCAN_THEME.warning,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: {
    color: Colors.dark.background, // 주황 바탕 위 어두운 글자
    fontSize: 10,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flexShrink: 1,
    color: SCAN_TEXT.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  duplicateBadge: {
    backgroundColor: WARNING_FILL,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  duplicateBadgeText: {
    color: SCAN_THEME.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  data: {
    color: SCAN_TEXT.secondary,
    fontFamily: MONO,
    fontSize: 13,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.control,
    gap: 6,
  },
  skipButton: {
    backgroundColor: SCAN_THEME.glassLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
  },
  addButton: {
    backgroundColor: SCAN_THEME.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  skipButtonText: {
    color: SCAN_TEXT.primary,
  },
  addButtonText: {
    color: SCAN_TEXT.primary,
  },
});
