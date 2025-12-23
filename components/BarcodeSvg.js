// components/BarcodeSvg.js - bwip-js 기반 바코드 생성 컴포넌트 (WebView 방식)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * bwip-js 지원 전체 바코드 목록 (110종)
 * 카테고리별로 그룹화
 */
export const ALL_BWIP_BARCODES = [
  // ===== 1D 산업/물류용 바코드 =====
  { bcid: 'code128', name: 'Code 128', category: 'industrial', description: '물류/재고 관리 (모든 ASCII)', placeholder: 'ABC-123' },
  { bcid: 'code39', name: 'Code 39', category: 'industrial', description: '산업용 (대문자/숫자)', placeholder: 'CODE39' },
  { bcid: 'code39ext', name: 'Code 39 Extended', category: 'industrial', description: 'Code 39 확장 (전체 ASCII)', placeholder: 'Code39' },
  { bcid: 'code93', name: 'Code 93', category: 'industrial', description: '산업용 고밀도', placeholder: 'CODE93' },
  { bcid: 'code93ext', name: 'Code 93 Extended', category: 'industrial', description: 'Code 93 확장', placeholder: 'Code93' },
  { bcid: 'code11', name: 'Code 11', category: 'industrial', description: '통신장비 식별', placeholder: '123-45' },
  { bcid: 'industrial2of5', name: 'Industrial 2 of 5', category: 'industrial', description: '산업용 2 of 5', placeholder: '123456' },
  { bcid: 'interleaved2of5', name: 'Interleaved 2 of 5 (ITF)', category: 'industrial', description: '물류용 (짝수 숫자)', placeholder: '123456' },
  { bcid: 'itf14', name: 'ITF-14', category: 'industrial', description: '박스/팔레트 단위', placeholder: '1234567890123' },
  { bcid: 'matrix2of5', name: 'Matrix 2 of 5', category: 'industrial', description: '매트릭스 2 of 5', placeholder: '123456' },
  { bcid: 'coop2of5', name: 'COOP 2 of 5', category: 'industrial', description: 'COOP 2 of 5', placeholder: '123456' },
  { bcid: 'iata2of5', name: 'IATA 2 of 5', category: 'industrial', description: '항공 화물용', placeholder: '123456' },
  { bcid: 'datalogic2of5', name: 'Datalogic 2 of 5', category: 'industrial', description: 'Datalogic 2 of 5', placeholder: '123456' },

  // ===== 상품 바코드 (Retail) =====
  { bcid: 'ean13', name: 'EAN-13', category: 'retail', description: '국제 상품 바코드', placeholder: '590123412345', fixedLength: 12 },
  { bcid: 'ean8', name: 'EAN-8', category: 'retail', description: '소형 상품', placeholder: '9638507', fixedLength: 7 },
  { bcid: 'ean5', name: 'EAN-5', category: 'retail', description: '보조 바코드 (책 가격)', placeholder: '52495', fixedLength: 5 },
  { bcid: 'ean2', name: 'EAN-2', category: 'retail', description: '보조 바코드 (잡지 호수)', placeholder: '05', fixedLength: 2 },
  { bcid: 'upca', name: 'UPC-A', category: 'retail', description: '미국/캐나다 상품', placeholder: '01234567890', fixedLength: 11 },
  { bcid: 'upce', name: 'UPC-E', category: 'retail', description: '소형 상품 (미국)', placeholder: '0123456', fixedLength: 7 },
  { bcid: 'isbn', name: 'ISBN', category: 'retail', description: '도서 바코드', placeholder: '978123456789' },
  { bcid: 'ismn', name: 'ISMN', category: 'retail', description: '음악출판물 바코드', placeholder: '979012345678' },
  { bcid: 'issn', name: 'ISSN', category: 'retail', description: '정기간행물 바코드', placeholder: '9771234567003' },
  { bcid: 'ean13composite', name: 'EAN-13 Composite', category: 'retail', description: 'EAN-13 복합 바코드', placeholder: '3312345678901' },
  { bcid: 'ean8composite', name: 'EAN-8 Composite', category: 'retail', description: 'EAN-8 복합 바코드', placeholder: '12345678' },
  { bcid: 'upcacomposite', name: 'UPC-A Composite', category: 'retail', description: 'UPC-A 복합 바코드', placeholder: '01234567890' },
  { bcid: 'upcecomposite', name: 'UPC-E Composite', category: 'retail', description: 'UPC-E 복합 바코드', placeholder: '0123456' },

  // ===== GS1 / 물류 =====
  { bcid: 'gs1-128', name: 'GS1-128', category: 'gs1', description: 'GS1 물류 바코드', placeholder: '(01)12345678901234' },
  { bcid: 'gs1-cc', name: 'GS1 Composite', category: 'gs1', description: 'GS1 복합 바코드', placeholder: '(01)12345678901234' },
  { bcid: 'gs1databar', name: 'GS1 DataBar Omnidirectional', category: 'gs1', description: 'GS1 DataBar 전방향', placeholder: '0123456789012' },
  { bcid: 'gs1databarstacked', name: 'GS1 DataBar Stacked', category: 'gs1', description: 'GS1 DataBar 스택', placeholder: '0123456789012' },
  { bcid: 'gs1databarstackedomni', name: 'GS1 DataBar Stacked Omni', category: 'gs1', description: 'GS1 DataBar 스택 전방향', placeholder: '0123456789012' },
  { bcid: 'gs1databartruncated', name: 'GS1 DataBar Truncated', category: 'gs1', description: 'GS1 DataBar 축약', placeholder: '0123456789012' },
  { bcid: 'gs1databarlimited', name: 'GS1 DataBar Limited', category: 'gs1', description: 'GS1 DataBar 제한', placeholder: '0123456789012' },
  { bcid: 'gs1databarexpanded', name: 'GS1 DataBar Expanded', category: 'gs1', description: 'GS1 DataBar 확장', placeholder: '(01)12345678901234' },
  { bcid: 'gs1databarexpandedstacked', name: 'GS1 DataBar Expanded Stacked', category: 'gs1', description: 'GS1 DataBar 확장 스택', placeholder: '(01)12345678901234' },
  { bcid: 'gs1northamericancoupon', name: 'GS1 North American Coupon', category: 'gs1', description: '북미 쿠폰 바코드', placeholder: '0123456789012' },
  { bcid: 'gs1qrcode', name: 'GS1 QR Code', category: 'gs1', description: 'GS1 QR 코드', placeholder: '(01)12345678901234' },
  { bcid: 'gs1dotcode', name: 'GS1 DotCode', category: 'gs1', description: 'GS1 닷코드', placeholder: '(01)12345678901234' },

  // ===== 의료/제약 =====
  { bcid: 'pharmacode', name: 'Pharmacode', category: 'medical', description: '의약품 포장', placeholder: '1234', minValue: 3, maxValue: 131070 },
  { bcid: 'pharmacode2', name: 'Pharmacode Two-Track', category: 'medical', description: '의약품 2트랙', placeholder: '12345678' },
  { bcid: 'code32', name: 'Code 32 (Italian Pharma)', category: 'medical', description: '이탈리아 의약품', placeholder: '123456789' },
  { bcid: 'pzn', name: 'PZN', category: 'medical', description: '독일 의약품번호', placeholder: '1234567' },
  { bcid: 'hibc39', name: 'HIBC Code 39', category: 'medical', description: '의료산업 바코드 39', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibc128', name: 'HIBC Code 128', category: 'medical', description: '의료산업 바코드 128', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcdatamatrix', name: 'HIBC Data Matrix', category: 'medical', description: '의료산업 데이터매트릭스', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcpdf417', name: 'HIBC PDF417', category: 'medical', description: '의료산업 PDF417', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcqrcode', name: 'HIBC QR Code', category: 'medical', description: '의료산업 QR코드', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcazteccode', name: 'HIBC Aztec Code', category: 'medical', description: '의료산업 아즈텍코드', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibccodablockf', name: 'HIBC Codablock F', category: 'medical', description: '의료산업 코다블록F', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcmicropdf417', name: 'HIBC MicroPDF417', category: 'medical', description: '의료산업 마이크로PDF417', placeholder: 'A123BJC5D6E71' },

  // ===== 도서관/특수 =====
  { bcid: 'rationalizedCodabar', name: 'Codabar', category: 'special', description: '도서관/택배/의료', placeholder: 'A12345A' },
  { bcid: 'bc412', name: 'BC412', category: 'special', description: 'BC412 바코드', placeholder: '123456' },
  { bcid: 'msi', name: 'MSI', category: 'special', description: '재고/창고 관리', placeholder: '123456' },
  { bcid: 'plessey', name: 'Plessey', category: 'special', description: 'Plessey 바코드', placeholder: '123456' },
  { bcid: 'telepen', name: 'Telepen', category: 'special', description: 'Telepen 바코드', placeholder: 'ABC123' },
  { bcid: 'telepennumeric', name: 'Telepen Numeric', category: 'special', description: 'Telepen 숫자', placeholder: '123456' },
  { bcid: 'channelcode', name: 'Channel Code', category: 'special', description: '채널 코드', placeholder: '123' },
  { bcid: 'posicode', name: 'PosiCode', category: 'special', description: 'PosiCode', placeholder: '123456' },

  // ===== 우편 바코드 (Postal) =====
  { bcid: 'postnet', name: 'POSTNET', category: 'postal', description: '미국 우편', placeholder: '12345' },
  { bcid: 'planet', name: 'PLANET', category: 'postal', description: '미국 우편 추적', placeholder: '12345678901' },
  { bcid: 'uspsintellligentmail', name: 'USPS Intelligent Mail', category: 'postal', description: '미국 스마트 우편', placeholder: '01234567890123456789' },
  { bcid: 'onecode', name: 'OneCode', category: 'postal', description: 'USPS OneCode', placeholder: '01234567890123456789' },
  { bcid: 'royalmail', name: 'Royal Mail 4-State', category: 'postal', description: '영국 우편', placeholder: 'LE28HS9Z' },
  { bcid: 'kix', name: 'KIX (Dutch)', category: 'postal', description: '네덜란드 우편', placeholder: '1231FZ13XHS' },
  { bcid: 'japanpost', name: 'Japan Post', category: 'postal', description: '일본 우편', placeholder: '1231FZ13XHS' },
  { bcid: 'auspost', name: 'Australia Post', category: 'postal', description: '호주 우편', placeholder: '5956439111ABA9' },
  { bcid: 'deutschepost', name: 'Deutsche Post Leitcode', category: 'postal', description: '독일 우편 라이트코드', placeholder: '21348075016401' },
  { bcid: 'deutschepostidentcode', name: 'Deutsche Post Identcode', category: 'postal', description: '독일 우편 신원코드', placeholder: '563102430313' },
  { bcid: 'cepnet', name: 'CEPNet', category: 'postal', description: '브라질 우편', placeholder: '12345678' },
  { bcid: 'flattermarken', name: 'Flattermarken', category: 'postal', description: '독일 파일 마크', placeholder: '123456' },

  // ===== 2D 바코드 =====
  { bcid: 'qrcode', name: 'QR Code', category: '2d', description: '범용 2D 코드', placeholder: 'https://example.com' },
  { bcid: 'microqrcode', name: 'Micro QR Code', category: '2d', description: '마이크로 QR', placeholder: 'ABC123' },
  { bcid: 'rectangularmicroqrcode', name: 'Rectangular Micro QR', category: '2d', description: '직사각형 마이크로 QR', placeholder: 'ABC123' },
  { bcid: 'datamatrix', name: 'Data Matrix', category: '2d', description: '데이터 매트릭스', placeholder: 'ABC123' },
  { bcid: 'datamatrixrectangular', name: 'Data Matrix Rectangular', category: '2d', description: '직사각형 데이터 매트릭스', placeholder: 'ABC123' },
  { bcid: 'datamatrixrectangularextension', name: 'Data Matrix Rectangular Ext', category: '2d', description: '확장 직사각형 데이터 매트릭스', placeholder: 'ABC123' },
  { bcid: 'pdf417', name: 'PDF417', category: '2d', description: 'PDF417', placeholder: 'ABC123' },
  { bcid: 'pdf417compact', name: 'Compact PDF417', category: '2d', description: '컴팩트 PDF417', placeholder: 'ABC123' },
  { bcid: 'micropdf417', name: 'MicroPDF417', category: '2d', description: '마이크로 PDF417', placeholder: 'ABC123' },
  { bcid: 'azteccode', name: 'Aztec Code', category: '2d', description: '아즈텍 코드', placeholder: 'ABC123' },
  { bcid: 'azteccodecompact', name: 'Compact Aztec Code', category: '2d', description: '컴팩트 아즈텍', placeholder: 'ABC123' },
  { bcid: 'aztecrune', name: 'Aztec Runes', category: '2d', description: '아즈텍 룬', placeholder: '123' },
  { bcid: 'maxicode', name: 'MaxiCode', category: '2d', description: 'UPS 맥시코드', placeholder: '[)>01961Z00004951UPSN06X6101' },
  { bcid: 'dotcode', name: 'DotCode', category: '2d', description: '닷코드', placeholder: 'ABC123' },
  { bcid: 'hanxin', name: 'Han Xin Code', category: '2d', description: '한신 코드 (중국)', placeholder: 'ABC123' },
  { bcid: 'codeone', name: 'Code One', category: '2d', description: '코드원', placeholder: 'ABC123' },
  { bcid: 'ultracode', name: 'Ultracode', category: '2d', description: '울트라코드', placeholder: 'ABC123' },

  // ===== 스택형 바코드 =====
  { bcid: 'codablockf', name: 'Codablock F', category: 'stacked', description: '코다블록 F', placeholder: 'ABC123' },
  { bcid: 'code16k', name: 'Code 16K', category: 'stacked', description: '코드 16K', placeholder: 'ABC123' },
  { bcid: 'code49', name: 'Code 49', category: 'stacked', description: '코드 49', placeholder: 'ABC123' },

  // ===== 기타 =====
  { bcid: 'raw', name: 'Raw (Custom)', category: 'other', description: '원시 바코드', placeholder: '1 2 3 4' },
  { bcid: 'daft', name: 'DAFT Code', category: 'other', description: 'DAFT 코드', placeholder: 'DAFTDAFT' },
  { bcid: 'symbol', name: 'Miscellaneous Symbols', category: 'other', description: '기타 심볼', placeholder: 'fima' },

  // ===== 국가별 특수 =====
  { bcid: 'vin', name: 'VIN (Vehicle ID)', category: 'automotive', description: '차량식별번호', placeholder: '1M8GDM9A_KP042788' },
  { bcid: 'sscc18', name: 'SSCC-18', category: 'gs1', description: '물류 단위 식별', placeholder: '106141411234567897' },
  { bcid: 'ean14', name: 'EAN-14', category: 'gs1', description: '물류 단위 식별', placeholder: '12345678901231' },
  { bcid: 'leitcode', name: 'Leitcode', category: 'postal', description: '독일 우편 라이트코드', placeholder: '21348075016401' },
  { bcid: 'identcode', name: 'Identcode', category: 'postal', description: '독일 우편 신원코드', placeholder: '563102430313' },
  { bcid: 'swissqrcode', name: 'Swiss QR Code', category: 'other', description: '스위스 결제 QR', placeholder: 'SPC\\n0200\\n1' },
];

/**
 * 카테고리 정보
 */
export const BARCODE_CATEGORIES = {
  industrial: { name: '산업/물류', icon: 'cube-outline', gradient: ['#667eea', '#764ba2'] },
  retail: { name: '상품 바코드', icon: 'cart-outline', gradient: ['#f093fb', '#f5576c'] },
  gs1: { name: 'GS1/물류', icon: 'git-network-outline', gradient: ['#4facfe', '#00f2fe'] },
  medical: { name: '의료/제약', icon: 'medkit-outline', gradient: ['#ff6e7f', '#bfe9ff'] },
  special: { name: '특수 용도', icon: 'library-outline', gradient: ['#ffecd2', '#fcb69f'] },
  postal: { name: '우편 바코드', icon: 'mail-outline', gradient: ['#a8edea', '#fed6e3'] },
  '2d': { name: '2D 바코드', icon: 'qr-code-outline', gradient: ['#30cfd0', '#330867'] },
  stacked: { name: '스택형', icon: 'layers-outline', gradient: ['#43e97b', '#38f9d7'] },
  automotive: { name: '자동차', icon: 'car-outline', gradient: ['#ff9a9e', '#fecfef'] },
  other: { name: '기타', icon: 'ellipsis-horizontal-outline', gradient: ['#c471f5', '#fa71cd'] },
};

/**
 * 지원하는 바코드 포맷 (bwip-js bcid 매핑) - 기존 호환성 유지
 */
export const BARCODE_FORMATS = {
  CODE128: {
    id: 'CODE128',
    bcid: 'code128',
    name: 'Code 128',
    description: '물류/재고 관리 (모든 ASCII)',
    icon: 'cube-outline',
    placeholder: 'ABC-123',
  },
  EAN13: {
    id: 'EAN13',
    bcid: 'ean13',
    name: 'EAN-13',
    description: '국제 상품 바코드',
    icon: 'cart-outline',
    placeholder: '590123412345',
    fixedLength: 12,
  },
  EAN8: {
    id: 'EAN8',
    bcid: 'ean8',
    name: 'EAN-8',
    description: '소형 상품',
    icon: 'pricetag-outline',
    placeholder: '9638507',
    fixedLength: 7,
  },
  EAN5: {
    id: 'EAN5',
    bcid: 'ean5',
    name: 'EAN-5',
    description: '보조 바코드 (책 가격)',
    icon: 'book-outline',
    placeholder: '52495',
    fixedLength: 5,
  },
  EAN2: {
    id: 'EAN2',
    bcid: 'ean2',
    name: 'EAN-2',
    description: '보조 바코드 (잡지 호수)',
    icon: 'newspaper-outline',
    placeholder: '05',
    fixedLength: 2,
  },
  UPC: {
    id: 'UPC',
    bcid: 'upca',
    name: 'UPC-A',
    description: '미국/캐나다 상품',
    icon: 'storefront-outline',
    placeholder: '01234567890',
    fixedLength: 11,
  },
  UPCE: {
    id: 'UPCE',
    bcid: 'upce',
    name: 'UPC-E',
    description: '소형 상품 (미국)',
    icon: 'pricetag-outline',
    placeholder: '0123456',
    fixedLength: 7,
  },
  CODE39: {
    id: 'CODE39',
    bcid: 'code39',
    name: 'Code 39',
    description: '산업용 (대문자/숫자)',
    icon: 'construct-outline',
    placeholder: 'CODE39',
  },
  ITF: {
    id: 'ITF',
    bcid: 'interleaved2of5',
    name: 'ITF (Interleaved 2 of 5)',
    description: '물류용 (짝수 숫자)',
    icon: 'swap-horizontal-outline',
    placeholder: '123456',
    evenDigits: true,
  },
  ITF14: {
    id: 'ITF14',
    bcid: 'itf14',
    name: 'ITF-14',
    description: '박스/팔레트 단위',
    icon: 'archive-outline',
    placeholder: '1001234567890',
    fixedLength: 13,
  },
  MSI: {
    id: 'MSI',
    bcid: 'msi',
    name: 'MSI',
    description: '재고/창고 관리',
    icon: 'file-tray-stacked-outline',
    placeholder: '123456',
  },
  pharmacode: {
    id: 'pharmacode',
    bcid: 'pharmacode',
    name: 'Pharmacode',
    description: '의약품 포장 (3-131070)',
    icon: 'medkit-outline',
    placeholder: '1234',
    minValue: 3,
    maxValue: 131070,
  },
  codabar: {
    id: 'codabar',
    bcid: 'rationalizedCodabar',
    name: 'Codabar',
    description: '도서관/택배/의료',
    icon: 'library-outline',
    placeholder: 'A12345A',
  },
  CODE93: {
    id: 'CODE93',
    bcid: 'code93',
    name: 'Code 93',
    description: '산업용 (고밀도)',
    icon: 'barcode-outline',
    placeholder: 'CODE93',
  },
};

/**
 * 바코드 유효성 검사
 */
export const validateBarcode = (format, value) => {
  if (!value || !format) return { valid: false, message: 'emptyValue' };

  const formatInfo = BARCODE_FORMATS[format];
  if (!formatInfo) return { valid: false, message: 'unknownFormat' };

  // 숫자만 허용하는 포맷
  const numericOnly = ['EAN13', 'EAN8', 'EAN5', 'EAN2', 'UPC', 'UPCE', 'ITF', 'ITF14', 'MSI', 'pharmacode'];
  if (numericOnly.includes(format) && !/^\d+$/.test(value)) {
    return { valid: false, message: 'invalidPattern' };
  }

  // 짝수 자릿수 검사
  if (formatInfo.evenDigits && value.length % 2 !== 0) {
    return { valid: false, message: 'evenDigits' };
  }

  // 고정 길이 검사
  if (formatInfo.fixedLength && value.length < formatInfo.fixedLength) {
    return { valid: false, message: 'tooShort', expected: formatInfo.fixedLength };
  }

  // Pharmacode 범위 검사
  if (format === 'pharmacode') {
    const num = parseInt(value, 10);
    if (num < 3 || num > 131070) {
      return { valid: false, message: 'pharmacodeRange' };
    }
  }

  return { valid: true };
};

/**
 * 체크섬 계산 (EAN/UPC) - bwip-js가 자동 계산
 */
export const calculateChecksum = (format, value) => {
  if (!value) return '';
  return value;
};

/**
 * Codabar 포맷팅
 */
export const formatCodabar = (value) => {
  if (!value) return value;
  const upper = value.toUpperCase();
  const hasStart = /^[A-D]/.test(upper);
  const hasEnd = /[A-D]$/.test(upper);
  if (hasStart && hasEnd) return upper;
  if (!hasStart && !hasEnd) return `A${value}A`;
  if (!hasStart) return `A${value}`;
  if (!hasEnd) return `${value}A`;
  return upper;
};

/**
 * BarcodeSvg 컴포넌트 - WebView 방식으로 bwip-js 사용
 * format prop은 bcid 형식 (예: 'code128', 'ean13') 또는 기존 포맷 키 (예: 'CODE128', 'EAN13')
 */
export default function BarcodeSvg({
  value,
  format = 'code128',
  width = 2,
  height = 100,
  displayValue = true,
  fontSize = 14,
  textMargin = 5,
  background = '#ffffff',
  lineColor = '#000000',
  margin = 10,
  maxWidth = 280,  // 최대 너비 (자동 스케일링)
}) {
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 280, height: 140 });
  const [scaledDimensions, setScaledDimensions] = useState({ width: 280, height: 140 });
  const webViewRef = useRef(null);

  // bcid 결정: 기존 포맷 키면 변환, 이미 bcid면 그대로 사용
  const bcid = useMemo(() => {
    // 기존 BARCODE_FORMATS에 있으면 bcid로 변환
    if (BARCODE_FORMATS[format]) {
      return BARCODE_FORMATS[format].bcid;
    }
    // 이미 bcid 형식이면 그대로 사용
    return format;
  }, [format]);

  // Codabar 전처리
  let processedValue = value;
  if ((format === 'codabar' || bcid === 'rationalizedCodabar') && value) {
    processedValue = formatCodabar(value);
  }

  // 고유 키 생성 (값 변경 시 WebView 리렌더링 강제)
  const webViewKey = useMemo(() => {
    return `${format}-${value}-${Date.now()}`;
  }, [format, value]);

  // HTML 템플릿 생성 - CDN 로드 완료 후 실행
  const generateHTML = () => {
    if (!value || !bcid) {
      return '<html><body></body></html>';
    }

    // 특수문자 이스케이프
    const escapedValue = processedValue
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: transparent;
    }
    canvas { display: block; }
    #error { color: red; font-size: 12px; text-align: center; padding: 10px; }
  </style>
</head>
<body>
  <canvas id="barcode"></canvas>
  <div id="error"></div>

  <script src="https://cdn.jsdelivr.net/npm/bwip-js@4.5.1/dist/bwip-js-min.js"></script>
  <script>
    function generateBarcode() {
      try {
        if (typeof bwipjs === 'undefined') {
          document.getElementById('error').innerText = 'Library not loaded';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            success: false,
            error: 'bwip-js library not loaded'
          }));
          return;
        }

        bwipjs.toCanvas('barcode', {
          bcid: '${bcid}',
          text: '${escapedValue}',
          scale: ${width},
          height: ${Math.max(height / 10, 8)},
          includetext: ${displayValue},
          textxalign: 'center',
          textsize: ${fontSize},
          textgaps: ${textMargin},
          backgroundcolor: '${background.replace('#', '')}',
          barcolor: '${lineColor.replace('#', '')}',
          paddingwidth: ${margin},
          paddingheight: ${margin},
        });

        var canvas = document.getElementById('barcode');
        var dataUrl = canvas.toDataURL('image/png');
        var w = canvas.width;
        var h = canvas.height;

        window.ReactNativeWebView.postMessage(JSON.stringify({
          success: true,
          data: dataUrl,
          width: w,
          height: h
        }));
      } catch (e) {
        document.getElementById('error').innerText = e.message;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          success: false,
          error: e.message
        }));
      }
    }

    // CDN 로드 완료 후 실행
    if (document.readyState === 'complete') {
      setTimeout(generateBarcode, 100);
    } else {
      window.addEventListener('load', function() {
        setTimeout(generateBarcode, 100);
      });
    }
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const result = JSON.parse(event.nativeEvent.data);
      if (result.success) {
        setImageData(result.data);
        const origWidth = Math.max(result.width, 100);
        const origHeight = Math.max(result.height, 50);
        setDimensions({ width: origWidth, height: origHeight });

        // maxWidth 기준으로 자동 스케일링
        if (origWidth > maxWidth) {
          const scale = maxWidth / origWidth;
          setScaledDimensions({
            width: maxWidth,
            height: Math.round(origHeight * scale),
          });
        } else {
          setScaledDimensions({ width: origWidth, height: origHeight });
        }
        setError(null);
      } else {
        setError(result.error);
        setImageData(null);
      }
    } catch (e) {
      // 파싱 오류 무시
    }
    setIsLoading(false);
  };

  const handleLoadEnd = () => {
    // WebView 로드 완료 - 잠시 후 로딩 상태 해제
    setTimeout(() => {
      if (isLoading && !imageData) {
        // 아직 이미지가 없으면 로딩 유지
      }
    }, 2000);
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    setError(nativeEvent.description || 'WebView error');
    setIsLoading(false);
  };

  useEffect(() => {
    if (value && formatInfo) {
      setIsLoading(true);
      setImageData(null);
      setError(null);
    }
  }, [value, format]);

  if (!value || !formatInfo) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* WebView - 바코드 생성용 (화면 밖에 배치) */}
      <View style={styles.webViewContainer}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ html: generateHTML() }}
          style={styles.webView}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          cacheEnabled={false}
          incognito={Platform.OS === 'android'}
          mixedContentMode="always"
        />
      </View>

      {/* 바코드 이미지 표시 */}
      {isLoading && !imageData && (
        <View style={[styles.loadingContainer, { minWidth: 200, minHeight: 80 }]}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      )}

      {imageData && (
        <Image
          source={{ uri: imageData }}
          style={{
            width: scaledDimensions.width,
            height: scaledDimensions.height,
          }}
          resizeMode="contain"
        />
      )}

      {error && !imageData && !isLoading && (
        <View style={styles.errorContainer}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  webViewContainer: {
    position: 'absolute',
    left: -1000,
    top: -1000,
    width: 400,
    height: 200,
    opacity: 0,
  },
  webView: {
    width: 400,
    height: 200,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
    minHeight: 80,
  },
});
