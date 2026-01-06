// components/NativeQRScanner/index.js
// @mgcrea/vision-camera-barcode-scanner 기반 네이티브 QR 스캐너 컴포넌트

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useBarcodeScanner } from '@mgcrea/vision-camera-barcode-scanner';
import { Worklets } from 'react-native-worklets-core';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 바코드 라벨 배경색 팔레트 (서로 구분되는 색상들 - 25가지)
const LABEL_COLORS = [
  '#E91E63', // 핑크
  '#2196F3', // 파랑
  '#4CAF50', // 초록
  '#9C27B0', // 보라
  '#FF5722', // 주황
  '#00BCD4', // 청록
  '#FFC107', // 노랑
  '#795548', // 갈색
  '#607D8B', // 청회색
  '#3F51B5', // 인디고
  '#F44336', // 빨강
  '#009688', // 틸
  '#673AB7', // 딥퍼플
  '#8BC34A', // 라이트그린
  '#FF9800', // 오렌지
  '#03A9F4', // 라이트블루
  '#CDDC39', // 라임
  '#9E9E9E', // 그레이
  '#E040FB', // 퍼플악센트
  '#00E676', // 그린악센트
  '#FF6F00', // 앰버다크
  '#1A237E', // 인디고다크
  '#B71C1C', // 레드다크
  '#1B5E20', // 그린다크
  '#4A148C', // 퍼플다크
];

// 애니메이션 하이라이트 컴포넌트 (부드럽게 따라다님)
const AnimatedHighlight = ({ highlight, borderColor, fillColor, showValue, value, labelBackgroundColor }) => {
  const x = useSharedValue(highlight.origin.x);
  const y = useSharedValue(highlight.origin.y);
  const width = useSharedValue(highlight.size.width);
  const height = useSharedValue(highlight.size.height);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // 부드러운 스프링 애니메이션으로 위치 업데이트
    x.value = withSpring(highlight.origin.x, { damping: 15, stiffness: 150 });
    y.value = withSpring(highlight.origin.y, { damping: 15, stiffness: 150 });
    width.value = withSpring(highlight.size.width, { damping: 15, stiffness: 150 });
    height.value = withSpring(highlight.size.height, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 100 });
  }, [highlight.origin.x, highlight.origin.y, highlight.size.width, highlight.size.height]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderWidth: 2,
    borderColor: borderColor,
    backgroundColor: fillColor,
    borderRadius: 4,
    opacity: opacity.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value + height.value + 4,
    maxWidth: Math.max(width.value, 200),
    opacity: opacity.value,
  }));

  return (
    <>
      <Animated.View style={animatedStyle} />
      {showValue && value && (
        <Animated.View style={labelStyle}>
          <View style={[styles.valueLabel, { backgroundColor: labelBackgroundColor || borderColor }]}>
            <Text style={styles.valueLabelText} numberOfLines={2}>
              {value}
            </Text>
          </View>
        </Animated.View>
      )}
    </>
  );
};

// 커스텀 하이라이트 컴포넌트 (객체 추적 알고리즘 적용 + 투표 기반 값 검증)
const CustomHighlights = ({ highlights, barcodes = [], borderColor = 'rgba(0, 255, 0, 0.5)', fillColor = 'rgba(0, 255, 0, 0.15)', showBarcodeValues = true, selectCenterOnly = false, onVisibleCountChange, onVerifiedBarcodesChange }) => {
  const [trackedHighlights, setTrackedHighlights] = useState([]);
  const lastUpdateRef = useRef(0);
  // 추적 중인 하이라이트: id -> {x, y, width, height, valueCounts: Map<value, count>, bestValue, lastSeen}
  const trackedObjectsRef = useRef(new Map());
  const nextIdRef = useRef(0);
  // 마지막으로 콜백된 검증된 바코드 키 (중복 콜백 방지)
  const lastVerifiedKeyRef = useRef('');

  // showBarcodeValues가 true이고 바코드가 있으면 값 표시
  const showValues = showBarcodeValues && barcodes.length > 0;

  // 두 하이라이트 간의 거리 계산
  const getDistance = (h1, h2) => {
    const cx1 = h1.x + h1.width / 2;
    const cy1 = h1.y + h1.height / 2;
    const cx2 = h2.x + h2.width / 2;
    const cy2 = h2.y + h2.height / 2;
    return Math.sqrt(Math.pow(cx1 - cx2, 2) + Math.pow(cy1 - cy2, 2));
  };

  useEffect(() => {
    const now = Date.now();

    if (!highlights || highlights.length === 0) {
      const timeout = setTimeout(() => {
        setTrackedHighlights([]);
        trackedObjectsRef.current.clear();
        lastVerifiedKeyRef.current = ''; // 검증 키도 초기화
      }, 300);
      return () => clearTimeout(timeout);
    }

    // 너무 빠른 업데이트 방지
    if (now - lastUpdateRef.current < 50) return;
    lastUpdateRef.current = now;

    let filteredHighlights = highlights;
    let filteredBarcodes = barcodes || [];

    // selectCenterOnly가 true이면 중앙에 가장 가까운 하이라이트만 선택
    if (selectCenterOnly && filteredHighlights.length >= 2) {
      const screenCenterX = SCREEN_WIDTH / 2;
      const screenCenterY = SCREEN_HEIGHT / 2;

      let closestIndex = 0;
      let minDistance = Number.MAX_VALUE;

      highlights.forEach((h, i) => {
        const hCenterX = h.origin.x + h.size.width / 2;
        const hCenterY = h.origin.y + h.size.height / 2;
        const distance = Math.sqrt(
          Math.pow(hCenterX - screenCenterX, 2) + Math.pow(hCenterY - screenCenterY, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      });

      filteredHighlights = [highlights[closestIndex]];
      filteredBarcodes = barcodes[closestIndex] ? [barcodes[closestIndex]] : [];
    }

    // 현재 프레임의 하이라이트를 표준 형식으로 변환
    const currentHighlights = filteredHighlights.map((h, idx) => ({
      x: h.origin.x,
      y: h.origin.y,
      width: h.size.width,
      height: h.size.height,
      value: filteredBarcodes[idx]?.value || null,
      original: h,
    }));

    // 기존 추적 객체와 새 하이라이트 매칭 (Hungarian 알고리즘 대신 탐욕적 매칭)
    const matched = new Set(); // 매칭된 새 하이라이트 인덱스
    const matchedTracked = new Set(); // 매칭된 기존 추적 객체 ID
    const MAX_DISTANCE = 100; // 매칭 최대 거리 (더 엄격하게)

    // 거리 기반 매칭
    const trackedEntries = Array.from(trackedObjectsRef.current.entries());

    // 모든 가능한 매칭의 거리 계산
    const matchCandidates = [];
    trackedEntries.forEach(([id, tracked]) => {
      currentHighlights.forEach((current, idx) => {
        const dist = getDistance(tracked, current);
        if (dist < MAX_DISTANCE) {
          matchCandidates.push({ id, idx, dist, tracked, current });
        }
      });
    });

    // 거리 순으로 정렬하여 가까운 것부터 매칭
    matchCandidates.sort((a, b) => a.dist - b.dist);

    const matchResults = new Map(); // 새 하이라이트 인덱스 -> 추적 ID

    for (const candidate of matchCandidates) {
      if (matched.has(candidate.idx) || matchedTracked.has(candidate.id)) {
        continue; // 이미 매칭됨
      }

      // 매칭 성공
      matched.add(candidate.idx);
      matchedTracked.add(candidate.id);
      matchResults.set(candidate.idx, candidate.id);

      // 추적 객체 업데이트
      const tracked = trackedObjectsRef.current.get(candidate.id);
      tracked.x = candidate.current.x;
      tracked.y = candidate.current.y;
      tracked.width = candidate.current.width;
      tracked.height = candidate.current.height;
      tracked.lastSeen = now;

      // 투표 기반 값 업데이트 - 각 값의 출현 횟수 카운트
      if (candidate.current.value) {
        const value = String(candidate.current.value).trim();
        if (value && value !== 'null' && value !== 'undefined') {
          // valueCounts Map이 없으면 생성
          if (!tracked.valueCounts) {
            tracked.valueCounts = new Map();
          }
          // 현재 값의 카운트 증가
          const currentCount = tracked.valueCounts.get(value) || 0;
          tracked.valueCounts.set(value, currentCount + 1);

          // 가장 많이 나온 값을 bestValue로 설정
          let maxCount = 0;
          let bestValue = null;
          for (const [v, count] of tracked.valueCounts) {
            if (count > maxCount) {
              maxCount = count;
              bestValue = v;
            }
          }
          tracked.bestValue = bestValue;
          tracked.bestValueCount = maxCount;
        }
      }
    }

    // 매칭되지 않은 새 하이라이트에 새 ID 부여
    currentHighlights.forEach((current, idx) => {
      if (!matched.has(idx)) {
        const newId = nextIdRef.current++;
        const value = current.value ? String(current.value).trim() : null;
        const validValue = value && value !== 'null' && value !== 'undefined' ? value : null;

        const valueCounts = new Map();
        if (validValue) {
          valueCounts.set(validValue, 1);
        }

        trackedObjectsRef.current.set(newId, {
          x: current.x,
          y: current.y,
          width: current.width,
          height: current.height,
          valueCounts: valueCounts,
          bestValue: validValue,
          bestValueCount: validValue ? 1 : 0,
          lastSeen: now,
        });
        matchResults.set(idx, newId);
      }
    });

    // 오래된 추적 객체 제거
    for (const [id, tracked] of trackedObjectsRef.current) {
      if (now - tracked.lastSeen > 500) {
        trackedObjectsRef.current.delete(id);
      }
    }

    // 최종 결과 생성 - bestValue 사용 (투표 결과)
    const newTracked = currentHighlights.map((current, idx) => {
      const trackId = matchResults.get(idx);
      const tracked = trackedObjectsRef.current.get(trackId);

      return {
        ...current.original,
        key: `track-${trackId}`,
        value: tracked?.bestValue || current.value,
        voteCount: tracked?.bestValueCount || 0,
        colorIndex: trackId % LABEL_COLORS.length, // 각 바코드별 고유 색상
      };
    });

    setTrackedHighlights(newTracked);

    // 화면에 표시되는 하이라이트 개수를 부모에게 알림
    if (onVisibleCountChange) {
      onVisibleCountChange(newTracked.length);
    }

    // 검증된 바코드만 콜백 (3회 이상 동일 값 감지된 경우)
    if (onVerifiedBarcodesChange) {
      const verifiedBarcodes = [];
      for (const [id, tracked] of trackedObjectsRef.current) {
        if (tracked.bestValue && tracked.bestValueCount >= 3) {
          verifiedBarcodes.push({
            value: tracked.bestValue,
            voteCount: tracked.bestValueCount,
            type: 'qr', // TODO: 타입도 추적하면 좋음
          });
        }
      }

      // 변경된 경우에만 콜백 호출 (중복 방지)
      if (verifiedBarcodes.length > 0) {
        const verifiedKey = verifiedBarcodes.map(bc => `${bc.value}:${bc.voteCount}`).sort().join('|');
        if (verifiedKey !== lastVerifiedKeyRef.current) {
          lastVerifiedKeyRef.current = verifiedKey;
          onVerifiedBarcodesChange(verifiedBarcodes);
        }
      }
    }
  }, [highlights, barcodes, selectCenterOnly, onVisibleCountChange, onVerifiedBarcodesChange]);

  if (trackedHighlights.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {trackedHighlights.map((highlight) => (
        <AnimatedHighlight
          key={highlight.key}
          highlight={highlight}
          borderColor={borderColor}
          fillColor={fillColor}
          showValue={showValues}
          value={highlight.value}
          labelBackgroundColor={LABEL_COLORS[highlight.colorIndex] || LABEL_COLORS[0]}
        />
      ))}
    </View>
  );
};

// 바코드 타입 매핑 (expo-camera 타입 -> @mgcrea/vision-camera-barcode-scanner 타입)
const BARCODE_TYPE_MAP = {
  'qr': 'qr',
  'ean13': 'ean-13',
  'ean8': 'ean-8',
  'code128': 'code-128',
  'code39': 'code-39',
  'code93': 'code-93',
  'upce': 'upc-e',
  'upca': 'upc-a',
  'itf14': 'itf',
  'codabar': 'codabar',
  'pdf417': 'pdf-417',
  'aztec': 'aztec',
  'datamatrix': 'data-matrix',
};

// Vision Camera 타입 -> expo-camera 타입 (역매핑)
const BARCODE_TYPE_REVERSE_MAP = Object.fromEntries(
  Object.entries(BARCODE_TYPE_MAP).map(([k, v]) => [v, k])
);

export const NativeQRScanner = forwardRef(function NativeQRScanner({
  isActive = true,
  torch = 'off',
  facing = 'back',
  barcodeTypes = ['qr'],
  onCodeScanned,
  onMultipleCodesDetected, // 2개 이상 바코드 감지 시 콜백
  onDetectedBarcodesChange, // 감지된 바코드 목록 변경 시 콜백 (React 상태 기반, Worklet 우회)
  onVerifiedBarcodesChange, // 검증된 바코드 콜백 (투표 기반 - 각 바운더리가 검증한 값)
  onVisibleHighlightsChange, // 화면에 표시되는 하이라이트 개수 변경 시 콜백
  multiCodeThreshold = 2, // 다중 감지 기준 (기본 2개)
  selectCenterBarcode = true, // 여러 코드 감지 시 중앙에 가장 가까운 코드만 선택 (기본값: true)
  showBarcodeValues = true, // 바코드 경계 아래에 값 표시 여부 (기본값: true)
  onError,
  style,
  showHighlights = false, // 하이라이트 표시 여부 (기본값: false)
  highlightColor = 'lime',
  highlightFillColor = 'rgba(0, 255, 0, 0.2)', // 하이라이트 내부 채우기 색상
}, ref) {
  const cameraRef = useRef(null);

  // Vision Camera v4 권한 훅 사용
  const { hasPermission, requestPermission } = useCameraPermission();

  // onCodeScanned의 최신 참조를 유지하기 위한 ref
  const onCodeScannedRef = useRef(onCodeScanned);
  useEffect(() => {
    onCodeScannedRef.current = onCodeScanned;
  }, [onCodeScanned]);

  // onMultipleCodesDetected의 최신 참조를 유지하기 위한 ref
  const onMultipleCodesDetectedRef = useRef(onMultipleCodesDetected);
  useEffect(() => {
    onMultipleCodesDetectedRef.current = onMultipleCodesDetected;
  }, [onMultipleCodesDetected]);

  // onDetectedBarcodesChange의 최신 참조를 유지하기 위한 ref
  const onDetectedBarcodesChangeRef = useRef(onDetectedBarcodesChange);
  useEffect(() => {
    onDetectedBarcodesChangeRef.current = onDetectedBarcodesChange;
  }, [onDetectedBarcodesChange]);

  // 현재 감지된 바코드 목록 (하이라이트에 값 표시용)
  const [detectedBarcodes, setDetectedBarcodes] = useState([]);
  const detectedBarcodesTimeoutRef = useRef(null);
  const lastBarcodesKeyRef = useRef(''); // 이전 바코드 키 (변경 감지용)

  // selectCenterBarcode를 worklet에서 사용하기 위한 shared value
  const selectCenterBarcodeShared = useSharedValue(selectCenterBarcode);
  useEffect(() => {
    console.log(`[NativeQRScanner] selectCenterBarcode prop changed: ${selectCenterBarcode}`);
    selectCenterBarcodeShared.value = selectCenterBarcode;
  }, [selectCenterBarcode]);

  // 카메라 디바이스 선택
  const device = useCameraDevice(facing);

  // 바코드 타입 변환 (expo-camera 형식 -> vision-camera-barcode-scanner 형식)
  const visionCameraCodeTypes = useMemo(() => {
    const types = barcodeTypes
      .map(type => BARCODE_TYPE_MAP[type])
      .filter(Boolean);
    return types.length > 0 ? types : ['qr'];
  }, [barcodeTypes]);

  // 카메라 프레임 크기 가져오기 (코드 스캐너 좌표 변환용)
  const frameDimensions = useMemo(() => {
    if (!device) return null;

    const formats = device.formats;
    if (formats && formats.length > 0) {
      const bestFormat = formats.reduce((best, current) => {
        const bestPixels = (best.videoWidth || 0) * (best.videoHeight || 0);
        const currentPixels = (current.videoWidth || 0) * (current.videoHeight || 0);
        return currentPixels > bestPixels ? current : best;
      }, formats[0]);

      return {
        width: bestFormat.videoWidth || 1920,
        height: bestFormat.videoHeight || 1440,
      };
    }

    return { width: 1920, height: 1440 };
  }, [device]);

  // 바코드 스캔 콜백 핸들러 (JS 스레드에서 실행)
  const handleBarcodeDetected = useCallback((barcodeData) => {
    if (!onCodeScannedRef.current) {
      return;
    }

    // 바코드 타입 역매핑 (expo-camera 형식으로 변환)
    const normalizedType = BARCODE_TYPE_REVERSE_MAP[barcodeData.type] || barcodeData.type;

    // cornerPoints를 bounds 형식으로 변환
    let bounds = null;
    let cornerPoints = null;

    if (barcodeData.cornerPoints && barcodeData.cornerPoints.length >= 4) {
      cornerPoints = barcodeData.cornerPoints;
      const xCoords = barcodeData.cornerPoints.map(c => c.x);
      const yCoords = barcodeData.cornerPoints.map(c => c.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      bounds = {
        origin: { x: minX, y: minY },
        size: { width: maxX - minX, height: maxY - minY },
      };
    } else if (barcodeData.frame) {
      bounds = {
        origin: { x: barcodeData.frame.x, y: barcodeData.frame.y },
        size: { width: barcodeData.frame.width, height: barcodeData.frame.height },
      };
    }

    onCodeScannedRef.current({
      data: barcodeData.value,
      type: normalizedType,
      bounds,
      cornerPoints,
      raw: barcodeData.value,
      frameDimensions: barcodeData.frameDimensions,
      // EC level: native에서 직접 가져옴
      errorCorrectionLevel: barcodeData.errorCorrectionLevel,
    });
  }, []);

  // Worklets.createRunOnJS로 JS 스레드에서 실행할 함수 생성
  const runOnJSCallback = Worklets.createRunOnJS(handleBarcodeDetected);

  // 감지된 바코드 상태 업데이트 (하이라이트에 값 표시용)
  const updateDetectedBarcodes = useCallback((barcodesData) => {
    // 기존 타임아웃 클리어
    if (detectedBarcodesTimeoutRef.current) {
      clearTimeout(detectedBarcodesTimeoutRef.current);
    }

    const barcodes = barcodesData || [];
    setDetectedBarcodes(barcodes);

    // 바코드 값 기반 키 생성 (변경 감지용) - 빈 값 엄격히 필터링
    const validBarcodes = barcodes.filter(bc => {
      if (!bc.value) return false;
      const value = String(bc.value).trim();
      return value.length > 0 && value !== 'null' && value !== 'undefined';
    });
    const barcodesKey = validBarcodes.map(bc => bc.value).sort().join('|');

    // 바코드가 변경된 경우에만 콜백 호출 (무한 루프 방지)
    if (onDetectedBarcodesChangeRef.current && validBarcodes.length > 0 && barcodesKey !== lastBarcodesKeyRef.current) {
      lastBarcodesKeyRef.current = barcodesKey;
      onDetectedBarcodesChangeRef.current(validBarcodes);
    }

    // 500ms 후 자동으로 클리어 (바코드가 화면에서 사라지면)
    detectedBarcodesTimeoutRef.current = setTimeout(() => {
      setDetectedBarcodes([]);
      lastBarcodesKeyRef.current = ''; // 키도 초기화
    }, 500);
  }, []);

  // 다중 바코드 감지 콜백 핸들러 (JS 스레드에서 실행)
  // barcodesDataJson: JSON 문자열로 전달받아 파싱 (Worklet 직렬화 문제 방지)
  const handleMultipleCodesDetected = useCallback((count, barcodesDataJson) => {
    try {
      const barcodesData = JSON.parse(barcodesDataJson || '[]');
      console.log(`[NativeQRScanner] Multiple codes detected: ${count}, parsed=${barcodesData?.length}`);
      if (onMultipleCodesDetectedRef.current) {
        onMultipleCodesDetectedRef.current(count, barcodesData);
      }
    } catch (e) {
      console.error('[NativeQRScanner] Failed to parse barcodes:', e);
    }
  }, []);

  // 디버그 로그용 콜백 (Worklet에서 JS로 로그 전달)
  const logBarcodeCount = useCallback((count, selectCenterValue, barcodeInfo, filteredCount) => {
    if (count > 1) {
      console.log(`[NativeQRScanner] Frame: raw=${count}, filtered=${filteredCount}, selectCenterBarcode: ${selectCenterValue}`);
      // 각 바코드의 상세 정보 출력
      if (barcodeInfo) {
        console.log(`[NativeQRScanner] Barcodes detail: ${barcodeInfo}`);
      }
    }
  }, []);

  // 다중 바코드 감지용 Worklet 콜백
  const runOnJSMultiCallback = Worklets.createRunOnJS(handleMultipleCodesDetected);
  const runOnJSLogCallback = Worklets.createRunOnJS(logBarcodeCount);
  const runOnJSUpdateBarcodes = Worklets.createRunOnJS(updateDetectedBarcodes);

  // @mgcrea/vision-camera-barcode-scanner useBarcodeScanner 훅 사용
  const { props: cameraProps, highlights } = useBarcodeScanner({
    fps: 10,
    barcodeTypes: visionCameraCodeTypes,
    scanMode: 'continuous',
    onBarcodeScanned: (barcodes) => {
      'worklet';

      if (barcodes.length === 0) {
        return;
      }

      // 다중 바코드 감지 시 (multiCodeThreshold 이상)
      if (barcodes.length >= multiCodeThreshold) {
        // 바코드 데이터를 JS 스레드로 전달 (직렬화 가능한 형태로)
        // value가 없을 경우 displayValue, rawValue, data 순으로 fallback
        const allBarcodesData = []; // 하이라이트 표시용 (모든 바코드)
        const validBarcodesData = []; // 다중 코드 감지용 (유효한 바코드만)
        const barcodeDetails = [];

        for (let i = 0; i < barcodes.length; i++) {
          const barcode = barcodes[i];
          const rawValue = barcode.value || barcode.displayValue || barcode.rawValue || barcode.data || '';
          // 값을 문자열로 변환하고 공백 제거
          const value = String(rawValue).trim();

          // 디버그: 각 바코드의 값 정보 기록
          barcodeDetails.push(`[${i}]: v="${value}" (raw="${barcode.value}")`);

          // 하이라이트 표시용 - 모든 바코드 (인덱스 매칭용)
          allBarcodesData.push({
            value: value || null,
            type: barcode.type,
            frame: barcode.frame,
          });

          // 다중 코드 감지용 - 빈 값이 아닌 경우에만
          if (value && value.length > 0 && value !== 'undefined' && value !== 'null') {
            validBarcodesData.push({
              value: value,
              type: barcode.type,
              frame: barcode.frame,
            });
          }
        }

        // 디버그 로그: 필터링 전후 개수와 각 바코드의 값
        runOnJSLogCallback(barcodes.length, selectCenterBarcodeShared.value, barcodeDetails.join(' | '), validBarcodesData.length);

        // 바코드가 없으면 무시
        if (allBarcodesData.length === 0) {
          return;
        }

        // 하이라이트에 값 표시를 위해 모든 바코드 상태 업데이트
        runOnJSUpdateBarcodes(allBarcodesData);

        // selectCenterBarcode가 true이면 중앙에 가장 가까운 코드만 선택 (여러 코드 인식 모드 OFF)
        if (selectCenterBarcodeShared.value) {
          // 프레임 중앙 좌표 계산
          const frameWidth = frameDimensions?.width || 1920;
          const frameHeight = frameDimensions?.height || 1440;
          const centerX = frameWidth / 2;
          const centerY = frameHeight / 2;

          // 필터링된 바코드 중에서 중앙에 가장 가까운 것을 선택
          let closestBarcode = validBarcodesData[0];
          let closestOriginalBarcode = barcodes[0];
          let minDistance = Number.MAX_VALUE;

          for (let i = 0; i < validBarcodesData.length; i++) {
            const bc = validBarcodesData[i];
            if (bc.frame) {
              // 바코드 중앙 좌표
              const bcCenterX = bc.frame.x + bc.frame.width / 2;
              const bcCenterY = bc.frame.y + bc.frame.height / 2;
              // 거리 계산 (유클리드 거리)
              const distance = Math.sqrt(
                Math.pow(bcCenterX - centerX, 2) + Math.pow(bcCenterY - centerY, 2)
              );
              if (distance < minDistance) {
                minDistance = distance;
                closestBarcode = bc;
                // 원본 바코드에서 EC level 가져오기 위해 인덱스로 찾기
                closestOriginalBarcode = barcodes.find(
                  (b) => b.frame && b.frame.x === bc.frame.x && b.frame.y === bc.frame.y
                ) || barcodes[0];
              }
            }
          }

          // 중앙에 가장 가까운 바코드로 단일 스캔 콜백 호출
          const ecLevel = closestOriginalBarcode.errorCorrectionLevel || closestOriginalBarcode.native?.errorCorrectionLevel;
          runOnJSCallback({
            value: closestBarcode.value,
            type: closestBarcode.type,
            frame: closestBarcode.frame,
            cornerPoints: closestOriginalBarcode.cornerPoints,
            frameDimensions: frameDimensions,
            errorCorrectionLevel: ecLevel,
          });
          return;
        }

        // 여러 코드 인식 모드 ON: 다중 감지 콜백 호출 (JSON 문자열로 전달)
        const barcodesJson = JSON.stringify(allBarcodesData);
        runOnJSMultiCallback(allBarcodesData.length, barcodesJson);
        return; // 다중 감지 시 개별 스캔 콜백 호출 안 함
      }

      // 여러 코드 인식 모드 ON이고 1개만 감지된 경우에도 멀티 콜백 호출
      if (!selectCenterBarcodeShared.value && barcodes.length === 1) {
        const barcode = barcodes[0];
        const rawValue = barcode.value || barcode.displayValue || barcode.rawValue || barcode.data || '';
        const value = String(rawValue).trim();

        if (value && value.length > 0 && value !== 'undefined' && value !== 'null') {
          const singleBarcodeData = [{
            value: value,
            type: barcode.type,
            frame: barcode.frame,
          }];
          runOnJSMultiCallback(1, JSON.stringify(singleBarcodeData));
          return;
        }
      }

      const barcode = barcodes[0];

      // EC level: 라이브러리 패치로 barcode.errorCorrectionLevel에 있거나,
      // native 객체에서 직접 가져옴
      const ecLevel = barcode.errorCorrectionLevel || barcode.native?.errorCorrectionLevel;

      runOnJSCallback({
        value: barcode.value,
        type: barcode.type,
        frame: barcode.frame,
        cornerPoints: barcode.cornerPoints,
        frameDimensions: frameDimensions,
        errorCorrectionLevel: ecLevel,
      });
    },
  });

  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted && onError) {
          onError({ message: 'Camera permission denied' });
        }
      }
    })();
  }, [hasPermission, requestPermission, onError]);

  // 카메라 에러 핸들러
  const handleCameraError = useCallback((error) => {
    console.error('[NativeQRScanner] Camera error:', error);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  // ref를 통해 메서드 노출
  useImperativeHandle(ref, () => ({
    takePhoto: async (options = {}) => {
      if (!cameraRef.current) {
        console.log('[NativeQRScanner] Camera not ready for capture');
        return null;
      }

      try {
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'quality',
          flash: 'off',
          enableShutterSound: false,
        });

        return {
          uri: `file://${photo.path}`,
          path: photo.path,
          width: photo.width,
          height: photo.height,
        };
      } catch (error) {
        console.error('[NativeQRScanner] Photo capture error:', error);
        return null;
      }
    },
    takePictureAsync: async (options = {}) => {
      if (!cameraRef.current) {
        console.log('[NativeQRScanner] Camera not ready for capture');
        return null;
      }

      try {
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'quality',
          flash: 'off',
          enableShutterSound: false,
        });

        return {
          uri: `file://${photo.path}`,
          path: photo.path,
          width: photo.width,
          height: photo.height,
        };
      } catch (error) {
        console.error('[NativeQRScanner] Photo capture error:', error);
        return null;
      }
    },
  }), []);

  if (!device || !hasPermission) {
    return <View style={[styles.container, style]} />;
  }

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        torch={torch}
        photo={true}
        onError={handleCameraError}
        enableZoomGesture={true}
        {...cameraProps}
      />
      {showHighlights && (
        <CustomHighlights
          highlights={highlights}
          barcodes={detectedBarcodes}
          borderColor={highlightColor}
          fillColor={highlightFillColor}
          showBarcodeValues={showBarcodeValues}
          selectCenterOnly={selectCenterBarcode}
          onVisibleCountChange={onVisibleHighlightsChange}
          onVerifiedBarcodesChange={onVerifiedBarcodesChange}
        />
      )}
    </View>
  );
});

export function useNativeCamera() {
  const cameraRef = useRef(null);

  const takePictureAsync = useCallback(async (options = {}) => {
    if (!cameraRef.current) {
      console.log('[useNativeCamera] Camera not ready');
      return null;
    }

    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'off',
        enableShutterSound: false,
      });

      return {
        uri: `file://${photo.path}`,
        width: photo.width,
        height: photo.height,
      };
    } catch (error) {
      console.error('[useNativeCamera] Photo capture error:', error);
      return null;
    }
  }, []);

  return {
    cameraRef,
    takePictureAsync,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  valueLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  valueLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NativeQRScanner;
