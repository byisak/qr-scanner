// config/lockedFeatures.js - 잠금 기능 설정
// 새 기능 추가 시 여기에 설정만 추가하면 됨

// ========================================
// 개발 모드 설정
// true: 모든 기능 잠금 해제 (개발용)
// false: 정상 잠금 동작 (배포용)
// ========================================
export const DEV_MODE_UNLOCK_ALL = true;

// ========================================
// 광고 횟수 기준:
// 2회: 기본 프리미엄 기능, 개별 바코드 타입
// 3회: 업무 효율화 기능 (배치 스캔, URL 연동)
// 4회: 고급 비즈니스 기능 (실시간 동기화)
// ========================================

export const LOCKED_FEATURES = {
  // ===== Generator 화면 =====
  barcodeTab: {
    id: 'barcodeTab',
    adCount: 2, // 바코드 생성 탭 - 기본 프리미엄
    type: 'generator',
    description: '바코드 생성 기능',
  },

  // ===== QR 스타일 (Classic 제외) =====
  // 디자인/꾸미기 기능 - 한번에 전체 해제되므로 3회
  qrStyleRounded: {
    id: 'qrStyleRounded',
    adCount: 3, // 대표 스타일 (전체 해제 기준)
    type: 'qrStyle',
  },
  qrStyleDots: {
    id: 'qrStyleDots',
    adCount: 3,
    type: 'qrStyle',
  },
  qrStyleClassy: {
    id: 'qrStyleClassy',
    adCount: 3,
    type: 'qrStyle',
  },
  qrStyleBlueGradient: {
    id: 'qrStyleBlueGradient',
    adCount: 3,
    type: 'qrStyle',
  },
  qrStyleSunset: {
    id: 'qrStyleSunset',
    adCount: 3,
    type: 'qrStyle',
  },
  qrStyleDarkMode: {
    id: 'qrStyleDarkMode',
    adCount: 3,
    type: 'qrStyle',
  },
  qrStyleNeon: {
    id: 'qrStyleNeon',
    adCount: 3,
    type: 'qrStyle',
  },

  // ===== 설정 화면 =====
  batchScan: {
    id: 'batchScan',
    adCount: 3, // 업무 효율화 - 대량 스캔에 필수
    type: 'settings',
    description: '배치 스캔 모드',
  },
  realtimeSync: {
    id: 'realtimeSync',
    adCount: 4, // 고급 비즈니스 기능 - 실시간 서버 전송
    type: 'settings',
    description: '실시간 서버 전송',
  },
  scanUrlIntegration: {
    id: 'scanUrlIntegration',
    adCount: 3, // 업무 자동화 - URL 연동
    type: 'settings',
    description: '스캔 연동 URL',
  },
  productSearch: {
    id: 'productSearch',
    adCount: 2, // 편의 기능 - 제품 검색
    type: 'settings',
    description: '제품 검색 설정',
  },

  // ===== 바코드 타입 (기본 6개 제외한 나머지) =====
  // 기본 무료: UPC-A, UPC-E, EAN-13, EAN-8, Code 128, QR Code
  // 개별 잠금 바코드 타입 - 각 2회 (개별 해제)
  barcodeCode39: {
    id: 'barcodeCode39',
    bcid: 'code39',
    adCount: 2, // 산업용 바코드
    type: 'barcode',
    name: 'Code 39',
  },
  barcodeCode93: {
    id: 'barcodeCode93',
    bcid: 'code93',
    adCount: 2, // 고밀도 바코드
    type: 'barcode',
    name: 'Code 93',
  },
  barcodeItf14: {
    id: 'barcodeItf14',
    bcid: 'itf14',
    adCount: 2, // 물류용 바코드
    type: 'barcode',
    name: 'ITF-14',
  },
  barcodeInterleaved: {
    id: 'barcodeInterleaved',
    bcid: 'interleaved2of5',
    adCount: 2, // 창고/물류용
    type: 'barcode',
    name: 'Interleaved 2 of 5',
  },
  barcodeCodabar: {
    id: 'barcodeCodabar',
    bcid: 'rationalizedCodabar',
    adCount: 2, // 도서관/혈액은행용
    type: 'barcode',
    name: 'Codabar',
  },
  barcodePdf417: {
    id: 'barcodePdf417',
    bcid: 'pdf417',
    adCount: 2, // 2D 바코드 - 신분증/면허증
    type: 'barcode',
    name: 'PDF417',
  },
  barcodeDatamatrix: {
    id: 'barcodeDatamatrix',
    bcid: 'datamatrix',
    adCount: 2, // 2D 바코드 - 소형 부품 마킹
    type: 'barcode',
    name: 'Data Matrix',
  },
  barcodeAztec: {
    id: 'barcodeAztec',
    bcid: 'azteccode',
    adCount: 2, // 2D 바코드 - 항공권/티켓
    type: 'barcode',
    name: 'Aztec Code',
  },
};

// 무료로 제공되는 바코드 타입 (bcid 기준)
export const FREE_BARCODE_TYPES = [
  'upca',
  'upce',
  'ean13',
  'ean8',
  'code128',
  'qrcode',
];

// 무료 QR 스타일 인덱스 (Classic만 무료)
export const FREE_QR_STYLE_INDEX = 0;
