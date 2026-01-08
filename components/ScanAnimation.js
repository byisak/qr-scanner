// components/ScanAnimation.js - 스캔 화면 로딩 애니메이션 컴포넌트
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ANIMATION_DURATIONS,
  TIMEOUT_VALUES,
  SCAN_ANIMATION
} from '../constants/Timing';

const { CORNER_MOVE_DISTANCE, CORNER_SIZE, CORNER_LINE_WIDTH } = SCAN_ANIMATION;

export default function ScanAnimation({ isActive }) {
  const { t } = useLanguage();
  const [scannerReady, setScannerReady] = useState(false);

  // 애니메이션 값
  const qrIconOpacity = useRef(new Animated.Value(1)).current;
  const guideTextOpacity = useRef(new Animated.Value(1)).current;
  const cornerExpand = useRef(new Animated.Value(0)).current;
  const cornerOpacity = useRef(new Animated.Value(1)).current;
  const crosshairOpacity = useRef(new Animated.Value(0)).current;

  // 스캔 화면 로딩 애니메이션 시퀀스
  useEffect(() => {
    if (isActive && !scannerReady) {
      // 애니메이션 값 초기화
      qrIconOpacity.setValue(1);
      guideTextOpacity.setValue(1);
      cornerExpand.setValue(0);
      cornerOpacity.setValue(1);
      crosshairOpacity.setValue(0);

      // 초기 상태 유지 후 애니메이션 시작
      const startTimer = setTimeout(() => {
        // QR 아이콘/안내 텍스트 페이드 아웃 + 코너 빠르게 바깥으로 확장
        Animated.parallel([
          Animated.timing(qrIconOpacity, {
            toValue: 0,
            duration: ANIMATION_DURATIONS.SCAN_INTRO,
            useNativeDriver: true,
          }),
          Animated.timing(guideTextOpacity, {
            toValue: 0,
            duration: ANIMATION_DURATIONS.SCAN_INTRO,
            useNativeDriver: true,
          }),
          Animated.timing(cornerExpand, {
            toValue: 1.15,
            duration: ANIMATION_DURATIONS.CORNER_EXPAND,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // 약간 안쪽으로 모임
          Animated.timing(cornerExpand, {
            toValue: 1,
            duration: ANIMATION_DURATIONS.CORNER_SETTLE,
            useNativeDriver: true,
          }).start(() => {
            // 페이드 인/아웃으로 사라짐
            Animated.sequence([
              Animated.timing(cornerOpacity, {
                toValue: 0.3,
                duration: ANIMATION_DURATIONS.CORNER_BLINK,
                useNativeDriver: true
              }),
              Animated.timing(cornerOpacity, {
                toValue: 1,
                duration: ANIMATION_DURATIONS.CORNER_BLINK,
                useNativeDriver: true
              }),
              Animated.timing(cornerOpacity, {
                toValue: 0.3,
                duration: ANIMATION_DURATIONS.CORNER_BLINK,
                useNativeDriver: true
              }),
              Animated.timing(cornerOpacity, {
                toValue: 1,
                duration: ANIMATION_DURATIONS.CORNER_BLINK,
                useNativeDriver: true
              }),
              // 마지막 페이드 아웃 + 십자가 페이드 인
              Animated.parallel([
                Animated.timing(cornerOpacity, {
                  toValue: 0,
                  duration: ANIMATION_DURATIONS.SCAN_INTRO,
                  useNativeDriver: true
                }),
                Animated.timing(crosshairOpacity, {
                  toValue: 1,
                  duration: ANIMATION_DURATIONS.SCAN_INTRO,
                  useNativeDriver: true
                }),
              ]),
            ]).start(() => {
              setScannerReady(true);
            });
          });
        });
      }, TIMEOUT_VALUES.SCAN_INTRO_START);

      return () => {
        clearTimeout(startTimer);
      };
    }
  }, [isActive, scannerReady]);

  // 화면 비활성화 시 애니메이션 리셋
  useEffect(() => {
    if (!isActive) {
      setScannerReady(false);
    }
  }, [isActive]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Step 1: QR 아이콘 - 주석처리
      <Animated.View style={[styles.qrIconContainer, { opacity: qrIconOpacity }]}>
        <Ionicons
          name="qr-code"
          size={SCAN_ANIMATION.QR_ICON_SIZE}
          color="rgba(255, 255, 255, 0.9)"
        />
      </Animated.View>
      */}

      {/* Step 1-2: 코너 사각형 (위치 이동 애니메이션) - 주석처리
      <View style={styles.cornerContainer}>
        <Animated.View
          style={[
            styles.corner,
            styles.cornerTopLeft,
            {
              opacity: cornerOpacity,
              transform: [
                { translateX: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15]
                }) },
                { translateY: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15]
                }) },
              ],
            },
          ]}
        >
          <View style={[styles.cornerLine, { width: CORNER_SIZE, height: CORNER_LINE_WIDTH, top: 0, left: 0 }]} />
          <View style={[styles.cornerLine, { width: CORNER_LINE_WIDTH, height: CORNER_SIZE, top: 0, left: 0 }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.corner,
            styles.cornerTopRight,
            {
              opacity: cornerOpacity,
              transform: [
                { translateX: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15]
                }) },
                { translateY: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15]
                }) },
              ],
            },
          ]}
        >
          <View style={[styles.cornerLine, { width: CORNER_SIZE, height: CORNER_LINE_WIDTH, top: 0, right: 0 }]} />
          <View style={[styles.cornerLine, { width: CORNER_LINE_WIDTH, height: CORNER_SIZE, top: 0, right: 0 }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.corner,
            styles.cornerBottomLeft,
            {
              opacity: cornerOpacity,
              transform: [
                { translateX: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15]
                }) },
                { translateY: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15]
                }) },
              ],
            },
          ]}
        >
          <View style={[styles.cornerLine, { width: CORNER_SIZE, height: CORNER_LINE_WIDTH, bottom: 0, left: 0 }]} />
          <View style={[styles.cornerLine, { width: CORNER_LINE_WIDTH, height: CORNER_SIZE, bottom: 0, left: 0 }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.corner,
            styles.cornerBottomRight,
            {
              opacity: cornerOpacity,
              transform: [
                { translateX: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15]
                }) },
                { translateY: cornerExpand.interpolate({
                  inputRange: [0, 1, 1.15],
                  outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15]
                }) },
              ],
            },
          ]}
        >
          <View style={[styles.cornerLine, { width: CORNER_SIZE, height: CORNER_LINE_WIDTH, bottom: 0, right: 0 }]} />
          <View style={[styles.cornerLine, { width: CORNER_LINE_WIDTH, height: CORNER_SIZE, bottom: 0, right: 0 }]} />
        </Animated.View>
      </View>
      */}

      {/* Step 1: 안내 텍스트 - 주석처리
      <Animated.View style={[styles.guideTextContainer, { opacity: guideTextOpacity }]}>
        <Text style={styles.guideText}>{t('scanner.guideText')}</Text>
      </Animated.View>
      */}

      {/* Step 3: 중앙 십자가 (플러스 표시) - 항상 표시 */}
      <View style={styles.centerTarget}>
        <View style={styles.targetLineHorizontal} />
        <View style={styles.targetLineVertical} />
        <View style={styles.targetCenter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrIconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerContainer: {
    position: 'absolute',
    width: 250,
    height: 250,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
  },
  cornerLine: {
    position: 'absolute',
    backgroundColor: '#FFD60A',
    borderRadius: 2,
  },
  guideTextContainer: {
    position: 'absolute',
    bottom: '30%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  guideText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerTarget: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    marginLeft: -50,
    marginTop: -50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetLineHorizontal: {
    position: 'absolute',
    width: SCAN_ANIMATION.CROSSHAIR_SIZE,
    height: 1.5,
    backgroundColor: '#FFD60A',
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetLineVertical: {
    position: 'absolute',
    width: 1.5,
    height: SCAN_ANIMATION.CROSSHAIR_SIZE,
    backgroundColor: '#FFD60A',
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetCenter: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFD60A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});
