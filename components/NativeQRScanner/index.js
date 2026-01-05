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

// 애니메이션 하이라이트 컴포넌트 (부드럽게 따라다님)
const AnimatedHighlight = ({ highlight, borderColor, fillColor, showValue, value }) => {
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
    borderWidth: 3,
    borderColor: borderColor,
    backgroundColor: fillColor,
    borderRadius: 8,
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
          <View style={styles.valueLabel}>
            <Text style={styles.valueLabelText} numberOfLines={2}>
              {value}
            </Text>
          </View>
        </Animated.View>
      )}
    </>
  );
};

// 커스텀 하이라이트 컴포넌트 (애니메이션 적용)
const CustomHighlights = ({ highlights, barcodes = [], borderColor = 'lime', fillColor = 'rgba(0, 255, 0, 0.15)', showBarcodeValues = true, selectCenterOnly = false }) => {
  const [trackedHighlights, setTrackedHighlights] = useState([]);
  const lastUpdateRef = useRef(0);

  // 2개 이상이고 showBarcodeValues가 true일 때만 값 표시
  const showValues = showBarcodeValues && barcodes.length >= 2;

  useEffect(() => {
    if (!highlights || highlights.length === 0) {
      // 하이라이트가 없으면 페이드아웃
      const timeout = setTimeout(() => {
        setTrackedHighlights([]);
      }, 300);
      return () => clearTimeout(timeout);
    }

    // 너무 빠른 업데이트 방지 (60fps = 약 16ms)
    const now = Date.now();
    if (now - lastUpdateRef.current < 16) return;
    lastUpdateRef.current = now;

    let filteredHighlights = highlights;

    // selectCenterOnly가 true이면 중앙에 가장 가까운 하이라이트만 선택
    if (selectCenterOnly && highlights.length >= 2) {
      const screenCenterX = SCREEN_WIDTH / 2;
      const screenCenterY = SCREEN_HEIGHT / 2;

      let closestIndex = 0;
      let minDistance = Number.MAX_VALUE;

      highlights.forEach((h, i) => {
        // 하이라이트 중앙 좌표 계산
        const hCenterX = h.origin.x + h.size.width / 2;
        const hCenterY = h.origin.y + h.size.height / 2;
        // 화면 중앙과의 거리
        const distance = Math.sqrt(
          Math.pow(hCenterX - screenCenterX, 2) + Math.pow(hCenterY - screenCenterY, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      });

      filteredHighlights = [highlights[closestIndex]];
    }

    setTrackedHighlights(filteredHighlights.map((h, i) => ({
      ...h,
      key: `highlight-${i}`,
      value: barcodes[i]?.value || null,
    })));
  }, [highlights, barcodes, selectCenterOnly]);

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

  // 현재 감지된 바코드 목록 (하이라이트에 값 표시용)
  const [detectedBarcodes, setDetectedBarcodes] = useState([]);
  const detectedBarcodesTimeoutRef = useRef(null);

  // selectCenterBarcode를 worklet에서 사용하기 위한 shared value
  const selectCenterBarcodeShared = useSharedValue(selectCenterBarcode);
  useEffect(() => {
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

    setDetectedBarcodes(barcodesData || []);

    // 500ms 후 자동으로 클리어 (바코드가 화면에서 사라지면)
    detectedBarcodesTimeoutRef.current = setTimeout(() => {
      setDetectedBarcodes([]);
    }, 500);
  }, []);

  // 다중 바코드 감지 콜백 핸들러 (JS 스레드에서 실행)
  const handleMultipleCodesDetected = useCallback((count, barcodesData) => {
    console.log(`[NativeQRScanner] Multiple codes detected: ${count}`, barcodesData?.length);
    if (onMultipleCodesDetectedRef.current) {
      onMultipleCodesDetectedRef.current(count, barcodesData);
    }
  }, []);

  // 디버그 로그용 콜백 (Worklet에서 JS로 로그 전달)
  const logBarcodeCount = useCallback((count, selectCenterValue, barcodeInfo) => {
    if (count > 1) {
      console.log(`[NativeQRScanner] Frame barcodes count: ${count}, selectCenterBarcode: ${selectCenterValue}`);
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

      // 디버그: 프레임당 바코드 개수 및 모드 로그 (각 바코드의 값 관련 속성들 출력)
      const barcodeDetails = barcodes.map((bc, idx) => {
        // 모든 값 관련 속성들을 수집
        const valueProps = {
          value: bc.value,
          displayValue: bc.displayValue,
          rawValue: bc.rawValue,
          data: bc.data,
          rawData: bc.rawData,
          content: bc.content,
          type: bc.type,
        };
        return `[${idx}]: ${JSON.stringify(valueProps)}`;
      }).join(' | ');
      runOnJSLogCallback(barcodes.length, selectCenterBarcodeShared.value, barcodeDetails);

      // 다중 바코드 감지 시 (multiCodeThreshold 이상)
      if (barcodes.length >= multiCodeThreshold) {
        // 바코드 데이터를 JS 스레드로 전달 (직렬화 가능한 형태로)
        // value가 없을 경우 displayValue, rawValue, data 순으로 fallback
        // 빈 값인 바코드는 필터링 (바운드리 박스 전환 시 발생하는 빈 값 방지)
        const barcodesData = [];
        for (let i = 0; i < barcodes.length; i++) {
          const barcode = barcodes[i];
          const value = barcode.value || barcode.displayValue || barcode.rawValue || barcode.data || '';
          // 빈 값이 아닌 경우에만 추가
          if (value && value.length > 0) {
            barcodesData.push({
              value: value,
              type: barcode.type,
              frame: barcode.frame,
            });
          }
        }

        // 유효한 바코드가 없으면 무시
        if (barcodesData.length === 0) {
          return;
        }

        // 하이라이트에 값 표시를 위해 항상 바코드 상태 업데이트 (모드와 상관없이)
        runOnJSUpdateBarcodes(barcodesData);

        // selectCenterBarcode가 true이면 중앙에 가장 가까운 코드만 선택 (여러 코드 인식 모드 OFF)
        if (selectCenterBarcodeShared.value) {
          // 프레임 중앙 좌표 계산
          const frameWidth = frameDimensions?.width || 1920;
          const frameHeight = frameDimensions?.height || 1440;
          const centerX = frameWidth / 2;
          const centerY = frameHeight / 2;

          // 필터링된 바코드 중에서 중앙에 가장 가까운 것을 선택
          let closestBarcode = barcodesData[0];
          let closestOriginalBarcode = barcodes[0];
          let minDistance = Number.MAX_VALUE;

          for (let i = 0; i < barcodesData.length; i++) {
            const bc = barcodesData[i];
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

        // 여러 코드 인식 모드 ON: 다중 감지 콜백 호출 (필터링된 개수 전달)
        runOnJSMultiCallback(barcodesData.length, barcodesData);
        return; // 다중 감지 시 개별 스캔 콜백 호출 안 함
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
