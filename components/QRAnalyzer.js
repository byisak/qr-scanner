// components/QRAnalyzer.js
// QR 코드 이미지에서 EC 레벨을 분석하는 컴포넌트

import React, { useRef, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

// ZXing-js를 사용한 QR 분석 HTML (최적화 버전)
const qrAnalyzerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f0f0f0; font-family: sans-serif; }
    #status { padding: 10px; font-size: 12px; }
  </style>
</head>
<body>
  <div id="status">Loading...</div>
  <canvas id="canvas" style="display:none;"></canvas>
  <canvas id="processedCanvas" style="display:none;"></canvas>

  <script>
    let zxingLoaded = false;
    let isReady = false;

    function log(msg) {
      console.log('[QRAnalyzer HTML] ' + msg);
      document.getElementById('status').innerText = msg;
    }

    function sendResult(result) {
      log('Sending result: ' + JSON.stringify(result));
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(result));
      }
    }

    function notifyReady() {
      isReady = true;
      log('Ready! ZXing loaded: ' + zxingLoaded);
      sendResult({ type: 'ready', zxingLoaded: zxingLoaded });
    }

    // 이미지 전처리 함수 (대비 증가, 샤프닝)
    function preprocessImage(canvas) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. 그레이스케일 변환 + 대비 증가
      for (let i = 0; i < data.length; i += 4) {
        // 그레이스케일
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // 대비 증가 (1.3배)
        const contrast = 1.3;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        const enhanced = factor * (gray - 128) + 128;

        const finalValue = Math.max(0, Math.min(255, enhanced));
        data[i] = finalValue;
        data[i + 1] = finalValue;
        data[i + 2] = finalValue;
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    // 다양한 설정으로 디코딩 시도
    async function tryDecodeWithSettings(canvas, settings) {
      try {
        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));

        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
        hints.set(ZXing.DecodeHintType.CHARACTER_SET, 'UTF-8');

        if (settings.alsoInverted) {
          hints.set(ZXing.DecodeHintType.ALSO_INVERTED, true);
        }

        const reader = new ZXing.QRCodeReader();
        return reader.decode(binaryBitmap, hints);
      } catch (e) {
        return null;
      }
    }

    async function analyzeQR(base64Image) {
      log('analyzeQR called, image length: ' + (base64Image ? base64Image.length : 0));

      if (!zxingLoaded || typeof ZXing === 'undefined') {
        log('ZXing not loaded!');
        sendResult({ type: 'result', success: false, error: 'ZXing library not loaded' });
        return;
      }

      try {
        log('Loading image to canvas...');
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = async function() {
          try {
            log('Image loaded: ' + img.width + 'x' + img.height);
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            let result = null;
            let attempt = 0;

            // 1차 시도: 원본 이미지
            log('Attempt 1: Original image...');
            result = await tryDecodeWithSettings(canvas, { alsoInverted: false });
            attempt = 1;

            // 2차 시도: 반전 포함
            if (!result) {
              log('Attempt 2: With inversion...');
              result = await tryDecodeWithSettings(canvas, { alsoInverted: true });
              attempt = 2;
            }

            // 3차 시도: 이미지 전처리 후
            if (!result) {
              log('Attempt 3: With preprocessing...');
              const processedCanvas = document.getElementById('processedCanvas');
              const pCtx = processedCanvas.getContext('2d');
              processedCanvas.width = img.width;
              processedCanvas.height = img.height;
              pCtx.drawImage(img, 0, 0);
              preprocessImage(processedCanvas);
              result = await tryDecodeWithSettings(processedCanvas, { alsoInverted: true });
              attempt = 3;
            }

            if (result) {
              log('QR decoded at attempt ' + attempt + ': ' + result.getText());
              const metadata = result.getResultMetadata();
              let ecLevel = null;

              if (metadata) {
                log('Metadata size: ' + metadata.size);

                // EC Level은 key 3 (ERROR_CORRECTION_LEVEL)
                if (metadata.has(3)) {
                  ecLevel = String(metadata.get(3));
                  log('EC Level from key 3: ' + ecLevel);
                }

                // 모든 메타데이터 출력
                metadata.forEach((val, key) => {
                  log('Metadata[' + key + '] = ' + val);
                  const strVal = String(val);
                  if (['L', 'M', 'Q', 'H'].includes(strVal) && !ecLevel) {
                    ecLevel = strVal;
                  }
                });
              } else {
                log('No metadata found');
              }

              sendResult({
                type: 'result',
                success: true,
                data: result.getText(),
                ecLevel: ecLevel,
                format: 'QR_CODE',
                attempt: attempt
              });
            } else {
              log('No result from decoder after all attempts');
              sendResult({ type: 'result', success: false, error: 'No QR code found' });
            }
          } catch (decodeErr) {
            log('Decode error: ' + decodeErr.message);
            sendResult({ type: 'result', success: false, error: decodeErr.message });
          }
        };

        img.onerror = function(err) {
          log('Image load error');
          sendResult({ type: 'result', success: false, error: 'Failed to load image' });
        };

        img.src = base64Image;
      } catch (err) {
        log('analyzeQR error: ' + err.message);
        sendResult({ type: 'result', success: false, error: err.message });
      }
    }

    window.analyzeQR = analyzeQR;

    // 스크립트 로드 완료 체크
    function checkZXing() {
      if (typeof ZXing !== 'undefined') {
        zxingLoaded = true;
        log('ZXing loaded successfully');
        notifyReady();
      } else {
        log('Waiting for ZXing...');
        setTimeout(checkZXing, 500);
      }
    }

    log('Starting...');
  </script>

  <script
    src="https://unpkg.com/@zxing/library@0.21.2/umd/index.min.js"
    onerror="log('Failed to load ZXing'); notifyReady();"
    onload="log('ZXing script loaded'); checkZXing();"
  ></script>
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
      console.log('[QRAnalyzer] Message received:', JSON.stringify(data));

      if (data.type === 'ready') {
        console.log('[QRAnalyzer] WebView ready, ZXing loaded:', data.zxingLoaded);
        setIsReady(true);
        return;
      }

      if (data.type === 'result') {
        console.log('[QRAnalyzer] Analysis result - success:', data.success, 'ecLevel:', data.ecLevel);
        // 모든 대기 중인 콜백 실행
        Object.values(pendingCallbacks.current).forEach(callback => {
          callback(data);
        });
        pendingCallbacks.current = {};
      }
    } catch (err) {
      console.error('[QRAnalyzer] Message parse error:', err);
    }
  }, []);

  const analyzeImage = useCallback(async (imageUri) => {
    console.log('[QRAnalyzer] analyzeImage called, isReady:', isReady, 'uri:', imageUri);

    return new Promise(async (resolve) => {
      try {
        // 파일을 base64로 변환
        console.log('[QRAnalyzer] Reading image file...');
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log('[QRAnalyzer] Image converted to base64, length:', base64.length);

        const base64Image = `data:image/jpeg;base64,${base64}`;

        // 콜백 등록
        const id = callbackId.current++;
        pendingCallbacks.current[id] = (result) => {
          console.log('[QRAnalyzer] Callback executed for id:', id);
          delete pendingCallbacks.current[id];
          resolve(result);
        };

        // 타임아웃 설정 (10초)
        setTimeout(() => {
          if (pendingCallbacks.current[id]) {
            console.log('[QRAnalyzer] Analysis timeout for id:', id);
            delete pendingCallbacks.current[id];
            resolve({ success: false, error: 'Analysis timeout' });
          }
        }, 10000);

        // WebView에서 분석 실행
        if (webViewRef.current) {
          console.log('[QRAnalyzer] Injecting JavaScript...');
          webViewRef.current.injectJavaScript(`
            analyzeQR("${base64Image}");
            true;
          `);
        } else {
          console.log('[QRAnalyzer] WebView not ready');
          resolve({ success: false, error: 'WebView not ready' });
        }
      } catch (err) {
        console.error('[QRAnalyzer] Error:', err);
        resolve({ success: false, error: err.message });
      }
    });
  }, [isReady]);

  const QRAnalyzerView = useCallback(() => (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        source={{ html: qrAnalyzerHtml }}
        onMessage={handleMessage}
        onError={(e) => console.error('[QRAnalyzer] WebView error:', e.nativeEvent)}
        onHttpError={(e) => console.error('[QRAnalyzer] HTTP error:', e.nativeEvent)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
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
