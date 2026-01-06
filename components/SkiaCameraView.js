// components/SkiaCameraView.js
// Skia Frame Processor를 사용한 카메라 뷰
// 카메라 프레임과 오버레이를 하나의 캔버스에 그려서 완벽한 캡쳐 가능
//
// 사용 전 설치 필요:
// npm install @shopify/react-native-skia
// npx pod-install (iOS)

import React, { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useSkiaFrameProcessor,
} from 'react-native-vision-camera';
import {
  Canvas,
  Image,
  Skia,
  useCanvasRef,
  Rect,
  Text,
  useFont,
  Paint,
  RoundedRect,
} from '@shopify/react-native-skia';
import { useBarcodeScanner } from '@mgcrea/vision-camera-barcode-scanner';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { LABEL_COLORS } from '../constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// hex 색상을 Skia Color로 변환
const hexToSkiaColor = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Skia.Color(`rgba(${r}, ${g}, ${b}, ${alpha})`);
};

const SkiaCameraView = forwardRef(({
  barcodeTypes = ['qr'],
  onBarcodeDetected,
  trackedBarcodes = [],
  showValues = true,
  isActive = true,
  torch = 'off',
  facing = 'back',
}, ref) => {
  const device = useCameraDevice(facing);
  const canvasRef = useCanvasRef();
  const cameraRef = useRef(null);

  // 현재 프레임 이미지
  const currentFrame = useSharedValue(null);

  // 바코드 위치 정보
  const barcodePositions = useSharedValue([]);

  // 바코드 스캐너 설정
  const { scanBarcodes } = useBarcodeScanner({
    codeTypes: barcodeTypes,
  });

  // Skia Frame Processor - 카메라 프레임을 Skia 이미지로 변환
  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet';

    // 프레임을 Skia 이미지로 변환
    const skiaImage = frame.toSkiaImage();
    if (skiaImage) {
      currentFrame.value = skiaImage;
    }

    // 바코드 스캔
    const barcodes = scanBarcodes(frame);
    if (barcodes.length > 0) {
      const positions = barcodes.map((bc, index) => ({
        x: bc.boundingBox?.x || 0,
        y: bc.boundingBox?.y || 0,
        width: bc.boundingBox?.width || 0,
        height: bc.boundingBox?.height || 0,
        value: bc.displayValue || bc.rawValue || '',
        colorIndex: index,
      }));
      barcodePositions.value = positions;

      // JS 스레드에서 콜백 호출
      if (onBarcodeDetected) {
        runOnJS(onBarcodeDetected)(barcodes);
      }
    }
  }, [scanBarcodes, onBarcodeDetected]);

  // 캡쳐 함수 - 현재 캔버스 스냅샷 생성
  const captureSnapshot = useCallback(async () => {
    if (!canvasRef.current) {
      console.error('[SkiaCameraView] Canvas ref not available');
      return null;
    }

    try {
      const image = canvasRef.current.makeImageSnapshot();
      if (image) {
        const base64 = image.encodeToBase64();
        const uri = `data:image/jpeg;base64,${base64}`;
        console.log('[SkiaCameraView] Snapshot captured');
        return uri;
      }
    } catch (error) {
      console.error('[SkiaCameraView] Snapshot failed:', error);
    }
    return null;
  }, []);

  // ref로 캡쳐 함수 노출
  useImperativeHandle(ref, () => ({
    captureSnapshot,
  }), [captureSnapshot]);

  if (!device) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* 숨겨진 카메라 (프레임 제공용) */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        torch={torch}
        pixelFormat="rgb"
      />

      {/* Skia 캔버스 - 프레임 + 오버레이 렌더링 */}
      <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
        {/* 카메라 프레임 이미지 */}
        {currentFrame.value && (
          <Image
            image={currentFrame.value}
            x={0}
            y={0}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            fit="cover"
          />
        )}

        {/* 바코드 오버레이 */}
        {trackedBarcodes.map((barcode, index) => {
          if (!barcode.bounds) return null;

          const colorIndex = barcode.colorIndex !== undefined ? barcode.colorIndex : index;
          const color = LABEL_COLORS[colorIndex % LABEL_COLORS.length];
          const borderColor = hexToSkiaColor(color, 1);
          const fillColor = hexToSkiaColor(color, 0.15);

          const { x, y, width, height } = barcode.bounds;

          return (
            <React.Fragment key={`barcode-${index}`}>
              {/* 바운더리 박스 */}
              <RoundedRect
                x={x}
                y={y}
                width={width}
                height={height}
                r={4}
                color={fillColor}
              />
              <RoundedRect
                x={x}
                y={y}
                width={width}
                height={height}
                r={4}
                color={borderColor}
                style="stroke"
                strokeWidth={2.5}
              />

              {/* 라벨 */}
              {showValues && barcode.value && (
                <>
                  <RoundedRect
                    x={x}
                    y={y + height + 4}
                    width={Math.min(width + 20, barcode.value.length * 7 + 12)}
                    height={22}
                    r={4}
                    color={borderColor}
                  />
                  <Text
                    x={x + 6}
                    y={y + height + 18}
                    text={barcode.value.length > 25 ? barcode.value.substring(0, 25) + '...' : barcode.value}
                    color="white"
                    font={null} // 시스템 폰트 사용
                  />
                </>
              )}
            </React.Fragment>
          );
        })}
      </Canvas>
    </View>
  );
});

SkiaCameraView.displayName = 'SkiaCameraView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default SkiaCameraView;
