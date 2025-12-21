// screens/ImageAnalysisScreen.js - 이미지에서 바코드/QR코드 분석 화면 (WebView 기반)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// 분석 타임아웃 (30초)
const ANALYSIS_TIMEOUT = 30000;

// zxing-wasm 라이브러리 로컬 파일 (텍스트 파일로 번들링)
const zxingWasmAsset = require('../assets/js/zxing-wasm.txt');

// ZXing WASM IIFE 빌드 사용 (QR 코드 + 다양한 바코드 지원)
const getWebViewHTML = (zxingScript) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${zxingScript || ''}</script>
</head>
<body style="background: #000;">
<script>
  // 로그 전송
  function sendLog(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message }));
  }

  // 에러 전송
  function sendError(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message }));
  }

  // 상태 전송
  function sendStatus(status) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'status', message: status }));
  }

  // 결과 전송
  function sendResults(results) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'results', data: results }));
  }

  // 글로벌 에러 핸들러
  window.onerror = function(message, source, lineno, colno, error) {
    sendError('Global error: ' + message);
    return true;
  };

  // Promise rejection 핸들러
  window.onunhandledrejection = function(event) {
    sendError('Unhandled rejection: ' + (event.reason ? event.reason.toString() : 'Unknown'));
  };

  // React Native에서 메시지 수신
  document.addEventListener('message', function(event) {
    try {
      var data = JSON.parse(event.data);
      if (data.type === 'analyze' && data.base64) {
        analyzeImage(data.base64);
      }
    } catch (e) {
      // ignore parse errors from other messages
    }
  });

  // window.addEventListener도 추가 (Android 호환성)
  window.addEventListener('message', function(event) {
    try {
      var data = JSON.parse(event.data);
      if (data.type === 'analyze' && data.base64) {
        analyzeImage(data.base64);
      }
    } catch (e) {
      // ignore
    }
  });

  // 이미지 분석 함수
  async function analyzeImage(base64Data) {
    sendStatus('loading');
    sendLog('Starting analysis with zxing-wasm...');

    try {
      // zxing-wasm IIFE 글로벌 객체 확인
      if (typeof ZXingWASM === 'undefined') {
        sendError('ZXing WASM library not loaded');
        return;
      }

      sendLog('ZXing WASM loaded, converting image...');
      sendStatus('analyzing');

      // Base64를 Blob으로 변환
      var byteCharacters = atob(base64Data);
      var byteNumbers = new Uint8Array(byteCharacters.length);
      for (var i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      var blob = new Blob([byteNumbers], { type: 'image/jpeg' });

      sendLog('Image blob created, analyzing...');

      // 바코드 읽기 옵션
      var readerOptions = {
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
        tryDownscale: true,
        maxNumberOfSymbols: 20,
        formats: [
          'QRCode',
          'EAN-13',
          'EAN-8',
          'Code128',
          'Code39',
          'Code93',
          'UPC-A',
          'UPC-E',
          'ITF',
          'Codabar',
          'DataMatrix',
          'Aztec',
          'PDF417',
        ],
      };

      // zxing-wasm readBarcodes 호출
      var barcodes = await ZXingWASM.readBarcodes(blob, readerOptions);

      sendLog('Analysis complete, found ' + barcodes.length + ' codes');

      // 결과 처리
      var processedResults = barcodes.map(function(barcode, index) {
        return {
          id: index,
          text: barcode.text,
          format: barcode.format,
          position: barcode.position ? {
            topLeft: barcode.position.topLeft,
            topRight: barcode.position.topRight,
            bottomRight: barcode.position.bottomRight,
            bottomLeft: barcode.position.bottomLeft,
          } : null,
        };
      });

      sendResults(processedResults);
    } catch (error) {
      sendLog('Analysis error: ' + error.message);
      sendError(error.message || 'Unknown error');
    }
  }

  // WebView 준비 완료 알림
  sendLog('WebView initialized with zxing-wasm IIFE');
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body>
</html>
`;

function ImageAnalysisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { imageUri } = params;
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [base64Image, setBase64Image] = useState(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [zxingScript, setZxingScript] = useState(null);

  const webViewRef = useRef(null);
  const timeoutRef = useRef(null);
  const analysisStartedRef = useRef(false);

  // zxing-wasm 라이브러리 로드
  useEffect(() => {
    const loadZxingScript = async () => {
      try {
        const asset = Asset.fromModule(zxingWasmAsset);
        await asset.downloadAsync();
        const scriptContent = await FileSystem.readAsStringAsync(asset.localUri);
        setZxingScript(scriptContent);
        console.log('ZXing WASM script loaded, size:', scriptContent.length);
      } catch (err) {
        console.error('Failed to load ZXing script:', err);
        // CDN 폴백
        setZxingScript(null);
      }
    };
    loadZxingScript();
  }, []);

  // 타임아웃 설정
  const startTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setError(t('imageAnalysis.analysisError') + ' (Timeout)');
        setIsLoading(false);
      }
    }, ANALYSIS_TIMEOUT);
  }, [isLoading, t]);

  // 타임아웃 해제
  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 컴포넌트 언마운트 시 타임아웃 해제
  useEffect(() => {
    return () => {
      clearTimeoutRef();
    };
  }, [clearTimeoutRef]);

  // 이미지를 Base64로 변환
  useEffect(() => {
    const loadImage = async () => {
      if (!imageUri) {
        setError(t('imageAnalysis.noImage'));
        setIsLoading(false);
        return;
      }

      try {
        setLoadingMessage(t('imageAnalysis.loadingImage'));

        // 이미지 크기 가져오기
        Image.getSize(
          imageUri,
          (width, height) => {
            setImageSize({ width, height });
            const maxWidth = screenWidth - 32;
            const maxHeight = screenHeight * 0.5;
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            setDisplaySize({
              width: width * ratio,
              height: height * ratio,
            });
          },
          (err) => {
            console.error('Image size error:', err);
            setDisplaySize({ width: screenWidth - 32, height: 300 });
          }
        );

        // 이미지를 Base64로 변환
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });

        console.log('Base64 image loaded, length:', base64.length);
        setBase64Image(base64);
        setLoadingMessage(t('imageAnalysis.loadingWasm'));
      } catch (err) {
        console.error('Image load error:', err);
        setError(t('imageAnalysis.analysisError'));
        setIsLoading(false);
      }
    };

    loadImage();
  }, [imageUri, t]);

  // WebView가 준비되면 분석 시작
  useEffect(() => {
    if (webViewReady && base64Image && webViewRef.current && !analysisStartedRef.current) {
      analysisStartedRef.current = true;
      console.log('Sending image to WebView for analysis...');

      // WebView에 base64 이미지 전송
      const message = JSON.stringify({ type: 'analyze', base64: base64Image });
      webViewRef.current.postMessage(message);

      // 타임아웃 시작
      startTimeout();
    }
  }, [webViewReady, base64Image, startTimeout]);

  // WebView 메시지 처리
  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'ready') {
        console.log('WebView is ready');
        setWebViewReady(true);
      } else if (data.type === 'log') {
        console.log('WebView log:', data.message);
      } else if (data.type === 'status') {
        if (data.message === 'loading') {
          setLoadingMessage(t('imageAnalysis.loadingWasm'));
        } else if (data.message === 'analyzing') {
          setLoadingMessage(t('imageAnalysis.analyzing'));
        }
      } else if (data.type === 'results') {
        clearTimeoutRef();
        setResults(data.data || []);
        setIsLoading(false);
        setLoadingMessage('');
      } else if (data.type === 'error') {
        clearTimeoutRef();
        console.error('WebView error:', data.message);
        setError(t('imageAnalysis.analysisError'));
        setIsLoading(false);
        setLoadingMessage('');
      }
    } catch (err) {
      console.error('Message parse error:', err);
    }
  }, [t, clearTimeoutRef]);

  // WebView 에러 처리
  const handleWebViewError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    clearTimeoutRef();
    setError(t('imageAnalysis.analysisError'));
    setIsLoading(false);
  }, [t, clearTimeoutRef]);

  // 결과 항목 복사
  const handleCopyResult = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Alert.alert(t('result.copySuccess'), t('result.copySuccessMessage'));
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  // 결과 화면으로 이동
  const handleOpenResult = (result) => {
    router.push({
      pathname: '/result',
      params: {
        code: result.text,
        type: result.format.toLowerCase(),
        fromImageAnalysis: 'true',
      },
    });
  };

  // bounds를 화면 좌표로 변환
  const convertToDisplayCoords = (position) => {
    if (!position || !imageSize.width || !displaySize.width) return null;

    const scaleX = displaySize.width / imageSize.width;
    const scaleY = displaySize.height / imageSize.height;

    const topLeft = position.topLeft;
    const topRight = position.topRight;
    const bottomLeft = position.bottomLeft;
    const bottomRight = position.bottomRight;

    if (!topLeft || !topRight || !bottomLeft || !bottomRight) return null;

    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);

    return {
      left: minX * scaleX,
      top: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY,
    };
  };

  // 바코드 형식 이름 변환
  const formatName = (format) => {
    const formatMap = {
      'QRCode': 'QR Code',
      'EAN-13': 'EAN-13',
      'EAN-8': 'EAN-8',
      'Code128': 'Code 128',
      'Code39': 'Code 39',
      'Code93': 'Code 93',
      'UPC-A': 'UPC-A',
      'UPC-E': 'UPC-E',
      'ITF': 'ITF',
      'Codabar': 'Codabar',
      'DataMatrix': 'Data Matrix',
      'Aztec': 'Aztec',
      'PDF417': 'PDF417',
      'MicroQRCode': 'Micro QR',
      'DataBar': 'DataBar',
      'DataBarExpanded': 'DataBar Expanded',
    };
    return formatMap[format] || format;
  };

  // 바코드 색상
  const getBarcodeColor = (index) => {
    const colorList = [
      '#FF6B6B',
      '#4ECDC4',
      '#FFE66D',
      '#95E1D3',
      '#F38181',
      '#AA96DA',
      '#FCBAD3',
      '#A8D8EA',
    ];
    return colorList[index % colorList.length];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('imageAnalysis.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 이미지 영역 */}
        <View style={styles.imageSection}>
          <View style={[styles.imageContainer, { width: displaySize.width || screenWidth - 32, height: displaySize.height || 300 }]}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, { width: displaySize.width || screenWidth - 32, height: displaySize.height || 300 }]}
                resizeMode="contain"
              />
            )}

            {/* 바코드 박스 오버레이 */}
            {!isLoading && results.map((result, index) => {
              const displayCoords = convertToDisplayCoords(result.position);
              if (!displayCoords) return null;

              const color = getBarcodeColor(index);
              return (
                <View
                  key={result.id}
                  style={[
                    styles.barcodeBox,
                    {
                      left: displayCoords.left,
                      top: displayCoords.top,
                      width: displayCoords.width,
                      height: displayCoords.height,
                      borderColor: color,
                    },
                  ]}
                >
                  <View style={[styles.barcodeLabel, { backgroundColor: color }]}>
                    <Text style={styles.barcodeLabelText}>{index + 1}</Text>
                  </View>
                </View>
              );
            })}

            {/* 로딩 오버레이 */}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>{loadingMessage || t('imageAnalysis.analyzing')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 결과 섹션 */}
        <View style={styles.resultsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('imageAnalysis.results')} ({results.length})
          </Text>

          {error && (
            <View style={[styles.errorCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="warning-outline" size={24} color="#FF3B30" />
              <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            </View>
          )}

          {!isLoading && !error && results.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="scan-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('imageAnalysis.noResults')}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('imageAnalysis.noResultsDesc')}
              </Text>
            </View>
          )}

          {results.map((result, index) => {
            const color = getBarcodeColor(index);
            return (
              <View
                key={result.id}
                style={[styles.resultCard, { backgroundColor: colors.surface, borderLeftColor: color }]}
              >
                <View style={styles.resultHeader}>
                  <View style={[styles.resultIndex, { backgroundColor: color }]}>
                    <Text style={styles.resultIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.resultFormat, { color: colors.textSecondary }]}>
                    {formatName(result.format)}
                  </Text>
                </View>

                <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={3}>
                  {result.text}
                </Text>

                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.border }]}
                    onPress={() => handleCopyResult(result.text)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.text} />
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>
                      {t('result.copy')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => handleOpenResult(result)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="open-outline" size={18} color="#fff" />
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                      {t('result.open')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 숨겨진 WebView - 바코드 분석용 (맨 아래 배치) */}
      {base64Image && zxingScript && (
        <WebView
          ref={webViewRef}
          style={styles.hiddenWebView}
          originWhitelist={['*']}
          source={{ html: getWebViewHTML(zxingScript) }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          mixedContentMode="always"
          cacheEnabled={true}
          onLoadEnd={() => console.log('WebView loaded')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hiddenWebView: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    zIndex: -1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  image: {
    borderRadius: 12,
  },
  barcodeBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 4,
  },
  barcodeLabel: {
    position: 'absolute',
    top: -24,
    left: -3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  barcodeLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  resultsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  resultIndexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  resultFormat: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ImageAnalysisScreen;
