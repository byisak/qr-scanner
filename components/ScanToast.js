// components/ScanToast.js - 스캔 결과 토스트 컴포넌트 (연속 스캔 모드용)
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { ANIMATION_DURATIONS, TIMEOUT_VALUES } from '../constants/Timing';

export default function ScanToast({
  visible,
  data,
  onPress,
  onClose,
  bottomOffset = 0,
  showScanCounter = true,
}) {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(50)).current;
  const autoHideTimer = useRef(null);

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

      // 자동 숨김 타이머 설정
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
      autoHideTimer.current = setTimeout(() => {
        hideAnimation(() => {
          onClose?.();
        });
      }, TIMEOUT_VALUES.TOAST_AUTO_HIDE);
    }

    return () => {
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
    };
  }, [visible, data, showAnimation, hideAnimation, onClose]);

  const handlePress = useCallback(() => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
    }
    hideAnimation(() => {
      onPress?.();
    });
  }, [hideAnimation, onPress]);

  const handleClose = useCallback(() => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
    }
    hideAnimation(() => {
      onClose?.();
    });
  }, [hideAnimation, onClose]);

  if (!visible || !data) {
    return null;
  }

  const isDuplicate = data.isDuplicate;
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
      accessibilityLabel={`${t('scanner.scanned')}: ${data.data}${isDuplicate ? ` (${t('scanner.duplicate') || '중복'})` : ''}`}
    >
      <TouchableOpacity
        style={[styles.content, { backgroundColor: colors.surface }]}
        onPress={handlePress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityHint={t('scanner.viewDetailsHint') || '결과 상세 화면으로 이동합니다'}
      >
        <View style={styles.left}>
          <View style={[
            styles.iconContainer,
            { backgroundColor: isDuplicate ? '#FF9500' + '20' : colors.success + '20' }
          ]}>
            <Ionicons
              name={isDuplicate ? "copy" : "checkmark-circle"}
              size={24}
              color={isDuplicate ? '#FF9500' : colors.success}
            />
            {/* 스캔 카운트 배지 */}
            {showScanCounter && scanCount > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {scanCount > 99 ? '99+' : scanCount}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('scanner.scanned')}
              </Text>
              {isDuplicate && (
                <View style={styles.duplicateBadge}>
                  <Text style={styles.duplicateBadgeText}>
                    {t('scanner.duplicate') || '중복'}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.data, { color: colors.textSecondary, fontFamily: fonts.regular }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {data.data}
            </Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={[styles.viewText, { color: colors.primary, fontFamily: fonts.medium }]}>
            {t('scanner.viewDetails')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.closeButton, { backgroundColor: colors.textTertiary + '30' }]}
        onPress={handleClose}
        accessibilityLabel={t('common.close')}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  duplicateBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  duplicateBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  data: {
    fontSize: 13,
    maxWidth: '90%',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewText: {
    fontSize: 13,
    marginRight: 4,
  },
  closeButton: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
