// components/ScanRegionOverlay.js - 스캔 영역 제한 표시 (바깥은 어둡게, 영역은 둥근 흰 테두리)
// 자기 크기를 재서 영역 사각형(dp)을 계산하고 onRegionChange로 알린다. 카메라 뷰와 같은 부모를 absoluteFill로 채워야 좌표가 맞는다.
// 마스크는 SVG 한 장(바깥 사각형 − 둥근 사각형, evenodd)으로 그려서 어두운 영역의 모서리도 테두리와 같이 둥글다.
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

export const SCAN_REGION_MODES = ['full', 'center', 'band'];

const MASK_COLOR = 'rgba(0,0,0,0.35)';
const CORNER_RADIUS = 16;

// 모드별 사각형. 가운데 정렬(중앙 십자 기준)
export function computeScanRegion(mode, width, height) {
  if (!width || !height) return null;
  if (mode === 'center') {
    const side = Math.round(Math.min(width * 0.7, height * 0.7));
    return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), width: side, height: side };
  }
  if (mode === 'band') {
    const w = Math.round(width * 0.85);
    const h = Math.round(height * 0.22);
    return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h };
  }
  return null;
}

// 둥근 사각형 path (시계 방향)
function roundedRectPath(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${x + radius},${y}`,
    `H${x + w - radius}`,
    `A${radius},${radius} 0 0 1 ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `A${radius},${radius} 0 0 1 ${x + w - radius},${y + h}`,
    `H${x + radius}`,
    `A${radius},${radius} 0 0 1 ${x},${y + h - radius}`,
    `V${y + radius}`,
    `A${radius},${radius} 0 0 1 ${x + radius},${y}`,
    'Z',
  ].join(' ');
}

export default function ScanRegionOverlay({ mode = 'full', onRegionChange }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const region = computeScanRegion(mode, size.width, size.height);

  useEffect(() => {
    if (onRegionChange) onRegionChange(region);
    // 사각형 값이 바뀔 때만 알린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, size.width, size.height]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}
    >
      {region && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Path
            d={`M0,0 H${size.width} V${size.height} H0 Z ${roundedRectPath(region.x, region.y, region.width, region.height, CORNER_RADIUS)}`}
            fill={MASK_COLOR}
            fillRule="evenodd"
          />
          <Rect
            x={region.x + 1}
            y={region.y + 1}
            width={region.width - 2}
            height={region.height - 2}
            rx={CORNER_RADIUS - 1}
            ry={CORNER_RADIUS - 1}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}
