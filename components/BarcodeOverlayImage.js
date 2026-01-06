// components/BarcodeOverlayImage.js
// 캡쳐된 이미지 위에 바코드 바운더리와 라벨을 오버레이로 그리는 컴포넌트

import React, { forwardRef } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { LABEL_COLORS } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// hex 색상을 rgba로 변환
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const BarcodeOverlayImage = forwardRef(({
  imageUri,
  barcodes = [],
  imageWidth,
  imageHeight,
  containerWidth = SCREEN_WIDTH - 32,
  showValues = true,
}, ref) => {
  // 이미지 비율 계산
  const imageAspectRatio = imageWidth / imageHeight;
  const displayHeight = containerWidth / imageAspectRatio;

  // 스케일 팩터: 원본 이미지 좌표 -> 디스플레이 좌표
  const scaleX = containerWidth / imageWidth;
  const scaleY = displayHeight / imageHeight;

  return (
    <View ref={ref} style={[styles.container, { width: containerWidth, height: displayHeight }]}>
      {/* 배경 이미지 */}
      <Image
        source={{ uri: imageUri }}
        style={{
          width: containerWidth,
          height: displayHeight,
          backgroundColor: '#000',
        }}
        resizeMode="cover"
      />

      {/* SVG 오버레이 */}
      <Svg
        width={containerWidth}
        height={displayHeight}
        style={styles.svgOverlay}
      >
        {barcodes.map((barcode, index) => {
          if (!barcode.bounds || !barcode.screenSize) return null;

          const colorIndex = barcode.colorIndex !== undefined ? barcode.colorIndex : index;
          const borderColor = LABEL_COLORS[colorIndex % LABEL_COLORS.length];
          const fillColor = hexToRgba(borderColor, 0.15);

          // 화면 좌표를 디스플레이 좌표로 변환
          const displayScaleX = containerWidth / barcode.screenSize.width;
          const displayScaleY = displayHeight / barcode.screenSize.height;

          const x = barcode.bounds.x * displayScaleX;
          const y = barcode.bounds.y * displayScaleY;
          const width = barcode.bounds.width * displayScaleX;
          const height = barcode.bounds.height * displayScaleY;

          // 라벨 텍스트 (최대 길이 제한)
          const maxTextLength = 25;
          const displayValue = barcode.value
            ? (barcode.value.length > maxTextLength
                ? barcode.value.substring(0, maxTextLength) + '...'
                : barcode.value)
            : '';

          // 라벨 배경 크기 계산
          const labelPadding = 6;
          const labelFontSize = 11;
          const labelWidth = Math.min(width + 20, displayValue.length * 7 + labelPadding * 2);
          const labelHeight = labelFontSize + labelPadding * 2;
          const labelY = y + height + 4;

          return (
            <G key={`barcode-overlay-${index}`}>
              {/* 바운더리 박스 */}
              <Rect
                x={x}
                y={y}
                width={width}
                height={height}
                stroke={borderColor}
                strokeWidth={2.5}
                fill={fillColor}
                rx={4}
                ry={4}
              />

              {/* 라벨 배경 및 텍스트 */}
              {showValues && displayValue && (
                <>
                  <Rect
                    x={x}
                    y={labelY}
                    width={labelWidth}
                    height={labelHeight}
                    fill={borderColor}
                    rx={4}
                    ry={4}
                  />
                  <SvgText
                    x={x + labelPadding}
                    y={labelY + labelFontSize + 3}
                    fontSize={labelFontSize}
                    fontWeight="600"
                    fill="#fff"
                  >
                    {displayValue}
                  </SvgText>
                </>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
});

BarcodeOverlayImage.displayName = 'BarcodeOverlayImage';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
    borderRadius: 12,
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default BarcodeOverlayImage;
