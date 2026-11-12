// constants/scanTheme.js - 스캔 화면 디자인 토큰. 카메라 위에 올라가는 요소는 전부 여기 값을 쓴다
// 컨셉: 도구는 조용히(흰 유리), 인식은 똑똑히(primary 하나). 라임·노랑은 쓰지 않는다
export const SCAN_THEME = {
  // 색
  white: 'rgba(255,255,255,0.92)',
  whiteDim: 'rgba(255,255,255,0.55)',
  whiteLine: 'rgba(255,255,255,0.7)',
  primary: '#2F6FEB',
  primaryFill: 'rgba(47,111,235,0.18)',
  warning: '#F5B34A',
  success: '#4CC38A',
  // 유리 (상단 알약: 밝은 유리 / 카드·토스트: 어두운 유리)
  glassLight: 'rgba(255,255,255,0.14)',
  glassDark: 'rgba(15,18,21,0.72)',
  glassCard: 'rgba(15,18,21,0.92)',
  glassBorder: 'rgba(255,255,255,0.22)',
  // 마스크
  mask: 'rgba(0,0,0,0.45)',
  // 모양
  pillRadius: 999,
  cardRadius: 20,
  regionRadius: 16,
  lineWidth: 1.5,
  cornerWidth: 3,
  cornerLength: 22,
  reticleSize: 150,         // 전체 화면 모드에서 조준 코너 네모 한 변
  // 시간 (ms)
  breathPeriod: 1600,
  // 코드에 붙기: 약 0.15초 안에 거의 붙고 살짝만 튄다 (예전 damping 18·stiffness 180은 0.5초쯤 걸려 늦게 느껴졌다)
  snap: { damping: 30, stiffness: 450, mass: 0.8 },
  // 코드에서 떨어져 제자리로: 붙을 때보다 부드럽게
  release: { damping: 22, stiffness: 220 },
  confirmDuration: 160,
  returnDuration: 300,
  cardEnter: 220,
};

// 카드·토스트 공통 글자색
export const SCAN_TEXT = {
  primary: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.72)',
  tertiary: 'rgba(255,255,255,0.5)',
};
