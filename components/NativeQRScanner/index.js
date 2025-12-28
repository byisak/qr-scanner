// components/NativeQRScanner/index.js
// @mgcrea/vision-camera-barcode-scanner 기반 네이티브 QR 스캐너 컴포넌트

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
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

// 애니메이션 하이라이트 컴포넌트 (부드럽게 따라다님)
const AnimatedHighlight = ({ highlight, borderColor, fillColor }) => {
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

  return <Animated.View style={animatedStyle} />;
};

// 커스텀 하이라이트 컴포넌트 (애니메이션 적용)
const CustomHighlights = ({ highlights, borderColor = 'lime', fillColor = 'rgba(0, 255, 0, 0.15)' }) => {
  const [trackedHighlights, setTrackedHighlights] = useState([]);
  const lastUpdateRef = useRef(0);

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

    setTrackedHighlights(highlights.map((h, i) => ({
      ...h,
      key: `highlight-${i}`,
    })));
  }, [highlights]);

  if (trackedHighlights.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {trackedHighlights.map((highlight) => (
        <AnimatedHighlight
          key={highlight.key}
          highlight={highlight}
          borderColor={borderColor}
          fillColor={fillColor}
        />
      ))}
    </View>
  );
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
          borderColor={highlightColor}
          fillColor={highlightFillColor}
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
});

export default NativeQRScanner;
