// components/QRFrameRenderer.js - QR 코드 프레임 렌더링 컴포넌트
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import StyledQRCode from './StyledQRCode';

// 프레임 SVG 데이터 - CSS 클래스를 인라인 스타일로 변환
// viewBox를 실제 콘텐츠 영역에 맞게 크롭 (비율 유지)
const FRAME_SVG_DATA = {
  'scan-me': `<svg viewBox="205 155 292 395" xmlns="http://www.w3.org/2000/svg">
<path fill="#020203" d="M312.5,213.8h7.4l-3.7-11.1L312.5,213.8z"/>
<path fill="#020203" d="M472.5,161.3h-244c-11.3,0-20.4,9.1-20.4,20.4v335.4c0,0.3,0,0.7,0,1c0.5,11.9,10.4,21.4,22.4,21.4h239.9c12.1,0,21.9-9.5,22.4-21.4c0-0.4,0-0.7,0-1V181.7C492.9,170.5,483.8,161.3,472.5,161.3z M488.8,517.2c0,10.1-8.2,18.4-18.4,18.4H230.5c-10.1,0-18.4-8.2-18.4-18.4v-206c0-32.7,26.5-59.2,59.2-59.2h217.5V517.2z M456.7,195.6l-0.7,20.1h-4.8l-0.7-20.1H456.7z M451.3,219.8c0.6-0.6,1.4-0.9,2.4-0.9s1.8,0.3,2.4,0.9s0.9,1.3,0.9,2.1c0,0.8-0.3,1.5-0.9,2.1c-0.6,0.6-1.4,0.9-2.4,0.9s-1.8-0.3-2.4-0.9c-0.6-0.6-0.9-1.3-0.9-2.1C450.4,221.2,450.7,220.5,451.3,219.8z M423.5,195.6h19.4v4.7h-13.5v7.1h11.5v4.5h-11.5v8h13.5v4.7h-19.5L423.5,195.6L423.5,195.6z M383.7,195.6h7.8l7.5,21.3l7.5-21.3h7.8v29h-6v-8.3l0.6-13.5l-7.8,21.7H397l-7.9-21.7l0.6,13.5v8.3h-6V195.6z M336.6,195.6h6l11.7,19.5v-19.5h6v29h-6l-11.7-19.4v19.4h-6V195.6z M313.4,195.6h5.6l10.8,29h-6.4l-2-6.1H311l-2,6.1h-6.4L313.4,195.6z M273.4,209.1c0-2.1,0.3-4,0.8-5.8c0.6-1.7,1.4-3.2,2.4-4.4c1.1-1.2,2.3-2.1,3.8-2.8s3.1-1,4.9-1c2.4,0,4.4,0.4,6.1,1.3c1.7,0.9,3,2.1,3.9,3.6c0.9,1.6,1.5,3.3,1.7,5.3h-6c-0.1-1.2-0.3-2.2-0.7-3c-0.4-0.8-1-1.4-1.8-1.9c-0.8-0.4-1.9-0.6-3.2-0.6c-1,0-1.9,0.2-2.6,0.5c-0.8,0.4-1.4,0.9-1.9,1.7s-0.9,1.7-1.1,2.9c-0.2,1.1-0.4,2.5-0.4,4v2.1c0,1.5,0.1,2.8,0.3,4c0.2,1.1,0.6,2.1,1,2.9c0.5,0.8,1.1,1.4,1.8,1.8c0.8,0.4,1.7,0.6,2.7,0.6c1.2,0,2.3-0.2,3.1-0.6c0.8-0.4,1.4-1,1.9-1.8c0.4-0.8,0.7-1.8,0.8-2.9h6c-0.1,1.9-0.7,3.7-1.6,5.2c-1,1.5-2.3,2.7-4,3.5c-1.7,0.9-3.7,1.3-6.1,1.3c-1.9,0-3.5-0.3-5-1c-1.5-0.6-2.7-1.6-3.8-2.8c-1-1.2-1.8-2.7-2.4-4.4c-0.6-1.7-0.8-3.6-0.8-5.8v-1.9H273.4z M259.9,215.7c-0.1-0.4-0.4-0.8-0.8-1.1c-0.4-0.4-1-0.7-1.7-1.1c-0.7-0.3-1.7-0.7-2.9-1.1c-1.3-0.4-2.6-0.9-3.7-1.4c-1.2-0.5-2.2-1.2-3.1-1.9c-0.9-0.7-1.6-1.6-2.1-2.5c-0.5-0.9-0.8-2-0.8-3.3c0-1.2,0.3-2.3,0.8-3.3s1.3-1.8,2.2-2.6c0.9-0.7,2.1-1.3,3.4-1.7c1.3-0.4,2.8-0.6,4.3-0.6c2.1,0,4,0.4,5.6,1.2s2.8,1.8,3.7,3.2c0.9,1.3,1.3,2.9,1.3,4.6h-5.9c0-0.9-0.2-1.6-0.5-2.2c-0.3-0.7-0.9-1.2-1.6-1.5c-0.7-0.4-1.6-0.6-2.7-0.6c-1,0-1.9,0.2-2.6,0.5s-1.2,0.7-1.5,1.3c-0.4,0.5-0.5,1.1-0.5,1.8c0,0.5,0.1,0.9,0.4,1.3c0.3,0.4,0.6,0.8,1.1,1.1c0.5,0.4,1.1,0.7,1.8,1s1.6,0.6,2.5,0.9c1.6,0.5,3,1,4.2,1.6s2.2,1.3,3,2c0.8,0.8,1.4,1.6,1.8,2.5s0.6,2,0.6,3.2c0,1.3-0.3,2.4-0.7,3.4c-0.5,1-1.2,1.8-2.1,2.5c-0.9,0.7-2,1.2-3.3,1.6c-1.3,0.4-2.7,0.5-4.3,0.5c-1.4,0-2.8-0.2-4.3-0.6c-1.4-0.4-2.7-1-3.8-1.7c-1.1-0.8-2-1.8-2.7-3c-0.7-1.2-1-2.6-1-4.3h6c0,0.9,0.1,1.7,0.4,2.3c0.3,0.6,0.7,1.1,1.2,1.5c0.5,0.4,1.1,0.7,1.8,0.8c0.7,0.2,1.5,0.3,2.3,0.3c1,0,1.9-0.2,2.6-0.4c0.7-0.3,1.2-0.7,1.5-1.2s0.5-1.1,0.5-1.8C260.2,216.5,260.1,216.1,259.9,215.7z"/>
<path fill="#FFFFFF" d="M456,215.8l0.7-20.2h-6.2l0.7,20.2H456z"/>
<path fill="#FFFFFF" d="M456,219.8c-0.6-0.6-1.4-0.9-2.3-0.9c-1,0-1.8,0.3-2.4,0.9c-0.6,0.5-0.9,1.3-0.9,2.1c0,0.8,0.3,1.5,0.9,2.1c0.6,0.6,1.4,0.9,2.4,0.9s1.8-0.3,2.3-0.9c0.6-0.6,0.9-1.3,0.9-2.1C456.8,221.2,456.5,220.5,456,219.8z"/>
<path fill="#FFFFFF" d="M429.5,212H441v-4.5h-11.5v-7.2h13.4v-4.7h-13.4h-2h-4v29h4h2H443V220h-13.5V212z"/>
<path fill="#FFFFFF" d="M409.1,195.6h-2.7l-7.5,21.2l-7.4-21.2h-2.8h-2.3h-2.7v29h5.9v-8.3l-0.6-13.5l7.9,21.8h4.1l7.8-21.8l-0.6,13.5v8.3h6v-29h-2.8H409.1z"/>
<path fill="#FFFFFF" d="M354.2,215.1l-11.7-19.5h-5.9v29h5.9v-19.4l11.7,19.4h6v-29h-6V215.1z"/>
<path fill="#FFFFFF" d="M317.4,195.6h-2.6h-1.5l-10.8,29h6.4l2-6.1h10.4l2,6.1h6.4l-10.8-29H317.4z M312.5,213.8l3.7-11.2l3.7,11.2H312.5z"/>
<path fill="#FFFFFF" d="M279.8,205.1c0.3-1.2,0.6-2.1,1.1-2.9c0.5-0.8,1.1-1.3,1.9-1.7c0.7-0.4,1.6-0.5,2.6-0.5c1.3,0,2.4,0.2,3.2,0.6c0.8,0.4,1.4,1,1.8,1.9c0.4,0.8,0.6,1.8,0.7,3h6c-0.2-2-0.7-3.7-1.7-5.3c-0.9-1.5-2.2-2.7-3.9-3.6c-1.7-0.9-3.7-1.3-6.1-1.3c-1.8,0-3.5,0.3-4.9,1c-1.5,0.6-2.8,1.6-3.8,2.8c-1.1,1.2-1.9,2.7-2.4,4.4c-0.6,1.7-0.8,3.6-0.8,5.8v2c0,2.1,0.3,4,0.8,5.8s1.3,3.2,2.4,4.4c1,1.2,2.3,2.1,3.8,2.8c1.5,0.6,3.1,1,5,1c2.4,0,4.4-0.4,6.1-1.3c1.7-0.9,3-2,4-3.5s1.5-3.3,1.6-5.2h-6c-0.1,1.2-0.3,2.1-0.8,2.9c-0.4,0.8-1.1,1.4-1.9,1.8c-0.8,0.4-1.8,0.6-3.1,0.6c-1.1,0-2-0.2-2.7-0.6c-0.8-0.4-1.4-1-1.8-1.8c-0.5-0.8-0.8-1.7-1-2.9c-0.2-1.1-0.3-2.5-0.3-4v-2.1C279.5,207.6,279.6,206.2,279.8,205.1z"/>
<path fill="#FFFFFF" d="M263.7,211.3c-0.8-0.7-1.8-1.4-3-2c-1.2-0.6-2.6-1.1-4.2-1.6c-0.9-0.3-1.8-0.6-2.5-0.9c-0.7-0.3-1.3-0.6-1.8-1c-0.5-0.3-0.9-0.7-1.1-1.1c-0.2-0.4-0.4-0.9-0.4-1.3c0-0.6,0.2-1.2,0.5-1.8c0.3-0.5,0.9-1,1.5-1.3c0.7-0.3,1.6-0.5,2.6-0.5c1.1,0,2,0.2,2.7,0.5c0.7,0.4,1.3,0.9,1.6,1.5c0.4,0.6,0.5,1.4,0.5,2.2h5.9c0-1.7-0.4-3.3-1.3-4.6c-0.9-1.3-2.1-2.4-3.7-3.2c-1.6-0.8-3.5-1.2-5.6-1.2c-1.6,0-3,0.2-4.3,0.6c-1.3,0.4-2.4,0.9-3.4,1.7c-1,0.7-1.7,1.5-2.2,2.5s-0.8,2.1-0.8,3.3c0,1.3,0.3,2.4,0.8,3.3c0.5,0.9,1.2,1.8,2.1,2.5c0.9,0.7,1.9,1.3,3.1,1.9c1.2,0.5,2.4,1,3.7,1.4c1.2,0.4,2.1,0.7,2.9,1.1c0.7,0.3,1.3,0.7,1.7,1.1c0.4,0.3,0.7,0.7,0.8,1.1c0.2,0.4,0.2,0.9,0.2,1.4c0,0.6-0.2,1.2-0.5,1.8c-0.3,0.5-0.8,0.9-1.5,1.2c-0.7,0.3-1.5,0.4-2.6,0.4c-0.9,0-1.6-0.1-2.4-0.3c-0.7-0.2-1.3-0.5-1.8-0.8c-0.5-0.4-0.9-0.9-1.2-1.5c-0.3-0.6-0.4-1.4-0.4-2.3h-6c0,1.6,0.3,3,1,4.3c0.7,1.2,1.6,2.2,2.7,3c1.1,0.8,2.4,1.3,3.8,1.7c1.4,0.4,2.8,0.6,4.3,0.6c1.6,0,3-0.2,4.3-0.5c1.3-0.4,2.4-0.9,3.3-1.6c0.9-0.7,1.6-1.5,2.1-2.5s0.7-2.1,0.7-3.4c0-1.2-0.2-2.3-0.6-3.2C264.8,212.9,264.5,212,263.7,211.3z"/>
</svg>`,
};

// QR 코드 위치 정보 (크롭된 viewBox 기준) - 흰색 영역
// viewBox "205 155 292 395" 기준으로 좌표 변환: x-205, y-155
// 내부 패딩 15px 적용
const FRAME_QR_POSITIONS = {
  'scan-me': { x: 22, y: 112, width: 247, height: 253, viewBoxWidth: 292, viewBoxHeight: 395 },
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

  const qrAreaWidth = qrPosition.width * scale;
  const qrAreaHeight = qrPosition.height * scale;
  // QR 코드 크기를 영역의 98%로 조정
  const qrSize = Math.floor(Math.min(qrAreaWidth, qrAreaHeight) * 0.98);
  const qrX = Math.floor(qrPosition.x * scale + (qrAreaWidth - qrSize) / 2);
  const qrY = Math.floor(qrPosition.y * scale + (qrAreaHeight - qrSize) / 2);

  return (
    <View style={[styles.container, { width: frameWidth, height: frameHeight }]} onLayout={onLayout}>
      {/* 프레임 SVG */}
      <SvgXml
        xml={frameSvg}
        width={frameWidth}
        height={frameHeight}
        style={styles.frameSvg}
      />
      {/* QR 코드 (프레임 위에 배치) */}
      <View
        style={[
          styles.qrOverlay,
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
          qrStyle={{ ...qrStyle, width: undefined, height: undefined, margin: 0 }}
          onCapture={onCapture}
        />
      </View>
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
  qrOverlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
