// components/BarcodeSvg.js - 바코드 생성 컴포넌트
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import JsBarcode from 'jsbarcode';

/**
 * 지원하는 바코드 포맷
 */
export const BARCODE_FORMATS = {
  CODE128: {
    id: 'CODE128',
    name: 'Code 128',
    description: '물류/재고 관리 (모든 ASCII)',
    icon: 'cube-outline',
    pattern: /^[\x00-\x7F]+$/, // ASCII characters
    maxLength: null,
    placeholder: 'ABC-123',
  },
  CODE128A: {
    id: 'CODE128A',
    name: 'Code 128A',
    description: '대문자/숫자/제어문자',
    icon: 'cube-outline',
    pattern: /^[\x00-\x5F]+$/, // Control chars + uppercase + digits
    maxLength: null,
    placeholder: 'ABC123',
  },
  CODE128B: {
    id: 'CODE128B',
    name: 'Code 128B',
    description: '대소문자/숫자',
    icon: 'cube-outline',
    pattern: /^[\x20-\x7F]+$/, // Printable ASCII
    maxLength: null,
    placeholder: 'Code128B',
  },
  CODE128C: {
    id: 'CODE128C',
    name: 'Code 128C',
    description: '숫자 전용 (짝수 자릿수)',
    icon: 'cube-outline',
    pattern: /^\d+$/,
    maxLength: null,
    placeholder: '123456',
    evenDigits: true,
  },
  EAN13: {
    id: 'EAN13',
    name: 'EAN-13',
    description: '국제 상품 바코드',
    icon: 'cart-outline',
    pattern: /^\d{12,13}$/,
    maxLength: 13,
    placeholder: '4901234567890',
  },
  EAN8: {
    id: 'EAN8',
    name: 'EAN-8',
    description: '소형 상품',
    icon: 'pricetag-outline',
    pattern: /^\d{7,8}$/,
    maxLength: 8,
    placeholder: '96385074',
  },
  EAN5: {
    id: 'EAN5',
    name: 'EAN-5',
    description: '보조 바코드 (책 가격)',
    icon: 'book-outline',
    pattern: /^\d{5}$/,
    maxLength: 5,
    placeholder: '52495',
  },
  EAN2: {
    id: 'EAN2',
    name: 'EAN-2',
    description: '보조 바코드 (잡지 호수)',
    icon: 'newspaper-outline',
    pattern: /^\d{2}$/,
    maxLength: 2,
    placeholder: '05',
  },
  UPC: {
    id: 'UPC',
    name: 'UPC-A',
    description: '미국/캐나다 상품',
    icon: 'storefront-outline',
    pattern: /^\d{11,12}$/,
    maxLength: 12,
    placeholder: '012345678905',
  },
  UPCE: {
    id: 'UPCE',
    name: 'UPC-E',
    description: '소형 상품 (미국)',
    icon: 'pricetag-outline',
    pattern: /^\d{6,8}$/,
    maxLength: 8,
    placeholder: '01234565',
  },
  CODE39: {
    id: 'CODE39',
    name: 'Code 39',
    description: '산업용 (대문자/숫자)',
    icon: 'construct-outline',
    pattern: /^[0-9A-Z\-\.\ \$\/\+\%]+$/,
    maxLength: null,
    placeholder: 'CODE-39',
  },
  ITF: {
    id: 'ITF',
    name: 'ITF (Interleaved 2 of 5)',
    description: '물류용 (짝수 숫자)',
    icon: 'swap-horizontal-outline',
    pattern: /^\d+$/,
    maxLength: null,
    placeholder: '123456',
    evenDigits: true,
  },
  ITF14: {
    id: 'ITF14',
    name: 'ITF-14',
    description: '박스/팔레트 단위',
    icon: 'archive-outline',
    pattern: /^\d{13,14}$/,
    maxLength: 14,
    placeholder: '10012345678902',
  },
  MSI: {
    id: 'MSI',
    name: 'MSI',
    description: '재고/창고 관리',
    icon: 'file-tray-stacked-outline',
    pattern: /^\d+$/,
    maxLength: null,
    placeholder: '123456',
  },
  MSI10: {
    id: 'MSI10',
    name: 'MSI Mod 10',
    description: 'MSI + 체크섬',
    icon: 'file-tray-stacked-outline',
    pattern: /^\d+$/,
    maxLength: null,
    placeholder: '123456',
  },
  MSI11: {
    id: 'MSI11',
    name: 'MSI Mod 11',
    description: 'MSI + Mod 11 체크섬',
    icon: 'file-tray-stacked-outline',
    pattern: /^\d+$/,
    maxLength: null,
    placeholder: '123456',
  },
  pharmacode: {
    id: 'pharmacode',
    name: 'Pharmacode',
    description: '의약품 포장 (3-131070)',
    icon: 'medkit-outline',
    pattern: /^\d+$/,
    maxLength: null,
    placeholder: '1234',
    minValue: 3,
    maxValue: 131070,
  },
  codabar: {
    id: 'codabar',
    name: 'Codabar',
    description: '도서관/택배/의료',
    icon: 'library-outline',
    pattern: /^[A-Da-d]?[0-9\-\$\:\/\.\+]+[A-Da-d]?$/,
    maxLength: null,
    placeholder: 'A12345B',
    autoWrap: true, // 시작/종료 문자 자동 추가
  },
};

/**
 * 바코드 유효성 검사
 */
export const validateBarcode = (format, value) => {
  if (!value || !format) return { valid: false, message: 'emptyValue' };

  const formatInfo = BARCODE_FORMATS[format];
  if (!formatInfo) return { valid: false, message: 'unknownFormat' };

  // Codabar는 시작/종료 문자 없이도 허용 (자동 추가됨)
  if (format === 'codabar') {
    const corePattern = /^[0-9\-\$\:\/\.\+]+$/;
    const fullPattern = /^[A-Da-d][0-9\-\$\:\/\.\+]+[A-Da-d]$/i;
    if (!corePattern.test(value) && !fullPattern.test(value)) {
      return { valid: false, message: 'invalidPattern' };
    }
    return { valid: true };
  }

  // 패턴 검사
  if (formatInfo.pattern && !formatInfo.pattern.test(value)) {
    return { valid: false, message: 'invalidPattern' };
  }

  // 짝수 자릿수 검사
  if (formatInfo.evenDigits && value.length % 2 !== 0) {
    return { valid: false, message: 'evenDigits' };
  }

  // Pharmacode 범위 검사
  if (format === 'pharmacode') {
    const num = parseInt(value, 10);
    if (num < 3 || num > 131070) {
      return { valid: false, message: 'pharmacodeRange' };
    }
  }

  // 길이 검사 (체크섬 제외한 길이)
  if (formatInfo.maxLength) {
    const checkLength = format === 'EAN13' ? 12 :
                        format === 'EAN8' ? 7 :
                        format === 'UPC' ? 11 :
                        format === 'UPCE' ? 6 :
                        format === 'ITF14' ? 13 : formatInfo.maxLength;

    if (value.length < checkLength) {
      return { valid: false, message: 'tooShort', expected: checkLength };
    }
  }

  return { valid: true };
};

/**
 * Codabar 시작/종료 문자 추가
 */
export const formatCodabar = (value) => {
  if (!value) return value;
  const upper = value.toUpperCase();
  // 이미 시작/종료 문자가 있는지 확인
  const hasStart = /^[A-D]/.test(upper);
  const hasEnd = /[A-D]$/.test(upper);

  if (hasStart && hasEnd) return upper;
  if (!hasStart && !hasEnd) return `A${value}B`;
  if (!hasStart) return `A${value}`;
  if (!hasEnd) return `${value}B`;
  return upper;
};

/**
 * EAN/UPC 체크섬 계산
 */
export const calculateChecksum = (format, value) => {
  if (!value) return '';

  const digits = value.replace(/\D/g, '');

  if (format === 'EAN13' && digits.length === 12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return digits + checkDigit;
  }

  if (format === 'EAN8' && digits.length === 7) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += parseInt(digits[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return digits + checkDigit;
  }

  if (format === 'UPC' && digits.length === 11) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += parseInt(digits[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return digits + checkDigit;
  }

  if (format === 'ITF14' && digits.length === 13) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return digits + checkDigit;
  }

  return value;
};

/**
 * BarcodeSvg 컴포넌트
 */
export default function BarcodeSvg({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  fontSize = 20,
  textMargin = 2,
  background = '#ffffff',
  lineColor = '#000000',
  margin = 10,
  textAlign = 'center',
  flat = false,
}) {
  // 직접 SVG 렌더링
  const renderBarcode = useMemo(() => {
    if (!value) return null;

    try {
      // JsBarcode 모듈 가져오기
      const getModule = (format) => {
        const formats = {
          CODE128: require('jsbarcode/src/barcodes/CODE128/CODE128.js').default || require('jsbarcode/src/barcodes/CODE128/CODE128.js'),
          CODE128A: require('jsbarcode/src/barcodes/CODE128/CODE128A.js').default || require('jsbarcode/src/barcodes/CODE128/CODE128A.js'),
          CODE128B: require('jsbarcode/src/barcodes/CODE128/CODE128B.js').default || require('jsbarcode/src/barcodes/CODE128/CODE128B.js'),
          CODE128C: require('jsbarcode/src/barcodes/CODE128/CODE128C.js').default || require('jsbarcode/src/barcodes/CODE128/CODE128C.js'),
          EAN13: require('jsbarcode/src/barcodes/EAN_UPC/EAN13.js').default || require('jsbarcode/src/barcodes/EAN_UPC/EAN13.js'),
          EAN8: require('jsbarcode/src/barcodes/EAN_UPC/EAN8.js').default || require('jsbarcode/src/barcodes/EAN_UPC/EAN8.js'),
          EAN5: require('jsbarcode/src/barcodes/EAN_UPC/EAN5.js').default || require('jsbarcode/src/barcodes/EAN_UPC/EAN5.js'),
          EAN2: require('jsbarcode/src/barcodes/EAN_UPC/EAN2.js').default || require('jsbarcode/src/barcodes/EAN_UPC/EAN2.js'),
          UPC: require('jsbarcode/src/barcodes/EAN_UPC/UPC.js').default || require('jsbarcode/src/barcodes/EAN_UPC/UPC.js'),
          UPCE: require('jsbarcode/src/barcodes/EAN_UPC/UPCE.js').default || require('jsbarcode/src/barcodes/EAN_UPC/UPCE.js'),
          CODE39: require('jsbarcode/src/barcodes/CODE39/index.js').default || require('jsbarcode/src/barcodes/CODE39/index.js'),
          ITF: require('jsbarcode/src/barcodes/ITF/ITF.js').default || require('jsbarcode/src/barcodes/ITF/ITF.js'),
          ITF14: require('jsbarcode/src/barcodes/ITF/ITF14.js').default || require('jsbarcode/src/barcodes/ITF/ITF14.js'),
          MSI: require('jsbarcode/src/barcodes/MSI/MSI.js').default || require('jsbarcode/src/barcodes/MSI/MSI.js'),
          MSI10: require('jsbarcode/src/barcodes/MSI/MSI10.js').default || require('jsbarcode/src/barcodes/MSI/MSI10.js'),
          MSI11: require('jsbarcode/src/barcodes/MSI/MSI11.js').default || require('jsbarcode/src/barcodes/MSI/MSI11.js'),
          pharmacode: require('jsbarcode/src/barcodes/pharmacode/index.js').default || require('jsbarcode/src/barcodes/pharmacode/index.js'),
          codabar: require('jsbarcode/src/barcodes/codabar/index.js').default || require('jsbarcode/src/barcodes/codabar/index.js'),
        };
        return formats[format];
      };

      const BarcodeClass = getModule(format);
      if (!BarcodeClass) {
        // 알 수 없는 포맷 - 조용히 실패
        return null;
      }

      // Codabar는 시작/종료 문자 자동 추가
      let processedValue = value;
      if (format === 'codabar') {
        processedValue = formatCodabar(value);
      }

      const encoder = new BarcodeClass(processedValue, {});
      if (!encoder.valid()) {
        // 유효하지 않은 값 - 입력 중일 수 있으므로 조용히 실패
        return null;
      }

      const encoded = encoder.encode();
      const binary = encoded.data;
      const text = encoded.text;

      // SVG 크기 계산
      const barcodeWidth = binary.length * width;
      const totalWidth = barcodeWidth + margin * 2;
      const textHeight = displayValue ? fontSize + textMargin : 0;
      const totalHeight = height + margin * 2 + textHeight;

      // 바 렌더링
      const bars = [];
      let x = margin;

      for (let i = 0; i < binary.length; i++) {
        if (binary[i] === '1') {
          bars.push(
            <Rect
              key={i}
              x={x}
              y={margin}
              width={width}
              height={height}
              fill={lineColor}
            />
          );
        }
        x += width;
      }

      return {
        bars,
        text,
        totalWidth,
        totalHeight,
        barcodeWidth,
      };
    } catch (error) {
      // 렌더링 오류 - 입력 중일 수 있으므로 조용히 실패
      return null;
    }
  }, [value, format, width, height, displayValue, fontSize, textMargin, background, lineColor, margin]);

  if (!renderBarcode) {
    return null;
  }

  const { bars, text, totalWidth, totalHeight, barcodeWidth } = renderBarcode;

  // 텍스트 X 위치 계산
  let textX = margin + barcodeWidth / 2;
  let textAnchor = 'middle';
  if (textAlign === 'left') {
    textX = margin;
    textAnchor = 'start';
  } else if (textAlign === 'right') {
    textX = margin + barcodeWidth;
    textAnchor = 'end';
  }

  return (
    <View>
      <Svg width={totalWidth} height={totalHeight}>
        {/* 배경 */}
        <Rect x={0} y={0} width={totalWidth} height={totalHeight} fill={background} />

        {/* 바코드 바 */}
        {bars}

        {/* 텍스트 */}
        {displayValue && (
          <SvgText
            x={textX}
            y={margin + height + textMargin + fontSize * 0.85}
            fill={lineColor}
            fontSize={fontSize}
            fontFamily="monospace"
            textAnchor={textAnchor}
          >
            {text}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
