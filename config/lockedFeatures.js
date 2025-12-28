// config/lockedFeatures.js - 잠금 기능 설정
// 새 기능 추가 시 여기에 설정만 추가하면 됨

export const LOCKED_FEATURES = {
  // ===== Generator 화면 =====
  barcodeTab: {
    id: 'barcodeTab',
    adCount: 1,
    type: 'generator',
    description: '바코드 생성 기능',
  },

  // ===== QR 스타일 (Classic 제외) =====
  qrStyleRounded: {
    id: 'qrStyleRounded',
    adCount: 1,
    type: 'qrStyle',
  },
  qrStyleDots: {
    id: 'qrStyleDots',
    adCount: 1,
    type: 'qrStyle',
  },
  qrStyleClassy: {
    id: 'qrStyleClassy',
    adCount: 1,
    type: 'qrStyle',
  },
  qrStyleBlueGradient: {
    id: 'qrStyleBlueGradient',
    adCount: 1,
    type: 'qrStyle',
  },
  qrStyleSunset: {
    id: 'qrStyleSunset',
    adCount: 1,
    type: 'qrStyle',
  },
  qrStyleDarkMode: {
    id: 'qrStyleDarkMode',
    adCount: 1,
    type: 'qrStyle',
  },
  qrStyleNeon: {
    id: 'qrStyleNeon',
    adCount: 1,
    type: 'qrStyle',
  },

  // ===== 설정 화면 =====
  batchScan: {
    id: 'batchScan',
    adCount: 1,
    type: 'settings',
    description: '배치 스캔 모드',
  },
  realtimeSync: {
    id: 'realtimeSync',
    adCount: 1,
    type: 'settings',
    description: '실시간 서버 전송',
  },

  // ===== 바코드 타입 (기본 6개 제외한 나머지) =====
  // 기본 무료: UPC-A, UPC-E, EAN-13, EAN-8, Code 128, QR Code
  advancedBarcodes: {
    id: 'advancedBarcodes',
    adCount: 1,
    type: 'barcode',
    description: '고급 바코드 타입',
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
