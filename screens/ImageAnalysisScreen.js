// screens/ImageAnalysisScreen.js - 이미지에서 바코드/QR코드 분석 화면
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

  // zxing-wasm 분석 수행
  const analyzeImage = useCallback(async () => {
    if (!imageUri) {
      setError(t('imageAnalysis.noImage'));
      setIsLoading(false);
      return;
    }

    try {
      setLoadingMessage(t('imageAnalysis.loadingWasm'));

      // 동적 import로 zxing-wasm 로드
      const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');

      setLoadingMessage(t('imageAnalysis.loadingImage'));

      // 이미지를 Blob으로 변환
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // 이미지 크기 가져오기
      await new Promise((resolve) => {
        Image.getSize(
          imageUri,
          (width, height) => {
            setImageSize({ width, height });

            // 화면에 맞게 크기 계산
            const maxWidth = screenWidth - 32;
            const maxHeight = screenHeight * 0.5;
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            setDisplaySize({
              width: width * ratio,
              height: height * ratio,
            });
            resolve();
          },
          (err) => {
            console.error('Image size error:', err);
            setDisplaySize({ width: maxWidth, height: 300 });
            resolve();
          }
        );
      });

      setLoadingMessage(t('imageAnalysis.analyzing'));

      // 바코드 읽기 옵션 - 모든 형식 지원
      const readerOptions = {
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
          'MicroQRCode',
          'DataBar',
          'DataBarExpanded',
        ],
      };

      const readResults = await readBarcodes(blob, readerOptions);

      if (readResults && readResults.length > 0) {
        // 결과 처리
        const processedResults = readResults.map((result, index) => ({
          id: index,
          text: result.text,
          format: result.format,
          position: result.position,
          // position에서 bounds 계산
          bounds: result.position ? {
            topLeft: result.position.topLeft,
            topRight: result.position.topRight,
            bottomRight: result.position.bottomRight,
            bottomLeft: result.position.bottomLeft,
          } : null,
        }));
        setResults(processedResults);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Barcode analysis error:', err);
      setError(t('imageAnalysis.analysisError'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [imageUri, t]);

  useEffect(() => {
    analyzeImage();
  }, [analyzeImage]);

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

    // 모든 점의 x, y 최소/최대값 계산
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

  // 바코드 색상 (인덱스 기반)
  const getBarcodeColor = (index) => {
    const colorList = [
      '#FF6B6B', // 빨간색
      '#4ECDC4', // 청록색
      '#FFE66D', // 노란색
      '#95E1D3', // 민트색
      '#F38181', // 연빨간색
      '#AA96DA', // 보라색
      '#FCBAD3', // 분홍색
      '#A8D8EA', // 하늘색
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
          <View style={[styles.imageContainer, { width: displaySize.width, height: displaySize.height }]}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, { width: displaySize.width, height: displaySize.height }]}
                resizeMode="contain"
              />
            )}

            {/* 바코드 박스 오버레이 */}
            {!isLoading && results.map((result, index) => {
              const displayCoords = convertToDisplayCoords(result.bounds);
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
          </View>

          {/* 로딩 오버레이 */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>{loadingMessage || t('imageAnalysis.analyzing')}</Text>
            </View>
          )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
