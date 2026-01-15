// components/LotteryIcons.js - 복권 아이콘 컴포넌트
import React from 'react';
import Svg, { Circle, Text, G, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * 로또 6/45 아이콘
 * 공식 동행복권 로고 스타일
 */
export function Lotto645Icon({ size = 40 }) {
  const scale = size / 40;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="lotto645Bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFD700" />
          <Stop offset="100%" stopColor="#FFA500" />
        </LinearGradient>
      </Defs>

      {/* 배경 원 */}
      <Circle cx="20" cy="20" r="19" fill="url(#lotto645Bg)" />

      {/* 로또 볼들 */}
      <G>
        {/* 빨간 볼 */}
        <Circle cx="11" cy="14" r="5" fill="#E53935" />
        <Text x="11" y="16.5" fontSize="6" fontWeight="bold" fill="#fff" textAnchor="middle">6</Text>

        {/* 노란 볼 */}
        <Circle cx="20" cy="11" r="5" fill="#FDD835" />
        <Text x="20" y="13.5" fontSize="6" fontWeight="bold" fill="#333" textAnchor="middle">/</Text>

        {/* 파란 볼 */}
        <Circle cx="29" cy="14" r="5" fill="#1E88E5" />
        <Text x="29" y="16.5" fontSize="6" fontWeight="bold" fill="#fff" textAnchor="middle">45</Text>
      </G>

      {/* LOTTO 텍스트 */}
      <Text x="20" y="32" fontSize="8" fontWeight="bold" fill="#333" textAnchor="middle">LOTTO</Text>
    </Svg>
  );
}

/**
 * 연금복권 720+ 아이콘
 * 공식 동행복권 로고 스타일
 */
export function Pension720Icon({ size = 40 }) {
  const scale = size / 40;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="pension720Bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#4CAF50" />
          <Stop offset="100%" stopColor="#2E7D32" />
        </LinearGradient>
      </Defs>

      {/* 배경 원 */}
      <Circle cx="20" cy="20" r="19" fill="url(#pension720Bg)" />

      {/* 720+ 텍스트 */}
      <Text x="20" y="18" fontSize="11" fontWeight="bold" fill="#fff" textAnchor="middle">720</Text>
      <Text x="30" y="14" fontSize="8" fontWeight="bold" fill="#FFD700" textAnchor="middle">+</Text>

      {/* 연금복권 텍스트 */}
      <Text x="20" y="30" fontSize="6" fontWeight="bold" fill="#fff" textAnchor="middle">연금복권</Text>
    </Svg>
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
