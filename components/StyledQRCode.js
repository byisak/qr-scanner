// components/StyledQRCode.js - WebView 기반 스타일 QR 코드 컴포넌트
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { QR_CODE_STYLING_LIB } from '../lib/qrCodeStylingLib';

const DOT_TYPES = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
const CORNER_SQUARE_TYPES = ['square', 'dot', 'extra-rounded'];
const CORNER_DOT_TYPES = ['square', 'dot'];

export { DOT_TYPES, CORNER_SQUARE_TYPES, CORNER_DOT_TYPES };

export default function StyledQRCode({
  value,
  size = 240,
  style = {},
  onCapture,
  qrStyle = {},
  // 저장용: 캔버스를 이 배율로 크게 그린다 (화면 밀도만큼 키워야 캡처가 흐리지 않다)
  renderScale = 1,
  // 저장용: 다 그려지면 결과 이미지를 WebView 위에 Image로 덮는다.
  // 실기기 Android는 WebView를 하드웨어 레이어에 그려서 react-native-view-shot 캡처에 잡히지 않는다
  snapshotAsImage = false,
}) {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [snapshotUri, setSnapshotUri] = useState(null);

  const {
    dotType = 'square',
    dotColor = '#000000',
    dotGradient = null,
    cornerSquareType = 'square',
    cornerSquareColor = '#000000',
    cornerSquareGradient = null,
    cornerDotType = 'square',
    cornerDotColor = '#000000',
    cornerDotGradient = null,
    backgroundColor = '#ffffff',
    backgroundGradient = null,
    margin = 0,
    logo = null,
    logoSize = 0.3,
    logoMargin = 5,
    logoPadding = 5,
    logoBackgroundColor = '#ffffff',
    errorCorrectionLevel = 'M',
    imageOptions = {},
    width: qrWidth,
    height: qrHeight,
  } = qrStyle;

  // qrStyle에서 width/height가 있으면 사용, 없으면 size prop 사용
  const actualWidth = qrWidth || size;
  const actualHeight = qrHeight || size;
  const canvasWidth = Math.round(actualWidth * renderScale);
  const canvasHeight = Math.round(actualHeight * renderScale);

  // 이미지 옵션 기본값
  const imgOpts = {
    hideBackgroundDots: imageOptions.hideBackgroundDots ?? true,
    imageSize: imageOptions.imageSize ?? 0.4,
    margin: imageOptions.margin ?? 5,
  };

  const generateHTML = () => {
    // Dots Options
    const dotOptions = dotGradient
      ? `{
          type: "${dotType}",
          gradient: {
            type: "${dotGradient.type || 'linear'}",
            rotation: ${dotGradient.rotation || 0},
            colorStops: ${JSON.stringify(dotGradient.colorStops)}
          }
        }`
      : `{
          type: "${dotType}",
          color: "${dotColor}"
        }`;

    // Corners Square Options
    const cornerSquareOptions = cornerSquareGradient
      ? `{
          type: "${cornerSquareType}",
          gradient: {
            type: "${cornerSquareGradient.type || 'linear'}",
            rotation: ${cornerSquareGradient.rotation || 0},
            colorStops: ${JSON.stringify(cornerSquareGradient.colorStops)}
          }
        }`
      : `{
          type: "${cornerSquareType}",
          color: "${cornerSquareColor}"
        }`;

    // Corners Dot Options
    const cornerDotOptions = cornerDotGradient
      ? `{
          type: "${cornerDotType}",
          gradient: {
            type: "${cornerDotGradient.type || 'linear'}",
            rotation: ${cornerDotGradient.rotation || 0},
            colorStops: ${JSON.stringify(cornerDotGradient.colorStops)}
          }
        }`
      : `{
          type: "${cornerDotType}",
          color: "${cornerDotColor}"
        }`;

    // Background Options
    const backgroundOptions = backgroundGradient
      ? `{
          gradient: {
            type: "${backgroundGradient.type || 'linear'}",
            rotation: ${backgroundGradient.rotation || 0},
            colorStops: ${JSON.stringify(backgroundGradient.colorStops)}
          }
        }`
      : `{
          color: "${backgroundColor}"
        }`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script>${QR_CODE_STYLING_LIB}</script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: transparent;
            overflow: hidden;
          }
          #qr-container {
            width: ${actualWidth}px;
            height: ${actualHeight}px;
          }
          #qr-container canvas {
            display: block;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div id="qr-container"></div>
        <script>
          // UTF-8 인코딩 함수: 문자열을 UTF-8 바이트로 변환 후 Latin-1 문자열로 반환
          // QR 코드 스캐너가 UTF-8로 디코딩하여 한글이 제대로 표시됨
          function toUTF8ByteString(str) {
            const utf8 = new TextEncoder().encode(str);
            let result = '';
            for (let i = 0; i < utf8.length; i++) {
              result += String.fromCharCode(utf8[i]);
            }
            return result;
          }

          try {
            const rawData = ${JSON.stringify(value)};
            const encodedData = toUTF8ByteString(rawData);

            const options = {
              width: ${canvasWidth},
              height: ${canvasHeight},
              type: "canvas",
              data: encodedData,
              margin: ${Math.round(margin * renderScale)},
              dotsOptions: ${dotOptions},
              cornersSquareOptions: ${cornerSquareOptions},
              cornersDotOptions: ${cornerDotOptions},
              backgroundOptions: ${backgroundOptions},
              qrOptions: {
                errorCorrectionLevel: "${errorCorrectionLevel}",
                mode: "Byte"
              }
            };

            ${logo ? `
            options.image = "${logo}";
            options.imageOptions = {
              crossOrigin: "anonymous",
              hideBackgroundDots: ${imgOpts.hideBackgroundDots},
              imageSize: ${imgOpts.imageSize},
              margin: ${Math.round(imgOpts.margin * renderScale)}
            };
            ` : ''}

            const qrCode = new QRCodeStyling(options);

            qrCode.append(document.getElementById("qr-container"));

            // 렌더링 완료 알림
            setTimeout(() => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));

              // base64 이미지 캡처
              qrCode.getRawData("png").then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'capture',
                    data: reader.result
                  }));
                };
                reader.readAsDataURL(blob);
              });
            }, 500);
          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: error.message
            }));
          }
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        setIsLoading(false);
      } else if (data.type === 'capture') {
        if (snapshotAsImage) setSnapshotUri(data.data);
        if (onCapture) onCapture(data.data);
      } else if (data.type === 'error') {
        console.error('QR Code generation error:', data.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setSnapshotUri(null);
  }, [value, JSON.stringify(qrStyle), renderScale]);

  if (!value) {
    return null;
  }

  return (
    <View style={[styles.container, { width: actualWidth, height: actualHeight }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateHTML() }}
        style={[styles.webView, { width: actualWidth, height: actualHeight }]}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        androidLayerType="hardware"
      />
      {snapshotAsImage && snapshotUri && (
        <Image
          source={{ uri: snapshotUri }}
          style={{ position: 'absolute', top: 0, left: 0, width: actualWidth, height: actualHeight }}
          fadeDuration={0}
        />
      )}
      {isLoading && !snapshotAsImage && (
        <View style={[styles.loadingContainer, { width: actualWidth, height: actualHeight }]}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
