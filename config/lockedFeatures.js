// config/lockedFeatures.js - 잠금 기능 설정
// 새 기능 추가 시 여기에 설정만 추가하면 됨

// ========================================
// 전체 잠금 해제 설정
// true: 모든 기능 잠금 해제 (AdMob 승인 전)
// false: 정상 잠금 동작 (AdMob 승인 후)
// ========================================
export const DEV_MODE_UNLOCK_ALL = true;

// ========================================
// 광고 횟수 기준:
// 2회: 기본 프리미엄 기능, 개별 바코드/QR 타입
// 3회: 업무 효율화 기능 (배치 스캔, URL 연동, 백업)
// 4회: 고급 비즈니스 기능 (실시간 동기화)
// ========================================

export const LOCKED_FEATURES = {
  // ===== Generator 화면 =====
  // barcodeTab은 기본 해제 (잠금 없음)

  // ===== QR 타입 (텍스트 제외) =====
  // 기본 무료: text (텍스트)
  // 나머지는 각 2회 광고
  qrTypeWebsite: {
    id: 'qrTypeWebsite',
    qrType: 'website',
    adCount: 2,
    type: 'qrType',
    name: '웹사이트',
  },
  qrTypeContact: {
    id: 'qrTypeContact',
    qrType: 'contact',
    adCount: 2,
    type: 'qrType',
    name: '연락처',
  },
  qrTypeWifi: {
    id: 'qrTypeWifi',
    qrType: 'wifi',
    adCount: 2,
    type: 'qrType',
    name: 'WiFi',
  },
  qrTypeClipboard: {
    id: 'qrTypeClipboard',
    qrType: 'clipboard',
    adCount: 2,
    type: 'qrType',
    name: '클립보드',
  },
  qrTypeEmail: {
    id: 'qrTypeEmail',
    qrType: 'email',
    adCount: 2,
    type: 'qrType',
    name: '이메일',
  },
  qrTypeSms: {
    id: 'qrTypeSms',
    qrType: 'sms',
    adCount: 2,
    type: 'qrType',
    name: 'SMS',
  },
  qrTypePhone: {
    id: 'qrTypePhone',
    qrType: 'phone',
    adCount: 2,
    type: 'qrType',
    name: '전화',
  },
  qrTypeEvent: {
    id: 'qrTypeEvent',
    qrType: 'event',
    adCount: 2,
    type: 'qrType',
    name: '일정',
  },
  qrTypeLocation: {
    id: 'qrTypeLocation',
    qrType: 'location',
    adCount: 2,
    type: 'qrType',
    name: '위치',
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
  photoSave: {
    id: 'photoSave',
    adCount: 3, // 스캔 사진 저장
    type: 'settings',
    description: '스캔 사진 저장',
  },
  lotteryScan: {
    id: 'lotteryScan',
    adCount: 2, // 복권 인식
    type: 'settings',
    description: '복권 인식',
  },

  // ===== 백업/내보내기 =====
  icloudBackup: {
    id: 'icloudBackup',
    adCount: 3, // iCloud 백업
    type: 'backup',
    description: 'iCloud 백업',
  },
  googleDriveBackup: {
    id: 'googleDriveBackup',
    adCount: 3, // Google Drive 백업
    type: 'backup',
    description: 'Google Drive 백업',
  },

  // ===== 바코드 타입 (code128 제외한 모든 바코드) =====
  // 기본 무료: Code 128만
  // 개별 잠금 바코드 타입 - 각 2회 (개별 해제)

  // --- 1D Industrial/Logistics ---
  barcodeCode39: { id: 'barcodeCode39', bcid: 'code39', adCount: 2, type: 'barcode', name: 'Code 39' },
  barcodeCode39ext: { id: 'barcodeCode39ext', bcid: 'code39ext', adCount: 2, type: 'barcode', name: 'Code 39 Extended' },
  barcodeCode93: { id: 'barcodeCode93', bcid: 'code93', adCount: 2, type: 'barcode', name: 'Code 93' },
  barcodeCode93ext: { id: 'barcodeCode93ext', bcid: 'code93ext', adCount: 2, type: 'barcode', name: 'Code 93 Extended' },
  barcodeCode11: { id: 'barcodeCode11', bcid: 'code11', adCount: 2, type: 'barcode', name: 'Code 11' },
  barcodeIndustrial2of5: { id: 'barcodeIndustrial2of5', bcid: 'industrial2of5', adCount: 2, type: 'barcode', name: 'Industrial 2 of 5' },
  barcodeInterleaved2of5: { id: 'barcodeInterleaved2of5', bcid: 'interleaved2of5', adCount: 2, type: 'barcode', name: 'Interleaved 2 of 5' },
  barcodeItf14: { id: 'barcodeItf14', bcid: 'itf14', adCount: 2, type: 'barcode', name: 'ITF-14' },
  barcodeMatrix2of5: { id: 'barcodeMatrix2of5', bcid: 'matrix2of5', adCount: 2, type: 'barcode', name: 'Matrix 2 of 5' },
  barcodeCoop2of5: { id: 'barcodeCoop2of5', bcid: 'coop2of5', adCount: 2, type: 'barcode', name: 'COOP 2 of 5' },
  barcodeIata2of5: { id: 'barcodeIata2of5', bcid: 'iata2of5', adCount: 2, type: 'barcode', name: 'IATA 2 of 5' },
  barcodeDatalogic2of5: { id: 'barcodeDatalogic2of5', bcid: 'datalogic2of5', adCount: 2, type: 'barcode', name: 'Datalogic 2 of 5' },

  // --- Retail ---
  barcodeEan13: { id: 'barcodeEan13', bcid: 'ean13', adCount: 2, type: 'barcode', name: 'EAN-13' },
  barcodeEan8: { id: 'barcodeEan8', bcid: 'ean8', adCount: 2, type: 'barcode', name: 'EAN-8' },
  barcodeEan5: { id: 'barcodeEan5', bcid: 'ean5', adCount: 2, type: 'barcode', name: 'EAN-5' },
  barcodeEan2: { id: 'barcodeEan2', bcid: 'ean2', adCount: 2, type: 'barcode', name: 'EAN-2' },
  barcodeUpca: { id: 'barcodeUpca', bcid: 'upca', adCount: 2, type: 'barcode', name: 'UPC-A' },
  barcodeUpce: { id: 'barcodeUpce', bcid: 'upce', adCount: 2, type: 'barcode', name: 'UPC-E' },
  barcodeIsbn: { id: 'barcodeIsbn', bcid: 'isbn', adCount: 2, type: 'barcode', name: 'ISBN' },
  barcodeIsmn: { id: 'barcodeIsmn', bcid: 'ismn', adCount: 2, type: 'barcode', name: 'ISMN' },
  barcodeIssn: { id: 'barcodeIssn', bcid: 'issn', adCount: 2, type: 'barcode', name: 'ISSN' },
  barcodeEan13composite: { id: 'barcodeEan13composite', bcid: 'ean13composite', adCount: 2, type: 'barcode', name: 'EAN-13 Composite' },
  barcodeEan8composite: { id: 'barcodeEan8composite', bcid: 'ean8composite', adCount: 2, type: 'barcode', name: 'EAN-8 Composite' },
  barcodeUpcacomposite: { id: 'barcodeUpcacomposite', bcid: 'upcacomposite', adCount: 2, type: 'barcode', name: 'UPC-A Composite' },
  barcodeUpcecomposite: { id: 'barcodeUpcecomposite', bcid: 'upcecomposite', adCount: 2, type: 'barcode', name: 'UPC-E Composite' },

  // --- GS1 / Logistics ---
  barcodeGs1128: { id: 'barcodeGs1128', bcid: 'gs1-128', adCount: 2, type: 'barcode', name: 'GS1-128' },
  barcodeGs1cc: { id: 'barcodeGs1cc', bcid: 'gs1-cc', adCount: 2, type: 'barcode', name: 'GS1 Composite' },
  barcodeGs1databar: { id: 'barcodeGs1databar', bcid: 'gs1databar', adCount: 2, type: 'barcode', name: 'GS1 DataBar Omnidirectional' },
  barcodeGs1databarstacked: { id: 'barcodeGs1databarstacked', bcid: 'gs1databarstacked', adCount: 2, type: 'barcode', name: 'GS1 DataBar Stacked' },
  barcodeGs1databarstackedomni: { id: 'barcodeGs1databarstackedomni', bcid: 'gs1databarstackedomni', adCount: 2, type: 'barcode', name: 'GS1 DataBar Stacked Omni' },
  barcodeGs1databartruncated: { id: 'barcodeGs1databartruncated', bcid: 'gs1databartruncated', adCount: 2, type: 'barcode', name: 'GS1 DataBar Truncated' },
  barcodeGs1databarlimited: { id: 'barcodeGs1databarlimited', bcid: 'gs1databarlimited', adCount: 2, type: 'barcode', name: 'GS1 DataBar Limited' },
  barcodeGs1databarexpanded: { id: 'barcodeGs1databarexpanded', bcid: 'gs1databarexpanded', adCount: 2, type: 'barcode', name: 'GS1 DataBar Expanded' },
  barcodeGs1databarexpandedstacked: { id: 'barcodeGs1databarexpandedstacked', bcid: 'gs1databarexpandedstacked', adCount: 2, type: 'barcode', name: 'GS1 DataBar Expanded Stacked' },
  barcodeGs1northamericancoupon: { id: 'barcodeGs1northamericancoupon', bcid: 'gs1northamericancoupon', adCount: 2, type: 'barcode', name: 'GS1 North American Coupon' },
  barcodeGs1qrcode: { id: 'barcodeGs1qrcode', bcid: 'gs1qrcode', adCount: 2, type: 'barcode', name: 'GS1 QR Code' },
  barcodeGs1dotcode: { id: 'barcodeGs1dotcode', bcid: 'gs1dotcode', adCount: 2, type: 'barcode', name: 'GS1 DotCode' },
  barcodeSscc18: { id: 'barcodeSscc18', bcid: 'sscc18', adCount: 2, type: 'barcode', name: 'SSCC-18' },
  barcodeEan14: { id: 'barcodeEan14', bcid: 'ean14', adCount: 2, type: 'barcode', name: 'EAN-14' },

  // --- Medical/Pharmaceutical ---
  barcodePharmacode: { id: 'barcodePharmacode', bcid: 'pharmacode', adCount: 2, type: 'barcode', name: 'Pharmacode' },
  barcodePharmacode2: { id: 'barcodePharmacode2', bcid: 'pharmacode2', adCount: 2, type: 'barcode', name: 'Pharmacode Two-Track' },
  barcodeCode32: { id: 'barcodeCode32', bcid: 'code32', adCount: 2, type: 'barcode', name: 'Code 32 (Italian Pharma)' },
  barcodePzn: { id: 'barcodePzn', bcid: 'pzn', adCount: 2, type: 'barcode', name: 'PZN' },
  barcodeHibc39: { id: 'barcodeHibc39', bcid: 'hibc39', adCount: 2, type: 'barcode', name: 'HIBC Code 39' },
  barcodeHibc128: { id: 'barcodeHibc128', bcid: 'hibc128', adCount: 2, type: 'barcode', name: 'HIBC Code 128' },
  barcodeHibcdatamatrix: { id: 'barcodeHibcdatamatrix', bcid: 'hibcdatamatrix', adCount: 2, type: 'barcode', name: 'HIBC Data Matrix' },
  barcodeHibcpdf417: { id: 'barcodeHibcpdf417', bcid: 'hibcpdf417', adCount: 2, type: 'barcode', name: 'HIBC PDF417' },
  barcodeHibcqrcode: { id: 'barcodeHibcqrcode', bcid: 'hibcqrcode', adCount: 2, type: 'barcode', name: 'HIBC QR Code' },
  barcodeHibcazteccode: { id: 'barcodeHibcazteccode', bcid: 'hibcazteccode', adCount: 2, type: 'barcode', name: 'HIBC Aztec Code' },
  barcodeHibccodablockf: { id: 'barcodeHibccodablockf', bcid: 'hibccodablockf', adCount: 2, type: 'barcode', name: 'HIBC Codablock F' },
  barcodeHibcmicropdf417: { id: 'barcodeHibcmicropdf417', bcid: 'hibcmicropdf417', adCount: 2, type: 'barcode', name: 'HIBC MicroPDF417' },

  // --- Library/Special ---
  barcodeCodabar: { id: 'barcodeCodabar', bcid: 'rationalizedCodabar', adCount: 2, type: 'barcode', name: 'Codabar' },
  barcodeBc412: { id: 'barcodeBc412', bcid: 'bc412', adCount: 2, type: 'barcode', name: 'BC412' },
  barcodeMsi: { id: 'barcodeMsi', bcid: 'msi', adCount: 2, type: 'barcode', name: 'MSI' },
  barcodePlessey: { id: 'barcodePlessey', bcid: 'plessey', adCount: 2, type: 'barcode', name: 'Plessey' },
  barcodeTelepen: { id: 'barcodeTelepen', bcid: 'telepen', adCount: 2, type: 'barcode', name: 'Telepen' },
  barcodeTelepennumeric: { id: 'barcodeTelepennumeric', bcid: 'telepennumeric', adCount: 2, type: 'barcode', name: 'Telepen Numeric' },
  barcodeChannelcode: { id: 'barcodeChannelcode', bcid: 'channelcode', adCount: 2, type: 'barcode', name: 'Channel Code' },
  barcodePosicode: { id: 'barcodePosicode', bcid: 'posicode', adCount: 2, type: 'barcode', name: 'PosiCode' },

  // --- Postal ---
  barcodePostnet: { id: 'barcodePostnet', bcid: 'postnet', adCount: 2, type: 'barcode', name: 'POSTNET' },
  barcodePlanet: { id: 'barcodePlanet', bcid: 'planet', adCount: 2, type: 'barcode', name: 'PLANET' },
  barcodeUspsintellligentmail: { id: 'barcodeUspsintellligentmail', bcid: 'uspsintellligentmail', adCount: 2, type: 'barcode', name: 'USPS Intelligent Mail' },
  barcodeOnecode: { id: 'barcodeOnecode', bcid: 'onecode', adCount: 2, type: 'barcode', name: 'OneCode' },
  barcodeRoyalmail: { id: 'barcodeRoyalmail', bcid: 'royalmail', adCount: 2, type: 'barcode', name: 'Royal Mail 4-State' },
  barcodeKix: { id: 'barcodeKix', bcid: 'kix', adCount: 2, type: 'barcode', name: 'KIX (Dutch)' },
  barcodeJapanpost: { id: 'barcodeJapanpost', bcid: 'japanpost', adCount: 2, type: 'barcode', name: 'Japan Post' },
  barcodeAuspost: { id: 'barcodeAuspost', bcid: 'auspost', adCount: 2, type: 'barcode', name: 'Australia Post' },
  barcodeDeutschepost: { id: 'barcodeDeutschepost', bcid: 'deutschepost', adCount: 2, type: 'barcode', name: 'Deutsche Post Leitcode' },
  barcodeDeutschepostidentcode: { id: 'barcodeDeutschepostidentcode', bcid: 'deutschepostidentcode', adCount: 2, type: 'barcode', name: 'Deutsche Post Identcode' },
  barcodeCepnet: { id: 'barcodeCepnet', bcid: 'cepnet', adCount: 2, type: 'barcode', name: 'CEPNet' },
  barcodeFlattermarken: { id: 'barcodeFlattermarken', bcid: 'flattermarken', adCount: 2, type: 'barcode', name: 'Flattermarken' },
  barcodeLeitcode: { id: 'barcodeLeitcode', bcid: 'leitcode', adCount: 2, type: 'barcode', name: 'Leitcode' },
  barcodeIdentcode: { id: 'barcodeIdentcode', bcid: 'identcode', adCount: 2, type: 'barcode', name: 'Identcode' },

  // --- 2D Barcodes ---
  barcodeQrcode: { id: 'barcodeQrcode', bcid: 'qrcode', adCount: 2, type: 'barcode', name: 'QR Code' },
  barcodeMicroqrcode: { id: 'barcodeMicroqrcode', bcid: 'microqrcode', adCount: 2, type: 'barcode', name: 'Micro QR Code' },
  barcodeRectangularmicroqrcode: { id: 'barcodeRectangularmicroqrcode', bcid: 'rectangularmicroqrcode', adCount: 2, type: 'barcode', name: 'Rectangular Micro QR' },
  barcodeDatamatrix: { id: 'barcodeDatamatrix', bcid: 'datamatrix', adCount: 2, type: 'barcode', name: 'Data Matrix' },
  barcodeDatamatrixrectangular: { id: 'barcodeDatamatrixrectangular', bcid: 'datamatrixrectangular', adCount: 2, type: 'barcode', name: 'Data Matrix Rectangular' },
  barcodeDatamatrixrectangularextension: { id: 'barcodeDatamatrixrectangularextension', bcid: 'datamatrixrectangularextension', adCount: 2, type: 'barcode', name: 'Data Matrix Rectangular Ext' },
  barcodePdf417: { id: 'barcodePdf417', bcid: 'pdf417', adCount: 2, type: 'barcode', name: 'PDF417' },
  barcodePdf417compact: { id: 'barcodePdf417compact', bcid: 'pdf417compact', adCount: 2, type: 'barcode', name: 'Compact PDF417' },
  barcodeMicropdf417: { id: 'barcodeMicropdf417', bcid: 'micropdf417', adCount: 2, type: 'barcode', name: 'MicroPDF417' },
  barcodeAzteccode: { id: 'barcodeAzteccode', bcid: 'azteccode', adCount: 2, type: 'barcode', name: 'Aztec Code' },
  barcodeAzteccodecompact: { id: 'barcodeAzteccodecompact', bcid: 'azteccodecompact', adCount: 2, type: 'barcode', name: 'Compact Aztec Code' },
  barcodeAztecrune: { id: 'barcodeAztecrune', bcid: 'aztecrune', adCount: 2, type: 'barcode', name: 'Aztec Runes' },
  barcodeMaxicode: { id: 'barcodeMaxicode', bcid: 'maxicode', adCount: 2, type: 'barcode', name: 'MaxiCode' },
  barcodeDotcode: { id: 'barcodeDotcode', bcid: 'dotcode', adCount: 2, type: 'barcode', name: 'DotCode' },
  barcodeHanxin: { id: 'barcodeHanxin', bcid: 'hanxin', adCount: 2, type: 'barcode', name: 'Han Xin Code' },
  barcodeCodeone: { id: 'barcodeCodeone', bcid: 'codeone', adCount: 2, type: 'barcode', name: 'Code One' },
  barcodeUltracode: { id: 'barcodeUltracode', bcid: 'ultracode', adCount: 2, type: 'barcode', name: 'Ultracode' },

  // --- Stacked Barcodes ---
  barcodeCodablockf: { id: 'barcodeCodablockf', bcid: 'codablockf', adCount: 2, type: 'barcode', name: 'Codablock F' },
  barcodeCode16k: { id: 'barcodeCode16k', bcid: 'code16k', adCount: 2, type: 'barcode', name: 'Code 16K' },
  barcodeCode49: { id: 'barcodeCode49', bcid: 'code49', adCount: 2, type: 'barcode', name: 'Code 49' },

  // --- Automotive ---
  barcodeVin: { id: 'barcodeVin', bcid: 'vin', adCount: 2, type: 'barcode', name: 'VIN (Vehicle ID)' },
};

// 무료로 제공되는 바코드 타입 (bcid 기준)
// code128만 무료
export const FREE_BARCODE_TYPES = [
  'code128',
];

// 무료 QR 타입 (텍스트만 무료)
export const FREE_QR_TYPES = ['text'];

// 무료 QR 스타일 인덱스 (Classic만 무료)
export const FREE_QR_STYLE_INDEX = 0;
