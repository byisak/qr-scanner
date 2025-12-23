// components/BarcodeSvg.js - bwip-js 기반 바코드 생성 컴포넌트 (WebView 방식)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * 지원하는 바코드 포맷 (bwip-js bcid 매핑)
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
 */
export default function BarcodeSvg({
  value,
  format = 'CODE128',
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

  // Codabar 전처리
  let processedValue = value;
  if (format === 'codabar' && value) {
    processedValue = formatCodabar(value);
  }

  const formatInfo = BARCODE_FORMATS[format];

  // 고유 키 생성 (값 변경 시 WebView 리렌더링 강제)
  const webViewKey = useMemo(() => {
    return `${format}-${value}-${Date.now()}`;
  }, [format, value]);

  // HTML 템플릿 생성 - CDN 로드 완료 후 실행
  const generateHTML = () => {
    if (!value || !formatInfo) {
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
          bcid: '${formatInfo.bcid}',
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
