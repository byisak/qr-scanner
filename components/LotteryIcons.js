// components/LotteryIcons.js - 복권 아이콘 컴포넌트
import React from 'react';
import { View } from 'react-native';

// SVG 파일 임포트 (react-native-svg-transformer 사용)
import Lotto645Svg from '../assets/img-mainLt645.svg';
import Pension720Svg from '../assets/img-mainWf720.svg';

/**
 * 로또 6/45 아이콘
 * 공식 동행복권 로고
 */
export function Lotto645Icon({ size = 40 }) {
  // 원본 비율: 146x30
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
 */
export function Pension720Icon({ size = 40 }) {
  // 원본 비율: 204x40
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
 */
export function LotteryIcon({ type, size = 40 }) {
  if (type === 'lotto') {
    return <Lotto645Icon size={size} />;
  } else if (type === 'pension') {
    return <Pension720Icon size={size} />;
  }
  return null;
}

export default {
  Lotto645Icon,
  Pension720Icon,
  LotteryIcon,
};
