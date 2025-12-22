// components/StyledQRCode.js - WebView 기반 스타일 QR 코드 컴포넌트
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

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
}) {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    dotType = 'square',
    dotColor = '#000000',
    dotGradient = null, // { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#000' }] }
    cornerSquareType = 'square',
    cornerSquareColor = '#000000',
    cornerDotType = 'square',
    cornerDotColor = '#000000',
    backgroundColor = '#ffffff',
    backgroundGradient = null,
    logo = null, // base64 이미지
    logoSize = 0.3, // QR 코드 대비 비율 (0.1 ~ 0.5)
    logoMargin = 5,
    logoPadding = 5,
    logoBackgroundColor = '#ffffff',
    errorCorrectionLevel = 'M', // L, M, Q, H
  } = qrStyle;

  const generateHTML = () => {
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

    const cornerSquareOptions = `{
      type: "${cornerSquareType}",
      color: "${cornerSquareColor}"
    }`;

    const cornerDotOptions = `{
      type: "${cornerDotType}",
      color: "${cornerDotColor}"
    }`;

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

    const imageOptions = logo
      ? `{
          src: "${logo}",
          width: ${size * logoSize},
          height: ${size * logoSize},
          margin: ${logoMargin},
          imageOptions: {
            crossOrigin: "anonymous",
            margin: ${logoPadding}
          }
        }`
      : 'undefined';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/qr-code-styling@1.6.0/lib/qr-code-styling.js"></script>
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
            width: ${size}px;
            height: ${size}px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          #qr-container canvas {
            border-radius: 12px;
          }
        </style>
      </head>
      <body>
        <div id="qr-container"></div>
        <script>
          try {
            const qrCode = new QRCodeStyling({
              width: ${size},
              height: ${size},
              type: "canvas",
              data: ${JSON.stringify(value)},
              dotsOptions: ${dotOptions},
              cornersSquareOptions: ${cornerSquareOptions},
              cornersDotOptions: ${cornerDotOptions},
              backgroundOptions: ${backgroundOptions},
              ${logo ? `image: "${logo}",` : ''}
              imageOptions: ${logo ? `{
                crossOrigin: "anonymous",
                margin: ${logoPadding},
                imageSize: ${logoSize}
              }` : 'undefined'},
              qrOptions: {
                errorCorrectionLevel: "${errorCorrectionLevel}"
              }
            });

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
      } else if (data.type === 'capture' && onCapture) {
        onCapture(data.data);
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
  }, [value, JSON.stringify(qrStyle)]);

  if (!value) {
    return null;
  }

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateHTML() }}
        style={[styles.webView, { width: size, height: size }]}
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
      {isLoading && (
        <View style={[styles.loadingContainer, { width: size, height: size }]}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
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
    borderRadius: 12,
  },
});
