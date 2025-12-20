// components/NativeQRScanner/index.js
// Vision Camera v4 기반 네이티브 QR 스캐너 컴포넌트
// mgcrea/vision-camera-barcode-scanner 라이브러리 사용

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Platform, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from 'react-native-vision-camera';
import {
  useBarcodeScanner,
  CameraHighlights,
} from '@mgcrea/vision-camera-barcode-scanner';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 바코드 타입 매핑 (expo-camera 타입 -> mgcrea 라이브러리 타입)
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
}, ref) {
  const cameraRef = useRef(null);
  const [layout, setLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

  // Vision Camera v4 권한 훅 사용
  const { hasPermission, requestPermission } = useCameraPermission();

  // onCodeScanned의 최신 참조를 유지하기 위한 ref
  const onCodeScannedRef = useRef(onCodeScanned);
  useEffect(() => {
    onCodeScannedRef.current = onCodeScanned;
  }, [onCodeScanned]);

  // 카메라 디바이스 선택
  const device = useCameraDevice(facing);

  // 카메라 포맷 선택 (1080p 권장)
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } },
  ]);

  // 바코드 타입 변환 (expo-camera 형식 -> mgcrea 형식)
  const mgcreaBarcodeTypes = useMemo(() => {
    const types = barcodeTypes
      .map(type => BARCODE_TYPE_MAP[type])
      .filter(Boolean);
    console.log('[NativeQRScanner] Converted barcode types:', types);
    return types.length > 0 ? types : ['qr'];
  }, [barcodeTypes]);

  // mgcrea useBarcodeScanner 훅 사용
  const { props: cameraProps, highlights } = useBarcodeScanner({
    fps: 5,
    barcodeTypes: mgcreaBarcodeTypes,
    scanMode: 'continuous',
    onBarcodeScanned: (barcodes) => {
      'worklet';
      // worklet에서는 console.log 사용 불가, runOnJS 필요
      if (barcodes.length === 0) return;
      if (!onCodeScannedRef.current) return;

      const code = barcodes[0];

      // expo-camera 형식으로 변환하여 콜백 호출
      const normalizedType = BARCODE_TYPE_REVERSE_MAP[code.type] || code.type;

      // cornerPoints를 bounds 형식으로 변환
      let bounds = null;
      let cornerPoints = null;

      if (code.cornerPoints && code.cornerPoints.length >= 4) {
        cornerPoints = code.cornerPoints;
        const xCoords = code.cornerPoints.map(c => c.x);
        const yCoords = code.cornerPoints.map(c => c.y);
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);

        bounds = {
          origin: { x: minX, y: minY },
          size: { width: maxX - minX, height: maxY - minY },
        };
      }

      // runOnJS로 메인 스레드에서 콜백 실행
      // worklet에서 직접 호출하면 안되므로 타이밍 조정
      onCodeScannedRef.current({
        data: code.value,
        type: normalizedType,
        bounds,
        cornerPoints,
        raw: code.value,
        // mgcrea 라이브러리가 좌표 변환을 처리하므로 frameDimensions는 불필요
        frameDimensions: null,
      });
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

  // 레이아웃 변경 핸들러
  const handleLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

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
    // highlights 반환 (외부에서 CameraHighlights 렌더링용)
    getHighlights: () => highlights,
  }), [highlights]);

  // 컴포넌트 마운트/언마운트 로그
  useEffect(() => {
    console.log('[NativeQRScanner] Component MOUNTED (using mgcrea library)');
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
  console.log('[NativeQRScanner] highlights count:', highlights?.length || 0);

  if (!device) {
    console.log('[NativeQRScanner] Waiting for camera device...');
    return <View style={[styles.container, style]} />;
  }

  if (!hasPermission) {
    console.log('[NativeQRScanner] Waiting for camera permission...');
    return <View style={[styles.container, style]} />;
  }

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={handleLayout}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={isActive}
        torch={torch}
        photo={true}
        onError={handleCameraError}
        enableZoomGesture={true}
        {...cameraProps}
      />
      {/* mgcrea CameraHighlights로 바코드 위치 표시 */}
      <CameraHighlights
        highlights={highlights}
        color="#FFD60A"
      />
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
