// components/ScanRegionOverlay.js - 스캔 영역 제한 표시 (바깥은 어둡게, 영역은 둥근 흰 테두리)
// 자기 크기를 재서 영역 사각형(dp)을 계산하고 onRegionChange로 알린다. 카메라 뷰와 같은 부모를 absoluteFill로 채워야 좌표가 맞는다.
// 마스크는 SVG 한 장(바깥 사각형 − 둥근 사각형, evenodd)으로 그려서 어두운 영역의 모서리도 테두리와 같이 둥글다.
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCAN_REGION_MODES = ['full', 'center', 'band', 'custom'];

// 사용자 지정 영역: 화면 비율(0~1)로 저장한다 — 폴드 접힘/펼침·회전·다른 기기 복원에도 같은 자리에 남게.
// 중심(cx, cy)과 크기(w, h). 화면에서 보여 주고 입력받는 값은 dp로 바꿔서 쓴다
export const SCAN_REGION_CUSTOM_KEY = 'scanRegionCustom';
export const DEFAULT_CUSTOM_REGION = { cx: 0.5, cy: 0.5, w: 0.85, h: 0.22 };
// 스캔 화면 카메라 영역의 마지막 크기(dp). 편집 화면이 같은 비율·같은 dp 숫자로 보여 주려고 기억해 둔다
export const SCAN_AREA_SIZE_KEY = 'scanAreaSize';
export const MIN_REGION = { width: 80, height: 48 };

export function parseCustomRegion(json) {
  try {
    const v = typeof json === 'string' ? JSON.parse(json) : json;
    if (v && [v.cx, v.cy, v.w, v.h].every(n => typeof n === 'number' && isFinite(n))) return v;
  } catch (e) {}
  return { ...DEFAULT_CUSTOM_REGION };
}

// dp 사각형을 화면 안으로 자르고 최소 크기를 지킨다
// min = false: 작은 아이콘처럼 최소 크기를 지키면 안 되는 곳 (아이콘 전체를 덮어 버린다)
export function clampRegion(r, width, height, min = true) {
  const minW = min ? MIN_REGION.width : 1;
  const minH = min ? MIN_REGION.height : 1;
  const w = Math.round(Math.min(Math.max(r.width, minW), width));
  const h = Math.round(Math.min(Math.max(r.height, minH), height));
  const x = Math.round(Math.min(Math.max(r.x, 0), width - w));
  const y = Math.round(Math.min(Math.max(r.y, 0), height - h));
  return { x, y, width: w, height: h };
}

// 비율 ↔ dp
export function customToRect(custom, width, height, min = true) {
  const c = parseCustomRegion(custom);
  const w = c.w * width;
  const h = c.h * height;
  return clampRegion({ x: c.cx * width - w / 2, y: c.cy * height - h / 2, width: w, height: h }, width, height, min);
}
export function rectToCustom(rect, width, height) {
  return {
    cx: (rect.x + rect.width / 2) / width,
    cy: (rect.y + rect.height / 2) / height,
    w: rect.width / width,
    h: rect.height / height,
  };
}

const MASK_COLOR = 'rgba(0,0,0,0.45)';
const CORNER_RADIUS = 16;

// 모드별 사각형. 가운데 정렬(중앙 십자 기준)
export function computeScanRegion(mode, width, height, custom, min = true) {
  if (!width || !height) return null;
  if (mode === 'custom') return customToRect(custom, width, height, min);
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

export default function ScanRegionOverlay({ mode = 'full', custom = null, onRegionChange, rememberAreaSize = false }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const region = computeScanRegion(mode, size.width, size.height, custom);
  const customKey = mode === 'custom' && custom ? `${custom.cx},${custom.cy},${custom.w},${custom.h}` : '';

  useEffect(() => {
    if (onRegionChange) onRegionChange(region);
    // 사각형 값이 바뀔 때만 알린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customKey, size.width, size.height]);

  // 스캔 화면에서만: 카메라 영역 크기를 기억해 둔다 (편집 화면이 같은 크기로 보여 주려고)
  useEffect(() => {
    if (!rememberAreaSize || !size.width || !size.height) return;
    AsyncStorage.setItem(SCAN_AREA_SIZE_KEY, JSON.stringify({ width: Math.round(size.width), height: Math.round(size.height) })).catch(() => {});
  }, [rememberAreaSize, size.width, size.height]);

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
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}
