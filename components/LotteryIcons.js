// components/LotteryIcons.js - 복권 아이콘 컴포넌트
import React from 'react';
import { View } from 'react-native';

// SVG 파일 임포트 (react-native-svg-transformer 사용)
import Lotto645Svg from '../assets/img-mainLt645.svg';
import Pension720Svg from '../assets/img-mainWf720.svg';

/**
 * 로또 6/45 아이콘
 * 공식 동행복권 로고
 * iconOnly: true면 복주머니만 표시
 */
export function Lotto645Icon({ size = 40, iconOnly = false }) {
  if (iconOnly) {
    // 복주머니만 표시 (원본에서 x=0~35 영역, 원본 비율 35x30)
    const iconWidth = size;
    const iconHeight = size * (30 / 35);
    // 전체 SVG를 크게 그리고 컨테이너로 자르기
    const scale = size / 35;
    const fullWidth = 146 * scale;
    const fullHeight = 30 * scale;

    return (
      <View style={{
        width: iconWidth,
        height: iconHeight,
        overflow: 'hidden',
      }}>
        <Lotto645Svg width={fullWidth} height={fullHeight} />
      </View>
    );
  }

  // 전체 로고 (원본 비율: 146x30)
  const aspectRatio = 146 / 30;
  const height = size;
  const width = height * aspectRatio;

  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <Lotto645Svg width={width} height={height} />
    </View>
  );
}

/**
 * 연금복권 720+ 아이콘
 * 공식 동행복권 로고
 * iconOnly: true면 복주머니만 표시
 */
export function Pension720Icon({ size = 40, iconOnly = false }) {
  if (iconOnly) {
    // 복주머니만 표시 (원본에서 x=27~54 영역, 원본 비율 27x40)
    const iconWidth = size;
    const iconHeight = size * (40 / 27);
    // 전체 SVG를 크게 그리고 왼쪽으로 이동시켜 복주머니만 보이게
    const scale = size / 27;
    const fullWidth = 204 * scale;
    const fullHeight = 40 * scale;
    const offsetX = -27 * scale;

    return (
      <View style={{
        width: iconWidth,
        height: iconWidth, // 정사각형으로
        overflow: 'hidden',
      }}>
        <View style={{ marginLeft: offsetX }}>
          <Pension720Svg width={fullWidth} height={fullHeight} />
        </View>
      </View>
    );
  }

  // 전체 로고 (원본 비율: 204x40)
  const aspectRatio = 204 / 40;
  const height = size;
  const width = height * aspectRatio;

  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <Pension720Svg width={width} height={height} />
    </View>
  );
}

/**
 * 복권 타입에 따른 아이콘 반환
 * iconOnly: true면 복주머니만 표시 (리스트 썸네일용)
 */
export function LotteryIcon({ type, size = 40, iconOnly = false }) {
  if (type === 'lotto') {
    return <Lotto645Icon size={size} iconOnly={iconOnly} />;
  } else if (type === 'pension') {
    return <Pension720Icon size={size} iconOnly={iconOnly} />;
  }
  return null;
}

export default {
  Lotto645Icon,
  Pension720Icon,
  LotteryIcon,
};
