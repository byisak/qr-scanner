// components/QRAnalyzer.js
// QR 코드 이미지에서 EC 레벨을 분석하는 컴포넌트

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

// ZXing-js를 사용한 QR 분석 HTML
const qrAnalyzerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: transparent; }
    canvas { display: none; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script src="https://unpkg.com/@aspect-software/barcode-scanner@0.0.5/dist/Decoders.min.js"></script>
  <script src="https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js"></script>
  <script>
    let isReady = false;
    let pendingAnalysis = null;

    // React Native로 결과 전송
    function sendResult(result) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(result));
      }
    }

    // 준비 완료 알림
    function notifyReady() {
      isReady = true;
      sendResult({ type: 'ready' });
      if (pendingAnalysis) {
        analyzeQR(pendingAnalysis);
        pendingAnalysis = null;
      }
    }

    // 이미지에서 QR 코드 분석
    async function analyzeQR(base64Image) {
      if (!isReady) {
        pendingAnalysis = base64Image;
        return;
      }

      try {
        // ZXing 디코더 사용
        if (typeof ZXing !== 'undefined') {
          const codeReader = new ZXing.BrowserQRCodeReader();

          try {
            const result = await codeReader.decodeFromImageUrl(base64Image);

            if (result) {
              const metadata = result.getResultMetadata();
              let ecLevel = null;

              // EC Level 추출 (Key 3)
              if (metadata && metadata.has(3)) {
                ecLevel = String(metadata.get(3));
              } else if (metadata) {
                metadata.forEach((val, key) => {
                  const strVal = String(val);
                  if (['L', 'M', 'Q', 'H'].includes(strVal)) {
                    ecLevel = strVal;
                  }
                });
              }

              sendResult({
                type: 'result',
                success: true,
                data: result.getText(),
                ecLevel: ecLevel,
                format: String(result.getBarcodeFormat())
              });
              return;
            }
          } catch (zxingErr) {
            console.log('ZXing decode error:', zxingErr);
          }
        }

        sendResult({
          type: 'result',
          success: false,
          error: 'QR code not found or could not be decoded'
        });
      } catch (err) {
        sendResult({
          type: 'result',
          success: false,
          error: err.message
        });
      }
    }

    // React Native에서 호출할 수 있도록 전역 함수로 노출
    window.analyzeQR = analyzeQR;

    // 라이브러리 로드 완료 대기
    setTimeout(notifyReady, 1000);
  </script>
</body>
</html>
`;

// QR 분석 훅
export function useQRAnalyzer() {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const pendingCallbacks = useRef({});
  const callbackId = useRef(0);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'ready') {
        setIsReady(true);
        return;
      }

      if (data.type === 'result') {
        // 모든 대기 중인 콜백 실행
        Object.values(pendingCallbacks.current).forEach(callback => {
          callback(data);
        });
        pendingCallbacks.current = {};
      }
    } catch (err) {
      console.error('QRAnalyzer message parse error:', err);
    }
  }, []);

  const analyzeImage = useCallback(async (imageUri) => {
    return new Promise(async (resolve) => {
      try {
        // 파일을 base64로 변환
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const base64Image = `data:image/jpeg;base64,${base64}`;

        // 콜백 등록
        const id = callbackId.current++;
        pendingCallbacks.current[id] = (result) => {
          delete pendingCallbacks.current[id];
          resolve(result);
        };

        // 타임아웃 설정 (5초)
        setTimeout(() => {
          if (pendingCallbacks.current[id]) {
            delete pendingCallbacks.current[id];
            resolve({ success: false, error: 'Analysis timeout' });
          }
        }, 5000);

        // WebView에서 분석 실행
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            analyzeQR("${base64Image}");
            true;
          `);
        } else {
          resolve({ success: false, error: 'WebView not ready' });
        }
      } catch (err) {
        console.error('QRAnalyzer error:', err);
        resolve({ success: false, error: err.message });
      }
    });
  }, []);

  const QRAnalyzerView = useCallback(() => (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        source={{ html: qrAnalyzerHtml }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        style={styles.webview}
      />
    </View>
  ), [handleMessage]);

  return {
    analyzeImage,
    isReady,
    QRAnalyzerView,
  };
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  webview: {
    width: 1,
    height: 1,
  },
});

export default useQRAnalyzer;
