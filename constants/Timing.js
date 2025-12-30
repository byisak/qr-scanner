// constants/Timing.js - 앱 전반에서 사용되는 타이밍 관련 상수

// 스캔 디바운스 지연 시간 (ms)
export const DEBOUNCE_DELAYS = {
  DEFAULT: 500,                    // 기본 디바운스 (QR 등 2D 바코드)
  NO_BOUNDS: 1000,                 // bounds 없는 바코드 디바운스
  ONE_D_BARCODE: 800,              // 1D 바코드 (code39 등) 전용 디바운스
  DUPLICATE_CHECK: 300,            // 중복 체크 디바운스
};

// 화면 전환 및 리셋 지연 시간 (ms)
export const RESET_DELAYS = {
  LINK: 1200,                      // 링크로 이동 후 리셋
  NORMAL: 800,                     // 일반 스캔 후 리셋
  BATCH: 500,                      // 배치 스캔 후 리셋
};

// 애니메이션 지속 시간 (ms)
export const ANIMATION_DURATIONS = {
  FADE: 200,                       // 페이드 인/아웃
  SLIDE: 300,                      // 슬라이드 애니메이션
  SCAN_INTRO: 400,                 // 스캔 인트로 애니메이션
  SCAN_READY: 300,                 // 스캔 준비 완료 애니메이션
  CORNER_EXPAND: 400,              // 코너 확장 애니메이션
  CORNER_SETTLE: 300,              // 코너 정착 애니메이션
  CORNER_BLINK: 300,               // 코너 깜빡임 애니메이션
  TOAST_SHOW: 200,                 // 토스트 표시
  TOAST_HIDE: 200,                 // 토스트 숨김
};

// 타임아웃 값 (ms)
export const TIMEOUT_VALUES = {
  PHOTO_CAPTURE: 300,              // 사진 촬영 대기 시간
  NAVIGATION: 50,                  // 네비게이션 지연
  CAMERA_CLEANUP: 50,              // 카메라 정리 지연
  SCAN_INTRO_START: 500,           // 스캔 인트로 시작 대기
  TOAST_AUTO_HIDE: 5000,           // 토스트 자동 숨김
  SEND_MESSAGE_HIDE: 1000,         // 전송 메시지 숨김
  SCAN_REACTIVATE: 500,            // 스캔 재활성화 대기
};

// 1D 바코드 타입 목록
export const ONE_D_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'code128',
  'code39',
  'code93',
  'upce',
  'upca',
  'itf14',
  'codabar',
];

// 상품 바코드 타입 목록
export const PRODUCT_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upca',
  'upce',
  'itf14',
];

// 스캔 애니메이션 관련 상수
export const SCAN_ANIMATION = {
  CORNER_MOVE_DISTANCE: 50,        // 코너 이동 거리 (px)
  CORNER_SIZE: 40,                 // 코너 크기 (px)
  CORNER_LINE_WIDTH: 4,            // 코너 선 두께 (px)
  CROSSHAIR_SIZE: 30,              // 십자가 크기 (px)
  QR_ICON_SIZE: 80,                // QR 아이콘 크기 (px)
};
