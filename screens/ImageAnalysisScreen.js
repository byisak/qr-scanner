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
  Modal,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { isLotteryQR, parseLotteryQR, LOTTERY_GROUPS } from '../utils/lotteryParser';
import { scheduleLotteryNotification } from '../utils/lotteryNotification';

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

      // 1단계: 기본 분석 (tryHarder, tryRotate, tryDownscale 활성화로 인식률 향상)
      // LocalAverage binarizer: 그림자/그라데이션이 있는 이미지에서 더 나은 결과
      // tryRotate: 회전된 QR 코드 인식 향상
      var fastOptions = {
        tryHarder: true,
        tryRotate: true,
        tryInvert: false,
        tryDownscale: true,
        tryDenoise: true,
        binarizer: 'LocalAverage',
        maxNumberOfSymbols: 20,
        formats: formats,
      };

      sendLog('Phase 1: Enhanced analysis with rotation and LocalAverage binarizer...');
      var barcodes = await ZXingWASM.readBarcodes(blob, fastOptions);

      // 결과가 없으면 2단계: 반전 시도 (어두운 배경에 밝은 코드)
      if (barcodes.length === 0) {
        sendLog('Phase 2: Trying inversion for dark backgrounds...');
        var deepOptions = {
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
          tryDownscale: true,
          tryDenoise: true,
          binarizer: 'LocalAverage',
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
  const [lotteryPromptVisible, setLotteryPromptVisible] = useState(false);
  const [pendingLotteryResult, setPendingLotteryResult] = useState(null); // { result, index, isAll }
  const [dontAskLotteryPrompt, setDontAskLotteryPrompt] = useState(false);

  // 복권 그룹에서 일반 QR 저장 시 그룹 선택 모달
  const [currentGroupId, setCurrentGroupId] = useState('default');
  const [availableGroups, setAvailableGroups] = useState([{ id: 'default', name: '기본 그룹', createdAt: Date.now() }]);
  const [groupSelectForNonLotteryVisible, setGroupSelectForNonLotteryVisible] = useState(false);
  const [pendingNonLotteryResult, setPendingNonLotteryResult] = useState(null); // { result, index, isAll }
  const [keepSavingToLotteryGroup, setKeepSavingToLotteryGroup] = useState(false); // 현재 그룹에 계속 저장 (앱 재시작 시 초기화)

  const webViewRef = useRef(null);
  const timeoutRef = useRef(null);
  const analysisStartedRef = useRef(false);

  // 핀치줌/팬 제스처 관련 상태
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // 재분석 시 크롭 영역 정보 (결과 좌표 변환용) - useRef로 클로저 문제 방지
  const cropInfoRef = useRef(null);

  // 줌/팬 상태 업데이트 함수 (JS thread에서 실행)
  const updateZoomState = useCallback((zoomed) => {
    setIsZoomed(zoomed);
  }, []);

  // 복권 인식 다시 묻지 않기 설정 로드
  useEffect(() => {
    const loadLotteryPromptSetting = async () => {
      const dontAsk = await AsyncStorage.getItem('dontAskLotteryPrompt');
      setDontAskLotteryPrompt(dontAsk === 'true');
    };
    loadLotteryPromptSetting();
  }, []);

  // 현재 선택된 그룹 및 그룹 목록 로드
  useEffect(() => {
    const loadGroupData = async () => {
      try {
        const [selectedId, groupsData] = await Promise.all([
          AsyncStorage.getItem('selectedGroupId'),
          AsyncStorage.getItem('scanGroups'),
        ]);
        if (selectedId) {
          setCurrentGroupId(selectedId);
        }
        if (groupsData) {
          const groups = JSON.parse(groupsData);
          if (groups.length > 0) {
            setAvailableGroups(groups);
          }
        }
      } catch (err) {
        console.log('Load group data error:', err);
      }
    };
    loadGroupData();
  }, []);

  // 현재 그룹이 복권 그룹인지 확인
  const isCurrentGroupLottery = useCallback(() => {
    if (currentGroupId.startsWith('lottery-')) {
      return true;
    }
    const currentGroup = availableGroups.find(g => g.id === currentGroupId);
    return currentGroup?.isLotteryGroup === true;
  }, [currentGroupId, availableGroups]);

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

      // 초기 분석이므로 cropInfo 초기화
      cropInfoRef.current = null;

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
        let results = data.data || [];
        const cropInfo = cropInfoRef.current;

        // 재분석인 경우 (cropInfo 존재), 좌표를 원본 이미지 기준으로 변환
        if (cropInfo && results.length > 0) {
          console.log('[Results] Applying crop offset:', cropInfo);
          results = results.map((result) => {
            if (result.position) {
              // 크롭된 이미지의 좌표에 오프셋을 더해 원본 이미지 좌표로 변환
              const adjustedPosition = {
                topLeft: {
                  x: result.position.topLeft.x + cropInfo.offsetX,
                  y: result.position.topLeft.y + cropInfo.offsetY,
                },
                topRight: {
                  x: result.position.topRight.x + cropInfo.offsetX,
                  y: result.position.topRight.y + cropInfo.offsetY,
                },
                bottomLeft: {
                  x: result.position.bottomLeft.x + cropInfo.offsetX,
                  y: result.position.bottomLeft.y + cropInfo.offsetY,
                },
                bottomRight: {
                  x: result.position.bottomRight.x + cropInfo.offsetX,
                  y: result.position.bottomRight.y + cropInfo.offsetY,
                },
              };
              return { ...result, position: adjustedPosition };
            }
            return result;
          });

          // 줌 상태 유지 - 리셋하지 않음
          // cropInfo는 유지하여 줌 상태에서 테두리 표시에 사용
        }

        setResults(results);
        setIsLoading(false);
        setLoadingMessage('');
      } else if (data.type === 'error') {
        clearTimeoutRef();
        console.error('WebView error:', data.message);
        setError(t('imageAnalysis.analysisError'));
        setIsLoading(false);
        setLoadingMessage('');
        cropInfoRef.current = null;
      }
    } catch (err) {
      console.error('Message parse error:', err);
    }
  }, [t, clearTimeoutRef, scale, translateX, translateY]);

  // WebView 에러 처리
  const handleWebViewError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    clearTimeoutRef();
    setError(t('imageAnalysis.analysisError'));
    setIsLoading(false);
  }, [t, clearTimeoutRef]);

  // 핀치줌 제스처
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, 1), 5); // 1x ~ 5x
    })
    .onEnd(() => {
      if (scale.value <= 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        runOnJS(updateZoomState)(false);
      } else {
        runOnJS(updateZoomState)(true);
      }
    });

  // 팬(이동) 제스처
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTranslateX = (displaySize.width * (scale.value - 1)) / 2;
        const maxTranslateY = (displaySize.height * (scale.value - 1)) / 2;
        translateX.value = Math.min(Math.max(savedTranslateX.value + event.translationX, -maxTranslateX), maxTranslateX);
        translateY.value = Math.min(Math.max(savedTranslateY.value + event.translationY, -maxTranslateY), maxTranslateY);
      }
    });

  // 더블탭 제스처 (리셋)
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(updateZoomState)(false);
    });

  // 제스처 조합
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(doubleTapGesture, panGesture)
  );

  // 애니메이션 스타일
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // 줌 영역 크롭 후 재분석
  const handleReanalyze = async () => {
    if (!normalizedImageUri || !imageSize.width || !displaySize.width) return;

    try {
      setIsReanalyzing(true);
      setIsLoading(true);
      setLoadingMessage(t('imageAnalysis.cropping'));

      // 현재 줌/팬 상태에서 보이는 영역 계산
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;

      // 화면에 보이는 영역 크기 (디스플레이 좌표 기준)
      const visibleWidth = displaySize.width / currentScale;
      const visibleHeight = displaySize.height / currentScale;

      // 스케일 비율 (원본 이미지 <-> 디스플레이)
      const scaleRatioX = imageSize.width / displaySize.width;
      const scaleRatioY = imageSize.height / displaySize.height;

      // 팬(translate)는 스케일된 상태에서의 픽셀 이동량
      // 이를 스케일 전 좌표로 변환하려면 currentScale로 나눔
      const panOffsetX = -currentTranslateX / currentScale;
      const panOffsetY = -currentTranslateY / currentScale;

      // 보이는 영역의 좌상단 좌표 (디스플레이 좌표)
      // 줌 중심은 이미지 중심이므로, 중심에서 보이는 영역의 반만큼 빼기
      const visibleLeft = (displaySize.width / 2 - visibleWidth / 2) + panOffsetX;
      const visibleTop = (displaySize.height / 2 - visibleHeight / 2) + panOffsetY;

      // 원본 이미지 좌표로 변환
      let cropX = visibleLeft * scaleRatioX;
      let cropY = visibleTop * scaleRatioY;
      let cropWidth = visibleWidth * scaleRatioX;
      let cropHeight = visibleHeight * scaleRatioY;

      // 경계 체크 및 보정
      cropX = Math.max(0, cropX);
      cropY = Math.max(0, cropY);
      if (cropX + cropWidth > imageSize.width) {
        cropWidth = imageSize.width - cropX;
      }
      if (cropY + cropHeight > imageSize.height) {
        cropHeight = imageSize.height - cropY;
      }

      // 최소 크기 보장
      cropWidth = Math.max(10, cropWidth);
      cropHeight = Math.max(10, cropHeight);

      console.log('[Reanalyze] Scale:', currentScale, 'Translate:', currentTranslateX, currentTranslateY);
      console.log('[Reanalyze] Visible area (display):', { visibleLeft, visibleTop, visibleWidth, visibleHeight });
      console.log('[Reanalyze] Crop region (original):', { cropX, cropY, cropWidth, cropHeight });

      // 크롭 정보 저장 (결과 좌표 변환용)
      cropInfoRef.current = {
        offsetX: cropX,
        offsetY: cropY,
        width: cropWidth,
        height: cropHeight,
      };

      // 이미지 크롭
      const croppedImage = await ImageManipulator.manipulateAsync(
        normalizedImageUri,
        [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
        { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
      );

      console.log('[Reanalyze] Cropped image:', croppedImage.width, 'x', croppedImage.height);

      // 크롭된 이미지를 Base64로 변환
      const croppedBase64 = await FileSystem.readAsStringAsync(croppedImage.uri, {
        encoding: 'base64',
      });

      // 임시 파일 삭제
      await FileSystem.deleteAsync(croppedImage.uri, { idempotent: true });

      // WebView에 재분석 요청
      setLoadingMessage(t('imageAnalysis.analyzing'));

      if (webViewRef.current) {
        const message = JSON.stringify({ type: 'analyze', base64: croppedBase64 });
        webViewRef.current.postMessage(message);
        startTimeout();
      }

      setIsReanalyzing(false);

      // 햅틱 피드백
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      console.error('Reanalyze error:', err);
      setIsReanalyzing(false);
      setIsLoading(false);
      cropInfoRef.current = null;
      Alert.alert(t('common.error'), t('imageAnalysis.analysisError'));
    }
  };

  // 줌 리셋
  const handleResetZoom = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    setIsZoomed(false);
    cropInfoRef.current = null;
  };

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

  // 복권 그룹 자동 생성
  const ensureLotteryGroup = async (lotteryType) => {
    const groupInfo = LOTTERY_GROUPS[lotteryType];
    if (!groupInfo) return null;

    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      let groups = groupsData ? JSON.parse(groupsData) : [];

      // 기본 그룹이 없으면 추가
      const hasDefaultGroup = groups.some(g => g.id === 'default' && !g.isDeleted);
      if (!hasDefaultGroup) {
        const defaultGroup = {
          id: 'default',
          name: '기본 그룹',
          createdAt: Date.now(),
        };
        groups.unshift(defaultGroup);
      }

      // 해당 복권 그룹이 이미 있는지 확인
      const existingGroup = groups.find(g => g.id === groupInfo.id && !g.isDeleted);
      if (existingGroup) {
        if (!hasDefaultGroup) {
          await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));
        }
        return groupInfo.id;
      }

      // 새 복권 그룹 생성
      const newGroup = {
        id: groupInfo.id,
        name: groupInfo.name,
        icon: groupInfo.icon,
        color: groupInfo.color,
        createdAt: Date.now(),
        isLotteryGroup: true,
      };

      groups.push(newGroup);
      await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));

      return groupInfo.id;
    } catch (error) {
      console.error('Failed to create lottery group:', error);
      return null;
    }
  };

  // 개별 바코드를 기록에 저장
  const handleSaveToHistory = async (result, index) => {
    try {
      // 복권 인식 설정 확인
      const lotteryScanEnabled = await AsyncStorage.getItem('lotteryScanEnabled');
      const isLotteryEnabled = lotteryScanEnabled === 'true';

      // 복권 QR 코드인지 확인
      let targetGroupId = 'default';
      let lotteryData = null;
      let isLotteryCode = false;

      // 복권 인식이 꺼져있는데 복권 QR이 감지된 경우 활성화 유도 모달 표시
      if (!isLotteryEnabled && isLotteryQR(result.text) && !dontAskLotteryPrompt) {
        setPendingLotteryResult({ result, index, isAll: false });
        setLotteryPromptVisible(true);
        return;
      }

      // 복권 그룹에서 일반 QR/바코드 저장 시 그룹 선택 모달 표시
      if (isCurrentGroupLottery() && !isLotteryQR(result.text) && !keepSavingToLotteryGroup) {
        setPendingNonLotteryResult({ result, index, isAll: false });
        setGroupSelectForNonLotteryVisible(true);
        return;
      }

      if (isLotteryEnabled && isLotteryQR(result.text)) {
        lotteryData = parseLotteryQR(result.text);
        if (lotteryData) {
          isLotteryCode = true;
          // 복권 그룹 생성/확인
          const lotteryGroupId = await ensureLotteryGroup(lotteryData.type);
          if (lotteryGroupId) {
            targetGroupId = lotteryGroupId;
          }
        }
      }

      // 그룹별 히스토리 가져오기
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : {};

      // 대상 그룹 초기화
      if (!historyByGroup[targetGroupId]) {
        historyByGroup[targetGroupId] = [];
      }

      // 복권 중복 체크
      if (isLotteryCode) {
        const existingIndex = historyByGroup[targetGroupId].findIndex(
          item => item.code === result.text
        );
        if (existingIndex !== -1) {
          // 이미 존재하는 복권
          Alert.alert(
            t('imageAnalysis.duplicateLottery') || '중복된 복권',
            t('imageAnalysis.duplicateLotteryMessage') || '이미 저장된 복권입니다.'
          );
          return;
        }
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
        ...(lotteryData && { lotteryData }), // 복권 데이터 포함
      };

      historyByGroup[targetGroupId].unshift(historyItem);

      // 최대 1000개까지만 저장
      if (historyByGroup[targetGroupId].length > 1000) {
        historyByGroup[targetGroupId] = historyByGroup[targetGroupId].slice(0, 1000);
      }

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      // 복권 저장 후 알림 스케줄링
      if (isLotteryCode) {
        scheduleLotteryNotification();
      }

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

  // 특정 그룹에 개별 바코드 저장 (그룹 선택 모달에서 호출)
  const handleSaveToHistoryWithGroup = async (result, index, targetGroupId) => {
    try {
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : {};

      if (!historyByGroup[targetGroupId]) {
        historyByGroup[targetGroupId] = [];
      }

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

      historyByGroup[targetGroupId].unshift(historyItem);

      if (historyByGroup[targetGroupId].length > 1000) {
        historyByGroup[targetGroupId] = historyByGroup[targetGroupId].slice(0, 1000);
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
      console.error('Save to history with group error:', err);
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
    }
  };

  // 특정 그룹에 모든 바코드 저장 (그룹 선택 모달에서 호출)
  const handleSaveAllToHistoryWithGroup = async (targetGroupId) => {
    if (results.length === 0) return;

    try {
      setIsSavingHistory(true);

      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : {};

      if (!historyByGroup[targetGroupId]) {
        historyByGroup[targetGroupId] = [];
      }

      let successCount = 0;

      for (const result of results) {
        // 복권 코드는 건너뛰기 (복권 그룹에 저장되어야 함)
        if (isLotteryQR(result.text)) continue;

        const normalizedType = result.format.toLowerCase().replace(/[^a-z0-9]/g, '');

        const historyItem = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${successCount}`,
          code: result.text,
          timestamp: Date.now(),
          url: null,
          photoUri: null,
          type: normalizedType,
          ecLevel: null,
          count: 1,
        };

        historyByGroup[targetGroupId].unshift(historyItem);
        successCount++;
      }

      if (historyByGroup[targetGroupId].length > 1000) {
        historyByGroup[targetGroupId] = historyByGroup[targetGroupId].slice(0, 1000);
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
      console.error('Save all to history with group error:', err);
      setIsSavingHistory(false);
      Alert.alert(t('common.error'), t('imageAnalysis.saveError'));
    }
  };

  // 모든 바코드를 기록에 저장
  const handleSaveAllToHistory = async () => {
    if (results.length === 0) return;

    try {
      // 복권 인식 설정 확인
      const lotteryScanEnabled = await AsyncStorage.getItem('lotteryScanEnabled');
      const isLotteryEnabled = lotteryScanEnabled === 'true';

      // 복권 인식이 꺼져있는데 결과 중 복권 QR이 있는 경우 활성화 유도 모달 표시
      if (!isLotteryEnabled && !dontAskLotteryPrompt) {
        const hasLotteryCode = results.some(r => isLotteryQR(r.text));
        if (hasLotteryCode) {
          setPendingLotteryResult({ result: null, index: null, isAll: true });
          setLotteryPromptVisible(true);
          return;
        }
      }

      // 복권 그룹에서 일반 QR/바코드가 포함된 경우 그룹 선택 모달 표시
      if (isCurrentGroupLottery() && !keepSavingToLotteryGroup) {
        const hasNonLotteryCode = results.some(r => !isLotteryQR(r.text));
        if (hasNonLotteryCode) {
          setPendingNonLotteryResult({ result: null, index: null, isAll: true });
          setGroupSelectForNonLotteryVisible(true);
          return;
        }
      }

      setIsSavingHistory(true);

      // 그룹별 히스토리 가져오기
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : {};

      // 기본 그룹 초기화
      if (!historyByGroup.default) {
        historyByGroup.default = [];
      }

      let successCount = 0;
      let lotteryCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // 복권 QR 코드인지 확인
        let targetGroupId = 'default';
        let lotteryData = null;
        let isLotteryCode = false;

        if (isLotteryEnabled && isLotteryQR(result.text)) {
          lotteryData = parseLotteryQR(result.text);
          if (lotteryData) {
            isLotteryCode = true;
            // 복권 그룹 생성/확인
            const lotteryGroupId = await ensureLotteryGroup(lotteryData.type);
            if (lotteryGroupId) {
              targetGroupId = lotteryGroupId;
            }
          }
        }

        // 대상 그룹 초기화
        if (!historyByGroup[targetGroupId]) {
          historyByGroup[targetGroupId] = [];
        }

        // 복권 중복 체크
        if (isLotteryCode) {
          const existingIndex = historyByGroup[targetGroupId].findIndex(
            item => item.code === result.text
          );
          if (existingIndex !== -1) {
            // 이미 존재하는 복권 - 스킵
            duplicateCount++;
            continue;
          }
          lotteryCount++;
        }

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
          ...(lotteryData && { lotteryData }), // 복권 데이터 포함
        };

        historyByGroup[targetGroupId].unshift(historyItem);
        successCount++;
      }

      // 각 그룹별 최대 1000개까지만 저장
      for (const groupId in historyByGroup) {
        if (historyByGroup[groupId].length > 1000) {
          historyByGroup[groupId] = historyByGroup[groupId].slice(0, 1000);
        }
      }

      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      // 복권 저장 후 알림 스케줄링
      if (lotteryCount > 0) {
        scheduleLotteryNotification();
      }

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
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
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
        scrollEnabled={!isZoomed}
      >
        {/* 이미지 영역 */}
        <View style={styles.imageSection}>
          {/* 줌 상태 안내 */}
          {isZoomed && (
            <View style={styles.zoomHint}>
              <Ionicons name="scan-outline" size={16} color="#fff" />
              <Text style={styles.zoomHintText}>
                {t('imageAnalysis.zoomHint')}
              </Text>
            </View>
          )}

          <GestureDetector gesture={composedGesture}>
            <View style={[styles.imageContainer, { width: displaySize.width || screenWidth - 32, height: displaySize.height || 300, overflow: 'hidden' }]}>
              <Animated.View style={[{ width: displaySize.width || screenWidth - 32, height: displaySize.height || 300 }, animatedImageStyle]}>
                {(normalizedImageUri || imageUri) && (
                  <Image
                    source={{ uri: normalizedImageUri || imageUri }}
                    style={[styles.image, { width: displaySize.width || screenWidth - 32, height: displaySize.height || 300 }]}
                    resizeMode="contain"
                  />
                )}

                {/* 바코드 박스 오버레이 (이미지와 함께 줌됨) */}
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
              </Animated.View>

              {/* 로딩 오버레이 */}
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>{loadingMessage || t('imageAnalysis.analyzing')}</Text>
                </View>
              )}
            </View>
          </GestureDetector>

          {/* 줌 컨트롤 버튼 */}
          {isZoomed && (
            <View style={styles.zoomControls}>
              <TouchableOpacity
                style={[styles.zoomButton, styles.resetButton]}
                onPress={handleResetZoom}
                activeOpacity={0.7}
              >
                <Ionicons name="contract-outline" size={20} color="#fff" />
                <Text style={styles.zoomButtonText}>{t('imageAnalysis.resetZoom')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.zoomButton, styles.reanalyzeButton]}
                onPress={handleReanalyze}
                activeOpacity={0.7}
                disabled={isLoading || isReanalyzing}
              >
                {isReanalyzing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="scan" size={20} color="#fff" />
                    <Text style={styles.zoomButtonText}>{t('imageAnalysis.reanalyze')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* 줌 사용법 안내 (줌되지 않은 상태에서만 표시) */}
          {!isZoomed && !isLoading && (
            <Text style={[styles.gestureHint, { color: colors.textSecondary }]}>
              {t('imageAnalysis.gestureHint')}
            </Text>
          )}
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

      {/* 복권 인식 활성화 유도 모달 */}
      <Modal
        visible={lotteryPromptVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLotteryPromptVisible(false)}
      >
        <View style={styles.lotteryPromptOverlay}>
          <View style={[styles.lotteryPromptContent, { backgroundColor: colors.surface }]}>
            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.lotteryPromptCloseButton}
              onPress={() => {
                setLotteryPromptVisible(false);
                setPendingLotteryResult(null);
              }}
            >
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* 아이콘 */}
            <View style={[styles.lotteryPromptIconContainer, { backgroundColor: '#f39c1220' }]}>
              <Ionicons name="ticket" size={40} color="#f39c12" />
            </View>

            {/* 메시지 */}
            <Text style={[styles.lotteryPromptTitle, { color: colors.text }]}>
              복권이 스캔되었습니다
            </Text>
            <Text style={[styles.lotteryPromptMessage, { color: colors.textSecondary }]}>
              설정에서 복권인식을 활성화 하여, 자동으로 그룹관리되도록 하겠습니까?
            </Text>

            {/* 버튼들 */}
            <View style={styles.lotteryPromptButtons}>
              <TouchableOpacity
                style={[styles.lotteryPromptButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  // 복권 인식 활성화
                  await AsyncStorage.setItem('lotteryScanEnabled', 'true');
                  // 다른 고급 스캔 기능 비활성화 (상호 배타적)
                  await AsyncStorage.setItem('continuousScanEnabled', 'false');
                  await AsyncStorage.setItem('batchScanEnabled', 'false');
                  await AsyncStorage.setItem('multiCodeModeEnabled', 'false');
                  await SecureStore.setItemAsync('scanLinkEnabled', 'false');
                  await AsyncStorage.setItem('realtimeSyncEnabled', 'false');
                  setLotteryPromptVisible(false);
                  setPendingLotteryResult(null);
                  Alert.alert('완료', '복권 인식이 활성화되었습니다. 다시 저장 버튼을 눌러주세요.');
                }}
              >
                <Text style={[styles.lotteryPromptButtonText, { color: '#fff' }]}>
                  활성화
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.lotteryPromptButton, { backgroundColor: colors.inputBackground }]}
                onPress={async () => {
                  // 다시 묻지 않기 저장
                  setDontAskLotteryPrompt(true);
                  await AsyncStorage.setItem('dontAskLotteryPrompt', 'true');
                  setLotteryPromptVisible(false);
                  setPendingLotteryResult(null);
                }}
              >
                <Text style={[styles.lotteryPromptButtonText, { color: colors.textSecondary }]}>
                  다시 묻지 않기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 복권 그룹에서 일반 QR/바코드 저장 시 그룹 선택 모달 */}
      <Modal
        visible={groupSelectForNonLotteryVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setGroupSelectForNonLotteryVisible(false);
          setPendingNonLotteryResult(null);
        }}
      >
        <View style={styles.lotteryPromptOverlay}>
          <View style={[styles.lotteryPromptContent, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.lotteryPromptCloseButton}
              onPress={() => {
                setGroupSelectForNonLotteryVisible(false);
                setPendingNonLotteryResult(null);
              }}
            >
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* 아이콘 */}
            <View style={[styles.lotteryPromptIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="folder-open" size={40} color={colors.primary} />
            </View>

            {/* 메시지 */}
            <Text style={[styles.lotteryPromptTitle, { color: colors.text }]}>
              복권 그룹이 선택되어 있습니다
            </Text>
            <Text style={[styles.lotteryPromptMessage, { color: colors.textSecondary }]}>
              일반 QR/바코드를 어디에 저장할까요?
            </Text>

            {/* 그룹 선택 리스트 */}
            <ScrollView style={styles.groupSelectList} showsVerticalScrollIndicator={false}>
              {/* 현재 그룹에 계속 저장 옵션 */}
              <TouchableOpacity
                style={[
                  styles.groupSelectItem,
                  { backgroundColor: colors.inputBackground, borderColor: colors.primary, borderWidth: 2 }
                ]}
                onPress={async () => {
                  setKeepSavingToLotteryGroup(true);
                  setGroupSelectForNonLotteryVisible(false);

                  // 대기 중인 저장 실행
                  if (pendingNonLotteryResult) {
                    if (pendingNonLotteryResult.isAll) {
                      // 모두 저장 실행
                      const { result, index, isAll, ...rest } = pendingNonLotteryResult;
                      setPendingNonLotteryResult(null);
                      await handleSaveAllToHistoryWithGroup(currentGroupId);
                    } else {
                      // 개별 저장 실행
                      await handleSaveToHistoryWithGroup(pendingNonLotteryResult.result, pendingNonLotteryResult.index, currentGroupId);
                      setPendingNonLotteryResult(null);
                    }
                  }
                }}
              >
                <View style={styles.groupSelectItemContent}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  <View style={styles.groupSelectItemTextContainer}>
                    <Text style={[styles.groupSelectItemText, { color: colors.text, fontWeight: '600' }]}>
                      현재 그룹에 계속 저장
                    </Text>
                    <Text style={[styles.groupSelectItemSubtext, { color: colors.textSecondary }]}>
                      다시 묻지 않고 복권 그룹에 저장합니다
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* 다른 그룹 목록 */}
              {availableGroups
                .filter(g => !g.isDeleted && !g.isLotteryGroup && !g.id.startsWith('lottery-'))
                .map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[styles.groupSelectItem, { backgroundColor: colors.inputBackground }]}
                    onPress={async () => {
                      setGroupSelectForNonLotteryVisible(false);

                      // 선택한 그룹에 저장
                      if (pendingNonLotteryResult) {
                        if (pendingNonLotteryResult.isAll) {
                          const { result, index, isAll, ...rest } = pendingNonLotteryResult;
                          setPendingNonLotteryResult(null);
                          await handleSaveAllToHistoryWithGroup(group.id);
                        } else {
                          await handleSaveToHistoryWithGroup(pendingNonLotteryResult.result, pendingNonLotteryResult.index, group.id);
                          setPendingNonLotteryResult(null);
                        }
                      }
                    }}
                  >
                    <View style={styles.groupSelectItemContent}>
                      <Ionicons
                        name={group.icon || 'folder'}
                        size={24}
                        color={group.color || colors.textSecondary}
                      />
                      <Text style={[styles.groupSelectItemText, { color: colors.text, marginLeft: 12 }]}>
                        {group.id === 'default' ? t('groupEdit.defaultGroup') : group.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
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
  // 줌 관련 스타일
  zoomHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  zoomHintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  zoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  resetButton: {
    backgroundColor: '#6c757d',
  },
  reanalyzeButton: {
    backgroundColor: '#007AFF',
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gestureHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // 복권 인식 활성화 유도 모달 스타일
  lotteryPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lotteryPromptContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  lotteryPromptCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lotteryPromptIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  lotteryPromptTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  lotteryPromptMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  lotteryPromptButtons: {
    width: '100%',
    gap: 12,
  },
  lotteryPromptButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  lotteryPromptButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 복권 그룹에서 일반 QR 저장 시 그룹 선택 모달 스타일
  groupSelectList: {
    width: '100%',
    maxHeight: 300,
  },
  groupSelectItem: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  groupSelectItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupSelectItemTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  groupSelectItemText: {
    fontSize: 16,
  },
  groupSelectItemSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default ImageAnalysisScreen;
