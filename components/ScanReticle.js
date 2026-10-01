// components/ScanReticle.js - 조준 코너 (숨 쉬는 네 코너)
// 대기: 가운데(또는 스캔 영역 네 모서리)에서 천천히 숨 쉰다 → 코드가 잡히면 코드 테두리로 날아가 붙는다
// → 저장되면 primary로 바뀌며 한 번 닫히고 안이 살짝 채워졌다 빠진다(confirm) → 흰색으로 돌아온다
// 중복이면 amber로 좌우 2번 흔들린다(shake). 모든 움직임은 UI 스레드(reanimated)
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  cancelAnimation,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { SCAN_THEME as T } from '../constants/scanTheme';

const WHITE = 'rgba(255,255,255,0.92)';
const TARGET_PADDING = 6;

const ScanReticle = forwardRef(function ScanReticle({ isActive = true, region = null, target = null }, ref) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);

  // 코너 네모의 중심·크기
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  const w = useSharedValue(T.reticleSize);
  const h = useSharedValue(T.reticleSize);
  const cornerLen = useSharedValue(T.cornerLength);
  const colorT = useSharedValue(0);        // 0 흰색, 1 primary, 2 amber
  const breath = useSharedValue(0);        // 0..1 숨
  const fillOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const intro = useSharedValue(0);         // 0 밖에서 투명 → 1 제자리
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduceMotion(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduceMotion(!!v));
    return () => { mounted = false; sub && sub.remove && sub.remove(); };
  }, []);

  // 대기 위치: 영역이 있으면 영역, 없으면 가운데 네모
  const idleBox = () => {
    if (!layout.width || !layout.height) return null;
    if (region) return { cx: region.x + region.width / 2, cy: region.y + region.height / 2, w: region.width, h: region.height };
    return { cx: layout.width / 2, cy: layout.height / 2, w: T.reticleSize, h: T.reticleSize };
  };

  // 숨 쉬기 시작/정지
  const startBreath = () => {
    cancelAnimation(breath);
    if (reduceMotion) { breath.value = 0; return; }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: T.breathPeriod / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: T.breathPeriod / 2, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  };
  const stopBreath = () => {
    cancelAnimation(breath);
    breath.value = withTiming(0, { duration: 150 });
  };

  // 인트로: 화면이 켜지면 밖에서 모여든다
  useEffect(() => {
    if (!layout.width) return;
    if (isActive) {
      intro.value = 0;
      intro.value = withDelay(120, withSpring(1, { damping: 16, stiffness: 120 }));
      startBreath();
    } else {
      cancelAnimation(breath);
      intro.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, layout.width, layout.height, reduceMotion]);

  // 타겟/대기 위치로 이동
  useEffect(() => {
    const idle = idleBox();
    if (!idle) return;
    if (target) {
      stopBreath();
      cx.value = withSpring(target.x + target.width / 2, T.snap);
      cy.value = withSpring(target.y + target.height / 2, T.snap);
      w.value = withSpring(target.width + TARGET_PADDING * 2, T.snap);
      h.value = withSpring(target.height + TARGET_PADDING * 2, T.snap);
      dotOpacity.value = withTiming(0, { duration: 120 });
    } else {
      cx.value = withSpring(idle.cx, T.snap);
      cy.value = withSpring(idle.cy, T.snap);
      w.value = withSpring(idle.w, T.snap);
      h.value = withSpring(idle.h, T.snap);
      dotOpacity.value = withTiming(region ? 0 : 1, { duration: 200 });
      startBreath();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target && target.x, target && target.y, target && target.width, target && target.height, region && region.x, region && region.y, region && region.width, region && region.height, layout.width, layout.height]);

  useImperativeHandle(ref, () => ({
    // 저장 확정: primary로 닫혔다가 돌아온다
    confirm() {
      const closeLen = Math.max(T.cornerLength, Math.min(w.value, h.value) / 2);
      colorT.value = withSequence(
        withTiming(1, { duration: T.confirmDuration }),
        withDelay(200, withTiming(0, { duration: T.returnDuration }))
      );
      cornerLen.value = withSequence(
        withTiming(closeLen, { duration: T.confirmDuration, easing: Easing.out(Easing.cubic) }),
        withDelay(160, withTiming(T.cornerLength, { duration: T.returnDuration }))
      );
      fillOpacity.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) })
      );
    },
    // 중복/경고: amber로 좌우 흔들림
    shake() {
      colorT.value = withSequence(
        withTiming(2, { duration: 120 }),
        withDelay(500, withTiming(0, { duration: T.returnDuration }))
      );
      shakeX.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 80 }),
        withTiming(-4, { duration: 80 }),
        withTiming(0, { duration: 70 })
      );
    },
  }), [w, h, colorT, cornerLen, fillOpacity, shakeX]);

  const boxStyle = useAnimatedStyle(() => {
    const scale = 1 + breath.value * 0.06;
    const spread = (1 - intro.value) * 40;
    return {
      position: 'absolute',
      left: cx.value - w.value / 2,
      top: cy.value - h.value / 2,
      width: w.value,
      height: h.value,
      opacity: 0.7 + breath.value * 0.3,
      transform: [{ translateX: shakeX.value }, { scale: scale * (1 + spread / Math.max(w.value, 1)) }],
    };
  });
  const introOpacity = useAnimatedStyle(() => ({ opacity: intro.value }));
  const fillStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.regionRadius,
    backgroundColor: T.primaryFill,
    opacity: fillOpacity.value,
  }));
  const barColor = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(colorT.value, [0, 1, 2], [WHITE, T.primary, T.warning]),
  }));
  const hBar = useAnimatedStyle(() => ({ width: cornerLen.value }));
  const vBar = useAnimatedStyle(() => ({ height: cornerLen.value }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value * intro.value,
    backgroundColor: interpolateColor(colorT.value, [0, 1, 2], [WHITE, T.primary, T.warning]),
  }));

  const corners = [
    { key: 'tl', style: { top: 0, left: 0 }, h: { top: 0, left: 0 }, v: { top: 0, left: 0 } },
    { key: 'tr', style: { top: 0, right: 0 }, h: { top: 0, right: 0 }, v: { top: 0, right: 0 } },
    { key: 'bl', style: { bottom: 0, left: 0 }, h: { bottom: 0, left: 0 }, v: { bottom: 0, left: 0 } },
    { key: 'br', style: { bottom: 0, right: 0 }, h: { bottom: 0, right: 0 }, v: { bottom: 0, right: 0 } },
  ];

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== layout.width || height !== layout.height) {
          setLayout({ width, height });
          // 첫 레이아웃: 즉시 가운데로
          cx.value = width / 2;
          cy.value = height / 2;
        }
      }}
    >
      <Animated.View style={[boxStyle, introOpacity]}>
        <Animated.View style={fillStyle} />
        {corners.map(c => (
          <View key={c.key} style={[styles.corner, c.style]}>
            <Animated.View style={[styles.bar, { height: T.cornerWidth }, c.h, hBar, barColor]} />
            <Animated.View style={[styles.bar, { width: T.cornerWidth }, c.v, vBar, barColor]} />
          </View>
        ))}
      </Animated.View>
      <Animated.View style={[styles.dot, { left: layout.width / 2 - 2, top: layout.height / 2 - 2 }, dotStyle]} />
    </View>
  );
});

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  bar: {
    position: 'absolute',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
});

export default ScanReticle;
