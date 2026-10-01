// components/ScanRegionOverlay.js - 스캔 영역 제한 표시 (바깥은 어둡게, 영역은 둥근 흰 테두리)
// 자기 크기를 재서 영역 사각형(dp)을 계산하고 onRegionChange로 알린다. 카메라 뷰와 같은 부모를 absoluteFill로 채워야 좌표가 맞는다.
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';

export const SCAN_REGION_MODES = ['full', 'center', 'band'];

const MASK_COLOR = 'rgba(0,0,0,0.35)';

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
        <>
          <View style={[styles.mask, { top: 0, left: 0, right: 0, height: region.y }]} />
          <View style={[styles.mask, { top: region.y + region.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.mask, { top: region.y, left: 0, width: region.x, height: region.height }]} />
          <View style={[styles.mask, { top: region.y, left: region.x + region.width, right: 0, height: region.height }]} />
          <View style={[styles.frame, { left: region.x, top: region.y, width: region.width, height: region.height }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: MASK_COLOR,
  },
  frame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
  },
});
