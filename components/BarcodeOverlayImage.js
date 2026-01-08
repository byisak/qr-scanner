// components/BarcodeOverlayImage.js
// 캡쳐된 이미지 위에 바코드 바운더리와 라벨을 오버레이로 그리는 컴포넌트
// 화면 좌표 -> 사진 좌표 -> 디스플레이 좌표 변환 적용

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
  photoWidth,        // 실제 사진 해상도 (픽셀)
  photoHeight,
  screenWidth,       // 화면 프리뷰 크기 (포인트)
  screenHeight,
  containerWidth = SCREEN_WIDTH,  // 디스플레이 컨테이너 크기
  showValues = true,
}, ref) => {
  // 사진 비율에 맞는 디스플레이 높이 계산
  const photoAspectRatio = photoWidth / photoHeight;
  const displayHeight = containerWidth / photoAspectRatio;

  // 좌표 변환 스케일 팩터 계산
  // 1단계: 화면 좌표 -> 사진 좌표 (scaleX = photoWidth / screenWidth)
  // 2단계: 사진 좌표 -> 디스플레이 좌표 (scaleX = containerWidth / photoWidth)
  // 합치면: displayX = screenX * (photoWidth / screenWidth) * (containerWidth / photoWidth)
  //       = screenX * (containerWidth / screenWidth)
  // 하지만 화면과 사진의 비율이 다를 수 있으므로 별도 계산 필요

  // 화면 프리뷰와 사진의 비율 차이를 고려한 스케일링
  const screenAspectRatio = screenWidth / screenHeight;

  let scaleX, scaleY, offsetX = 0, offsetY = 0;

  if (photoAspectRatio > screenAspectRatio) {
    // 사진이 더 넓음 - 세로 기준 맞춤, 가로 크롭
    scaleY = containerWidth / photoAspectRatio / screenHeight;
    scaleX = scaleY; // 비율 유지
    offsetX = (containerWidth - screenWidth * scaleX) / 2;
  } else {
    // 사진이 더 좁거나 같음 - 가로 기준 맞춤
    scaleX = containerWidth / screenWidth;
    scaleY = scaleX; // 비율 유지
    offsetY = (displayHeight - screenHeight * scaleY) / 2;
  }

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
          if (!barcode.bounds) return null;

          const colorIndex = barcode.colorIndex !== undefined ? barcode.colorIndex : index;
          const borderColor = LABEL_COLORS[colorIndex % LABEL_COLORS.length];
          const fillColor = hexToRgba(borderColor, 0.15);

          // 화면 좌표를 디스플레이 좌표로 변환
          const x = barcode.bounds.x * scaleX + offsetX;
          const y = barcode.bounds.y * scaleY + offsetY;
          const width = barcode.bounds.width * scaleX;
          const height = barcode.bounds.height * scaleY;

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
