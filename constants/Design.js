// constants/Design.js - 모양 토큰 (2026-10 리디자인). 색은 constants/Colors.js
import { Platform } from 'react-native';

// 모서리: 큰 카드 24 · 묶음 목록 20 · 주 버튼 16 · 입력·보조 버튼 14 · 칩 18(높이 36의 절반)
export const RADIUS = { card: 24, group: 20, button: 16, control: 14, chip: 18, badge: 8 };

// 간격: 화면 좌우 16 · 카드 안 20 · 묶음 사이 8 · 섹션 사이 12
export const SPACE = { screen: 16, card: 20, gap: 8, section: 12 };

// 높이: 주 버튼 52 · 보조 버튼 48 · 입력 44 · 목록 행 최소 56(설명 있으면 64) · 칩 36. 누를 수 있는 건 44 이상
export const SIZE = { primaryButton: 52, button: 48, input: 44, row: 56, rowWithDesc: 64, chip: 36, touch: 44 };

// 글자: 탭 제목 28/700 · 하위 화면 제목 17/600 · 본문 15/500 · 섹션 머리글 13/600 · 보조 12
export const TYPE = {
  tabTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  screenTitle: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '500' },
  sectionHeader: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12 },
};

// 코드 값(URL·바코드 숫자 등)은 고정폭
export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
