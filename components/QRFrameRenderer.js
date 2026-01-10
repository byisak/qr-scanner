// components/QRFrameRenderer.js - QR 코드 프레임 렌더링 컴포넌트
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import StyledQRCode from './StyledQRCode';

// 프레임 SVG 데이터
const FRAME_SVG_DATA = {
  'envelope': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1300">
<polygon fill="#000000" points="864.31,551.09 980.65,652.92 869.6,740.63" />
<polygon fill="#000000" points="135.69,551.09 19.35,652.92 130.4,740.63" />
<path fill="#000000" d="M878.8,539.58V116.77c0-24.22-19.63-43.85-43.85-43.85H165.06c-24.22,0-43.85,19.63-43.85,43.85v422.81L1.38,632.35 v599.37c0,37.48,30.49,67.97,67.97,67.97h861.31c37.48,0,67.97-30.49,67.97-67.97V632.35L878.8,539.58z M962.69,689.55v458.25 L666.74,918.67L962.69,689.55z M958.9,647.04l-80.1,62.02V585.02L958.9,647.04z M165.06,105.8h669.88 c6.04,0,10.96,4.92,10.96,10.96v617.75L637.4,895.95l-94.56-73.21c-25.22-19.53-60.44-19.52-85.66,0l-94.56,73.21L154.1,734.52 V116.77C154.1,110.72,159.01,105.8,165.06,105.8z M333.26,918.67L37.31,1147.8V689.55L333.26,918.67z M121.2,709.05l-80.1-62.02 l80.1-62.02V709.05z M930.65,1263.75H69.35c-17.66,0-32.03-14.37-32.03-32.03v-38.47l441.86-342.09c12.26-9.5,29.4-9.5,41.66,0 l441.85,342.09v38.47C962.69,1249.38,948.32,1263.75,930.65,1263.75z" />
<text fill="#000000" font-size="90" x="50%" y="1160" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="600">Scan me!</text>
</svg>`,
  'play-button': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1300">
<path fill="#000000" d="M960,0H40A40,40,0,0,0,0,40V960a40,40,0,0,0,40,40H960a40,40,0,0,0,40-40V40A40,40,0,0,0,960,0Zm0,960H40V40H960Z"/>
<path fill="#000000" d="M960,1040H40a40,40,0,0,0-40,40v180a40,40,0,0,0,40,40H960a40,40,0,0,0,40-40V1080A40,40,0,0,0,960,1040ZM216,1201.86a12,12,0,0,1-12,12H108a12,12,0,0,1-12-12v-61.72a12,12,0,0,1,12-12h96a12,12,0,0,1,12,12Z"/>
<polygon fill="#000000" points="139.81 1150 139.81 1171 139.81 1192 158 1181.5 176.19 1171 158 1160.5 139.81 1150"/>
<text x="60%" y="1180" fill="#ffffff" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="90" font-weight="600">Scan me!</text>
</svg>`,
};

// QR 코드 위치 정보
const FRAME_QR_POSITIONS = {
  'envelope': { x: 154, y: 106, width: 692, height: 628, viewBoxWidth: 1000, viewBoxHeight: 1300 },
  'play-button': { x: 40, y: 40, width: 920, height: 920, viewBoxWidth: 1000, viewBoxHeight: 1300 },
};

/**
 * QR 코드와 프레임을 합성하여 렌더링하는 컴포넌트
 */
export default function QRFrameRenderer({
  frame,
  qrValue,
  qrStyle,
  size = 280,
  onCapture,
  onLayout,
}) {
  if (!frame || !frame.id || frame.id === 'none') {
    // 프레임이 없으면 QR 코드만 렌더링
    return (
      <View style={[styles.container, { width: size, height: size }]} onLayout={onLayout}>
        <View style={[styles.qrWrapper, { backgroundColor: qrStyle?.backgroundColor || '#fff' }]}>
          <StyledQRCode
            value={qrValue}
            size={size - 48}
            qrStyle={{ ...qrStyle, width: undefined, height: undefined }}
            onCapture={onCapture}
          />
        </View>
      </View>
    );
  }

  const frameSvg = FRAME_SVG_DATA[frame.id];
  const qrPosition = FRAME_QR_POSITIONS[frame.id];

  if (!frameSvg || !qrPosition) {
    // 프레임 데이터가 없으면 QR 코드만 렌더링
    return (
      <View style={[styles.container, { width: size, height: size }]} onLayout={onLayout}>
        <View style={[styles.qrWrapper, { backgroundColor: qrStyle?.backgroundColor || '#fff' }]}>
          <StyledQRCode
            value={qrValue}
            size={size - 48}
            qrStyle={{ ...qrStyle, width: undefined, height: undefined }}
            onCapture={onCapture}
          />
        </View>
      </View>
    );
  }

  // 프레임 비율 계산 (비정사각형 viewBox 지원)
  const viewBoxWidth = qrPosition.viewBoxWidth || 700;
  const viewBoxHeight = qrPosition.viewBoxHeight || 700;
  const aspectRatio = viewBoxWidth / viewBoxHeight;

  // size는 높이 기준, 너비는 비율에 맞게 계산
  const frameHeight = size;
  const frameWidth = Math.floor(size * aspectRatio);
  const scale = frameHeight / viewBoxHeight;

  // 프레임 내부 영역 (배경색이 채워질 영역)
  const bgAreaWidth = Math.floor(qrPosition.width * scale);
  const bgAreaHeight = Math.floor(qrPosition.height * scale);
  const bgX = Math.floor(qrPosition.x * scale);
  const bgY = Math.floor(qrPosition.y * scale);

  // QR 코드는 내부 영역 중앙에 정사각형으로 배치 (88%로 패딩 확보)
  const qrSize = Math.floor(Math.min(bgAreaWidth, bgAreaHeight) * 0.88);
  const qrX = bgX + Math.floor((bgAreaWidth - qrSize) / 2);
  const qrY = bgY + Math.floor((bgAreaHeight - qrSize) / 2);

  return (
    <View style={[styles.container, { width: frameWidth, height: frameHeight }]} onLayout={onLayout}>
      {/* 1. 배경색 (프레임 내부 전체 영역) */}
      <View
        style={[
          styles.qrBehind,
          {
            left: bgX,
            top: bgY,
            width: bgAreaWidth,
            height: bgAreaHeight,
            backgroundColor: qrStyle?.backgroundColor || '#ffffff',
          },
        ]}
      />
      {/* 2. QR 코드 (투명 배경, 중앙 배치) */}
      <View
        style={[
          styles.qrBehind,
          {
            left: qrX,
            top: qrY,
            width: qrSize,
            height: qrSize,
          },
        ]}
      >
        <StyledQRCode
          value={qrValue}
          size={qrSize}
          qrStyle={{ ...qrStyle, backgroundColor: 'transparent', width: undefined, height: undefined, margin: 0 }}
          onCapture={onCapture}
        />
      </View>
      {/* 3. 프레임 SVG (가장 위) */}
      <SvgXml
        xml={frameSvg}
        width={frameWidth}
        height={frameHeight}
        style={styles.frameSvg}
        pointerEvents="none"
      />
    </View>
  );
}

// 프레임 SVG 데이터 export (다른 컴포넌트에서 사용 가능)
export { FRAME_SVG_DATA, FRAME_QR_POSITIONS };

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  frameSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  qrWrapper: {
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  qrBehind: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
