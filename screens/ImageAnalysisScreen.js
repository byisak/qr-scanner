// screens/ImageAnalysisScreen.js - 이미지에서 바코드/QR코드 분석 화면 (WebView 기반)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 분석 타임아웃 (15초)
const ANALYSIS_TIMEOUT = 15000;

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

      // 지원 포맷
      var formats = [
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
      ];

      // 1단계: 기본 분석 (tryHarder 활성화로 인식률 유지)
      var fastOptions = {
        tryHarder: true,
        tryRotate: false,
        tryInvert: false,
        tryDownscale: false,
        maxNumberOfSymbols: 20,
        formats: formats,
      };

      sendLog('Phase 1: Standard analysis...');
      var barcodes = await ZXingWASM.readBarcodes(blob, fastOptions);

      // 결과가 없으면 2단계: 회전/반전 시도
      if (barcodes.length === 0) {
        sendLog('Phase 2: Trying rotation and inversion...');
        var deepOptions = {
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
          tryDownscale: false,
          maxNumberOfSymbols: 20,
          formats: formats,
        };
        barcodes = await ZXingWASM.readBarcodes(blob, deepOptions);
      }

      sendLog('Analysis complete, found ' + barcodes.length + ' codes');

      // 결과 처리 - 전체 원본 데이터 저장
      var processedResults = barcodes.map(function(barcode, index) {
        // 전체 barcode 객체를 복사하고 id 추가
        var result = Object.assign({}, barcode, { id: index });
        return result;
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
  const { imageUri, detectedBarcodes: detectedBarcodesParam } = params;
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');

  // 스캐너에서 감지된 바코드 파싱
  const scannerDetectedBarcodes = useMemo(() => {
    if (!detectedBarcodesParam) return [];
    try {
      return JSON.parse(detectedBarcodesParam);
    } catch (e) {
      console.error('Failed to parse detected barcodes:', e);
      return [];
    }
  }, [detectedBarcodesParam]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [base64Image, setBase64Image] = useState(null);
  const [normalizedImageUri, setNormalizedImageUri] = useState(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [zxingScript, setZxingScript] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);

  const webViewRef = useRef(null);
  const timeoutRef = useRef(null);
  const analysisStartedRef = useRef(false);

  // zxing-wasm 라이브러리 로드 (오프라인 지원)
  useEffect(() => {
    const loadZxingScript = async () => {
      try {
        const asset = Asset.fromModule(zxingWasmAsset);

        // 이미 로컬에 있으면 downloadAsync 건너뛰기 (오프라인 지원)
        if (!asset.localUri) {
          try {
            await asset.downloadAsync();
          } catch (downloadErr) {
            console.log('Asset download failed (offline?), trying local:', downloadErr.message);
          }
        }

        // localUri가 있으면 사용, 없으면 uri 사용 (번들된 에셋)
        const assetUri = asset.localUri || asset.uri;
        if (!assetUri) {
          throw new Error('Asset URI not available');
        }

        const scriptContent = await FileSystem.readAsStringAsync(assetUri);
        setZxingScript(scriptContent);
        console.log('ZXing WASM script loaded, size:', scriptContent.length);
      } catch (err) {
        console.error('Failed to load ZXing script:', err);
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

  // 이미지를 Base64로 변환 (EXIF 회전 정규화 포함)
  useEffect(() => {
    const loadImage = async () => {
      if (!imageUri) {
        setError(t('imageAnalysis.noImage'));
        setIsLoading(false);
        return;
      }

      try {
        setLoadingMessage(t('imageAnalysis.loadingImage'));

        // 파일 존재 여부 확인
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (!fileInfo.exists) {
          setError(t('imageAnalysis.fileNotFound') || '이미지 파일을 찾을 수 없습니다.\n캐시가 삭제되었을 수 있습니다.');
          setIsLoading(false);
          return;
        }

        // 원본 이미지 크기 로그 (디버깅용)
        console.log('[ImageAnalysis] Original image:', imageUri, 'size:', fileInfo.size ? `${(fileInfo.size / 1024).toFixed(1)}KB` : 'unknown');

        // EXIF 회전 정규화 (원본 크기 유지)
        console.log('Normalizing image orientation...');
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          imageUri,
          [], // EXIF rotation만 적용
          { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
        );

        const normalizedUri = manipulatedImage.uri;
        setNormalizedImageUri(normalizedUri);

        // 처리된 이미지 정보 로그
        const processedInfo = await FileSystem.getInfoAsync(normalizedUri);
        console.log('[ImageAnalysis] Processed image:', manipulatedImage.width, 'x', manipulatedImage.height,
          'size:', processedInfo.size ? `${(processedInfo.size / 1024).toFixed(1)}KB` : 'unknown');

        // 정규화된 이미지 크기 사용
        const width = manipulatedImage.width;
        const height = manipulatedImage.height;
        setImageSize({ width, height });

        const maxWidth = screenWidth - 32;
        const maxHeight = screenHeight * 0.35;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        setDisplaySize({
          width: width * ratio,
          height: height * ratio,
        });

        // 정규화된 이미지를 Base64로 변환
        const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
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

  // 개별 바코드 이미지 저장
  const handleSaveBarcode = async (result, index) => {
    if (!normalizedImageUri || !result.position) {
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
      return;
    }

    try {
      // 미디어 라이브러리 권한 요청
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('imageAnalysis.permissionDenied'));
        return;
      }

      const pos = result.position;
      const padding = 50; // 여백 (바코드 잘림 방지)

      // 바운딩 박스 계산
      const minX = Math.min(pos.topLeft.x, pos.bottomLeft.x);
      const maxX = Math.max(pos.topRight.x, pos.bottomRight.x);
      const minY = Math.min(pos.topLeft.y, pos.topRight.y);
      const maxY = Math.max(pos.bottomLeft.y, pos.bottomRight.y);

      // 패딩 적용 (이미지 범위 내로 제한)
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropWidth = Math.min(imageSize.width - cropX, maxX - minX + padding * 2);
      const cropHeight = Math.min(imageSize.height - cropY, maxY - minY + padding * 2);

      // 이미지 크롭
      const croppedImage = await ImageManipulator.manipulateAsync(
        normalizedImageUri,
        [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
      );

      // 앨범에 저장
      await MediaLibrary.saveToLibraryAsync(croppedImage.uri);

      // 임시 파일 삭제
      await FileSystem.deleteAsync(croppedImage.uri, { idempotent: true });

      setSavedCount(prev => prev + 1);

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert(
        t('imageAnalysis.saveSuccess'),
        t('imageAnalysis.saveSuccessMessage', { number: index + 1 })
      );
    } catch (err) {
      console.error('Save barcode error:', err);
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
    }
  };

  // 모든 바코드 이미지 저장
  const handleSaveAllBarcodes = async () => {
    if (results.length === 0 || !normalizedImageUri) {
      return;
    }

    try {
      // 미디어 라이브러리 권한 요청
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('imageAnalysis.permissionDenied'));
        return;
      }

      setIsSaving(true);
      let successCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result.position) continue;

        try {
          const pos = result.position;
          const padding = 50;

          const minX = Math.min(pos.topLeft.x, pos.bottomLeft.x);
          const maxX = Math.max(pos.topRight.x, pos.bottomRight.x);
          const minY = Math.min(pos.topLeft.y, pos.topRight.y);
          const maxY = Math.max(pos.bottomLeft.y, pos.bottomRight.y);

          const cropX = Math.max(0, minX - padding);
          const cropY = Math.max(0, minY - padding);
          const cropWidth = Math.min(imageSize.width - cropX, maxX - minX + padding * 2);
          const cropHeight = Math.min(imageSize.height - cropY, maxY - minY + padding * 2);

          const croppedImage = await ImageManipulator.manipulateAsync(
            normalizedImageUri,
            [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
            { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
          );

          await MediaLibrary.saveToLibraryAsync(croppedImage.uri);
          await FileSystem.deleteAsync(croppedImage.uri, { idempotent: true });

          successCount++;
        } catch (err) {
          console.error(`Save barcode ${i + 1} error:`, err);
        }
      }

      setIsSaving(false);
      setSavedCount(prev => prev + successCount);

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert(
        t('imageAnalysis.saveAllSuccess'),
        t('imageAnalysis.saveAllSuccessMessage', { count: successCount })
      );
    } catch (err) {
      console.error('Save all barcodes error:', err);
      setIsSaving(false);
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
    }
  };

  // 개별 바코드를 기록에 저장
  const handleSaveToHistory = async (result, index) => {
    try {
      // 그룹별 히스토리 가져오기
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };

      // 기본 그룹에 저장
      if (!historyByGroup.default) {
        historyByGroup.default = [];
      }

      // 바코드 타입 정규화
      const normalizedType = result.format.toLowerCase().replace(/[^a-z0-9]/g, '');

      const historyItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        code: result.text,
        timestamp: Date.now(),
        url: null,
        photoUri: null,
        type: normalizedType,
        ecLevel: null,
        count: 1,
      };

      historyByGroup.default.unshift(historyItem);

      // 최대 1000개까지만 저장
      if (historyByGroup.default.length > 1000) {
        historyByGroup.default = historyByGroup.default.slice(0, 1000);
      }

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert(
        t('imageAnalysis.historySaveSuccess'),
        t('imageAnalysis.historySaveSuccessMessage', { number: index + 1 })
      );
    } catch (err) {
      console.error('Save to history error:', err);
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
    }
  };

  // 모든 바코드를 기록에 저장
  const handleSaveAllToHistory = async () => {
    if (results.length === 0) return;

    try {
      setIsSavingHistory(true);

      // 그룹별 히스토리 가져오기
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };

      if (!historyByGroup.default) {
        historyByGroup.default = [];
      }

      let successCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // 바코드 타입 정규화
        const normalizedType = result.format.toLowerCase().replace(/[^a-z0-9]/g, '');

        const historyItem = {
          id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          code: result.text,
          timestamp: Date.now() + i, // 순서 유지를 위해 약간의 시간 차이
          url: null,
          photoUri: null,
          type: normalizedType,
          ecLevel: null,
          count: 1,
        };

        historyByGroup.default.unshift(historyItem);
        successCount++;
      }

      // 최대 1000개까지만 저장
      if (historyByGroup.default.length > 1000) {
        historyByGroup.default = historyByGroup.default.slice(0, 1000);
      }

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      setIsSavingHistory(false);

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert(
        t('imageAnalysis.historyAllSaveSuccess'),
        t('imageAnalysis.historyAllSaveSuccessMessage', { count: successCount })
      );
    } catch (err) {
      console.error('Save all to history error:', err);
      setIsSavingHistory(false);
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
    }
  };

  // 전체 JSON 다운로드 - ZXing WASM 원본 데이터 전체
  const handleDownloadAllJson = async () => {
    if (results.length === 0) return;

    try {
      const jsonData = {
        analysisDate: new Date().toISOString(),
        totalCount: results.length,
        results: results.map((result, index) => {
          // 전체 원본 데이터 복사 (id 제외하고 index 추가)
          const { id, ...rawData } = result;
          return {
            index: index + 1,
            ...rawData,
          };
        }),
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const fileName = `barcode_analysis_${Date.now()}.json`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 공유 가능 여부 확인
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: t('imageAnalysis.downloadJson'),
        });
      } else {
        // 공유 불가능 시 클립보드에 복사
        await Clipboard.setStringAsync(jsonString);
        Alert.alert(t('imageAnalysis.jsonCopied'), t('imageAnalysis.jsonCopiedMessage'));
      }

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      console.error('Download all JSON error:', err);
      Alert.alert(t('common.error'), t('imageAnalysis.jsonError'));
    }
  };

  // 개별 JSON 다운로드 - ZXing WASM 원본 데이터 전체
  const handleDownloadSingleJson = async (result, index) => {
    try {
      // 전체 원본 데이터 복사 (id 제외하고 index와 analysisDate 추가)
      const { id, ...rawData } = result;
      const jsonData = {
        index: index + 1,
        analysisDate: new Date().toISOString(),
        ...rawData,
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const fileName = `barcode_${index + 1}_${Date.now()}.json`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: t('imageAnalysis.downloadJson'),
        });
      } else {
        await Clipboard.setStringAsync(jsonString);
        Alert.alert(t('imageAnalysis.jsonCopied'), t('imageAnalysis.jsonCopiedMessage'));
      }

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      console.error('Download single JSON error:', err);
      Alert.alert(t('common.error'), t('imageAnalysis.jsonError'));
    }
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 이미지 영역 */}
        <View style={styles.imageSection}>
          <View style={[styles.imageContainer, { width: displaySize.width || screenWidth - 32, height: displaySize.height || 300 }]}>
            {(normalizedImageUri || imageUri) && (
              <Image
                source={{ uri: normalizedImageUri || imageUri }}
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

        {/* 스캐너에서 감지된 바코드 섹션 (상단에 먼저 표시) */}
        {scannerDetectedBarcodes.length > 0 && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsSectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('imageAnalysis.scannerDetected') || '스캐너 감지'} ({scannerDetectedBarcodes.length})
              </Text>
            </View>

            <Text style={[styles.scannerDetectedInfo, { color: colors.textSecondary }]}>
              {t('imageAnalysis.scannerDetectedDesc') || '실시간 스캐너에서 감지된 코드입니다'}
            </Text>

            {scannerDetectedBarcodes.map((barcode, index) => {
              const color = getBarcodeColor(index);
              return (
                <View
                  key={`scanner-${index}`}
                  style={[styles.resultCard, { backgroundColor: colors.surface, borderLeftColor: color }]}
                >
                  <View style={styles.resultHeader}>
                    <View style={[styles.resultIndex, { backgroundColor: color }]}>
                      <Ionicons name="scan" size={12} color="#fff" />
                    </View>
                    <Text style={[styles.resultFormat, { color: colors.textSecondary }]}>
                      {formatName(barcode.type)}
                    </Text>
                  </View>

                  <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={3}>
                    {barcode.value}
                  </Text>

                  <View style={styles.resultActions}>
                    {/* 복사 */}
                    <TouchableOpacity
                      style={[styles.resultIconButton, { backgroundColor: colors.border }]}
                      onPress={() => handleCopyResult(barcode.value)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="copy-outline" size={20} color={colors.text} />
                    </TouchableOpacity>

                    {/* 열기 */}
                    <TouchableOpacity
                      style={[styles.resultIconButton, styles.primaryButton]}
                      onPress={() => handleOpenResult({ text: barcode.value, format: barcode.type })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="open-outline" size={20} color="#fff" />
                    </TouchableOpacity>

                    {/* 기록 저장 */}
                    <TouchableOpacity
                      style={[styles.resultIconButton, styles.historyButton]}
                      onPress={() => handleSaveToHistory({ text: barcode.value, format: barcode.type }, index)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="bookmark-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 이미지 분석 결과 섹션 */}
        <View style={styles.resultsSection}>
          <View style={styles.resultsSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('imageAnalysis.results')} ({results.length})
            </Text>
            {results.length > 0 && (
              <View style={styles.headerButtons}>
                {/* JSON 다운로드 버튼 */}
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: '#2E7D32' }]}
                  onPress={handleDownloadAllJson}
                  activeOpacity={0.7}
                >
                  <Ionicons name="code-download-outline" size={20} color="#fff" />
                </TouchableOpacity>

                {/* 이미지 모두 저장 버튼 */}
                {results.some(r => r.position) && (
                  <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: colors.primary }]}
                    onPress={handleSaveAllBarcodes}
                    activeOpacity={0.7}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="images-outline" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}

                {/* 기록 모두 저장 버튼 */}
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: '#E67E22' }]}
                  onPress={handleSaveAllToHistory}
                  activeOpacity={0.7}
                  disabled={isSavingHistory}
                >
                  {isSavingHistory ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="bookmarks-outline" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

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
            const color = getBarcodeColor(index + scannerDetectedBarcodes.length);
            return (
              <View
                key={result.id}
                style={[styles.resultCard, { backgroundColor: colors.surface, borderLeftColor: color }]}
              >
                <View style={styles.resultHeader}>
                  <View style={[styles.resultIndex, { backgroundColor: color }]}>
                    <Text style={styles.resultIndexText}>{index + scannerDetectedBarcodes.length + 1}</Text>
                  </View>
                  <Text style={[styles.resultFormat, { color: colors.textSecondary }]}>
                    {formatName(result.format)}
                  </Text>
                </View>

                <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={3}>
                  {result.text}
                </Text>

                <View style={styles.resultActions}>
                  {/* 복사 */}
                  <TouchableOpacity
                    style={[styles.resultIconButton, { backgroundColor: colors.border }]}
                    onPress={() => handleCopyResult(result.text)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={20} color={colors.text} />
                  </TouchableOpacity>

                  {/* 이미지 저장 */}
                  {result.position && (
                    <TouchableOpacity
                      style={[styles.resultIconButton, { backgroundColor: colors.border }]}
                      onPress={() => handleSaveBarcode(result, index)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="image-outline" size={20} color={colors.text} />
                    </TouchableOpacity>
                  )}

                  {/* 열기 */}
                  <TouchableOpacity
                    style={[styles.resultIconButton, styles.primaryButton]}
                    onPress={() => handleOpenResult(result)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="open-outline" size={20} color="#fff" />
                  </TouchableOpacity>

                  {/* 기록 저장 */}
                  <TouchableOpacity
                    style={[styles.resultIconButton, styles.historyButton]}
                    onPress={() => handleSaveToHistory(result, index)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="bookmark-outline" size={20} color="#fff" />
                  </TouchableOpacity>

                  {/* JSON */}
                  <TouchableOpacity
                    style={[styles.resultIconButton, styles.jsonButton]}
                    onPress={() => handleDownloadSingleJson(result, index)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="code-slash-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 숨겨진 WebView - 바코드 분석용 (레이아웃 외부) */}
      {base64Image && zxingScript && (
        <View style={styles.hiddenWebViewContainer} pointerEvents="none">
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  fullScreen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  hiddenWebViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
    zIndex: -1,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 28, // 라벨 높이 + 여백 (잘림 방지)
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'visible', // 라벨이 이미지 밖으로 나올 수 있도록
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
  },
  resultsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scannerDetectedInfo: {
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveAllButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  resultIconButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  jsonButton: {
    backgroundColor: '#2E7D32',
  },
  historyButton: {
    backgroundColor: '#E67E22',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ImageAnalysisScreen;
