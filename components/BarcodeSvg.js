// components/BarcodeSvg.js - bwip-js 기반 바코드 생성 컴포넌트 (네이티브 방식)
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, PixelRatio } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import bwipjs from '@bwip-js/react-native';

/**
 * bwip-js 지원 전체 바코드 목록 (110종)
 * 카테고리별로 그룹화
 */
export const ALL_BWIP_BARCODES = [
  // ===== 1D Industrial/Logistics =====
  { bcid: 'code128', name: 'Code 128', category: 'industrial', description: 'Logistics/Inventory (all ASCII)', placeholder: 'ABC-123' },
  { bcid: 'code39', name: 'Code 39', category: 'industrial', description: 'Industrial (uppercase/numbers)', placeholder: 'CODE39' },
  { bcid: 'code39ext', name: 'Code 39 Extended', category: 'industrial', description: 'Code 39 Extended (full ASCII)', placeholder: 'Code39' },
  { bcid: 'code93', name: 'Code 93', category: 'industrial', description: 'Industrial high-density', placeholder: 'CODE93' },
  { bcid: 'code93ext', name: 'Code 93 Extended', category: 'industrial', description: 'Code 93 Extended', placeholder: 'Code93' },
  { bcid: 'code11', name: 'Code 11', category: 'industrial', description: 'Telecom equipment ID', placeholder: '123-45' },
  { bcid: 'industrial2of5', name: 'Industrial 2 of 5', category: 'industrial', description: 'Industrial 2 of 5', placeholder: '123456' },
  { bcid: 'interleaved2of5', name: 'Interleaved 2 of 5 (ITF)', category: 'industrial', description: 'Logistics (even digits)', placeholder: '123456' },
  { bcid: 'itf14', name: 'ITF-14', category: 'industrial', description: 'Box/Pallet unit', placeholder: '1234567890123' },
  { bcid: 'matrix2of5', name: 'Matrix 2 of 5', category: 'industrial', description: 'Matrix 2 of 5', placeholder: '123456' },
  { bcid: 'coop2of5', name: 'COOP 2 of 5', category: 'industrial', description: 'COOP 2 of 5', placeholder: '123456' },
  { bcid: 'iata2of5', name: 'IATA 2 of 5', category: 'industrial', description: 'Air cargo', placeholder: '123456' },
  { bcid: 'datalogic2of5', name: 'Datalogic 2 of 5', category: 'industrial', description: 'Datalogic 2 of 5', placeholder: '123456' },

  // ===== Retail =====
  { bcid: 'ean13', name: 'EAN-13', category: 'retail', description: 'International product barcode', placeholder: '590123412345', fixedLength: 12 },
  { bcid: 'ean8', name: 'EAN-8', category: 'retail', description: 'Small products', placeholder: '9638507', fixedLength: 7 },
  { bcid: 'ean5', name: 'EAN-5', category: 'retail', description: 'Add-on (book price)', placeholder: '52495', fixedLength: 5 },
  { bcid: 'ean2', name: 'EAN-2', category: 'retail', description: 'Add-on (magazine issue)', placeholder: '05', fixedLength: 2 },
  { bcid: 'upca', name: 'UPC-A', category: 'retail', description: 'US/Canada products', placeholder: '01234567890', fixedLength: 11 },
  { bcid: 'upce', name: 'UPC-E', category: 'retail', description: 'Small products (US)', placeholder: '0123456', fixedLength: 7 },
  { bcid: 'isbn', name: 'ISBN', category: 'retail', description: 'Book barcode', placeholder: '978123456789' },
  { bcid: 'ismn', name: 'ISMN', category: 'retail', description: 'Music publication', placeholder: '979012345678' },
  { bcid: 'issn', name: 'ISSN', category: 'retail', description: 'Periodical publication', placeholder: '9771234567003' },
  { bcid: 'ean13composite', name: 'EAN-13 Composite', category: 'retail', description: 'EAN-13 Composite', placeholder: '3312345678901' },
  { bcid: 'ean8composite', name: 'EAN-8 Composite', category: 'retail', description: 'EAN-8 Composite', placeholder: '12345678' },
  { bcid: 'upcacomposite', name: 'UPC-A Composite', category: 'retail', description: 'UPC-A Composite', placeholder: '01234567890' },
  { bcid: 'upcecomposite', name: 'UPC-E Composite', category: 'retail', description: 'UPC-E Composite', placeholder: '0123456' },

  // ===== GS1 / Logistics =====
  { bcid: 'gs1-128', name: 'GS1-128', category: 'gs1', description: 'GS1 Logistics barcode', placeholder: '(01)12345678901234' },
  { bcid: 'gs1-cc', name: 'GS1 Composite', category: 'gs1', description: 'GS1 Composite barcode', placeholder: '(01)12345678901234' },
  { bcid: 'gs1databar', name: 'GS1 DataBar Omnidirectional', category: 'gs1', description: 'GS1 DataBar Omnidirectional', placeholder: '0123456789012' },
  { bcid: 'gs1databarstacked', name: 'GS1 DataBar Stacked', category: 'gs1', description: 'GS1 DataBar Stacked', placeholder: '0123456789012' },
  { bcid: 'gs1databarstackedomni', name: 'GS1 DataBar Stacked Omni', category: 'gs1', description: 'GS1 DataBar Stacked Omni', placeholder: '0123456789012' },
  { bcid: 'gs1databartruncated', name: 'GS1 DataBar Truncated', category: 'gs1', description: 'GS1 DataBar Truncated', placeholder: '0123456789012' },
  { bcid: 'gs1databarlimited', name: 'GS1 DataBar Limited', category: 'gs1', description: 'GS1 DataBar Limited', placeholder: '0123456789012' },
  { bcid: 'gs1databarexpanded', name: 'GS1 DataBar Expanded', category: 'gs1', description: 'GS1 DataBar Expanded', placeholder: '(01)12345678901234' },
  { bcid: 'gs1databarexpandedstacked', name: 'GS1 DataBar Expanded Stacked', category: 'gs1', description: 'GS1 DataBar Expanded Stacked', placeholder: '(01)12345678901234' },
  { bcid: 'gs1northamericancoupon', name: 'GS1 North American Coupon', category: 'gs1', description: 'North American coupon', placeholder: '0123456789012' },
  { bcid: 'gs1qrcode', name: 'GS1 QR Code', category: 'gs1', description: 'GS1 QR Code', placeholder: '(01)12345678901234' },
  { bcid: 'gs1dotcode', name: 'GS1 DotCode', category: 'gs1', description: 'GS1 DotCode', placeholder: '(01)12345678901234' },

  // ===== Medical/Pharmaceutical =====
  { bcid: 'pharmacode', name: 'Pharmacode', category: 'medical', description: 'Pharmaceutical packaging', placeholder: '1234', minValue: 3, maxValue: 131070 },
  { bcid: 'pharmacode2', name: 'Pharmacode Two-Track', category: 'medical', description: 'Pharmaceutical 2-track', placeholder: '12345678' },
  { bcid: 'code32', name: 'Code 32 (Italian Pharma)', category: 'medical', description: 'Italian pharmaceutical', placeholder: '123456789' },
  { bcid: 'pzn', name: 'PZN', category: 'medical', description: 'German pharma number', placeholder: '1234567' },
  { bcid: 'hibc39', name: 'HIBC Code 39', category: 'medical', description: 'Healthcare Code 39', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibc128', name: 'HIBC Code 128', category: 'medical', description: 'Healthcare Code 128', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcdatamatrix', name: 'HIBC Data Matrix', category: 'medical', description: 'Healthcare Data Matrix', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcpdf417', name: 'HIBC PDF417', category: 'medical', description: 'Healthcare PDF417', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcqrcode', name: 'HIBC QR Code', category: 'medical', description: 'Healthcare QR Code', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcazteccode', name: 'HIBC Aztec Code', category: 'medical', description: 'Healthcare Aztec Code', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibccodablockf', name: 'HIBC Codablock F', category: 'medical', description: 'Healthcare Codablock F', placeholder: 'A123BJC5D6E71' },
  { bcid: 'hibcmicropdf417', name: 'HIBC MicroPDF417', category: 'medical', description: 'Healthcare MicroPDF417', placeholder: 'A123BJC5D6E71' },

  // ===== Library/Special =====
  { bcid: 'rationalizedCodabar', name: 'Codabar', category: 'special', description: 'Library/Courier/Medical', placeholder: 'A12345A' },
  { bcid: 'bc412', name: 'BC412', category: 'special', description: 'BC412 barcode', placeholder: '123456' },
  { bcid: 'msi', name: 'MSI', category: 'special', description: 'Inventory/Warehouse', placeholder: '123456' },
  { bcid: 'plessey', name: 'Plessey', category: 'special', description: 'Plessey barcode', placeholder: '123456' },
  { bcid: 'telepen', name: 'Telepen', category: 'special', description: 'Telepen barcode', placeholder: 'ABC123' },
  { bcid: 'telepennumeric', name: 'Telepen Numeric', category: 'special', description: 'Telepen Numeric', placeholder: '123456' },
  { bcid: 'channelcode', name: 'Channel Code', category: 'special', description: 'Channel Code', placeholder: '123' },
  { bcid: 'posicode', name: 'PosiCode', category: 'special', description: 'PosiCode', placeholder: '123456' },

  // ===== Postal =====
  { bcid: 'postnet', name: 'POSTNET', category: 'postal', description: 'US Postal', placeholder: '12345' },
  { bcid: 'planet', name: 'PLANET', category: 'postal', description: 'US Postal tracking', placeholder: '12345678901' },
  { bcid: 'uspsintellligentmail', name: 'USPS Intelligent Mail', category: 'postal', description: 'US Smart Mail', placeholder: '01234567890123456789' },
  { bcid: 'onecode', name: 'OneCode', category: 'postal', description: 'USPS OneCode', placeholder: '01234567890123456789' },
  { bcid: 'royalmail', name: 'Royal Mail 4-State', category: 'postal', description: 'UK Postal', placeholder: 'LE28HS9Z' },
  { bcid: 'kix', name: 'KIX (Dutch)', category: 'postal', description: 'Netherlands Postal', placeholder: '1231FZ13XHS' },
  { bcid: 'japanpost', name: 'Japan Post', category: 'postal', description: 'Japan Postal', placeholder: '1231FZ13XHS' },
  { bcid: 'auspost', name: 'Australia Post', category: 'postal', description: 'Australia Postal', placeholder: '5956439111ABA9' },
  { bcid: 'deutschepost', name: 'Deutsche Post Leitcode', category: 'postal', description: 'German Postal Leitcode', placeholder: '21348075016401' },
  { bcid: 'deutschepostidentcode', name: 'Deutsche Post Identcode', category: 'postal', description: 'German Postal Identcode', placeholder: '563102430313' },
  { bcid: 'cepnet', name: 'CEPNet', category: 'postal', description: 'Brazil Postal', placeholder: '12345678' },
  { bcid: 'flattermarken', name: 'Flattermarken', category: 'postal', description: 'German file mark', placeholder: '123456' },

  // ===== 2D Barcodes =====
  { bcid: 'qrcode', name: 'QR Code', category: '2d', description: 'General 2D code', placeholder: 'https://example.com' },
  { bcid: 'microqrcode', name: 'Micro QR Code', category: '2d', description: 'Micro QR', placeholder: 'ABC123' },
  { bcid: 'rectangularmicroqrcode', name: 'Rectangular Micro QR', category: '2d', description: 'Rectangular Micro QR', placeholder: 'ABC123' },
  { bcid: 'datamatrix', name: 'Data Matrix', category: '2d', description: 'Data Matrix', placeholder: 'ABC123' },
  { bcid: 'datamatrixrectangular', name: 'Data Matrix Rectangular', category: '2d', description: 'Rectangular Data Matrix', placeholder: 'ABC123' },
  { bcid: 'datamatrixrectangularextension', name: 'Data Matrix Rectangular Ext', category: '2d', description: 'Extended Rectangular Data Matrix', placeholder: 'ABC123' },
  { bcid: 'pdf417', name: 'PDF417', category: '2d', description: 'PDF417', placeholder: 'ABC123' },
  { bcid: 'pdf417compact', name: 'Compact PDF417', category: '2d', description: 'Compact PDF417', placeholder: 'ABC123' },
  { bcid: 'micropdf417', name: 'MicroPDF417', category: '2d', description: 'Micro PDF417', placeholder: 'ABC123' },
  { bcid: 'azteccode', name: 'Aztec Code', category: '2d', description: 'Aztec Code', placeholder: 'ABC123' },
  { bcid: 'azteccodecompact', name: 'Compact Aztec Code', category: '2d', description: 'Compact Aztec', placeholder: 'ABC123' },
  { bcid: 'aztecrune', name: 'Aztec Runes', category: '2d', description: 'Aztec Runes', placeholder: '123' },
  { bcid: 'maxicode', name: 'MaxiCode', category: '2d', description: 'UPS MaxiCode', placeholder: '[)>01961Z00004951UPSN06X6101' },
  { bcid: 'dotcode', name: 'DotCode', category: '2d', description: 'DotCode', placeholder: 'ABC123' },
  { bcid: 'hanxin', name: 'Han Xin Code', category: '2d', description: 'Han Xin Code (China)', placeholder: 'ABC123' },
  { bcid: 'codeone', name: 'Code One', category: '2d', description: 'Code One', placeholder: 'ABC123' },
  { bcid: 'ultracode', name: 'Ultracode', category: '2d', description: 'Ultracode', placeholder: 'ABC123' },

  // ===== Stacked Barcodes =====
  { bcid: 'codablockf', name: 'Codablock F', category: 'stacked', description: 'Codablock F', placeholder: 'ABC123' },
  { bcid: 'code16k', name: 'Code 16K', category: 'stacked', description: 'Code 16K', placeholder: 'ABC123' },
  { bcid: 'code49', name: 'Code 49', category: 'stacked', description: 'Code 49', placeholder: 'ABC123' },

  // ===== Other =====
  // { bcid: 'raw', name: 'Raw (Custom)', category: 'other', description: 'Raw barcode', placeholder: '1 2 3 4' },
  // { bcid: 'daft', name: 'DAFT Code', category: 'other', description: 'DAFT Code', placeholder: 'DAFTDAFT' },
  // { bcid: 'symbol', name: 'Miscellaneous Symbols', category: 'other', description: 'Misc Symbols', placeholder: 'fima' },

  // ===== Country-specific =====
  { bcid: 'vin', name: 'VIN (Vehicle ID)', category: 'automotive', description: 'Vehicle ID Number', placeholder: '1M8GDM9A_KP042788' },
  { bcid: 'sscc18', name: 'SSCC-18', category: 'gs1', description: 'Logistics unit ID', placeholder: '106141411234567897' },
  { bcid: 'ean14', name: 'EAN-14', category: 'gs1', description: 'Logistics unit ID', placeholder: '12345678901231' },
  { bcid: 'leitcode', name: 'Leitcode', category: 'postal', description: 'German Postal Leitcode', placeholder: '21348075016401' },
  { bcid: 'identcode', name: 'Identcode', category: 'postal', description: 'German Postal Identcode', placeholder: '563102430313' },
  // { bcid: 'swissqrcode', name: 'Swiss QR Code', category: 'other', description: 'Swiss Payment QR', placeholder: 'SPC\\n0200\\n1' },
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
 * 바코드 타입별 최적 설정 (GS1 규격 및 스캔 가능성 기반)
 * - minScale: 스캔 가능한 최소 스케일 (모듈당 픽셀)
 * - recommendedScale: 권장 스케일
 * - defaultHeight: 기본 높이 (mm 단위, bwip-js 기준)
 * - minHeight: 최소 높이 (mm)
 * - fixedModules: 고정 모듈 수 (EAN/UPC 등)
 * - modulesPerChar: 문자당 모듈 수
 * - quietZoneMultiplier: Quiet Zone 배수
 * - inkspread: 인쇄 시 잉크 번짐 보정값
 */
export const BARCODE_OPTIMAL_SETTINGS = {
  // ===== 리테일 바코드 (좁은 바가 많음 - 높은 스케일 필요) =====
  ean13: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 22.85,  // GS1 권장 (100% 기준)
    minHeight: 18.28,      // GS1 최소 (80%)
    fixedModules: 95,
    quietZoneMultiplier: 11,
    inkspread: 0.15,
    guardwhitespace: true,
  },
  ean8: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 18.23,
    minHeight: 14.58,
    fixedModules: 67,
    quietZoneMultiplier: 7,
    inkspread: 0.15,
    guardwhitespace: true,
  },
  ean5: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 21.9,
    minHeight: 17.5,
    fixedModules: 47,
    quietZoneMultiplier: 5,
    inkspread: 0.15,
  },
  ean2: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 21.9,
    minHeight: 17.5,
    fixedModules: 20,
    quietZoneMultiplier: 5,
    inkspread: 0.15,
  },
  upca: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 25.91,  // GS1 권장
    minHeight: 20.73,
    fixedModules: 95,
    quietZoneMultiplier: 9,
    inkspread: 0.15,
    guardwhitespace: true,
  },
  upce: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 25.91,
    minHeight: 20.73,
    fixedModules: 51,
    quietZoneMultiplier: 9,
    inkspread: 0.15,
    guardwhitespace: true,
  },
  isbn: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 22.85,
    minHeight: 18.28,
    fixedModules: 95,
    quietZoneMultiplier: 11,
    inkspread: 0.15,
    guardwhitespace: true,
  },

  // ===== 산업용 바코드 =====
  code128: {
    minScale: 1,
    recommendedScale: 2,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 11,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },
  'gs1-128': {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 31.75,  // GS1 권장
    minHeight: 12.7,
    modulesPerChar: 11,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },
  code39: {
    minScale: 1,
    recommendedScale: 2,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 13,  // 9 bars + 4 gaps
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },
  code93: {
    minScale: 1,
    recommendedScale: 2,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 9,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },

  // ===== ITF 계열 =====
  interleaved2of5: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 9,  // 2문자당 18 모듈
    quietZoneMultiplier: 10,
    inkspread: 0.15,
    bearerbars: true,
  },
  itf14: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 32,  // GS1 권장 (물류용)
    minHeight: 12.7,
    fixedModules: 142,
    quietZoneMultiplier: 10,
    inkspread: 0.15,
    bearerbars: true,
  },

  // ===== 의료/제약 =====
  pharmacode: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 8,
    minHeight: 5,
    modulesPerChar: 2,
    quietZoneMultiplier: 5,
    inkspread: 0.1,
  },
  code32: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 13,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },

  // ===== 특수 바코드 =====
  rationalizedCodabar: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 12,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },
  msi: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 12,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  },

  // ===== 우편 바코드 =====
  postnet: {
    minScale: 3,
    recommendedScale: 4,
    defaultHeight: 3.175,  // 짧은 바
    minHeight: 3.175,
    modulesPerChar: 5,
    quietZoneMultiplier: 5,
    inkspread: 0.05,
  },

  // ===== 2D 바코드 =====
  qrcode: {
    minScale: 3,
    recommendedScale: 5,
    defaultHeight: null,  // 자동 계산
    minHeight: null,
    eclevel: 'M',
  },
  datamatrix: {
    minScale: 3,
    recommendedScale: 5,
    defaultHeight: null,
    minHeight: null,
  },
  pdf417: {
    minScale: 2,
    recommendedScale: 3,
    defaultHeight: null,
    minHeight: null,
    columns: 3,
  },
  azteccode: {
    minScale: 3,
    recommendedScale: 5,
    defaultHeight: null,
    minHeight: null,
  },

  // ===== 기본값 =====
  default: {
    minScale: 2,
    recommendedScale: 2,
    defaultHeight: 15,
    minHeight: 10,
    modulesPerChar: 11,
    quietZoneMultiplier: 10,
    inkspread: 0.1,
  }
};

/**
 * 바코드 타입별 고정 모듈 수 반환
 */
const getFixedModules = (bcid) => {
  const settings = BARCODE_OPTIMAL_SETTINGS[bcid];
  if (settings?.fixedModules) return settings.fixedModules;
  return null;
};

/**
 * 문자당 모듈 수 반환
 */
const getModulesPerChar = (bcid) => {
  const settings = BARCODE_OPTIMAL_SETTINGS[bcid];
  if (settings?.modulesPerChar) return settings.modulesPerChar;
  return BARCODE_OPTIMAL_SETTINGS.default.modulesPerChar;
};

/**
 * 바코드 값과 타입에 따른 최적 스케일 계산
 * @param {string} bcid - 바코드 타입
 * @param {string} value - 바코드 값
 * @param {number} maxWidth - 최대 허용 너비 (픽셀)
 * @returns {object} - { scale, height, padding, options }
 */
export const calculateOptimalSettings = (bcid, value, maxWidth = 280) => {
  const settings = BARCODE_OPTIMAL_SETTINGS[bcid] || BARCODE_OPTIMAL_SETTINGS.default;
  const valueLength = value?.length || 10;

  // 총 모듈 수 계산
  const fixedModules = getFixedModules(bcid);
  const totalModules = fixedModules || (valueLength * getModulesPerChar(bcid));
  const quietZone = settings.quietZoneMultiplier || 10;

  // 최적 스케일 계산
  let scale = settings.recommendedScale;
  const estimatedWidth = (totalModules + quietZone * 2) * scale;

  if (estimatedWidth > maxWidth) {
    // maxWidth에 맞게 축소, 하지만 minScale 이상 유지
    const calculatedScale = Math.floor(maxWidth / (totalModules + quietZone * 2));
    scale = Math.max(calculatedScale, settings.minScale);
  }

  return {
    scale,
    height: settings.defaultHeight || 15,
    minHeight: settings.minHeight || 10,
    padding: Math.ceil(quietZone * scale / 2),
    inkspread: settings.inkspread || 0,
    guardwhitespace: settings.guardwhitespace || false,
    bearerbars: settings.bearerbars || false,
  };
};

/**
 * 저장/공유용 고해상도 바코드 생성
 * @param {object} options - 바코드 옵션 (bcid, text 필수)
 * @returns {Promise<string>} - base64 데이터 URL
 */
export const generateHighResBarcode = async (options) => {
  if (!options || !options.bcid || !options.text) {
    throw new Error('Missing required options: bcid and text are required');
  }

  const settings = BARCODE_OPTIMAL_SETTINGS[options.bcid] || BARCODE_OPTIMAL_SETTINGS.default;

  // height 값이 픽셀 단위로 전달될 수 있으므로 mm 단위로 변환
  const userHeight = options.height || 100;
  const effectiveHeight = userHeight > 50 ? userHeight / 10 : userHeight;

  // 저장용 스케일: 미리보기보다 2배 정도만 (너무 높으면 느려짐)
  const baseScale = options.scale || settings.recommendedScale;
  const saveScale = Math.min(Math.max(baseScale * 2, 4), 8); // 4~8 범위로 제한

  const highResOptions = {
    bcid: options.bcid,
    text: String(options.text),
    scale: saveScale,
    height: Math.max(effectiveHeight, settings.defaultHeight || 15),
    includetext: options.includetext !== false,
    textxalign: 'center',
    textsize: options.textsize || 14,
    backgroundcolor: (options.backgroundcolor || 'ffffff').replace('#', ''),
    barcolor: (options.barcolor || '000000').replace('#', ''),
    paddingwidth: 20,
    paddingheight: 15,
    rotate: options.rotate || 'N',
  };

  // 선택적 옵션 추가
  if (options.alttext) {
    highResOptions.alttext = options.alttext;
  }
  if (settings.guardwhitespace) {
    highResOptions.guardwhitespace = true;
  }

  try {
    const result = await bwipjs.toDataURL(highResOptions);

    // 결과 타입에 따라 처리
    let dataUrl = null;

    if (typeof result === 'string') {
      dataUrl = result;
    } else if (result && typeof result === 'object') {
      if (result.uri) {
        dataUrl = result.uri;
      } else if (result.data) {
        dataUrl = result.data;
      } else if (result.dataURL) {
        dataUrl = result.dataURL;
      } else if (result.base64) {
        dataUrl = result.base64.startsWith('data:')
          ? result.base64
          : `data:image/png;base64,${result.base64}`;
      }
    }

    if (!dataUrl) {
      throw new Error('Invalid result from bwipjs');
    }

    if (!dataUrl.startsWith('data:') && !dataUrl.startsWith('file:')) {
      throw new Error('Invalid dataUrl format');
    }

    return dataUrl;
  } catch (error) {
    console.warn('High-res barcode generation failed:', error.message);
    throw error;
  }
};

/**
 * 스케일 경고 체크
 * @param {string} bcid - 바코드 타입
 * @param {number} scale - 현재 스케일
 * @returns {string|null} - 경고 메시지 키 또는 null
 */
export const checkScaleWarning = (bcid, scale) => {
  const settings = BARCODE_OPTIMAL_SETTINGS[bcid] || BARCODE_OPTIMAL_SETTINGS.default;

  if (scale < settings.minScale) {
    return 'scaleTooLow'; // 스캔 불가능할 수 있음
  }
  return null;
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
 * BarcodeSvg 컴포넌트 - 네이티브 bwip-js 사용
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
  rotate = 'N',    // 회전: N(0°), R(90°), I(180°), L(270°)
  alttext = '',    // 바코드 아래 커스텀 텍스트 (비어있으면 value 사용)
  onError = null,  // 에러 콜백: (errorMessage: string | null) => void
}) {
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scaledDimensions, setScaledDimensions] = useState({ width: 280, height: 140 });

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
  const processedValue = useMemo(() => {
    if ((format === 'codabar' || bcid === 'rationalizedCodabar') && value) {
      return formatCodabar(value);
    }
    return value;
  }, [format, bcid, value]);

  // 바코드 생성 함수
  const generateBarcode = useCallback(async () => {
    if (!processedValue || !bcid) {
      setImageData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 타입별 최적 설정 가져오기
      const optimalSettings = BARCODE_OPTIMAL_SETTINGS[bcid] || BARCODE_OPTIMAL_SETTINGS.default;

      // 스케일 결정: 사용자 지정값과 최소값 중 큰 값 사용
      const effectiveScale = Math.max(width, optimalSettings.minScale);

      // 높이 결정: 사용자 지정값 또는 타입별 기본값 사용
      const effectiveHeight = height > 0
        ? Math.max(height / 10, optimalSettings.minHeight || 8)
        : optimalSettings.defaultHeight || 15;

      // 네이티브 bwip-js로 바코드 생성
      const options = {
        bcid: bcid,
        text: String(processedValue),
        scale: effectiveScale,
        height: effectiveHeight,
        includetext: displayValue,
        textxalign: 'center',
        textsize: fontSize,
        textgaps: textMargin,
        backgroundcolor: background.replace('#', ''),
        barcolor: lineColor.replace('#', ''),
        paddingwidth: margin,
        paddingheight: margin,
        rotate: rotate,
      };

      // 타입별 추가 옵션
      if (optimalSettings.guardwhitespace) {
        options.guardwhitespace = true;
      }
      if (optimalSettings.inkspread && optimalSettings.inkspread > 0) {
        options.inkspread = optimalSettings.inkspread;
      }

      // 커스텀 텍스트가 있으면 alttext 옵션 추가
      if (alttext && alttext.trim()) {
        options.alttext = alttext.trim();
      }

      console.log('Generating barcode with options:', options);

      const result = await bwipjs.toDataURL(options);

      console.log('Barcode generated, result type:', typeof result, 'result:', JSON.stringify(result).substring(0, 200));

      // 결과 타입에 따라 처리
      let dataUrl;
      if (typeof result === 'string') {
        // 문자열인 경우 그대로 사용
        dataUrl = result;
      } else if (result && typeof result === 'object') {
        // 객체인 경우 uri, data, dataURL 등의 속성 확인
        dataUrl = result.uri || result.data || result.dataURL || result.base64;
        if (result.base64 && !dataUrl.startsWith('data:')) {
          dataUrl = `data:image/png;base64,${result.base64}`;
        }
      }

      console.log('Final dataUrl:', dataUrl ? dataUrl.substring(0, 50) + '...' : 'null');

      if (!dataUrl) {
        throw new Error('toDataURL returned invalid result: ' + JSON.stringify(result).substring(0, 100));
      }

      setImageData(dataUrl);
      setError(null);
      // 성공 시 에러 콜백 호출 (null)
      if (onError) onError(null);

      // 이미지 크기 계산 (타입별 설정 기반)
      const fixedModules = optimalSettings.fixedModules;
      const modulesPerChar = optimalSettings.modulesPerChar || 11;
      const totalModules = fixedModules || (processedValue.length * modulesPerChar);
      const quietZone = optimalSettings.quietZoneMultiplier || 10;

      const estimatedWidth = Math.min(
        (totalModules + quietZone * 2) * effectiveScale + margin * 2,
        400
      );
      const estimatedHeight = effectiveHeight * 2.835 + (displayValue ? fontSize + textMargin : 0) + margin * 2;

      // maxWidth 기준으로 자동 스케일링
      if (estimatedWidth > maxWidth) {
        const scaleRatio = maxWidth / estimatedWidth;
        setScaledDimensions({
          width: maxWidth,
          height: Math.round(estimatedHeight * scaleRatio),
        });
      } else {
        setScaledDimensions({
          width: Math.max(estimatedWidth, 150),
          height: Math.max(estimatedHeight, 60)
        });
      }
    } catch (e) {
      console.warn('Barcode generation error:', e.message);
      setError(e.message);
      setImageData(null);
      // 에러 콜백 호출
      if (onError) onError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [processedValue, bcid, width, height, displayValue, fontSize, textMargin, background, lineColor, margin, maxWidth, rotate, alttext, onError]);

  // 값이나 포맷 변경 시 바코드 재생성
  useEffect(() => {
    generateBarcode();
  }, [generateBarcode]);

  // 포맷 정보 가져오기
  const formatInfo = useMemo(() => {
    if (BARCODE_FORMATS[format]) {
      return BARCODE_FORMATS[format];
    }
    // bcid로 검색
    const found = ALL_BWIP_BARCODES.find(b => b.bcid === format);
    return found || { bcid: format };
  }, [format]);

  if (!value) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* 로딩 상태 */}
      {isLoading && !imageData && (
        <View style={[styles.loadingContainer, { minWidth: 200, minHeight: 80 }]}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      )}

      {/* 바코드 이미지 표시 */}
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

      {/* 에러 상태 - 간단한 아이콘만 표시 (상세 에러는 인풋 아래에 표시) */}
      {error && !imageData && !isLoading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
    minHeight: 80,
    padding: 16,
  },
});
