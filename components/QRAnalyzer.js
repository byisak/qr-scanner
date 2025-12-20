// components/QRAnalyzer.js
// QR 코드 이미지에서 EC 레벨을 분석하는 컴포넌트 (jsQR 로컬 번들 버전)

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

// jsQR을 사용한 QR 분석 HTML (로컬 번들 버전)
const getQRAnalyzerHtml = (jsQRCode) => `
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

  <script>
    // jsQR 라이브러리 인라인
    ${jsQRCode}
  </script>

  <script>
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
      log('Ready! jsQR loaded');
      sendResult({ type: 'ready', jsQRLoaded: typeof jsQR !== 'undefined' });
    }

    async function analyzeQR(base64Image) {
      log('analyzeQR called, image length: ' + (base64Image ? base64Image.length : 0));

      if (typeof jsQR === 'undefined') {
        log('jsQR not loaded!');
        sendResult({ type: 'result', success: false, error: 'jsQR library not loaded' });
        return;
      }

      try {
        log('Loading image to canvas...');
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = function() {
          try {
            log('Image loaded: ' + img.width + 'x' + img.height);
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Decode QR code using jsQR
            const result = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth'
            });

            if (result) {
              log('QR decoded: ' + result.data);
              log('EC Level: ' + result.errorCorrectionLevel);

              sendResult({
                type: 'result',
                success: true,
                data: result.data,
                ecLevel: result.errorCorrectionLevel,
                format: 'QR_CODE',
                version: result.version
              });
            } else {
              log('No QR code found');
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

    // 준비 완료 알림
    log('Starting...');
    if (typeof jsQR !== 'undefined') {
      notifyReady();
    } else {
      log('jsQR not found');
      sendResult({ type: 'ready', jsQRLoaded: false });
    }
  </script>
</body>
</html>
`;

// QR 분석 훅
export function useQRAnalyzer() {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [htmlContent, setHtmlContent] = useState(null);
  const pendingCallbacks = useRef({});
  const callbackId = useRef(0);

  // jsQR 라이브러리 로드
  useEffect(() => {
    async function loadJsQR() {
      try {
        console.log('[QRAnalyzer] Loading jsQR library...');

        // jsQR 라이브러리를 asset에서 로드
        // .txt 확장자를 사용하여 Metro가 모듈이 아닌 asset으로 처리하도록 함
        const asset = Asset.fromModule(require('../assets/libs/jsqr.txt'));
        await asset.downloadAsync();

        const jsQRCode = await FileSystem.readAsStringAsync(asset.localUri);
        console.log('[QRAnalyzer] jsQR library loaded, size:', jsQRCode.length);

        const html = getQRAnalyzerHtml(jsQRCode);
        setHtmlContent(html);
      } catch (err) {
        console.error('[QRAnalyzer] Failed to load jsQR:', err);
        // Fallback: 빈 함수로 대체
        const fallbackHtml = getQRAnalyzerHtml('// jsQR load failed');
        setHtmlContent(fallbackHtml);
      }
    }

    loadJsQR();
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[QRAnalyzer] Message received:', JSON.stringify(data));

      if (data.type === 'ready') {
        console.log('[QRAnalyzer] WebView ready, jsQR loaded:', data.jsQRLoaded);
        setIsReady(data.jsQRLoaded === true);
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

  const QRAnalyzerView = useCallback(() => {
    if (!htmlContent) {
      return <View style={styles.hidden} />;
    }

    return (
      <View style={styles.hidden}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
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
    );
  }, [handleMessage, htmlContent]);

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
