// components/NativeQRScanner/index.js
// @mgcrea/vision-camera-barcode-scanner 기반 네이티브 QR 스캐너 컴포넌트

import React, { useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  useBarcodeScanner,
  CameraHighlights,
} from '@mgcrea/vision-camera-barcode-scanner';
import { runOnJS } from 'react-native-worklets-core';

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
    console.log('[NativeQRScanner] Converted code types:', types);
    return types.length > 0 ? types : ['qr'];
  }, [barcodeTypes]);

  // 카메라 프레임 크기 가져오기 (코드 스캐너 좌표 변환용)
  const frameDimensions = useMemo(() => {
    if (!device) return null;

    // 디바이스의 활성 포맷 또는 첫 번째 포맷에서 해상도 가져오기
    const formats = device.formats;
    if (formats && formats.length > 0) {
      // 가장 높은 해상도 포맷 찾기 (보통 코드 스캐너가 사용하는 해상도)
      const bestFormat = formats.reduce((best, current) => {
        const bestPixels = (best.videoWidth || 0) * (best.videoHeight || 0);
        const currentPixels = (current.videoWidth || 0) * (current.videoHeight || 0);
        return currentPixels > bestPixels ? current : best;
      }, formats[0]);

      console.log('[NativeQRScanner] Best format:', bestFormat.videoWidth, 'x', bestFormat.videoHeight);
      return {
        width: bestFormat.videoWidth || 1920,
        height: bestFormat.videoHeight || 1440,
      };
    }

    // 기본값 (iOS 일반적인 4:3 해상도)
    return { width: 1920, height: 1440 };
  }, [device]);

  // 바코드 스캔 콜백 핸들러 (JS 스레드에서 실행)
  const handleBarcodeDetected = useCallback((barcode, currentFrameDimensions) => {
    console.log('[NativeQRScanner] ===== CODE SCANNED =====');
    console.log('[NativeQRScanner] Code value:', barcode.value);
    console.log('[NativeQRScanner] Code type:', barcode.type);
    console.log('[NativeQRScanner] Code frame:', JSON.stringify(barcode.frame));
    console.log('[NativeQRScanner] Code cornerPoints:', JSON.stringify(barcode.cornerPoints));
    console.log('[NativeQRScanner] Frame dimensions:', JSON.stringify(currentFrameDimensions));

    if (!onCodeScannedRef.current) {
      console.log('[NativeQRScanner] No callback registered');
      return;
    }

    // 바코드 타입 역매핑 (expo-camera 형식으로 변환)
    const normalizedType = BARCODE_TYPE_REVERSE_MAP[barcode.type] || barcode.type;

    // cornerPoints를 bounds 형식으로 변환
    let bounds = null;
    let cornerPoints = null;

    if (barcode.cornerPoints && barcode.cornerPoints.length >= 4) {
      cornerPoints = barcode.cornerPoints;
      const xCoords = barcode.cornerPoints.map(c => c.x);
      const yCoords = barcode.cornerPoints.map(c => c.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      bounds = {
        origin: { x: minX, y: minY },
        size: { width: maxX - minX, height: maxY - minY },
      };
    } else if (barcode.frame) {
      bounds = {
        origin: { x: barcode.frame.x, y: barcode.frame.y },
        size: { width: barcode.frame.width, height: barcode.frame.height },
      };
    }

    console.log('[NativeQRScanner] Calling parent callback...');
    onCodeScannedRef.current({
      data: barcode.value,
      type: normalizedType,
      bounds,
      cornerPoints,
      raw: barcode.value,
      // 카메라 프레임 크기 정보 추가 (좌표 변환용)
      frameDimensions: currentFrameDimensions,
    });
  }, []);

  // @mgcrea/vision-camera-barcode-scanner useBarcodeScanner 훅 사용
  const { props: cameraProps, highlights } = useBarcodeScanner({
    fps: 5,
    barcodeTypes: visionCameraCodeTypes,
    scanMode: 'continuous',
    onBarcodeScanned: (barcodes) => {
      'worklet';

      if (barcodes.length === 0) {
        return;
      }

      const barcode = barcodes[0];

      // runOnJS를 사용하여 JS 스레드에서 콜백 실행
      runOnJS(handleBarcodeDetected)(barcode, frameDimensions);
    },
  });

  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      console.log('[NativeQRScanner] Current permission status:', hasPermission);
      if (!hasPermission) {
        console.log('[NativeQRScanner] Requesting camera permission...');
        const granted = await requestPermission();
        console.log('[NativeQRScanner] Permission granted:', granted);
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

  // 컴포넌트 마운트/언마운트 로그
  useEffect(() => {
    console.log('[NativeQRScanner] Component MOUNTED');
    return () => {
      console.log('[NativeQRScanner] Component UNMOUNTING...');
    };
  }, []);

  // isActive 변경 감지 로그
  useEffect(() => {
    console.log('[NativeQRScanner] isActive CHANGED to:', isActive);
    if (!isActive) {
      console.log('[NativeQRScanner] Camera will stop processing frames');
    }
  }, [isActive]);

  console.log('[NativeQRScanner] === RENDER ===');
  console.log('[NativeQRScanner] device:', device ? device.id : 'null');
  console.log('[NativeQRScanner] hasPermission:', hasPermission);
  console.log('[NativeQRScanner] isActive:', isActive);
  console.log('[NativeQRScanner] torch:', torch);

  if (!device) {
    console.log('[NativeQRScanner] Waiting for camera device...');
    return <View style={[styles.container, style]} />;
  }

  if (!hasPermission) {
    console.log('[NativeQRScanner] Waiting for camera permission...');
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
        <CameraHighlights highlights={highlights} color={highlightColor} />
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
