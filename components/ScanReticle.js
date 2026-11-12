// components/ScanReticle.js - 조준 코너 (숨 쉬는 네 코너)
// 대기: 가운데(또는 스캔 영역 네 모서리)에서 천천히 숨 쉰다 → 코드가 잡히면 코드 테두리로 날아가 붙는다
// → 저장되면 primary로 바뀌며 한 번 닫히고 안이 살짝 채워졌다 빠진다(confirm) → 흰색으로 돌아온다
// 중복이면 amber로 좌우 2번 흔들린다(shake). 모든 움직임은 UI 스레드(reanimated)
// 코드 위치는 ref.setTarget(rect)로 직접 받는다. 예전엔 스캔 화면 state(prop)를 거쳐서 코드가 움직일 때마다
// 스캔 화면 전체가 다시 그려졌고, 구형 기기에서 코너가 한 박자 늦게 따라왔다
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
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
  useAnimatedProps,
  Easing,
} from 'react-native-reanimated';
import { SCAN_THEME as T } from '../constants/scanTheme';

const WHITE = 'rgba(255,255,255,0.92)';
const TARGET_PADDING = 6;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// 네 코너를 화면 좌표에 직접 그린다 (회전·스케일 없음 → 네 코너의 선 두께가 같다)
// x,y,w,h = 코너 네모, r = 모서리 반경, len = 변 길이
function cornersPath(x, y, w, h, r, len) {
  'worklet';
  const radius = Math.max(1, Math.min(r, len, w / 2, h / 2));
  const L = Math.max(radius, Math.min(len, w / 2, h / 2));
  const x2 = x + w;
  const y2 = y + h;
  return [
    // 왼쪽 위
    `M${x},${y + L} V${y + radius} A${radius},${radius} 0 0 1 ${x + radius},${y} H${x + L}`,
    // 오른쪽 위
    `M${x2 - L},${y} H${x2 - radius} A${radius},${radius} 0 0 1 ${x2},${y + radius} V${y + L}`,
    // 오른쪽 아래
    `M${x2},${y2 - L} V${y2 - radius} A${radius},${radius} 0 0 1 ${x2 - radius},${y2} H${x2 - L}`,
    // 왼쪽 아래
    `M${x + L},${y2} H${x + radius} A${radius},${radius} 0 0 1 ${x},${y2 - radius} V${y2 - L}`,
  ].join(' ');
}

const TARGET_RADIUS = 8;

// 같은 사각형인지 (1px 이내 떨림은 무시)
const sameRect = (a, b) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

const ScanReticle = forwardRef(function ScanReticle({ isActive = true, region = null }, ref) {
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
  const targetOn = useSharedValue(0);      // 0 대기, 1 코드에 붙음
  const radius = useSharedValue(T.regionRadius);
  const targetRef = useRef(null);          // 지금 붙어 있는 코드 사각형 (없으면 null)

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

  // 타겟/대기 위치로 이동. 코드에 붙을 때는 짧고 단단한 스프링(T.snap)으로 바로 붙는다
  const moveTo = (rect) => {
    const idle = idleBox();
    if (!idle) return;
    if (rect) {
      if (!targetOn.value) stopBreath();
      targetOn.value = 1;
      cx.value = withSpring(rect.x + rect.width / 2, T.snap);
      cy.value = withSpring(rect.y + rect.height / 2, T.snap);
      w.value = withSpring(rect.width + TARGET_PADDING * 2, T.snap);
      h.value = withSpring(rect.height + TARGET_PADDING * 2, T.snap);
      radius.value = withTiming(TARGET_RADIUS, { duration: 120 });
      dotOpacity.value = withTiming(0, { duration: 100 });
    } else {
      targetOn.value = 0;
      cx.value = withSpring(idle.cx, T.release);
      cy.value = withSpring(idle.cy, T.release);
      w.value = withSpring(idle.w, T.release);
      h.value = withSpring(idle.h, T.release);
      radius.value = withTiming(T.regionRadius, { duration: 200 });
      dotOpacity.value = withTiming(region ? 0 : 1, { duration: 200 });
      startBreath();
    }
  };

  // 대기 위치(화면 크기·스캔 영역)가 바뀌면 지금 상태 그대로 다시 맞춘다
  useEffect(() => {
    moveTo(targetRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region && region.x, region && region.y, region && region.width, region && region.height, layout.width, layout.height]);

  // 화면이 꺼지면 코드에서 떨어진다 (돌아왔을 때 예전 위치에 붙어 있지 않게)
  useEffect(() => {
    if (isActive) return;
    targetRef.current = null;
    const idle = idleBox();
    if (!idle) return;
    // 보이지 않으니 애니메이션 없이 제자리로 (숨 쉬기는 인트로 effect가 멈춰 둔다)
    targetOn.value = 0;
    cx.value = idle.cx;
    cy.value = idle.cy;
    w.value = idle.w;
    h.value = idle.h;
    radius.value = T.regionRadius;
    dotOpacity.value = region ? 0 : 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useImperativeHandle(ref, () => ({
    // 대표 코드의 화면 사각형 { x, y, width, height } | null. 스캔 화면 state를 거치지 않고 바로 움직인다
    setTarget(rect) {
      const next = rect && rect.width > 0 && rect.height > 0 ? rect : null;
      if (sameRect(targetRef.current, next)) return;
      targetRef.current = next;
      moveTo(next);
    },
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
  }));

  const hasRegion = !!region;
  // 숨 쉬기·인트로는 변환 대신 크기 값으로 (SVG를 변환하면 코너마다 선 두께가 달라진다)
  const frame = () => {
    'worklet';
    // 영역 모드에선 코너가 영역 테두리에 딱 붙어야 하니 크기는 두지 않고 투명도만 숨 쉰다
    const grow = breath.value * (hasRegion && !targetOn.value ? 0 : 0.06) + (1 - intro.value) * 0.4;
    const bw = w.value * (1 + grow);
    const bh = h.value * (1 + grow);
    return { x: cx.value - bw / 2 + shakeX.value, y: cy.value - bh / 2, w: bw, h: bh };
  };
  const cornerProps = useAnimatedProps(() => {
    const f = frame();
    return {
      d: cornersPath(f.x, f.y, f.w, f.h, radius.value, cornerLen.value),
      stroke: interpolateColor(colorT.value, [0, 1, 2], [WHITE, T.primary, T.warning]),
      strokeOpacity: intro.value * (0.7 + breath.value * 0.3),
    };
  });
  const fillProps = useAnimatedProps(() => {
    const f = frame();
    return { x: f.x, y: f.y, width: f.w, height: f.h, rx: radius.value, ry: radius.value, fillOpacity: fillOpacity.value };
  });
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value * intro.value,
    backgroundColor: interpolateColor(colorT.value, [0, 1, 2], [WHITE, T.primary, T.warning]),
  }));

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
      {layout.width > 0 && (
        <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
          <AnimatedRect animatedProps={fillProps} fill={T.primaryFill} />
          <AnimatedPath animatedProps={cornerProps} fill="none" strokeWidth={T.cornerWidth} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      <Animated.View style={[styles.dot, { left: layout.width / 2 - 2, top: layout.height / 2 - 2 }, dotStyle]} />
    </View>
  );
});

const styles = StyleSheet.create({
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
