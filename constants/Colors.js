// constants/Colors.js - Theme colors

// 바코드 라벨 배경색 팔레트 (서로 구분되는 색상들 - 25가지)
export const LABEL_COLORS = [
  '#E91E63', // 핑크
  '#2196F3', // 파랑
  '#4CAF50', // 초록
  '#9C27B0', // 보라
  '#FF5722', // 주황
  '#00BCD4', // 청록
  '#FFC107', // 노랑
  '#795548', // 갈색
  '#607D8B', // 청회색
  '#3F51B5', // 인디고
  '#F44336', // 빨강
  '#009688', // 틸
  '#673AB7', // 딥퍼플
  '#8BC34A', // 라이트그린
  '#FF9800', // 오렌지
  '#03A9F4', // 라이트블루
  '#CDDC39', // 라임
  '#9E9E9E', // 그레이
  '#E040FB', // 퍼플악센트
  '#00E676', // 그린악센트
  '#FF6F00', // 앰버다크
  '#1A237E', // 인디고다크
  '#B71C1C', // 레드다크
  '#1B5E20', // 그린다크
  '#4A148C', // 퍼플다크
];

// 2026-10 리디자인 (docs: 아티팩트 "공통 디자인 규칙"): 바탕 하나, 강조색(파랑) 하나.
// 상태색은 진한 글자색 + 연한 바탕(…Soft) 쌍으로 배지·알림에 쓴다
export const Colors = {
  light: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    raised: '#F0F2F5', // 카드 안의 보조 버튼·하위 카드
    primary: '#2F6FEB',
    primaryText: '#2457C5', // 바탕 위 강조 글자 (primary는 채움용)
    primarySoft: '#E6EEFF',
    text: '#0B0D10',
    textSecondary: '#5B6470',
    textTertiary: '#646C78', // 흰 바탕 5.3:1, raised 위 4.8:1 (WCAG AA)
    border: '#E3E6EB',
    borderLight: '#EDEFF2',
    inputBackground: '#F0F2F5',
    success: '#1F9D61',
    successSoft: '#E5F6EE',
    warning: '#C77700',
    warningSoft: '#FFF3E0',
    error: '#D93636',
    errorSoft: '#FDECEC',
    tabBar: '#FFFFFF',
    shadow: '#000',
  },
  dark: {
    background: '#0B0D10',
    surface: '#15181D',
    raised: '#1B1F26',
    primary: '#2F6FEB',
    primaryText: '#8FB3FF',
    primarySoft: '#1B2A45',
    text: '#F2F4F7',
    textSecondary: '#9AA3AF',
    textTertiary: '#8A929E', // 카드 바탕 5.6:1, raised 위 5.1:1 (WCAG AA)
    border: '#232831',
    borderLight: '#1E232B',
    inputBackground: '#1B1F26',
    success: '#4CC38A',
    successSoft: '#0F2A1E',
    warning: '#F5B34A',
    warningSoft: '#2A1E0C',
    error: '#FF7A7A',
    errorSoft: '#2E1414',
    tabBar: '#0F1215',
    shadow: '#000',
  },
};
