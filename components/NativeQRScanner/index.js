// components/NativeQRScanner/index.js
// Vision Camera v4 기반 네이티브 QR 스캐너 컴포넌트

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Platform, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
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

  // onCodeScanned의 최신 참조를 유지하기 위한 ref
  const onCodeScannedRef = useRef(onCodeScanned);
  useEffect(() => {
    onCodeScannedRef.current = onCodeScanned;
  }, [onCodeScanned]);

  // 카메라 디바이스 선택
  const device = useCameraDevice(facing);

  // 바코드 타입 변환 (expo-camera 형식 -> Vision Camera 형식)
  const visionCameraCodeTypes = useMemo(() => {
    const types = barcodeTypes
      .map(type => BARCODE_TYPE_MAP[type])
      .filter(Boolean);
    console.log('[NativeQRScanner] Code types:', types);
    return types.length > 0 ? types : ['qr'];
  }, [barcodeTypes]);

  // 코드 스캐너 콜백
  const handleCodeScanned = useCallback((codes) => {
    console.log('[NativeQRScanner] Codes detected:', codes.length);

    if (!onCodeScannedRef.current || codes.length === 0) {
      console.log('[NativeQRScanner] No callback or no codes');
      return;
    }

    const code = codes[0];
    console.log('[NativeQRScanner] First code:', code.value, 'Type:', code.type);

    // expo-camera 형식으로 변환하여 콜백 호출
    const normalizedType = BARCODE_TYPE_REVERSE_MAP[code.type] || code.type;

    // cornerPoints를 bounds 형식으로 변환
    let bounds = null;
    let cornerPoints = null;

    if (code.corners && code.corners.length >= 4) {
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

    console.log('[NativeQRScanner] Calling onCodeScanned with:', code.value);

    onCodeScannedRef.current({
      data: code.value,
      type: normalizedType,
      bounds,
      cornerPoints,
      raw: code.value,
    });
  }, []);

  // 코드 스캐너 설정
  const codeScanner = useCodeScanner({
    codeTypes: visionCameraCodeTypes,
    onCodeScanned: handleCodeScanned,
  });

  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      console.log('[NativeQRScanner] Requesting camera permission...');
      const status = await Camera.requestCameraPermission();
      console.log('[NativeQRScanner] Permission status:', status);
      setHasPermission(status === 'granted');
      if (status !== 'granted' && onError) {
        onError({ message: 'Camera permission denied' });
      }
    })();
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
  }), []);

  console.log('[NativeQRScanner] Render - device:', !!device, 'hasPermission:', hasPermission, 'isActive:', isActive);

  if (!device) {
    console.log('[NativeQRScanner] No camera device available');
    return <View style={[styles.container, style]} />;
  }

  if (!hasPermission) {
    console.log('[NativeQRScanner] No camera permission');
    return <View style={[styles.container, style]} />;
  }

  return (
    <Camera
      ref={cameraRef}
      style={[StyleSheet.absoluteFill, style]}
      device={device}
      isActive={isActive}
      torch={torch}
      codeScanner={codeScanner}
      photo={true}
      enableZoomGesture={true}
    />
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
