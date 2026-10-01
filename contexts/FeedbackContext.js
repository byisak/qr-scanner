// contexts/FeedbackContext.js - 토스트 + 햅틱을 한 곳에서 처리하는 공용 피드백
// 가벼운 성공/경고(복사됨, 삭제됨, 저장됨)는 Alert 대신 이걸 쓴다. Alert는 되돌릴 수 없는 작업의 확인에만.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Snackbar } from 'react-native-paper';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { Colors } from '../constants/Colors';

const FeedbackContext = createContext(null);

const TOAST_DURATION = 2500;
const TOAST_DURATION_WITH_ACTION = 4000;

const ICONS = {
  success: 'checkmark-circle',
  warning: 'alert-circle',
  error: 'close-circle',
  info: 'information-circle',
};

let toastSeq = 0;

export const FeedbackProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  // 여러 화면(특히 모달)이 각자 호스트를 두면, 마지막에 마운트된 호스트만 그린다
  const [hosts, setHosts] = useState([]);
  const hideTimerRef = useRef(null);

  const hapticEnabled = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('hapticEnabled');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  }, []);

  const haptic = useCallback(async (kind = 'success') => {
    if (!(await hapticEnabled())) return;
    try {
      if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (kind === 'warning') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else if (kind === 'error') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // 햅틱 미지원 기기
    }
  }, [hapticEnabled]);

  const hideToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const { type = 'info', actionLabel, onAction, duration } = options;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const id = ++toastSeq;
    setToast({ id, message, type, actionLabel, onAction });
    hideTimerRef.current = setTimeout(() => {
      setToast(current => (current && current.id === id ? null : current));
      hideTimerRef.current = null;
    }, duration || (actionLabel ? TOAST_DURATION_WITH_ACTION : TOAST_DURATION));
  }, []);

  const success = useCallback((message, options) => { haptic('success'); showToast(message, { ...options, type: 'success' }); }, [haptic, showToast]);
  const warning = useCallback((message, options) => { haptic('warning'); showToast(message, { ...options, type: 'warning' }); }, [haptic, showToast]);
  const error = useCallback((message, options) => { haptic('error'); showToast(message, { ...options, type: 'error' }); }, [haptic, showToast]);
  const info = useCallback((message, options) => { showToast(message, { ...options, type: 'info' }); }, [showToast]);

  const registerHost = useCallback((id) => {
    setHosts(prev => [...prev, id]);
    return () => setHosts(prev => prev.filter(h => h !== id));
  }, []);

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  const activeHostId = hosts.length > 0 ? hosts[hosts.length - 1] : null;

  const value = useMemo(() => ({
    toast, hideToast, showToast, success, warning, error, info, haptic, registerHost, activeHostId,
  }), [toast, hideToast, showToast, success, warning, error, info, haptic, registerHost, activeHostId]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackToastHost />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

let hostSeq = 0;

/**
 * 토스트를 그리는 자리. 루트에 하나 있고, 네이티브 모달 화면(ResultScreen 등)은
 * 자기 안에 하나 더 둔다. 그래야 모달 위에서도 토스트가 보인다.
 */
export const FeedbackToastHost = () => {
  const { toast, hideToast, registerHost, activeHostId } = useFeedback();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = ++hostSeq;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => registerHost(idRef.current), [registerHost]);

  const isActive = activeHostId === idRef.current;
  const visible = isActive && !!toast;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: visible ? 0 : 20, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, translateY]);

  // Android: Material 3 스낵바 (메시지 + 텍스트 버튼). iOS는 아래 기존 토스트 유지
  if (Platform.OS === 'android') {
    return (
      <Snackbar
        visible={visible}
        onDismiss={hideToast}
        // 숨김 시점은 컨텍스트 타이머가 정한다
        duration={toast?.actionLabel ? 4000 : 2500}
        action={toast?.actionLabel
          ? { label: toast.actionLabel, onPress: () => { toast.onAction?.(); } }
          : { label: t('common.close'), onPress: hideToast }}
        // 탭 화면에서 Material 하단 내비게이션(80dp + 내비게이션 바)에 가리지 않게
        wrapperStyle={{ bottom: insets.bottom + 88, zIndex: 9999 }}
        accessibilityLiveRegion="polite"
      >
        {toast?.message}
      </Snackbar>
    );
  }

  if (!visible) return null;

  const tint = {
    success: colors.success || '#34C759',
    warning: colors.warning || '#FF9500',
    error: colors.error || '#FF3B30',
    info: colors.primary,
  }[toast.type] || colors.primary;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 16) + (Platform.OS === 'ios' ? 70 : 76), opacity, transform: [{ translateY }] }]}
    >
      <View
        style={[styles.toast, { backgroundColor: isDark ? '#2C2C2E' : '#1C1C1E' }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Ionicons name={ICONS[toast.type] || ICONS.info} size={20} color={tint} />
        <Text style={[styles.message, { fontFamily: fonts.medium }]} numberOfLines={2}>{toast.message}</Text>
        {toast.actionLabel ? (
          <TouchableOpacity
            onPress={() => { toast.onAction?.(); hideToast(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            style={styles.action}
          >
            <Text style={[styles.actionText, { color: tint, fontFamily: fonts.bold }]}>{toast.actionLabel}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={hideToast}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.action}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    maxWidth: 520,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
  },
  action: {
    marginLeft: 12,
    minWidth: 44,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
  },
});

export default FeedbackContext;
