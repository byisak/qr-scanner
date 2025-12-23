// constants/barcodeSpecs.js - 바코드 유효성 검사 사양
// 각 바코드 타입별 패턴, 최소/최대 길이, 허용 문자 등 정의

export const BARCODE_SPECS = {
  // ===== 1D 산업/물류용 바코드 =====
  code128: {
    pattern: /^[\x00-\x7F]+$/, // ASCII 0-127
    minLength: 1,
    maxLength: 80,
    description: '모든 ASCII 문자 지원',
    example: 'ABC-123',
    autoCheckDigit: true,
  },
  code39: {
    pattern: /^[0-9A-Z\-\.\ \$\/\+\%]+$/,
    minLength: 1,
    maxLength: 43,
    description: '대문자, 숫자, - . $ / + % 스페이스',
    example: 'CODE39',
    autoCheckDigit: false,
  },
  code39ext: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 43,
    description: '전체 ASCII 문자 지원',
    example: 'Code39',
    autoCheckDigit: false,
  },
  code93: {
    pattern: /^[0-9A-Z\-\.\ \$\/\+\%]+$/,
    minLength: 1,
    maxLength: 48,
    description: '대문자, 숫자, - . $ / + % 스페이스',
    example: 'CODE93',
    autoCheckDigit: true,
  },
  code93ext: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 48,
    description: '전체 ASCII 문자 지원',
    example: 'Code93',
    autoCheckDigit: true,
  },
  code11: {
    pattern: /^[0-9\-]+$/,
    minLength: 1,
    maxLength: 20,
    description: '숫자와 하이픈만 허용',
    example: '123-45',
    autoCheckDigit: true,
  },
  industrial2of5: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 30,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: false,
  },
  interleaved2of5: {
    pattern: /^[0-9]+$/,
    minLength: 2,
    maxLength: 30,
    description: '짝수 개의 숫자 (자동 패딩)',
    example: '123456',
    autoCheckDigit: false,
    evenLength: true,
  },
  itf14: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자',
    example: '1234567890123',
    autoCheckDigit: true,
  },
  matrix2of5: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 30,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: false,
  },
  coop2of5: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 30,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: false,
  },
  iata2of5: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 30,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: false,
  },
  datalogic2of5: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 30,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: false,
  },

  // ===== 상품 바코드 (Retail) =====
  ean13: {
    pattern: /^[0-9]{12,13}$/,
    minLength: 12,
    maxLength: 13,
    description: '12-13자리 숫자 (체크섬 자동계산)',
    example: '590123412345',
    autoCheckDigit: true,
  },
  ean8: {
    pattern: /^[0-9]{7,8}$/,
    minLength: 7,
    maxLength: 8,
    description: '7-8자리 숫자 (체크섬 자동계산)',
    example: '9638507',
    autoCheckDigit: true,
  },
  ean5: {
    pattern: /^[0-9]{5}$/,
    minLength: 5,
    maxLength: 5,
    description: '정확히 5자리 숫자',
    example: '52495',
    autoCheckDigit: false,
  },
  ean2: {
    pattern: /^[0-9]{2}$/,
    minLength: 2,
    maxLength: 2,
    description: '정확히 2자리 숫자',
    example: '05',
    autoCheckDigit: false,
  },
  upca: {
    pattern: /^[0-9]{11,12}$/,
    minLength: 11,
    maxLength: 12,
    description: '11-12자리 숫자 (체크섬 자동계산)',
    example: '01234567890',
    autoCheckDigit: true,
  },
  upce: {
    pattern: /^[0-9]{6,8}$/,
    minLength: 6,
    maxLength: 8,
    description: '6-8자리 숫자',
    example: '0123456',
    autoCheckDigit: true,
  },
  isbn: {
    pattern: /^[0-9]{9,13}[0-9X]?$/i,
    minLength: 10,
    maxLength: 13,
    description: 'ISBN-10 또는 ISBN-13',
    example: '978123456789',
    autoCheckDigit: true,
  },
  ismn: {
    pattern: /^[0-9]{13}$/,
    minLength: 13,
    maxLength: 13,
    description: '13자리 숫자 (979로 시작)',
    example: '979012345678',
    autoCheckDigit: true,
  },
  issn: {
    pattern: /^[0-9]{8,13}$/,
    minLength: 8,
    maxLength: 13,
    description: '8-13자리 숫자',
    example: '9771234567003',
    autoCheckDigit: true,
  },
  ean13composite: {
    pattern: /^[0-9]{12,13}/,
    minLength: 12,
    maxLength: 100,
    description: 'EAN-13 + 복합 데이터',
    example: '3312345678901',
    autoCheckDigit: true,
  },
  ean8composite: {
    pattern: /^[0-9]{7,8}/,
    minLength: 7,
    maxLength: 100,
    description: 'EAN-8 + 복합 데이터',
    example: '12345678',
    autoCheckDigit: true,
  },
  upcacomposite: {
    pattern: /^[0-9]{11,12}/,
    minLength: 11,
    maxLength: 100,
    description: 'UPC-A + 복합 데이터',
    example: '01234567890',
    autoCheckDigit: true,
  },
  upcecomposite: {
    pattern: /^[0-9]{6,8}/,
    minLength: 6,
    maxLength: 100,
    description: 'UPC-E + 복합 데이터',
    example: '0123456',
    autoCheckDigit: true,
  },

  // ===== GS1 / 물류 =====
  'gs1-128': {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 48,
    description: 'GS1 AI 형식: (01)12345678901234',
    example: '(01)12345678901234',
    autoCheckDigit: true,
  },
  'gs1-cc': {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 200,
    description: 'GS1 복합 바코드',
    example: '(01)12345678901234',
    autoCheckDigit: true,
  },
  gs1databar: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자',
    example: '0123456789012',
    autoCheckDigit: true,
  },
  gs1databarstacked: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자',
    example: '0123456789012',
    autoCheckDigit: true,
  },
  gs1databarstackedomni: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자',
    example: '0123456789012',
    autoCheckDigit: true,
  },
  gs1databartruncated: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자',
    example: '0123456789012',
    autoCheckDigit: true,
  },
  gs1databarlimited: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자 (0,1로 시작)',
    example: '0123456789012',
    autoCheckDigit: true,
  },
  gs1databarexpanded: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 74,
    description: 'GS1 AI 형식 지원',
    example: '(01)12345678901234',
    autoCheckDigit: true,
  },
  gs1databarexpandedstacked: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 74,
    description: 'GS1 AI 형식 지원',
    example: '(01)12345678901234',
    autoCheckDigit: true,
  },
  gs1northamericancoupon: {
    pattern: /^[0-9]+$/,
    minLength: 12,
    maxLength: 30,
    description: '북미 쿠폰 형식',
    example: '0123456789012',
    autoCheckDigit: true,
  },
  gs1qrcode: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 4296,
    description: 'GS1 AI 형식의 QR',
    example: '(01)12345678901234',
    autoCheckDigit: false,
  },
  gs1dotcode: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 500,
    description: 'GS1 AI 형식',
    example: '(01)12345678901234',
    autoCheckDigit: false,
  },
  sscc18: {
    pattern: /^[0-9]{17,18}$/,
    minLength: 17,
    maxLength: 18,
    description: '17-18자리 숫자',
    example: '106141411234567897',
    autoCheckDigit: true,
  },
  ean14: {
    pattern: /^[0-9]{13,14}$/,
    minLength: 13,
    maxLength: 14,
    description: '13-14자리 숫자',
    example: '12345678901231',
    autoCheckDigit: true,
  },

  // ===== 의료/제약 =====
  pharmacode: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 6,
    minValue: 3,
    maxValue: 131070,
    description: '3-131070 사이의 숫자',
    example: '1234',
    autoCheckDigit: false,
  },
  pharmacode2: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 8,
    description: '숫자만 허용',
    example: '12345678',
    autoCheckDigit: false,
  },
  code32: {
    pattern: /^[0-9]{8,9}$/,
    minLength: 8,
    maxLength: 9,
    description: '8-9자리 숫자',
    example: '123456789',
    autoCheckDigit: true,
  },
  pzn: {
    pattern: /^[0-9]{6,7}$/,
    minLength: 6,
    maxLength: 7,
    description: '6-7자리 숫자',
    example: '1234567',
    autoCheckDigit: true,
  },
  hibc39: {
    pattern: /^[A-Z0-9\-\.\ \$\/\+\%]+$/,
    minLength: 1,
    maxLength: 43,
    description: 'HIBC 형식 (대문자, 숫자)',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibc128: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 80,
    description: 'HIBC 형식',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibcdatamatrix: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 2335,
    description: 'HIBC 데이터 매트릭스',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibcpdf417: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 1850,
    description: 'HIBC PDF417',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibcqrcode: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 4296,
    description: 'HIBC QR 코드',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibcazteccode: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 3067,
    description: 'HIBC Aztec 코드',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibccodablockf: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 2725,
    description: 'HIBC Codablock F',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },
  hibcmicropdf417: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 250,
    description: 'HIBC MicroPDF417',
    example: 'A123BJC5D6E71',
    autoCheckDigit: true,
  },

  // ===== 도서관/특수 =====
  rationalizedCodabar: {
    pattern: /^[A-D][0-9\-\$\:\.\+\/]+[A-D]$/i,
    minLength: 3,
    maxLength: 43,
    description: 'A-D로 시작/끝, 중간은 숫자/-$:.+/',
    example: 'A12345A',
    autoCheckDigit: false,
  },
  bc412: {
    pattern: /^[0-9A-Z\#\-\.\ \$\/\+\%]+$/,
    minLength: 1,
    maxLength: 18,
    description: '대문자, 숫자, 특수문자',
    example: '123456',
    autoCheckDigit: false,
  },
  msi: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 14,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: true,
  },
  plessey: {
    pattern: /^[0-9A-F]+$/i,
    minLength: 1,
    maxLength: 14,
    description: '숫자와 A-F (16진수)',
    example: '123456',
    autoCheckDigit: true,
  },
  telepen: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 60,
    description: '전체 ASCII 지원',
    example: 'ABC123',
    autoCheckDigit: true,
  },
  telepennumeric: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 60,
    description: '숫자만 허용 (짝수)',
    example: '123456',
    autoCheckDigit: true,
    evenLength: true,
  },
  channelcode: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 7,
    description: '숫자만 (채널 수에 따라)',
    example: '123',
    autoCheckDigit: false,
  },
  posicode: {
    pattern: /^[0-9A-Z]+$/,
    minLength: 1,
    maxLength: 30,
    description: '대문자와 숫자',
    example: '123456',
    autoCheckDigit: false,
  },

  // ===== 우편 바코드 (Postal) =====
  postnet: {
    pattern: /^[0-9]{5,11}$/,
    minLength: 5,
    maxLength: 11,
    description: '5, 9, 또는 11자리 숫자',
    example: '12345',
    autoCheckDigit: true,
  },
  planet: {
    pattern: /^[0-9]{11,13}$/,
    minLength: 11,
    maxLength: 13,
    description: '11 또는 13자리 숫자',
    example: '12345678901',
    autoCheckDigit: true,
  },
  uspsintellligentmail: {
    pattern: /^[0-9]{20,31}$/,
    minLength: 20,
    maxLength: 31,
    description: '20-31자리 숫자',
    example: '01234567890123456789',
    autoCheckDigit: false,
  },
  onecode: {
    pattern: /^[0-9]{20,31}$/,
    minLength: 20,
    maxLength: 31,
    description: '20-31자리 숫자',
    example: '01234567890123456789',
    autoCheckDigit: false,
  },
  royalmail: {
    pattern: /^[0-9A-Z]+$/,
    minLength: 1,
    maxLength: 50,
    description: '대문자와 숫자',
    example: 'LE28HS9Z',
    autoCheckDigit: true,
  },
  kix: {
    pattern: /^[0-9A-Z]+$/,
    minLength: 1,
    maxLength: 18,
    description: '대문자와 숫자',
    example: '1231FZ13XHS',
    autoCheckDigit: false,
  },
  japanpost: {
    pattern: /^[0-9A-Z\-]+$/,
    minLength: 1,
    maxLength: 20,
    description: '숫자, 대문자, 하이픈',
    example: '1231FZ13XHS',
    autoCheckDigit: true,
  },
  auspost: {
    pattern: /^[0-9A-Z]+$/,
    minLength: 8,
    maxLength: 23,
    description: '숫자와 대문자',
    example: '5956439111ABA9',
    autoCheckDigit: true,
  },
  deutschepost: {
    pattern: /^[0-9]{14}$/,
    minLength: 14,
    maxLength: 14,
    description: '정확히 14자리 숫자',
    example: '21348075016401',
    autoCheckDigit: true,
  },
  deutschepostidentcode: {
    pattern: /^[0-9]{11,12}$/,
    minLength: 11,
    maxLength: 12,
    description: '11-12자리 숫자',
    example: '563102430313',
    autoCheckDigit: true,
  },
  cepnet: {
    pattern: /^[0-9]{8}$/,
    minLength: 8,
    maxLength: 8,
    description: '정확히 8자리 숫자',
    example: '12345678',
    autoCheckDigit: false,
  },
  flattermarken: {
    pattern: /^[0-9]+$/,
    minLength: 1,
    maxLength: 14,
    description: '숫자만 허용',
    example: '123456',
    autoCheckDigit: false,
  },
  leitcode: {
    pattern: /^[0-9]{14}$/,
    minLength: 14,
    maxLength: 14,
    description: '정확히 14자리 숫자',
    example: '21348075016401',
    autoCheckDigit: true,
  },
  identcode: {
    pattern: /^[0-9]{11,12}$/,
    minLength: 11,
    maxLength: 12,
    description: '11-12자리 숫자',
    example: '563102430313',
    autoCheckDigit: true,
  },

  // ===== 2D 바코드 =====
  qrcode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 4296,
    description: '모든 문자 지원',
    example: 'https://example.com',
    autoCheckDigit: false,
  },
  microqrcode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 35,
    description: '짧은 텍스트용',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  rectangularmicroqrcode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 361,
    description: '직사각형 마이크로 QR',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  datamatrix: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 2335,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  datamatrixrectangular: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 2335,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  datamatrixrectangularextension: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 3550,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  pdf417: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 1850,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  pdf417compact: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 1850,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  micropdf417: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 250,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  azteccode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 3067,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  azteccodecompact: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 3067,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  aztecrune: {
    pattern: /^[0-9]{1,3}$/,
    minLength: 1,
    maxLength: 3,
    minValue: 0,
    maxValue: 255,
    description: '0-255 사이의 숫자',
    example: '123',
    autoCheckDigit: false,
  },
  maxicode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 138,
    description: 'UPS 형식 지원',
    example: '[)>01961Z00004951UPSN06X6101',
    autoCheckDigit: false,
  },
  dotcode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 500,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  hanxin: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 7827,
    description: '중국어 포함 모든 문자',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  codeone: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 2218,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },
  ultracode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 504,
    description: '모든 문자 지원',
    example: 'ABC123',
    autoCheckDigit: false,
  },

  // ===== 스택형 바코드 =====
  codablockf: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 2725,
    description: 'ASCII 문자 지원',
    example: 'ABC123',
    autoCheckDigit: true,
  },
  code16k: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 77,
    description: 'ASCII 문자 지원',
    example: 'ABC123',
    autoCheckDigit: true,
  },
  code49: {
    pattern: /^[\x00-\x7F]+$/,
    minLength: 1,
    maxLength: 81,
    description: 'ASCII 문자 지원',
    example: 'ABC123',
    autoCheckDigit: true,
  },

  // ===== 자동차 =====
  vin: {
    pattern: /^[A-HJ-NPR-Z0-9]{17}$/,
    minLength: 17,
    maxLength: 17,
    description: '17자리 (I, O, Q 제외)',
    example: '1M8GDM9AXKP042788',
    autoCheckDigit: true,
    excludeChars: 'IOQ',
  },

  // ===== 기타 =====
  raw: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 100,
    description: '공백으로 구분된 숫자',
    example: '1 2 3 4',
    autoCheckDigit: false,
  },
  daft: {
    pattern: /^[DAFT]+$/i,
    minLength: 1,
    maxLength: 50,
    description: 'D, A, F, T 문자만',
    example: 'DAFTDAFT',
    autoCheckDigit: false,
  },
  symbol: {
    pattern: /^[a-z]+$/,
    minLength: 1,
    maxLength: 10,
    description: '심볼 이름 (소문자)',
    example: 'fima',
    autoCheckDigit: false,
  },
  swissqrcode: {
    pattern: /^[\s\S]+$/,
    minLength: 1,
    maxLength: 997,
    description: '스위스 결제 QR 형식',
    example: 'SPC\\n0200\\n1',
    autoCheckDigit: false,
  },
};

/**
 * 바코드 값 유효성 검사 함수
 * @param {string} bcid - 바코드 타입 ID
 * @param {string} value - 검사할 값
 * @returns {{ valid: boolean, error?: string }} 유효성 검사 결과
 */
export function validateBarcodeValue(bcid, value) {
  const spec = BARCODE_SPECS[bcid];

  // 사양이 없으면 유효로 처리 (bwip-js가 검증)
  if (!spec) {
    return { valid: true };
  }

  // 빈 값 체크
  if (!value || value.length === 0) {
    return { valid: false, error: 'empty' };
  }

  // 최소 길이 체크
  if (spec.minLength && value.length < spec.minLength) {
    return {
      valid: false,
      error: 'tooShort',
      detail: { min: spec.minLength, current: value.length }
    };
  }

  // 최대 길이 체크
  if (spec.maxLength && value.length > spec.maxLength) {
    return {
      valid: false,
      error: 'tooLong',
      detail: { max: spec.maxLength, current: value.length }
    };
  }

  // 패턴 체크
  if (spec.pattern && !spec.pattern.test(value)) {
    return {
      valid: false,
      error: 'invalidFormat',
      detail: { description: spec.description }
    };
  }

  // 숫자 범위 체크 (pharmacode 등)
  if (spec.minValue !== undefined || spec.maxValue !== undefined) {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      return { valid: false, error: 'invalidNumber' };
    }
    if (spec.minValue !== undefined && numValue < spec.minValue) {
      return {
        valid: false,
        error: 'valueTooSmall',
        detail: { min: spec.minValue }
      };
    }
    if (spec.maxValue !== undefined && numValue > spec.maxValue) {
      return {
        valid: false,
        error: 'valueTooLarge',
        detail: { max: spec.maxValue }
      };
    }
  }

  // 짝수 길이 체크
  if (spec.evenLength && value.length % 2 !== 0) {
    return {
      valid: false,
      error: 'needsEvenLength',
      detail: { current: value.length }
    };
  }

  return { valid: true };
}

/**
 * 바코드 에러 메시지 생성
 * @param {string} error - 에러 코드
 * @param {object} detail - 상세 정보
 * @param {function} t - 번역 함수
 * @returns {string} 에러 메시지
 */
export function getBarcodeErrorMessage(error, detail, t) {
  switch (error) {
    case 'empty':
      return t?.('generator.barcodeErrors.empty') || '값을 입력해주세요';
    case 'tooShort':
      return t?.('generator.barcodeErrors.tooShort', detail) ||
        `최소 ${detail?.min}자리 이상 입력해주세요 (현재: ${detail?.current}자리)`;
    case 'tooLong':
      return t?.('generator.barcodeErrors.tooLong', detail) ||
        `최대 ${detail?.max}자리까지 입력 가능합니다 (현재: ${detail?.current}자리)`;
    case 'invalidFormat':
      return t?.('generator.barcodeErrors.invalidFormat', detail) ||
        `올바른 형식이 아닙니다: ${detail?.description || ''}`;
    case 'invalidNumber':
      return t?.('generator.barcodeErrors.invalidNumber') || '숫자만 입력 가능합니다';
    case 'valueTooSmall':
      return t?.('generator.barcodeErrors.valueTooSmall', detail) ||
        `최소값은 ${detail?.min}입니다`;
    case 'valueTooLarge':
      return t?.('generator.barcodeErrors.valueTooLarge', detail) ||
        `최대값은 ${detail?.max}입니다`;
    case 'needsEvenLength':
      return t?.('generator.barcodeErrors.needsEvenLength', detail) ||
        `짝수 자리수가 필요합니다 (현재: ${detail?.current}자리)`;
    default:
      return t?.('generator.barcodeErrors.invalid') || '올바른 형식이 아닙니다';
  }
}

export default BARCODE_SPECS;
