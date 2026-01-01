// components/DuplicateConfirmToast.js - 중복 확인 토스트 컴포넌트 (연속 스캔 모드용)
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import { ANIMATION_DURATIONS } from '../constants/Timing';

export default function DuplicateConfirmToast({
  visible,
  data,
  onAdd,
  onSkip,
  bottomOffset = 0,
}) {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

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
      <View style={[styles.content, { backgroundColor: colors.surface }]}>
        {/* 상단: 중복 아이콘과 정보 */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: '#FF9500' + '20' }]}>
            <Ionicons name="copy" size={24} color="#FF9500" />
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
              <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('batchScan.duplicateAlertTitle')}
              </Text>
              <View style={styles.duplicateBadge}>
                <Text style={styles.duplicateBadgeText}>
                  {t('scanner.duplicate') || '중복'}
                </Text>
              </View>
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

        {/* 하단: 버튼들 */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={handleSkip}
            activeOpacity={0.8}
            accessibilityLabel={t('batchScan.duplicateAlertCancel')}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color="#8E8E93" />
            <Text style={[styles.buttonText, styles.skipButtonText, { fontFamily: fonts.medium }]}>
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
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={[styles.buttonText, styles.addButtonText, { fontFamily: fonts.medium }]}>
              {t('batchScan.duplicateAlertAdd')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1001, // ScanToast보다 위에 표시
  },
  content: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    fontSize: 15,
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
  data: {
    fontSize: 13,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  skipButton: {
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
  },
  addButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  skipButtonText: {
    color: '#8E8E93',
  },
  addButtonText: {
    color: '#fff',
  },
});
