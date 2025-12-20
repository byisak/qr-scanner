// components/NativeQRScanner/index.js
// Vision Camera v4 기반 네이티브 QR 스캐너 컴포넌트

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Platform, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
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

  // Vision Camera v4 권한 훅 사용
  const { hasPermission, requestPermission } = useCameraPermission();

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

  // 코드 스캐너 설정 - useCodeScanner 훅 사용
  const codeScanner = useCodeScanner({
    codeTypes: visionCameraCodeTypes,
    onCodeScanned: (codes) => {
      console.log('[NativeQRScanner] ===== CODE SCANNED =====');
      console.log('[NativeQRScanner] Number of codes:', codes.length);

      if (codes.length === 0) {
        console.log('[NativeQRScanner] No codes in array');
        return;
      }

      if (!onCodeScannedRef.current) {
        console.log('[NativeQRScanner] No callback registered');
        return;
      }

      const code = codes[0];
      console.log('[NativeQRScanner] Code value:', code.value);
      console.log('[NativeQRScanner] Code type:', code.type);
      console.log('[NativeQRScanner] Code frame:', JSON.stringify(code.frame));
      console.log('[NativeQRScanner] Code corners:', JSON.stringify(code.corners));
      console.log('[NativeQRScanner] Frame dimensions:', JSON.stringify(frameDimensions));

      // expo-camera 형식으로 변환
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

      console.log('[NativeQRScanner] Calling parent callback...');
      onCodeScannedRef.current({
        data: code.value,
        type: normalizedType,
        bounds,
        cornerPoints,
        raw: code.value,
        // 카메라 프레임 크기 정보 추가 (좌표 변환용)
        frameDimensions: frameDimensions,
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
    <Camera
      ref={cameraRef}
      style={[StyleSheet.absoluteFill, style]}
      device={device}
      isActive={isActive}
      torch={torch}
      codeScanner={codeScanner}
      photo={true}
      onError={handleCameraError}
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
