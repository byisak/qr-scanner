// components/NativeQRScanner/index.js
// Vision Camera v4 기반 네이티브 QR 스캐너 컴포넌트

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Platform, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCodeScanner,
} from 'react-native-vision-camera';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 바코드 타입 매핑 (expo-camera 타입 -> Vision Camera 타입)
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
  const [hasPermission, setHasPermission] = useState(false);

  // 카메라 디바이스 선택
  const device = useCameraDevice(facing);

  // 최적 포맷 선택 (1080p, 30fps)
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } },
    { fps: 30 },
  ]);

  // 바코드 타입 변환 (expo-camera 형식 -> Vision Camera 형식)
  const visionCameraCodeTypes = useMemo(() => {
    return barcodeTypes
      .map(type => BARCODE_TYPE_MAP[type])
      .filter(Boolean);
  }, [barcodeTypes]);

  // 코드 스캐너 설정 (디바운싱 제거 - ScannerScreen에서 처리)
  const codeScanner = useCodeScanner({
    codeTypes: visionCameraCodeTypes.length > 0 ? visionCameraCodeTypes : ['qr'],
    onCodeScanned: (codes) => {
      if (!onCodeScanned || codes.length === 0) return;

      const code = codes[0];

      // expo-camera 형식으로 변환하여 콜백 호출
      const normalizedType = BARCODE_TYPE_REVERSE_MAP[code.type] || code.type;

      // cornerPoints를 bounds 형식으로 변환 (화면 좌표로 변환)
      let bounds = null;
      let cornerPoints = null;

      if (code.corners && code.corners.length >= 4) {
        // Vision Camera의 corners는 이미 화면 좌표
        cornerPoints = code.corners;
        const xCoords = code.corners.map(c => c.x);
        const yCoords = code.corners.map(c => c.y);
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);

        bounds = {
          origin: { x: minX, y: minY },
          size: { width: maxX - minX, height: maxY - minY },
        };
      } else if (code.frame) {
        bounds = {
          origin: { x: code.frame.x, y: code.frame.y },
          size: { width: code.frame.width, height: code.frame.height },
        };
      }

      console.log('[NativeQRScanner] Code scanned:', code.value, 'Type:', normalizedType, 'Bounds:', bounds);

      onCodeScanned({
        data: code.value,
        type: normalizedType,
        bounds,
        cornerPoints,
        raw: code.value,
      });
    },
  });

  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      if (status !== 'granted' && onError) {
        onError({ message: 'Camera permission denied' });
      }
    })();
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
    // expo-camera 호환성을 위한 별칭
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
    <Camera
      ref={cameraRef}
      style={[StyleSheet.absoluteFill, style]}
      device={device}
      format={format}
      isActive={isActive}
      torch={torch}
      codeScanner={codeScanner}
      photo={true}
      enableZoomGesture={true}
      exposure={0}
      // Android 최적화
      androidPreviewViewType="surface-view"
      // iOS 최적화
      videoStabilizationMode="auto"
    />
  );
});

// takePictureAsync를 외부에서 호출할 수 있도록 하는 훅
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
