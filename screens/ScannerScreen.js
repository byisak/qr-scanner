// screens/ScannerScreen.js - Expo Router 버전 (Vision Camera 적용)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  AppState,
  Alert,
  Modal,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
// Vision Camera 사용 (네이티브 ZXing 기반으로 인식률 향상)
import { Camera } from 'react-native-vision-camera';
import { NativeQRScanner, useNativeCamera } from '../components/NativeQRScanner';
import { useRouter, useFocusEffect } from 'expo-router';
import haptics from '../utils/haptics';
import { createAudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useTabBarOverlap } from '../hooks/useTabBarOverlap';
import NewLabelPatternModal from '../components/NewLabelPatternModal';
import ScanRegionOverlay, { parseCustomRegion } from '../components/ScanRegionOverlay';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import useHardwareKeys from '../hooks/useHardwareKeys';
import { parseKeyMap, confirmKeyOf, DEFAULT_KEY_MAP } from '../utils/hardwareKeys';
import * as Clipboard from 'expo-clipboard';
import { evaluateRules, substituteTemplate } from '../utils/scanRules';
import { loadScanRules } from '../utils/scanRulesStore';
import { parseGs1, compactGs1, formatGs1Summary } from '../utils/gs1';
import { keyValueOf } from '../utils/labelParser';
import { getActiveStocktake, recordStocktakeScan, summarizeStocktake, upsertStocktake } from '../utils/stocktake';
import { isNfcSupported, startNfcListening, readNfcOnce } from '../utils/nfcReader';
import { parseLabel, signatureOf, labelOfItem, formatLabelSummary, splitLabel } from '../utils/labelParser';
import { loadLabelSettings, createCategoryFromCode, ignorePattern, addDiscovered, setCategoryRouting } from '../utils/labelCategories';

// 중복을 알린 뒤 같은 코드를 다시 알리기까지 쉬는 시간 (ms)
const DUPLICATE_NOTICE_COOLDOWN = 2500;
// 같은 코드가 이 시간 안에 다시 보이면 "계속 비추고 있는 중"으로 본다 (ms).
// 카메라는 코드가 보이는 동안 매 프레임 인식하므로, 이걸 새 스캔으로 치면 대고 있는 동안
// 0.8초마다 다시 저장되고 횟수가 부풀었다. 한 번 치웠다가 다시 찍어야 새 스캔이 된다
const STILL_IN_VIEW_GAP = 1200;

import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import {
  DEBOUNCE_DELAYS,
  RESET_DELAYS,
  TIMEOUT_VALUES,
  ONE_D_BARCODE_TYPES,
  PRODUCT_BARCODE_TYPES,
} from '../constants/Timing';
import websocketClient from '../utils/websocket';
import config from '../config/config';
import { trackScreenView, trackQRScanned, trackBarcodeScanned } from '../utils/analytics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 네이티브 모듈 안전한 import (빌드 문제 대응)
let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker not available:', e.message);
}

// 복권 유틸리티
import { isLotteryQR, parseLotteryQR, LOTTERY_GROUPS } from '../utils/lotteryParser';
import { updateLotteryNotificationOnScan } from '../utils/lotteryNotification';
import { LOTTERY_FEATURE_ENABLED } from '../utils/lotteryFeature';

// 분리된 컴포넌트
import ScanReticle from '../components/ScanReticle'; // 조준 코너 (숨 쉬기 → 코드에 붙기 → 확정 펑)
import { SCAN_THEME, SCAN_TEXT } from '../constants/scanTheme';
import BatchScanControls from '../components/BatchScanControls';
import ScanToast from '../components/ScanToast';
import DuplicateConfirmToast from '../components/DuplicateConfirmToast';
import AdBanner from '../components/AdBanner';

function ScannerScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const feedback = useFeedback();
  const { isDark } = useTheme();
  const { triggerSync } = useSync();
  const { user } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();


  // 노치 없는 SE(inset 20)부터 Dynamic Island(59)까지 대응하도록 insets 기준으로 계산
  // (iOS 상수는 노치 기기 inset 47/34 기준으로 기존 값과 같아지게 잡았다)
  const topOffset = insets.top + (Platform.OS === 'ios' ? 13 : 10);
  const batchBadgeTop = insets.top + (Platform.OS === 'ios' ? 58 : 55);
  // 하단 요소는 탭바에 가려지는 높이(tabBarOverlap) 위에 둔다. iOS는 반투명 탭바 밑까지 화면이 그려지고,
  // Android 네이티브 탭바는 화면을 탭바 위까지만 그린다. (iOS 값은 이전과 동일)
  const tabBarOverlap = useTabBarOverlap();
  const bottomOffset = tabBarOverlap + (Platform.OS === 'ios' ? 117 : 81);
  const floatingButtonBottom = tabBarOverlap + 57;
  const toastBottom = tabBarOverlap;

  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [canScan, setCanScan] = useState(true); // 스캔 허용 여부 (카메라는 계속 활성)
  const appStateSubRef = useRef(null);
  const [hapticEnabled, setHapticEnabled] = useState(true); // 햅틱 피드백 활성화 여부
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true); // 스캔 소리 활성화 여부
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(true); // 사진 저장 활성화 여부 (기본값: 켬)
  const [batchScanEnabled, setBatchScanEnabled] = useState(false); // 배치 스캔 모드 활성화 여부
  const [batchScannedItems, setBatchScannedItems] = useState([]); // 배치로 스캔된 항목들
  const [isFinishingBatch, setIsFinishingBatch] = useState(false); // 배치 저장 중 (완료 버튼 중복 탭 방지)
  const [showScanCounter, setShowScanCounter] = useState(true); // 스캔 카운터 표시 여부
  const [duplicateDetection, setDuplicateDetection] = useState(true); // 중복 감지 활성화 여부
  const [duplicateAction, setDuplicateAction] = useState('alert'); // 중복 처리 방식: 'alert', 'skip', 'allow'
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false); // 사진 촬영 중 여부
  const [cameraFacing, setCameraFacing] = useState('back'); // 카메라 방향 (back/front)
  const [currentGroupName, setCurrentGroupName] = useState(() => t('groupEdit.defaultGroup')); // 현재 선택된 그룹 이름
  const [currentGroupId, setCurrentGroupId] = useState('default'); // 현재 선택된 그룹 ID
  // 콜백 안에서 최신 그룹을 읽기 위한 ref (useCallback 의존성에 없어도 오래된 값을 붙잡지 않게)
  const currentGroupIdRef = useRef('default');
  useEffect(() => { currentGroupIdRef.current = currentGroupId || 'default'; }, [currentGroupId]);
  const [groupModalVisible, setGroupModalVisible] = useState(false); // 그룹 선택 모달 표시 여부
  const [availableGroups, setAvailableGroups] = useState([{ id: 'default', name: t('groupEdit.defaultGroup'), createdAt: Date.now() }]); // 사용 가능한 그룹 목록
  // 기본값: 모든 바코드 타입 (BarcodeSelectionScreen과 일치)
  const [barcodeTypes, setBarcodeTypes] = useState([
    'qr',
    'ean13',
    'ean8',
    'code128',
    'code39',
    'code93',
    'upce',
    'upca',
    'pdf417',
    'aztec',
    'datamatrix',
    'itf14',
    'codabar',
  ]);

  // 1차원 바코드 선택 시 전체 화면 스캔 모드 활성화 (QR만 선택 시 기존 스캔 방식 유지)
  const fullScreenScanMode = useMemo(() => {
    // QR 이외의 모든 바코드: 1차원 바코드 + 기타 2D 바코드
    const fullScreenBarcodes = ['ean13', 'ean8', 'code128', 'code39', 'code93', 'upce', 'upca', 'itf14', 'codabar', 'pdf417', 'aztec', 'datamatrix'];
    return barcodeTypes.some(type => fullScreenBarcodes.includes(type));
  }, [barcodeTypes]);

  // 카메라 컴포넌트 key 메모이제이션 (불필요한 remount 방지)
  const cameraKey = useMemo(() => {
    return `${multiCodeModeEnabled ? 'multi' : 'single'}-${[...barcodeTypes].sort().join(',')}`;
  }, [multiCodeModeEnabled, barcodeTypes]);

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [showSendMessage, setShowSendMessage] = useState(false); // "전송" 메시지 표시 여부
  const [isImageLoading, setIsImageLoading] = useState(false); // 이미지 분석 화면 전환 로딩

  // 스캔 연동 URL 관련 상태
  const [scanUrlEnabled, setScanUrlEnabled] = useState(false);
  const [activeScanUrl, setActiveScanUrl] = useState(null); // { id, name, url }
  const [showUrlSendMessage, setShowUrlSendMessage] = useState(false); // URL 전송 메시지 표시

  // 스캔 결과 표시 모드 (popup: 결과 화면, toast: 하단 토스트)
  const [scanResultMode, setScanResultMode] = useState('popup');
  const [toastData, setToastData] = useState(null); // 토스트에 표시할 스캔 데이터
  const [confirmToastData, setConfirmToastData] = useState(null); // 중복 확인 토스트 데이터
  const [continuousScanCount, setContinuousScanCount] = useState(0); // 연속 스캔 카운터
  const showContinuousCounter = scanResultMode === 'toast' && showScanCounter && continuousScanCount > 0;
  // 카운터는 화면을 오가도 유지되므로, 작업 단위를 끊고 싶을 때 배지를 길게 눌러 초기화한다
  const resetContinuousCounter = useCallback(() => {
    const previous = continuousScanCount;
    setContinuousScanCount(0);
    feedback.info(t('scanner.counterReset'), {
      actionLabel: t('common.undo'),
      onAction: () => setContinuousScanCount(previous),
    });
  }, [continuousScanCount, feedback, t]);
  const [pendingMultiScanData, setPendingMultiScanData] = useState(null); // 다중 바코드 감지 시 보류 데이터 { imageUri, barcodes, scannedCodes }
  const [visibleHighlightsCount, setVisibleHighlightsCount] = useState(0); // 화면에 표시되는 하이라이트 개수
  const [multiCodeModeEnabled, setMultiCodeModeEnabled] = useState(false); // 여러 코드 인식 모드
  const [showBarcodeValues, setShowBarcodeValues] = useState(true); // 바코드 값 표시 여부 (여러 코드 모드)
  const [singleCodeShowValue, setSingleCodeShowValue] = useState(false); // 일반 스캔에서도 값 표시
  const [scanRegionMode, setScanRegionMode] = useState('full'); // 스캔 영역 제한: full | center | band | custom
  const [scanRegionCustom, setScanRegionCustom] = useState(null); // 사용자 지정 영역 (화면 비율)
  const [scanRegionDebug, setScanRegionDebug] = useState(false); // 개발자 옵션: 영역 밖 판정 표시
  const [scanTimingDebug, setScanTimingDebug] = useState(false); // 개발자 옵션: 네이티브 단계별 처리 시간 표시
  const [scanRegion, setScanRegion] = useState(null); // 오버레이가 잰 영역 사각형 (dp)
  const reticleRef = useRef(null);                     // 조준 코너 (confirm/shake)
  // 수량 누적: 같은 코드를 다시 찍으면 중복 알림 대신 수량 +1 (GS1 수량이 있으면 그만큼)
  const [quantityMode, setQuantityMode] = useState(false);
  const quantityModeRef = useRef(false);
  // 재고 실사: 진행 중인 실사가 있으면 스캔마다 예상 목록과 맞춰 본다
  const stocktakeRef = useRef(null);
  const [stocktakeBadge, setStocktakeBadge] = useState(null); // { id, name, done, total, extra }
  // NFC 태그 읽기
  const [nfcEnabled, setNfcEnabled] = useState(true);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [primaryHighlight, setPrimaryHighlight] = useState(null); // 대표 코드의 화면 사각형
  const handlePrimaryHighlightChange = useCallback((rect) => {
    setPrimaryHighlight(prev => {
      if (!rect || !prev) return rect === prev ? prev : rect;
      // 1px 이내 움직임은 무시 (리렌더 절약)
      if (Math.abs(prev.x - rect.x) < 1 && Math.abs(prev.y - rect.y) < 1 && Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1) return prev;
      return rect;
    });
  }, []);
  const [hardwareKeyMap, setHardwareKeyMap] = useState(DEFAULT_KEY_MAP); // 볼륨 키 → 동작
  const [scanConfirmMode, setScanConfirmMode] = useState('auto'); // auto | manual (수동이면 키/버튼으로 확정)
  const scanConfirmModeRef = useRef('auto');
  const [pendingScan, setPendingScan] = useState(null); // 수동 확정 대기 중인 코드 { code, type }
  const [resultWindowAutoOpen, setResultWindowAutoOpen] = useState(true); // 결과창 자동 열림 (기본값: true)
  const [lastScannedCode, setLastScannedCode] = useState(null); // 마지막 스캔된 코드 (결과창 자동 열림 비활성화 시 사용)
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false); // 복권 인식 활성화 여부
  const [lotteryPromptVisible, setLotteryPromptVisible] = useState(false); // 복권 인식 활성화 유도 모달

  // 복권 안내 모달을 닫으면서 보류했던 스캔을 다시 켠다 (닫기·다시 묻지 않기·활성화 공통)
  const closeLotteryPrompt = useCallback(() => {
    setLotteryPromptVisible(false);
    setPendingLotteryCode(null);
    isProcessingRef.current = false;
    setCanScan(true);
  }, []);
  const [dontAskLotteryPrompt, setDontAskLotteryPrompt] = useState(false); // 복권 인식 활성화 다시 묻지 않기
  const [pendingLotteryCode, setPendingLotteryCode] = useState(null); // 복권 인식 활성화 대기 중인 코드

  // 복권 그룹에서 일반 QR 스캔 시 그룹 선택 모달
  const [groupSelectForNonLotteryVisible, setGroupSelectForNonLotteryVisible] = useState(false);
  const [pendingNonLotteryData, setPendingNonLotteryData] = useState(null); // { data, type, ecLevel, bounds, cornerPoints }
  const [keepSavingToLotteryGroup, setKeepSavingToLotteryGroup] = useState(false); // 현재 그룹에 계속 저장 (앱 재시작 시 초기화)

  const lastScannedData = useRef(null);
  const lastScannedTime = useRef(0);
  const resetTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const pendingTimersRef = useRef(new Set()); // 모든 ad-hoc setTimeout 추적
  const cameraRef = useRef(null);
  const photoSaveEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지 (기본값: 켬)
  const hapticEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지
  const scanSoundEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지
  const duplicateDetectionRef = useRef(true); // 중복 감지 설정 ref
  const duplicateActionRef = useRef('alert'); // 중복 처리 방식 ref
  const isCapturingPhotoRef = useRef(false); // ref로 동기적 추적 (카메라 마운트 유지용)
  const beepSoundPlayerRef = useRef(null); // 스캔 소리 플레이어 ref
  const isNavigatingRef = useRef(false); // 네비게이션 진행 중 플래그 (크래시 방지)
  const isProcessingRef = useRef(false); // 스캔 처리 중 플래그 (동기적 차단용)
  const scanResultModeRef = useRef('popup'); // 스캔 결과 표시 모드 ref
  const cleanupTimeoutRef = useRef(null); // cleanup 타이머 ref (경쟁 상태 방지)
  const isProcessingMultiRef = useRef(false); // 다중 바코드 처리 중 플래그
  const multiCodeModeEnabledRef = useRef(false); // 여러 코드 인식 모드 ref
  const scannedCodesRef = useRef([]); // 스캔된 코드 목록 ref (여러 코드 인식 모드)
  const resultWindowAutoOpenRef = useRef(true); // 결과창 자동 열림 ref
  const lotteryScanEnabledRef = useRef(false); // 복권 인식 활성화 ref

  // photoSaveEnabled 상태를 ref에 동기화
  useEffect(() => {
    photoSaveEnabledRef.current = photoSaveEnabled;
  }, [photoSaveEnabled]);

  // hapticEnabled 상태를 ref에 동기화
  useEffect(() => {
    hapticEnabledRef.current = hapticEnabled;
  }, [hapticEnabled]);

  // scanSoundEnabled 상태를 ref에 동기화
  useEffect(() => {
    scanSoundEnabledRef.current = scanSoundEnabled;
  }, [scanSoundEnabled]);

  // duplicateDetection 상태를 ref에 동기화
  useEffect(() => {
    duplicateDetectionRef.current = duplicateDetection;
  }, [duplicateDetection]);

  // duplicateAction 상태를 ref에 동기화
  useEffect(() => {
    duplicateActionRef.current = duplicateAction;
  }, [duplicateAction]);

  // scanResultMode 상태를 ref에 동기화
  useEffect(() => {
    scanResultModeRef.current = scanResultMode;
  }, [scanResultMode]);

  // multiCodeModeEnabled 상태를 ref에 동기화
  useEffect(() => {
    multiCodeModeEnabledRef.current = multiCodeModeEnabled;
    // 모드 비활성화 시 스캔된 코드 초기화
    if (!multiCodeModeEnabled) {
      scannedCodesRef.current = [];
      setPendingMultiScanData(null);
    }
  }, [multiCodeModeEnabled]);

  // resultWindowAutoOpen 상태를 ref에 동기화
  useEffect(() => {
    resultWindowAutoOpenRef.current = resultWindowAutoOpen;
    // 활성화 시 마지막 스캔 코드 초기화
    if (resultWindowAutoOpen) {
      setLastScannedCode(null);
    }
  }, [resultWindowAutoOpen]);

  // lotteryScanEnabled 상태를 ref에 동기화
  useEffect(() => {
    lotteryScanEnabledRef.current = lotteryScanEnabled;
  }, [lotteryScanEnabled]);

  // user 변경 시 WebSocket에 userId 동기화 (인증 로딩 완료 후 반영)
  useEffect(() => {
    if (realtimeSyncEnabled && activeSessionId) {
      const validUserId = user?.id && !user.id.startsWith('dev-') ? user.id : null;
      websocketClient.setUserId(validUserId);
      console.log('[WebSocket] User changed, updated userId:', validUserId);
    }
  }, [user, realtimeSyncEnabled, activeSessionId]);

  // 토스트 표시 함수 (ScanToast 컴포넌트가 애니메이션 처리)
  const showToast = useCallback((toastInfo) => {
    // 라벨 카테고리가 있으면 값 아래에 "필드 값" 요약을 같이 보여준다
    const label = labelOfItem({ code: toastInfo.data }, labelSettingsRef.current.categories);
    if (label) toastInfo = { ...toastInfo, labelSummary: formatLabelSummary(label, 2, t) };
    else {
      const gs1Summary = formatGs1Summary(parseGs1(toastInfo.data), t);
      if (gs1Summary) toastInfo = { ...toastInfo, labelSummary: gs1Summary };
    }
    // 규칙이 다른 그룹에 저장하게 했으면 "→ 그룹"을 같이 보여준다
    if (ruleGroupNameRef.current) {
      toastInfo = { ...toastInfo, groupName: ruleGroupNameRef.current };
      ruleGroupNameRef.current = null;
    }
    setToastData({ ...toastInfo, timestamp: Date.now() });
  }, []);

  // 토스트 클릭 시 결과 화면으로 이동
  const handleToastPress = useCallback(() => {
    if (toastData) {
      router.push({
        pathname: '/result',
        params: {
          groupId: currentGroupIdRef.current, // 결과 화면에 저장된 그룹을 보여주기 위해
          code: toastData.data,
          type: toastData.type,
          isDuplicate: toastData.isDuplicate ? 'true' : 'false',
          scanCount: (toastData.scanCount || 1).toString(),
          photoUri: '',
          errorCorrectionLevel: toastData.errorCorrectionLevel || '',
        }
      });
    }
  }, [toastData, router]);

  // 토스트 닫기
  const handleToastClose = useCallback(() => {
    setToastData(null);
  }, []);

  // 스캔 소리 플레이어 초기화
  useEffect(() => {
    try {
      beepSoundPlayerRef.current = createAudioPlayer(require('../assets/sounds/beep.mp3'));
      beepSoundPlayerRef.current.volume = 0.5;
    } catch (error) {
      console.log('Failed to initialize beep sound player:', error);
    }

    // 컴포넌트 언마운트 시 플레이어 해제
    return () => {
      if (beepSoundPlayerRef.current) {
        beepSoundPlayerRef.current.remove();
      }
    };
  }, []);

  // 카메라 권한 요청. 설정 로드와 분리해 두어야 설정 파싱 오류가 "권한 거부" 화면으로 둔갑하지 않는다
  const requestCameraPermission = useCallback(async () => {
    try {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
    }
  }, []);

  useEffect(() => {
    requestCameraPermission();
  }, [requestCameraPermission]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedBarcodes');
        if (saved) {
          const parsed = JSON.parse(saved);
          setBarcodeTypes(
            parsed.length > 0
              ? parsed
              : ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'upce', 'upca', 'pdf417', 'aztec', 'datamatrix', 'itf14', 'codabar']
          );
        }

        const haptic = await AsyncStorage.getItem('hapticEnabled');
        if (haptic !== null) {
          setHapticEnabled(haptic === 'true');
        }

        const scanSound = await AsyncStorage.getItem('scanSoundEnabled');
        if (scanSound !== null) {
          setScanSoundEnabled(scanSound === 'true');
        }

        const photoSave = await AsyncStorage.getItem('photoSaveEnabled');
        // null이면 기본값 true 유지, 저장된 값이 있으면 해당 값 사용
        setPhotoSaveEnabled(photoSave === null ? true : photoSave === 'true');

        // 연속 스캔 설정 로드 (두 키를 동기화하여 로드)
        let batchScan = await AsyncStorage.getItem('batchScanEnabled');
        const continuousScan = await AsyncStorage.getItem('continuousScanEnabled');

        // 두 키가 일치하지 않으면 동기화
        if (batchScan === null && continuousScan !== null) {
          batchScan = continuousScan;
          await AsyncStorage.setItem('batchScanEnabled', continuousScan);
        } else if (continuousScan !== null && batchScan !== continuousScan) {
          // continuousScanEnabled 기준으로 동기화 (설정 화면의 값을 우선)
          batchScan = continuousScan;
          await AsyncStorage.setItem('batchScanEnabled', continuousScan);
        }

        if (batchScan !== null) {
          setBatchScanEnabled(batchScan === 'true');
        }

        // 배치 스캔 세부 설정 로드
        const scanCounter = await AsyncStorage.getItem('batchShowScanCounter');
        if (scanCounter !== null) {
          setShowScanCounter(scanCounter === 'true');
        }
        const dupDetection = await AsyncStorage.getItem('batchDuplicateDetection');
        if (dupDetection !== null) {
          setDuplicateDetection(dupDetection === 'true');
        }
        const dupAction = await AsyncStorage.getItem('batchDuplicateAction');
        if (dupAction !== null) {
          setDuplicateAction(dupAction);
        }

        const camera = await AsyncStorage.getItem('selectedCamera');
        if (camera) {
          setCameraFacing(camera);
        }

        // 현재 선택된 그룹 이름 로드
        const selectedGroupId = await AsyncStorage.getItem('selectedGroupId') || 'default';
        setCurrentGroupId(selectedGroupId);
        const groupsData = await AsyncStorage.getItem('scanGroups');
        const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
        const isRealtimeSyncEnabled = realtimeSync === 'true';

        // 기본 그룹 정의
        const defaultGroup = { id: 'default', name: t('groupEdit.defaultGroup'), createdAt: Date.now() };

        let localizedGroups = [defaultGroup];

        if (groupsData) {
          const groups = JSON.parse(groupsData);
          // 삭제된 그룹 필터링, 실시간 서버전송이 꺼져있으면 세션 그룹도 필터링
          const filteredGroups = groups.filter(g => {
            if (g.isDeleted) return false;
            if (!isRealtimeSyncEnabled && g.isCloudSync) return false;
            return true;
          });

          // 기본 그룹 이름을 현재 언어로 변환
          localizedGroups = filteredGroups.map(g => {
            if (g.id === 'default') {
              return { ...g, name: t('groupEdit.defaultGroup') };
            }
            return g;
          });

          // 기본 그룹이 없으면 추가
          if (!localizedGroups.find(g => g.id === 'default')) {
            localizedGroups.unshift(defaultGroup);
          }
        }

        const currentGroup = localizedGroups.find(g => g.id === selectedGroupId);
        if (currentGroup) {
          setCurrentGroupName(currentGroup.name);
        } else {
          // 현재 선택된 그룹이 삭제되었으면 기본 그룹으로 변경
          setCurrentGroupId('default');
          setCurrentGroupName(t('groupEdit.defaultGroup'));
          await AsyncStorage.setItem('selectedGroupId', 'default');
        }
        // 사용 가능한 그룹 목록 설정
        setAvailableGroups(localizedGroups);

        // 실시간 서버전송 설정 로드
        if (isRealtimeSyncEnabled) {
          setRealtimeSyncEnabled(true);

          // 현재 선택된 그룹이 세션 그룹인지 확인하여 WebSocket 연결
          if (groupsData) {
            const parsedGroups = JSON.parse(groupsData);
            const selectedGroup = parsedGroups.find(g => g.id === selectedGroupId && !g.isDeleted);
            if (selectedGroup && selectedGroup.isCloudSync) {
              setActiveSessionId(selectedGroupId);

              // WebSocket 서버에 연결 (항상 config.serverUrl 사용)
              websocketClient.connect(config.serverUrl);
              websocketClient.setSessionId(selectedGroupId);
              // 개발 모드 user_id는 전송하지 않음 (dev- prefix 제외)
              const validUserId = user?.id && !user.id.startsWith('dev-') ? user.id : null;
              websocketClient.setUserId(validUserId);
              console.log('WebSocket connected for session group:', selectedGroupId, 'userId:', validUserId);
            }
          }
        }

        // 스캔 연동 URL 설정 로드
        const scanLinkEnabledStr = await SecureStore.getItemAsync('scanLinkEnabled');
        const isScanLinkEnabled = scanLinkEnabledStr === 'true';
        setScanUrlEnabled(isScanLinkEnabled);

        if (isScanLinkEnabled) {
          const urlListStr = await SecureStore.getItemAsync('scanUrlList');
          if (urlListStr) {
            const urlList = JSON.parse(urlListStr);
            const activeUrl = urlList.find(item => item.enabled);
            setActiveScanUrl(activeUrl || null);
            console.log('[ScannerScreen] Loaded active scan URL:', activeUrl?.name);
          }
        } else {
          setActiveScanUrl(null);
        }
      } catch (error) {
        // 설정 하나가 깨져도 스캐너는 기본값으로 동작해야 한다
        console.error('Scanner settings load error:', error);
      }
    })();
  }, []);

  const clearAllTimers = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
    // 모든 ad-hoc 타이머 정리
    pendingTimersRef.current.forEach(id => clearTimeout(id));
    pendingTimersRef.current.clear();
  }, []);

  // 안전한 setTimeout (자동 추적 + 자동 해제)
  const safeTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      pendingTimersRef.current.delete(id);
      fn();
    }, delay);
    pendingTimersRef.current.add(id);
    return id;
  }, []);

  const resetAll = useCallback(() => {
    lastScannedData.current = null;
    lastScannedTime.current = 0;
    clearAllTimers();
  }, [clearAllTimers]);

  useFocusEffect(
    useCallback(() => {
      // 화면 조회 추적
      trackScreenView('Scanner', 'ScannerScreen');

      // 이전 cleanup 타이머 취소 (경쟁 상태 방지)
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }

      setIsActive(true);
      setCanScan(true); // 화면 복귀 시 스캔 허용
      // 스캔 중엔 화면이 꺼지거나 어두워지지 않게 (가만히 들고 있으면 시스템이 밝기를 낮췄다)
      activateKeepAwakeAsync('scanner').catch(() => {});
      // 다른 앱에 갔다 오면 카메라 세션이 끊겨 검은 화면이 남았다 → 백그라운드에서 끄고 돌아오면 다시 켠다
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          setIsActive(true);
          setCanScan(true);
          isProcessingRef.current = false;
        } else if (state === 'background' || state === 'inactive') {
          setIsActive(false);
        }
      });
      appStateSubRef.current = appStateSub;
      historyCacheDirtyRef.current = true; // 히스토리 캐시 무효화 (다른 화면에서 변경 가능)
      sessionSavedCodesRef.current.clear(); // 다른 화면에서 기록을 지웠을 수 있다. 이후 중복은 히스토리로 판정
      isNavigatingRef.current = false; // 네비게이션 플래그 리셋
      isProcessingRef.current = false; // 처리 중 플래그 리셋
      isProcessingMultiRef.current = false; // 다중 바코드 처리 플래그 리셋
      setIsImageLoading(false); // 이미지 분석 로딩 리셋
      // 여러 코드 목록과 연속 스캔 카운터는 유지한다. 다른 탭에 잠깐 다녀오거나 토스트로 결과를
      // 확인하고 돌아왔을 때 모아 둔 코드·센 개수가 사라지면 안 된다. (결과 보기·비우기에서 지운다)
      resetAll();

      reloadLabelSettings().catch(() => {});
      loadScanRules().then((loaded) => { scanRulesRef.current = loaded; }).catch(() => {});

      (async () => {
        try {
          // 모든 설정을 한 번에 읽기 (multiGet으로 I/O 워터폴 제거)
          const settingsKeys = [
            'selectedBarcodes', 'hapticEnabled', 'scanSoundEnabled', 'photoSaveEnabled',
            'batchScanEnabled', 'continuousScanEnabled', 'batchShowScanCounter',
            'batchDuplicateDetection', 'batchDuplicateAction', 'selectedCamera',
            'scanResultMode', 'multiCodeModeEnabled', 'multiCodeShowValues', 'singleCodeShowValue',
            'resultWindowAutoOpen', 'lotteryScanEnabled', 'dontAskLotteryPrompt',
            'selectedGroupId', 'scanGroups', 'realtimeSyncEnabled',
            'scanRegionMode', 'scanRegionCustom', 'scanRegionDebug', 'scanTimingDebug', 'scanConfirmMode', 'hardwareKeyMap',
            'quantityMode', 'nfcReadEnabled',
          ];
          const settingsData = await AsyncStorage.multiGet(settingsKeys);
          const settings = Object.fromEntries(settingsData);

          const saved = settings['selectedBarcodes'];
          if (saved) {
            const parsed = JSON.parse(saved);
            setBarcodeTypes(
              parsed.length > 0
                ? parsed
                : ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'upce', 'upca', 'pdf417', 'aztec', 'datamatrix', 'itf14', 'codabar']
            );
          }

          const haptic = settings['hapticEnabled'];
          if (haptic !== null) {
            setHapticEnabled(haptic === 'true');
          }

          const scanSound = settings['scanSoundEnabled'];
          if (scanSound !== null) {
            setScanSoundEnabled(scanSound === 'true');
          }

          const photoSave = settings['photoSaveEnabled'];
          setPhotoSaveEnabled(photoSave === null ? true : photoSave === 'true');

          // 연속 스캔 설정 로드 (두 키를 동기화하여 로드)
          let batchScan = settings['batchScanEnabled'];
          const continuousScan = settings['continuousScanEnabled'];

          // 두 키가 일치하지 않으면 동기화
          if (batchScan === null && continuousScan !== null) {
            batchScan = continuousScan;
            await AsyncStorage.setItem('batchScanEnabled', continuousScan);
          } else if (continuousScan !== null && batchScan !== continuousScan) {
            batchScan = continuousScan;
            await AsyncStorage.setItem('batchScanEnabled', continuousScan);
          }

          if (batchScan !== null) {
            setBatchScanEnabled(batchScan === 'true');
          }

          // 배치 스캔 세부 설정 로드
          const scanCounter = settings['batchShowScanCounter'];
          if (scanCounter !== null) {
            setShowScanCounter(scanCounter === 'true');
          }
          const dupDetection = settings['batchDuplicateDetection'];
          if (dupDetection !== null) {
            setDuplicateDetection(dupDetection === 'true');
          }
          const dupAction = settings['batchDuplicateAction'];
          if (dupAction !== null) {
            setDuplicateAction(dupAction);
          }

          const camera = settings['selectedCamera'];
          if (camera) {
            setCameraFacing(camera);
          }

          // 스캔 결과 표시 모드 로드
          const resultMode = settings['scanResultMode'];
          if (resultMode) {
            setScanResultMode(resultMode);
          }

          // 여러 코드 인식 모드 로드
          const multiCodeMode = settings['multiCodeModeEnabled'];
          setMultiCodeModeEnabled(multiCodeMode === 'true');

          // 바코드 값 표시 설정 로드
          setSingleCodeShowValue(settings['singleCodeShowValue'] === 'true');
          setScanRegionMode(['center', 'band', 'custom'].includes(settings['scanRegionMode']) ? settings['scanRegionMode'] : 'full');
          setScanRegionCustom(parseCustomRegion(settings['scanRegionCustom']));
          setScanRegionDebug(settings['scanRegionDebug'] === 'true');
          setScanTimingDebug(settings['scanTimingDebug'] === 'true');
          setHardwareKeyMap(parseKeyMap(settings['hardwareKeyMap']));
          const qtyMode = settings['quantityMode'] === 'true';
          setQuantityMode(qtyMode);
          quantityModeRef.current = qtyMode;
          setNfcEnabled(settings['nfcReadEnabled'] !== 'false');
          getActiveStocktake().then((st) => {
            stocktakeRef.current = st;
            if (st) {
              const sum = summarizeStocktake(st);
              setStocktakeBadge({ id: st.id, name: st.name, done: sum.complete + sum.over, total: sum.total, extra: sum.extra });
            } else {
              setStocktakeBadge(null);
            }
          }).catch(() => {});
          const confirmMode = settings['scanConfirmMode'] === 'manual' ? 'manual' : 'auto';
          setScanConfirmMode(confirmMode);
          scanConfirmModeRef.current = confirmMode;
          if (confirmMode !== 'manual') { pendingScanRef.current = null; setPendingScan(null); }
          const showValues = settings['multiCodeShowValues'];
          setShowBarcodeValues(showValues === null ? true : showValues === 'true');

          // 결과창 자동 열림 설정 로드
          const autoOpen = settings['resultWindowAutoOpen'];
          setResultWindowAutoOpen(autoOpen === null ? true : autoOpen === 'true');

          // 복권 인식 활성화 설정 로드
          const lotteryScan = settings['lotteryScanEnabled'];
          // 기능 플래그가 꺼져 있으면 저장된 값(그대로 둠)과 무관하게 끈 상태로
          setLotteryScanEnabled(LOTTERY_FEATURE_ENABLED && lotteryScan === 'true');

          // 복권 인식 활성화 다시 묻지 않기 설정 로드
          const dontAskLottery = settings['dontAskLotteryPrompt'];
          setDontAskLotteryPrompt(dontAskLottery === 'true');

          // 현재 선택된 그룹 이름 로드 (multiGet 결과 사용)
          const selectedGroupId = settings['selectedGroupId'] || 'default';
          setCurrentGroupId(selectedGroupId);
          const groupsData = settings['scanGroups'];
          const realtimeSync = settings['realtimeSyncEnabled'];
          const isRealtimeSyncEnabled = realtimeSync === 'true';

          // 기본 그룹 정의
          const defaultGroup = { id: 'default', name: t('groupEdit.defaultGroup'), createdAt: Date.now() };

          let localizedGroups = [defaultGroup];

          if (groupsData) {
            const groups = JSON.parse(groupsData);
            // 삭제된 그룹 필터링, 실시간 서버전송이 꺼져있으면 세션 그룹도 필터링
            const filteredGroups = groups.filter(g => {
              if (g.isDeleted) return false;
              if (!isRealtimeSyncEnabled && g.isCloudSync) return false;
              return true;
            });

            // 기본 그룹 이름을 현재 언어로 변환
            localizedGroups = filteredGroups.map(g => {
              if (g.id === 'default') {
                return { ...g, name: t('groupEdit.defaultGroup') };
              }
              return g;
            });

            // 기본 그룹이 없으면 추가
            if (!localizedGroups.find(g => g.id === 'default')) {
              localizedGroups.unshift(defaultGroup);
            }
          }

          const currentGroup = localizedGroups.find(g => g.id === selectedGroupId);
          if (currentGroup) {
            setCurrentGroupName(currentGroup.name);
          } else {
            // 현재 선택된 그룹이 삭제되었으면 기본 그룹으로 변경
            setCurrentGroupId('default');
            setCurrentGroupName(t('groupEdit.defaultGroup'));
            await AsyncStorage.setItem('selectedGroupId', 'default');
          }
          // 사용 가능한 그룹 목록 설정
          setAvailableGroups(localizedGroups);

          // 실시간 서버전송 설정 로드
          if (isRealtimeSyncEnabled) {
            setRealtimeSyncEnabled(true);

            // 현재 선택된 그룹이 세션 그룹인지 확인하여 WebSocket 연결 (이미 파싱된 groupsData 재사용)
            if (groupsData) {
              const groups2 = JSON.parse(groupsData);
              const selectedGroup = groups2.find(g => g.id === selectedGroupId && !g.isDeleted);

              if (selectedGroup && selectedGroup.isCloudSync) {
                setActiveSessionId(selectedGroupId);

                // WebSocket 서버에 연결 (항상 config.serverUrl 사용)
                websocketClient.connect(config.serverUrl);
                websocketClient.setSessionId(selectedGroupId);
                // 개발 모드 user_id는 전송하지 않음 (dev- prefix 제외)
                const validUserId = user?.id && !user.id.startsWith('dev-') ? user.id : null;
                websocketClient.setUserId(validUserId);
                console.log('WebSocket connected for session group:', selectedGroupId, 'userId:', validUserId);
              } else {
                setActiveSessionId('');
              }
            }
          } else {
            setRealtimeSyncEnabled(false);
            setActiveSessionId('');
            // WebSocket 연결 해제
            websocketClient.disconnect();
          }

          // 스캔 연동 URL 설정 로드
          const scanLinkEnabledStr = await SecureStore.getItemAsync('scanLinkEnabled');
          const isScanLinkEnabled = scanLinkEnabledStr === 'true';
          setScanUrlEnabled(isScanLinkEnabled);

          if (isScanLinkEnabled) {
            const urlListStr = await SecureStore.getItemAsync('scanUrlList');
            if (urlListStr) {
              const urlList = JSON.parse(urlListStr);
              const activeUrl = urlList.find(item => item.enabled);
              setActiveScanUrl(activeUrl || null);
              console.log('[ScannerScreen] Focus - Loaded active scan URL:', activeUrl?.name);
            }
          } else {
            setActiveScanUrl(null);
          }
        } catch (error) {
          console.error('Load barcode settings error:', error);
        }
      })();

      return () => {
        // 먼저 콜백 차단 (새로운 스캔 결과 무시)
        isNavigatingRef.current = true;
        isProcessingRef.current = true;
        isCapturingPhotoRef.current = false;

        clearAllTimers();
        if (appStateSubRef.current) { appStateSubRef.current.remove(); appStateSubRef.current = null; }
        deactivateKeepAwake('scanner').catch(() => {});

        // 카메라 비활성화를 지연시켜 탭 전환 애니메이션이 먼저 실행되도록 함
        cleanupTimeoutRef.current = setTimeout(() => {
          setIsActive(false);
          cleanupTimeoutRef.current = null;
        }, 50);
      };
    }, [resetAll, clearAllTimers]),
  );

  // 히스토리 인메모리 캐시 (매 스캔마다 전체 JSON 파싱 방지)
  const historyCacheRef = useRef(null);
  const historyCacheDirtyRef = useRef(false);

  const getHistoryCache = useCallback(async () => {
    if (historyCacheRef.current && !historyCacheDirtyRef.current) {
      return historyCacheRef.current;
    }
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    historyCacheRef.current = historyData ? JSON.parse(historyData) : { default: [] };
    historyCacheDirtyRef.current = false;
    return historyCacheRef.current;
  }, []);

  const saveHistoryCache = useCallback(async (historyByGroup) => {
    historyCacheRef.current = historyByGroup;
    historyCacheDirtyRef.current = false;
    await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
  }, []);

  // 이번 세션에서 저장하기로 한 코드 (그룹ID::코드). 연속 스캔은 같은 코드를 0.5초마다 다시 인식하는데,
  // 첫 저장이 끝나기 전에 두 번째 인식이 오면 히스토리에 아직 없어 중복으로 안 잡혔다
  const sessionSavedCodesRef = useRef(new Set());
  // 코드별 마지막으로 보인 시각 (계속 비추는 중인지 판단용)
  const lastSeenAtRef = useRef(new Map());

  // 수동 확정: 코드를 들고 있다가 확정 키/버튼에서 저장한다. 안 보인 지 PENDING_SCAN_TTL 지나면 내린다
  const PENDING_SCAN_TTL = 1500;
  const pendingScanRef = useRef(null);          // { scanResult, seenAt }
  const pendingClearTimerRef = useRef(null);
  const confirmBypassRef = useRef(null);        // 확정 중인 코드 값: 수동 대기·연속 노출 가드를 건너뛴다
  const lastConfirmedCodeRef = useRef(null);    // 방금 확정한 코드는 계속 비추는 동안 다시 묻지 않는다
  // "이 카테고리는 ○○ 그룹에 계속 저장할까요?" — 묻는 동안 들어오는 프레임은 버린다
  const routePromptOpenRef = useRef(false);
  const askCategoryRouting = useCallback((prompt) => new Promise((resolve) => {
    const groupName = (availableGroups.find(g => g.id === prompt.groupId) || {}).name || prompt.categoryName;
    routePromptOpenRef.current = true;
    const finish = async (choice) => {
      routePromptOpenRef.current = false;
      if (choice !== null) {
        try {
          await setCategoryRouting(prompt.categoryId, choice);
          await reloadLabelSettings();
        } catch (e) {
          console.error('Save category routing error:', e);
        }
      }
      resolve(choice === true);
    };
    Alert.alert(
      t('labelCategories.routePromptTitle', { group: groupName }),
      t('labelCategories.routePromptMessage', { category: prompt.categoryName, group: groupName }),
      [
        { text: t('labelCategories.routeLater'), style: 'cancel', onPress: () => finish(null) },
        { text: t('labelCategories.routeNo'), onPress: () => finish(false) },
        { text: t('labelCategories.routeYes'), onPress: () => finish(true) },
      ],
      { cancelable: false }
    );
  }), [availableGroups, t, reloadLabelSettings]);

  const holdPendingScan = useCallback((scanResult) => {
    const code = scanResult.data;
    const type = String(scanResult.type || 'qr').toLowerCase().replace(/^org\.(iso|gs1)\./, '');
    pendingScanRef.current = { scanResult, seenAt: Date.now() };
    setPendingScan(prev => (prev && prev.code === code && prev.type === type) ? prev : { code, type });
    if (pendingClearTimerRef.current) clearTimeout(pendingClearTimerRef.current);
    pendingClearTimerRef.current = setTimeout(() => {
      pendingScanRef.current = null;
      setPendingScan(null);
    }, PENDING_SCAN_TTL);
  }, []);
  useEffect(() => () => { if (pendingClearTimerRef.current) clearTimeout(pendingClearTimerRef.current); }, []);

  // 히스토리에서 중복 여부만 확인 (저장하지 않음)
  const checkDuplicateInHistory = useCallback(async (code) => {
    const selectedGroupId = currentGroupId || 'default';
    const pendingDuplicate = sessionSavedCodesRef.current.has(`${selectedGroupId}::${code}`);
    try {
      const historyByGroup = await getHistoryCache();
      const currentHistory = historyByGroup[selectedGroupId] || [];

      const existingItem = currentHistory.find(item => item.code === code);
      return {
        isDuplicate: !!existingItem || pendingDuplicate,
        existingCount: existingItem?.count || (pendingDuplicate ? 1 : 0),
      };
    } catch (e) {
      console.error('Check duplicate error:', e);
      return { isDuplicate: pendingDuplicate, existingCount: pendingDuplicate ? 1 : 0 };
    }
  }, [currentGroupId, getHistoryCache]);

  // Android는 EC 레벨을 ZXing으로 따로 읽어서, 첫 프레임에는 없고 다음 프레임에 들어올 수 있다.
  // 이미 저장한 기록에 EC 레벨이 비어 있으면 채운다 (코드당 한 번)
  const ecFilledRef = useRef(new Set());
  const fillMissingEcLevel = useCallback(async (code, ecLevel) => {
    const key = `${currentGroupIdRef.current}::${code}`;
    if (ecFilledRef.current.has(key)) return;
    try {
      const historyByGroup = await getHistoryCache();
      const list = historyByGroup[currentGroupIdRef.current] || [];
      const index = list.findIndex(item => item.code === code);
      if (index === -1) return; // 아직 저장 전이면 다음 프레임에 다시
      ecFilledRef.current.add(key);
      if (list[index].errorCorrectionLevel) return;
      list[index] = { ...list[index], errorCorrectionLevel: ecLevel };
      historyByGroup[currentGroupIdRef.current] = list;
      await saveHistoryCache(historyByGroup);
    } catch (e) {
      console.error('Fill EC level error:', e);
    }
  }, [getHistoryCache, saveHistoryCache]);

  // 스캔 파이프라인의 "결정" 단계. 코드가 어떤 것인지 보고(라벨 카테고리·필드 값) 어떻게 처리할지(건너뜀·저장 그룹·부가 동작)를 정한다.
  // 모드별 저장 분기들은 이 결과만 보고 움직인다. 지금은 기본값만 돌려주고, 라벨 분리·자동 규칙이 여기에 들어온다.
  // 라벨 카테고리 설정 (구분자로 나뉜 코드를 필드로 저장). ref는 스캔 콜백용, state는 화면 표시용
  const labelSettingsRef = useRef({ categories: [], ignored: [], discovered: [], autoSplit: true });
  const [labelCategories, setLabelCategories] = useState([]);
  const [newPatternPrompt, setNewPatternPrompt] = useState(null); // { signature, sample } — 자동열기 OFF 모드에서 묻는 모달
  const notifiedPatternsRef = useRef(new Set());                   // 연속·배치 모드에서 한 번만 알린 패턴
  const reloadLabelSettings = useCallback(async () => {
    const settings = await loadLabelSettings();
    labelSettingsRef.current = settings;
    setLabelCategories(settings.categories);
    return settings;
  }, []);

  // 자동 규칙(설정 > 자동 규칙)과 "현재 위치"(setLocation 동작). 위치는 그룹을 바꾸거나 탭을 벗어나면 풀린다
  const scanRulesRef = useRef({ rules: [], enabled: true });
  const currentLocationRef = useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null); // { code, at }
  const ruleGroupNameRef = useRef(null); // 규칙이 다른 그룹에 저장하게 했을 때 토스트에 "→ 그룹" 표시용
  const clearLocation = useCallback((notify = false) => {
    if (!currentLocationRef.current) return;
    currentLocationRef.current = null;
    setCurrentLocation(null);
    if (notify) feedback.info(t('scanner.locationCleared'));
  }, [feedback, t]);

  const buildScanMeta = useCallback((code, barcodeType) => {
    const meta = {
      extra: null,                                       // saveHistory extra (categoryId, values, location …)
      decision: { skip: false, targetGroupId: null, actions: [] },
      newPattern: null,                                  // 카테고리가 없는 새 패턴이면 { signature, sample }
    };
    // 1) 라벨 카테고리
    const { categories, ignored, autoSplit } = labelSettingsRef.current;
    let categoryGroupId = null;
    if (autoSplit) {
      const parsed = parseLabel(code, categories);
      if (parsed) {
        meta.extra = { categoryId: parsed.categoryId, values: parsed.values };
        // 카테고리에 연결된 그룹: 승인됐으면 그 그룹에 저장, 아직 안 물어봤으면 이번에 묻는다
        const category = categories.find(c => c.id === parsed.categoryId);
        if (category && category.groupId && category.groupId !== currentGroupIdRef.current) {
          if (category.routeToGroup === true) categoryGroupId = category.groupId;
          else if (category.routeToGroup == null) meta.routePrompt = { categoryId: category.id, categoryName: category.name, groupId: category.groupId };
        }
      } else {
        const signature = signatureOf(code);
        if (signature && !ignored.includes(signature)) meta.newPattern = { signature, sample: code };
      }
    }
    // 1-2) GS1 (GTIN·로트·유통기한·수량)
    const gs1 = parseGs1(code);
    if (gs1) meta.extra = { ...(meta.extra || {}), gs1: compactGs1(gs1) };
    // 2) 자동 규칙
    const { rules, enabled } = scanRulesRef.current;
    if (enabled && rules.length > 0) {
      const input = {
        code,
        type: barcodeType,
        categoryId: meta.extra ? meta.extra.categoryId : null,
        values: meta.extra ? meta.extra.values : [],
        groupId: currentGroupIdRef.current,
      };
      meta.decision = evaluateRules(rules, input).decision;
    }
    // 규칙이 그룹을 정하지 않았으면 카테고리 그룹을 쓴다
    if (categoryGroupId && !meta.decision.targetGroupId) meta.decision.targetGroupId = categoryGroupId;
    // 3) 현재 위치가 지정돼 있으면 (이 코드가 새 위치가 되는 경우 빼고) 기록에 붙인다
    if (currentLocationRef.current && !meta.decision.actions.some(a => a.type === 'setLocation')) {
      meta.extra = { ...(meta.extra || {}), location: currentLocationRef.current.code };
    }
    return meta;
  }, []);

  // 규칙 동작 실행 (저장과 무관한 것들: 복사·URL·위치 지정·진동). 저장 그룹/건너뜀은 decision으로 처리된다
  const runRuleActions = useCallback((meta, code) => {
    for (const action of meta.decision.actions) {
      switch (action.type) {
        case 'copy':
          Clipboard.setStringAsync(code).catch(() => {});
          break;
        case 'openUrl': {
          const category = meta.extra && meta.extra.categoryId
            ? labelSettingsRef.current.categories.find(c => c.id === meta.extra.categoryId)
            : null;
          const url = substituteTemplate(action.url, { code, values: meta.extra ? meta.extra.values : [] }, {
            fieldNames: category ? category.fields : [],
            groupName: currentGroupName,
          });
          if (action.mode === 'send') {
            fetch(url).then(() => feedback.info(t('scanner.ruleUrlSent'))).catch(() => feedback.warning(t('scanner.ruleUrlFailed')));
          } else {
            Linking.openURL(url).catch(() => feedback.warning(t('scanner.ruleUrlFailed')));
          }
          break;
        }
        case 'setLocation': {
          const location = { code, at: Date.now() };
          currentLocationRef.current = location;
          setCurrentLocation(location);
          feedback.info(t('scanner.locationSet', { code }));
          break;
        }
        case 'feedback':
          if (hapticEnabledRef.current) (haptics[action.haptic] || haptics.success)();
          break;
        default:
          break;
      }
    }
    if (meta.decision.targetGroupId && meta.decision.targetGroupId !== currentGroupIdRef.current) {
      const group = availableGroups.find(g => g.id === meta.decision.targetGroupId);
      ruleGroupNameRef.current = group ? group.name : null;
    }
  }, [feedback, t, currentGroupName, availableGroups]);

  // 재고 실사에 스캔 하나를 반영 (예상 목록과 맞춰 보고 배지·저장 갱신)
  const recordStocktake = useCallback((code, meta) => {
    const st = stocktakeRef.current;
    if (!st) return;
    const label = meta.extra && meta.extra.categoryId
      ? labelOfItem({ code, categoryId: meta.extra.categoryId, values: meta.extra.values }, labelSettingsRef.current.categories)
      : null;
    const { stocktake, status, item } = recordStocktakeScan(st, {
      code,
      gtin: meta.extra && meta.extra.gs1 ? meta.extra.gs1.gtin : null,
      keyValue: label ? keyValueOf(label) : null,
      qty: meta.extra && meta.extra.gs1 ? meta.extra.gs1.qty : null,
    });
    stocktakeRef.current = stocktake;
    const sum = summarizeStocktake(stocktake);
    setStocktakeBadge({ id: stocktake.id, name: stocktake.name, done: sum.complete + sum.over, total: sum.total, extra: sum.extra });
    upsertStocktake(stocktake).catch(() => {});
    if (status === 'extra') {
      if (hapticEnabledRef.current) haptics.warning();
      reticleRef.current?.shake();
      feedback.warning(t('stocktake.notInList', { code }));
    } else if (status === 'over') {
      if (hapticEnabledRef.current) haptics.warning();
      reticleRef.current?.shake();
      feedback.warning(t('stocktake.overExpected', { name: item.name || item.code, scanned: item.scanned, expected: item.expected }));
    }
  }, [feedback, t]);

  // 그룹을 바꾸거나 스캐너 탭을 벗어나면 위치 지정을 푼다 (결정: 자동 해제)
  const locationGroupRef = useRef(currentGroupId);
  useEffect(() => {
    if (locationGroupRef.current !== currentGroupId) {
      locationGroupRef.current = currentGroupId;
      clearLocation(false);
    }
  }, [currentGroupId, clearLocation]);
  useFocusEffect(useCallback(() => () => clearLocation(false), [clearLocation]));

  // 연속·배치·여러 코드 모드에서는 스캔을 막지 않고, 패턴당 한 번만 알리고 설정의 "발견된 형식"에 쌓아 둔다
  const notifyDiscoveredPattern = useCallback((pattern) => {
    addDiscovered(pattern.sample).catch(() => {});
    if (notifiedPatternsRef.current.has(pattern.signature)) return;
    notifiedPatternsRef.current.add(pattern.signature);
    feedback.info(t('labelCategories.discoveredSnackbar'));
  }, [feedback, t]);

  // 방금 저장한 기록에 카테고리·필드 값을 채운다 (모달에서 카테고리를 만든 직후)
  const applyCategoryToHistory = useCallback(async (code, category) => {
    try {
      const historyByGroup = await getHistoryCache();
      const groupId = currentGroupIdRef.current;
      const list = historyByGroup[groupId] || [];
      const index = list.findIndex(item => item.code === code);
      if (index === -1) return;
      list[index] = { ...list[index], categoryId: category.id, values: splitLabel(code, category.delimiter) };
      historyByGroup[groupId] = list;
      await saveHistoryCache(historyByGroup);
    } catch (e) {
      console.error('Apply category error:', e);
    }
  }, [getHistoryCache, saveHistoryCache]);

  const handleCreateCategory = useCallback(async (name) => {
    const pattern = newPatternPrompt;
    setNewPatternPrompt(null);
    if (!pattern) return;
    try {
      const category = await createCategoryFromCode(pattern.sample, t, name);
      await reloadLabelSettings();
      if (category) {
        if (category.groupId && !availableGroups.some(g => g.id === category.groupId)) {
          setAvailableGroups(prev => [...prev, { id: category.groupId, name: category.name, createdAt: Date.now() }]);
        }
        await applyCategoryToHistory(pattern.sample, category);
        setLastScannedCode(prev => (prev && prev.code === pattern.sample)
          ? { ...prev, categoryId: category.id, values: splitLabel(pattern.sample, category.delimiter) }
          : prev);
        feedback.success(t('labelCategories.created', { name: category.name }));
      }
    } catch (e) {
      console.error('Create category error:', e);
    }
  }, [newPatternPrompt, t, reloadLabelSettings, applyCategoryToHistory, feedback, availableGroups]);

  const handleNeverAskPattern = useCallback(async () => {
    const pattern = newPatternPrompt;
    setNewPatternPrompt(null);
    if (!pattern) return;
    await ignorePattern(pattern.signature);
    await reloadLabelSettings();
  }, [newPatternPrompt, reloadLabelSettings]);

  // 저장하기로 정한 순간 세션 목록에 넣는다 (저장 완료를 기다리지 않음)
  const markSessionSaved = useCallback((code) => {
    sessionSavedCodesRef.current.add(`${currentGroupId || 'default'}::${code}`);
  }, [currentGroupId]);

  // extra: 기록 항목에 같이 넣을 부가 정보 (라벨 카테고리·필드 값·위치 등). 없는 키는 건드리지 않는다
  const saveHistory = useCallback(async (code, url = null, photoUri = null, barcodeType = 'qr', ecLevel = null, targetGroupId = null, extra = null) => {
    if (reticleRef.current) reticleRef.current.confirm();
    try {
      // targetGroupId가 있으면 해당 그룹에, 없으면 현재 선택된 그룹에 저장
      let selectedGroupId = targetGroupId || currentGroupId;

      // 그룹별 히스토리 가져오기 (캐시 사용)
      let historyByGroup = await getHistoryCache();

      // 선택된 그룹이 없으면 기본 그룹 사용
      if (!historyByGroup[selectedGroupId]) {
        historyByGroup[selectedGroupId] = [];
      }

      const currentHistory = historyByGroup[selectedGroupId];

      // 중복 체크 (같은 그룹 내에서 같은 코드 찾기)
      const existingIndex = currentHistory.findIndex(item => item.code === code);

      let isDuplicate = false;
      const now = Date.now();

      if (existingIndex !== -1) {
        // 중복 스캔 - 기존 항목 업데이트
        isDuplicate = true;
        const existingItem = currentHistory[existingIndex];

        // 기존 스캔 시간 배열에 새 시간 추가
        const scanTimes = existingItem.scanTimes || [existingItem.timestamp];
        scanTimes.push(now);

        // 기존 사진 배열에 새 사진 추가 (최대 10개까지 저장)
        const photos = existingItem.photos || [];
        if (photoUri) {
          photos.unshift(photoUri); // 최신 사진을 앞에 추가
          if (photos.length > 10) photos.pop(); // 10개 초과시 가장 오래된 사진 제거
        }

        const addQty = (extra && extra.gs1 && extra.gs1.qty) || 1;
        const updatedItem = {
          ...existingItem,
          ...(quantityModeRef.current && { quantity: (existingItem.quantity || existingItem.count || 1) + addQty }),
          timestamp: now, // 최신 스캔 시간으로 업데이트
          count: (existingItem.count || 1) + 1, // 스캔 횟수 증가
          scanTimes: scanTimes, // 모든 스캔 시간 저장
          photos: photos, // 모든 사진 저장
          ...(url && { url }), // URL이 있으면 업데이트
          type: barcodeType, // 바코드 타입
          ...(ecLevel && { errorCorrectionLevel: ecLevel }), // QR 오류 검증 레벨
          ...(extra || {}),
        };

        // 기존 항목 제거하고 맨 앞에 추가 (최신순으로)
        currentHistory.splice(existingIndex, 1);
        historyByGroup[selectedGroupId] = [updatedItem, ...currentHistory].slice(0, 1000);
      } else {
        // 새로운 스캔
        const record = {
          code,
          ...(quantityModeRef.current && { quantity: (extra && extra.gs1 && extra.gs1.qty) || 1 }),
          timestamp: now,
          count: 1,
          scanTimes: [now], // 첫 스캔 시간을 배열로 저장
          photos: photoUri ? [photoUri] : [], // 사진 배열
          ...(url && { url }),
          type: barcodeType, // 바코드 타입
          ...(ecLevel && { errorCorrectionLevel: ecLevel }), // QR 오류 검증 레벨
          ...(extra || {}),
        };
        historyByGroup[selectedGroupId] = [record, ...currentHistory].slice(0, 1000);
      }

      // 저장 (캐시 + AsyncStorage)
      await saveHistoryCache(historyByGroup);
      triggerSync();

      // 중복 여부 반환 (ResultScreen에서 사용)
      const saved = historyByGroup[selectedGroupId][0];
      return { isDuplicate, count: isDuplicate ? saved.count : 1, quantity: saved.quantity, errorCorrectionLevel: ecLevel };
    } catch (e) {
      console.error('Save history error:', e);
      return { isDuplicate: false, count: 1, errorCorrectionLevel: null };
    }
  }, [currentGroupId]);

  // 중복 확인 토스트 - 추가 버튼
  const handleConfirmAdd = useCallback(() => {
    if (confirmToastData) {
      const { data, type, errorCorrectionLevel } = confirmToastData;

      // 실시간 서버전송이 활성화되어 있으면 웹소켓으로 데이터 전송
      if (realtimeSyncEnabled && activeSessionId) {
        const success = websocketClient.sendScanData({
          code: data,
          timestamp: Date.now(),
        }, activeSessionId);
        if (success) {
          setShowSendMessage(true);
          safeTimeout(() => setShowSendMessage(false), 1000);
        }
      }

      // 사용자가 "추가"를 고른 경우에만 실제로 저장된 것으로 센다
      setContinuousScanCount(prev => prev + 1);
      // 토스트를 닫자마자 같은 코드가 다시 잡혀 또 묻지 않도록 잠시 쉰다
      lastScannedData.current = data;
      lastScannedTime.current = Date.now() + DUPLICATE_NOTICE_COOLDOWN;
      const meta = buildScanMeta(data, type);
      saveHistory(data, null, null, type, errorCorrectionLevel, meta.decision.targetGroupId, meta.extra).then((historyResult) => {
        showToast({
          data,
          type,
          historyId: historyResult.id,
          isDuplicate: true,
          scanCount: historyResult.count,
          quantity: historyResult.quantity,
          errorCorrectionLevel,
        });
      });
    }
    setConfirmToastData(null);
    setCanScan(true);
  }, [confirmToastData, saveHistory, showToast, realtimeSyncEnabled, activeSessionId, buildScanMeta]);

  // 중복 확인 토스트 - 건너뛰기 버튼
  const handleConfirmSkip = useCallback(() => {
    if (confirmToastData) {
      const { data, type, scanCount, errorCorrectionLevel } = confirmToastData;
      lastScannedData.current = data;
      lastScannedTime.current = Date.now() + DUPLICATE_NOTICE_COOLDOWN;
      showToast({
        data,
        type,
        historyId: null,
        isDuplicate: true,
        scanCount,
        errorCorrectionLevel,
        skipped: true,
      });
    }
    setConfirmToastData(null);
    setCanScan(true);
  }, [confirmToastData, showToast]);

  // 히스토리에 사진 추가 (백그라운드에서 사진 캡처 완료 후 호출)
  const updateHistoryWithPhoto = useCallback(async (code, photoUri, attempt = 0) => {
    if (!photoUri) return;

    try {
      const selectedGroupId = currentGroupId || 'default';
      // 캐시를 거치지 않고 저장소에 직접 쓰면 다음 saveHistory가 오래된 캐시로 덮어쓴다
      const historyByGroup = await getHistoryCache();
      const currentHistory = historyByGroup[selectedGroupId] || [];

      // 해당 코드의 가장 최근 항목 찾기
      const existingIndex = currentHistory.findIndex(item => item.code === code);

      if (existingIndex !== -1) {
        const existingItem = currentHistory[existingIndex];
        const photos = existingItem.photos || [];

        // 이미 같은 사진이 있는지 확인
        if (!photos.includes(photoUri)) {
          photos.unshift(photoUri);
          if (photos.length > 10) photos.pop();

          currentHistory[existingIndex] = {
            ...existingItem,
            photos: photos,
          };

          historyByGroup[selectedGroupId] = currentHistory;
          await saveHistoryCache(historyByGroup);
          triggerSync();
          console.log('[updateHistoryWithPhoto] Photo added to history:', photoUri);
        }
      } else if (attempt < 5) {
        // 사진이 기록 저장(saveHistory)보다 먼저 끝나면 항목이 아직 없다 → 조금 뒤 다시 붙인다
        setTimeout(() => updateHistoryWithPhoto(code, photoUri, attempt + 1), 400);
      }
    } catch (e) {
      console.error('Update history with photo error:', e);
    }
  }, [currentGroupId, getHistoryCache, saveHistoryCache]);

  // 현재 그룹이 복권 그룹인지 확인
  const isCurrentGroupLottery = useCallback(() => {
    if (!LOTTERY_FEATURE_ENABLED) return false; // 복권 기능을 꺼 두면 복권 그룹도 일반 그룹처럼
    // ID로 체크 (lottery-lotto, lottery-pension)
    if (currentGroupId.startsWith('lottery-')) {
      return true;
    }
    // availableGroups에서 isLotteryGroup 플래그 체크
    const currentGroup = availableGroups.find(g => g.id === currentGroupId);
    return currentGroup?.isLotteryGroup === true;
  }, [currentGroupId, availableGroups]);

  // 복권 그룹 자동 생성 및 복권 데이터 저장
  const ensureLotteryGroup = useCallback(async (lotteryType) => {
    const groupInfo = LOTTERY_GROUPS[lotteryType];
    if (!groupInfo) return null;

    try {
      const groupsData = await AsyncStorage.getItem('scanGroups');
      let groups = groupsData ? JSON.parse(groupsData) : [];

      // 기본 그룹이 없으면 추가 (scanGroups 스토리지에도 저장)
      const hasDefaultGroup = groups.some(g => g.id === 'default' && !g.isDeleted);
      if (!hasDefaultGroup) {
        const defaultGroup = {
          id: 'default',
          name: t('groupEdit.defaultGroup'),
          createdAt: Date.now(),
        };
        groups.unshift(defaultGroup);
      }

      // 해당 복권 그룹이 이미 있는지 확인
      const existingGroup = groups.find(g => g.id === groupInfo.id && !g.isDeleted);
      if (existingGroup) {
        // 기본 그룹만 추가된 경우에도 저장
        if (!hasDefaultGroup) {
          await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));
          setAvailableGroups(prev => {
            const hasDefault = prev.some(g => g.id === 'default');
            if (!hasDefault) {
              return [{ id: 'default', name: t('groupEdit.defaultGroup'), createdAt: Date.now() }, ...prev];
            }
            return prev;
          });
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

      // 그룹 목록 UI 업데이트
      setAvailableGroups(prev => {
        const hasDefault = prev.some(g => g.id === 'default');
        const hasLotteryGroup = prev.some(g => g.id === groupInfo.id);

        let updated = [...prev];
        if (!hasDefault) {
          updated = [{ id: 'default', name: t('groupEdit.defaultGroup'), createdAt: Date.now() }, ...updated];
        }
        if (!hasLotteryGroup) {
          updated = [...updated, newGroup];
        }
        return updated;
      });

      console.log('[ScannerScreen] Created lottery group:', groupInfo.name);
      return groupInfo.id;
    } catch (error) {
      console.error('Failed to create lottery group:', error);
      return null;
    }
  }, []);

  // 복권 기록 저장 (lotteryData 포함)
  const saveLotteryRecord = useCallback(async (code, lotteryData, photoUri = null) => {
    try {
      const groupId = await ensureLotteryGroup(lotteryData.type);
      if (!groupId) {
        console.error('[ScannerScreen] Failed to get lottery group');
        return null;
      }

      // 그룹별 히스토리 가져오기 (캐시 경유 — 직접 쓰면 다음 saveHistory가 덮어쓴다)
      let historyByGroup = await getHistoryCache();

      if (!historyByGroup[groupId]) {
        historyByGroup[groupId] = [];
      }

      const currentHistory = historyByGroup[groupId];
      const now = Date.now();

      // 중복 체크 (같은 복권 코드)
      const existingIndex = currentHistory.findIndex(item => item.code === code);

      if (existingIndex !== -1) {
        // 중복 - 이미 스캔된 복권
        console.log('[ScannerScreen] Lottery already scanned:', code);
        return {
          isDuplicate: true,
          record: currentHistory[existingIndex],
          groupId,
        };
      }

      // 새 복권 기록
      const record = {
        code,
        timestamp: now,
        count: 1,
        scanTimes: [now],
        photos: photoUri ? [photoUri] : [],
        type: 'qr',
        lotteryData: {
          ...lotteryData,
          isChecked: false,
          checkedAt: null,
        },
      };

      historyByGroup[groupId] = [record, ...currentHistory].slice(0, 1000);
      await saveHistoryCache(historyByGroup);
      triggerSync();

      console.log('[ScannerScreen] Saved lottery record:', lotteryData.typeName, lotteryData.round);
      return {
        isDuplicate: false,
        record,
        groupId,
      };
    } catch (error) {
      console.error('Save lottery record error:', error);
      return null;
    }
  }, [ensureLotteryGroup, triggerSync, getHistoryCache, saveHistoryCache]);

  // cornerPoints에서 bounds 생성
  const boundsFromCornerPoints = useCallback(
    (cornerPoints) => {
      if (!cornerPoints || cornerPoints.length < 3) return null;

      // cornerPoints는 [{x, y}, {x, y}, ...] 형식
      const xCoords = cornerPoints.map(p => p.x);
      const yCoords = cornerPoints.map(p => p.y);

      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
    []
  );

  // 현재 카메라 프레임 크기 (콜백에서 업데이트됨)
  const frameDimensionsRef = useRef({ width: 1920, height: 1440 });

  // Vision Camera 좌표 변환 헬퍼 함수
  const convertVisionCameraCoords = useCallback((x, y, width, height, frameDimensions = null) => {
    // 콜백에서 받은 실제 프레임 크기 사용 (없으면 저장된 값 사용)
    const dims = frameDimensions || frameDimensionsRef.current;
    const RAW_FRAME_W = dims.width;   // 센서 원본 가로 (예: 4032)
    const RAW_FRAME_H = dims.height;  // 센서 원본 세로 (예: 3024)


    // 좌표가 0-1 사이면 정규화된 좌표
    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      return {
        x: x * winWidth,
        y: y * winHeight,
        width: width * winWidth,
        height: height * winHeight,
      };
    }

    // 화면이 portrait이고 프레임이 landscape면 차원 스왑
    // Vision Camera는 좌표를 이미 프리뷰 방향에 맞춰 반환하지만
    // 프레임 차원은 센서 원본 방향으로 보고됨
    const isScreenPortrait = winHeight > winWidth;
    const isFrameLandscape = RAW_FRAME_W > RAW_FRAME_H;

    let FRAME_W, FRAME_H;
    if (isScreenPortrait && isFrameLandscape) {
      // 프레임 차원 스왑 (landscape → portrait)
      FRAME_W = RAW_FRAME_H;  // 3024
      FRAME_H = RAW_FRAME_W;  // 4032
    } else {
      FRAME_W = RAW_FRAME_W;
      FRAME_H = RAW_FRAME_H;
    }

    // aspectFill 스케일링 (회전 없이 직접 스케일링)
    const scaleX = winWidth / FRAME_W;
    const scaleY = winHeight / FRAME_H;
    const scale = Math.max(scaleX, scaleY);

    // 크롭 오프셋 (화면 중앙 정렬)
    const offsetX = (FRAME_W * scale - winWidth) / 2;
    const offsetY = (FRAME_H * scale - winHeight) / 2;

    const result = {
      x: x * scale - offsetX,
      y: y * scale - offsetY,
      width: width * scale,
      height: height * scale,
    };

    return result;
  }, [winWidth, winHeight]);

  const normalizeBounds = useCallback(
    (bounds, frameDimensions = null) => {
      if (!bounds) {
        return null;
      }

      // 형식 1: { origin: { x, y }, size: { width, height } } (iOS / Vision Camera)
      if (bounds.origin && bounds.size) {
        const { origin, size } = bounds;
        return convertVisionCameraCoords(origin.x, origin.y, size.width, size.height, frameDimensions);
      }

      // 형식 2: { x, y, width, height } (일부 1차원 바코드)
      if (bounds.x !== undefined && bounds.y !== undefined && bounds.width && bounds.height) {
        return convertVisionCameraCoords(bounds.x, bounds.y, bounds.width, bounds.height, frameDimensions);
      }

      // 형식 3: { boundingBox: { x, y, width, height } }
      if (bounds.boundingBox) {
        const box = bounds.boundingBox;
        return convertVisionCameraCoords(box.x, box.y, box.width, box.height, frameDimensions);
      }

      // 형식 4: Android CameraView { left, top, right, bottom }
      if (bounds.left !== undefined && bounds.top !== undefined && bounds.right !== undefined && bounds.bottom !== undefined) {
        return {
          x: bounds.left,
          y: bounds.top,
          width: bounds.right - bounds.left,
          height: bounds.bottom - bounds.top,
        };
      }

      return null;
    },
    [convertVisionCameraCoords],
  );

  // 마지막 스캔 기억만 지운다. resetAll()은 스캔을 다시 켜는 safeTimeout까지 취소해서
  // 연속 스캔 중 두 번째 스캔의 재활성화 타이머가 사라지면 스캐너가 멈춘다
  const startResetTimer = useCallback((delay) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      lastScannedData.current = null;
      lastScannedTime.current = 0;
    }, delay);
  }, []);

  // 사진 압축률 설정 (AsyncStorage에서 로드)
  const [photoQuality, setPhotoQuality] = useState(0.8);
  const photoQualityRef = useRef(0.8);

  // 사진 압축률 로드 함수
  const loadPhotoQuality = useCallback(async () => {
    try {
      const quality = await AsyncStorage.getItem('photoQuality');
      if (quality !== null) {
        const parsedQuality = parseFloat(quality);
        setPhotoQuality(parsedQuality);
        photoQualityRef.current = parsedQuality;
        console.log('[ScannerScreen] Photo quality loaded:', parsedQuality);
      }
    } catch (error) {
      console.log('Failed to load photo quality setting');
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadPhotoQuality();
  }, [loadPhotoQuality]);

  // 화면 포커스 시 다시 로드 (설정 변경 반영)
  useFocusEffect(
    useCallback(() => {
      loadPhotoQuality();
    }, [loadPhotoQuality])
  );

  const capturePhoto = useCallback(async () => {
    isCapturingPhotoRef.current = true;
    setIsCapturingPhoto(true);

    try {
      // 카메라 ref 체크
      if (!cameraRef.current) {
        console.log('Camera not ready');
        return null;
      }

      // 사진 디렉토리 생성 (첫 실행 시에만 시간 소요)
      const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
      }

      // Vision Camera 사진 촬영 (설정된 압축률 적용)
      const currentQuality = photoQualityRef.current;
      console.log('[capturePhoto] Using quality:', currentQuality);
      const photo = await cameraRef.current.takePictureAsync({
        quality: currentQuality,
        shutterSound: false,
      });

      if (!photo || !photo.uri) {
        console.log('Photo capture failed');
        return null;
      }

      const timestamp = Date.now();
      const fileName = `scan_${timestamp}.jpg`;
      const newPath = photoDir + fileName;

      // 사진 저장
      await FileSystem.copyAsync({
        from: photo.uri,
        to: newPath,
      });

      console.log('[capturePhoto] Photo saved:', newPath);
      return { croppedUri: newPath, originalUri: newPath };
    } catch (error) {
      console.error('Photo capture error:', error);
      return null;
    } finally {
      isCapturingPhotoRef.current = false;
      setIsCapturingPhoto(false);
    }
  }, []);

  // 배치 스캔 처리 헬퍼 함수 (중복 알림 후 추가 시 사용)
  const processBatchScan = useCallback(async (data, normalizedType, errorCorrectionLevel) => {
    // 햅틱 피드백
    if (hapticEnabledRef.current) {
      if (Platform.OS === 'android') {
        haptics.scan();
      } else {
        haptics.success();
      }
    }

    // 스캔 소리
    if (scanSoundEnabledRef.current && beepSoundPlayerRef.current) {
      try {
        beepSoundPlayerRef.current.seekTo(0);
        beepSoundPlayerRef.current.play();
      } catch (error) {
        console.log('Scan sound playback error:', error);
      }
    }

    // 사진 촬영 (활성화된 경우)
    let photoUri = null;
    if (photoSaveEnabledRef.current) {
      // 배치에 이미 같은 코드가 있으면 사진 저장 스킵 (저장 공간 절약)
      const isDuplicateInBatch = batchScannedItems.some(item => item.code === data);
      if (!isDuplicateInBatch) {
        try {
          const photoResult = await capturePhoto();
          photoUri = photoResult?.croppedUri || photoResult;
        } catch (error) {
          console.log('Photo capture error:', error);
        }
      } else {
        console.log('[processBatchScan] Skipping photo for duplicate code:', data);
      }
    }

    // 실시간 서버전송
    if (realtimeSyncEnabled && activeSessionId) {
      websocketClient.sendScanData({
        code: data,
        timestamp: Date.now(),
      }, activeSessionId);
      setShowSendMessage(true);
      safeTimeout(() => setShowSendMessage(false), 1000);
    }

    // 배치에 추가
    setBatchScannedItems(prev => [...prev, {
      code: data,
      timestamp: Date.now(),
      photoUri: photoUri || null,
      type: normalizedType,
      errorCorrectionLevel: errorCorrectionLevel,
    }]);

    // 스캔 재활성화
    safeTimeout(() => {
      isProcessingRef.current = false;
      setCanScan(true);
    }, 500);
    startResetTimer(RESET_DELAYS.NORMAL);
  }, [realtimeSyncEnabled, activeSessionId, capturePhoto, startResetTimer]);

  // 스캔 성공 비프 (설정에서 소리를 켠 경우만)
  const playScanBeep = useCallback(() => {
    if (!scanSoundEnabledRef.current || !beepSoundPlayerRef.current) return;
    try {
      beepSoundPlayerRef.current.seekTo(0);
      beepSoundPlayerRef.current.play();
    } catch (error) {
      // 소리 재생 실패는 무시
    }
  }, []);

  // 다중 바코드 감지 핸들러 - 중복 제외하고 누적
  const handleMultipleCodesDetected = useCallback((count, barcodesData) => {
    console.log(`[ScannerScreen] handleMultipleCodesDetected called: count=${count}, barcodes=${barcodesData?.length}, isProcessingMulti=${isProcessingMultiRef.current}, isNavigating=${isNavigatingRef.current}, isActive=${isActive}`);

    // 디버그: 각 바코드의 값 로그
    if (barcodesData) {
      barcodesData.forEach((bc, idx) => {
        console.log(`[ScannerScreen] Barcode ${idx}: value="${bc.value}", type="${bc.type}"`);
      });
    }

    // 네비게이션 중이거나 비활성화 상태면 무시
    if (isNavigatingRef.current || !isActive) {
      console.log('[ScannerScreen] Blocked by navigation or inactive');
      return;
    }

    // 새로 감지된 바코드 중 중복되지 않은 것만 추가
    if (barcodesData && barcodesData.length > 0) {
      let newCodesAdded = false;

      barcodesData.forEach((barcode) => {
        // 값을 문자열로 변환하고 정리
        const value = String(barcode.value || '').trim();

        // 빈 값이면 무시 (더 엄격한 체크)
        if (!value || value.length === 0) {
          console.log(`[ScannerScreen] Skipping barcode with empty value (original: "${barcode.value}")`);
          return;
        }

        const isDuplicate = scannedCodesRef.current.some(
          (existing) => existing.value === value
        );
        if (!isDuplicate) {
          scannedCodesRef.current.push({
            value: value,
            type: barcode.type,
            frame: barcode.frame,
            bounds: barcode.bounds || barcode.frame, // bounds가 있으면 사용, 없으면 frame
            screenSize: barcode.screenSize,
            colorIndex: barcode.colorIndex,
          });
          newCodesAdded = true;
          console.log(`[ScannerScreen] Added new code (len=${value.length}): ${value}`);

          // 실시간 서버전송이 활성화되어 있으면 새 코드 추가 시 웹소켓으로 데이터 전송
          if (realtimeSyncEnabled && activeSessionId) {
            const success = websocketClient.sendScanData({
              code: value,
              timestamp: Date.now(),
            }, activeSessionId);
            if (success) {
              setShowSendMessage(true);
              safeTimeout(() => setShowSendMessage(false), 1000);
            }
          }
        } else {
          // 기존 코드의 bounds 업데이트 (위치가 변경될 수 있으므로)
          const existing = scannedCodesRef.current.find(item => item.value === value);
          if (existing && (barcode.bounds || barcode.frame)) {
            existing.bounds = barcode.bounds || barcode.frame;
            existing.screenSize = barcode.screenSize;
            existing.colorIndex = barcode.colorIndex;
          }
        }
      });

      // 먼저 상태 업데이트 (동기적으로)
      const validBarcodes = scannedCodesRef.current.filter(bc => bc.value && bc.value.trim().length > 0);

      // 상태 즉시 업데이트
      setPendingMultiScanData({
        imageUri: null,
        barcodes: JSON.stringify(validBarcodes),
        count: validBarcodes.length
      });

      // 새로운 코드가 추가되었을 때 햅틱 피드백
      if (newCodesAdded) {
        console.log(`[ScannerScreen] Accumulated unique codes: ${scannedCodesRef.current.length}`);

        // 햅틱 피드백 (새 코드 추가 시)
        if (hapticEnabledRef.current) {
          haptics.success();
        }
        // 소음이 큰 곳에서는 진동만으로 잡혔는지 알기 어렵다 → 단일 모드처럼 비프도
        playScanBeep();
      }
      return; // 처리 완료
    }
  }, [isActive, realtimeSyncEnabled, activeSessionId]);

  // 감지된 바코드 변경 핸들러 (React 상태 기반 - Worklet 직렬화 우회)
  const handleDetectedBarcodesChange = useCallback((barcodesData) => {
    console.log(`[ScannerScreen] handleDetectedBarcodesChange: ${barcodesData?.length} barcodes`);

    // 네비게이션 중이거나 비활성화 상태면 무시
    if (isNavigatingRef.current || !isActive) {
      return;
    }

    // 여러 코드 인식 모드가 아니면 무시
    if (!multiCodeModeEnabledRef.current) {
      return;
    }

    if (barcodesData && barcodesData.length > 0) {
      let newCodesAdded = false;

      barcodesData.forEach((barcode) => {
        const value = String(barcode.value || '').trim();
        // 빈 값, "null", "undefined" 문자열 필터링
        if (!value || value.length === 0 || value === 'null' || value === 'undefined') return;

        const isDuplicate = scannedCodesRef.current.some(
          (existing) => existing.value === value
        );
        if (!isDuplicate) {
          scannedCodesRef.current.push({
            value: value,
            type: barcode.type,
            frame: barcode.frame,
            bounds: barcode.bounds || barcode.frame,
            screenSize: barcode.screenSize,
            colorIndex: barcode.colorIndex,
          });
          newCodesAdded = true;
          console.log(`[ScannerScreen] Added via state: ${value}`);
        } else {
          // 기존 코드의 bounds 업데이트
          const existing = scannedCodesRef.current.find(item => item.value === value);
          if (existing && (barcode.bounds || barcode.frame)) {
            existing.bounds = barcode.bounds || barcode.frame;
            existing.screenSize = barcode.screenSize;
            existing.colorIndex = barcode.colorIndex;
          }
        }
      });

      // 참고: setPendingMultiScanData는 handleVerifiedBarcodesChange에서만 호출
      // handleDetectedBarcodesChange에서는 scannedCodesRef에만 축적하고,
      // bounds가 보장된 handleVerifiedBarcodesChange에서 pendingMultiScanData를 설정함

      if (newCodesAdded) {
        if (hapticEnabledRef.current) {
          haptics.success();
        }
        playScanBeep();
      }
    }
  }, [isActive]);

  // 다중 바코드 결과 보기 핸들러
  const handleViewMultiResults = useCallback(() => {
    if (!pendingMultiScanData) return;

    isNavigatingRef.current = true;

    // 결과 페이지로 바로 이동 (이미지 없이)
    router.push({
      pathname: '/multi-code-results',
      params: {
        detectedBarcodes: pendingMultiScanData.barcodes,
        // 결과 화면이 지금 선택된 그룹에 저장하도록 넘긴다
        groupId: currentGroupId || 'default',
        groupName: currentGroupName,
      }
    });

    // 보류 데이터 및 스캔된 코드 초기화
    setPendingMultiScanData(null);
    scannedCodesRef.current = [];

    // 플래그 해제 (약간의 딜레이 후)
    safeTimeout(() => {
      isNavigatingRef.current = false;
    }, 2000);
  }, [pendingMultiScanData, router, safeTimeout, currentGroupId, currentGroupName]);

  // 화면에 표시되는 하이라이트 개수 변경 핸들러
  const handleVisibleHighlightsChange = useCallback((count) => {
    setVisibleHighlightsCount(count);
  }, []);

  // 검증된 바코드 변경 핸들러 (투표 기반 - 각 바운더리가 검증한 값)
  const handleVerifiedBarcodesChange = useCallback((verifiedBarcodes) => {
    // 네비게이션 중이거나 비활성화 상태면 무시
    if (isNavigatingRef.current || !isActive) return;
    // 여러 코드 인식 모드가 아니면 무시
    if (!multiCodeModeEnabledRef.current) return;

    console.log(`[ScannerScreen] Verified barcodes: ${verifiedBarcodes?.length}`);

    if (verifiedBarcodes && verifiedBarcodes.length > 0) {
      // scannedCodesRef에 있는 바코드의 bounds 업데이트
      verifiedBarcodes.forEach(bc => {
        if (bc.value && bc.bounds) {
          const existing = scannedCodesRef.current.find(item => item.value === bc.value);
          if (existing) {
            // bounds와 screenSize 업데이트
            existing.bounds = bc.bounds;
            existing.screenSize = bc.screenSize;
            existing.colorIndex = bc.colorIndex;
          }
        }
      });

      // 검증된 바코드로 pendingMultiScanData 업데이트
      // 중복 제거 (같은 값이 여러 바운더리에서 나올 수 있음)
      const uniqueValues = new Map();
      verifiedBarcodes.forEach(bc => {
        if (bc.value && !uniqueValues.has(bc.value)) {
          uniqueValues.set(bc.value, bc);
        }
      });

      const uniqueBarcodes = Array.from(uniqueValues.values());

      setPendingMultiScanData({
        imageUri: null,
        barcodes: JSON.stringify(uniqueBarcodes),
        count: uniqueBarcodes.length
      });
    }
  }, [isActive]);

  // 결과 창 열기 핸들러 (결과창 자동 열림 비활성화 시 사용)
  const handleOpenResultWindow = useCallback(() => {
    if (!lastScannedCode) return;

    isNavigatingRef.current = true;
    setIsActive(false);

    router.push({
      pathname: '/result',
      params: {
        groupId: currentGroupIdRef.current, // 결과 화면에 저장된 그룹을 보여주기 위해
        code: lastScannedCode.code,
        isDuplicate: lastScannedCode.isDuplicate ? 'true' : 'false',
        scanCount: lastScannedCode.scanCount.toString(),
        photoUri: lastScannedCode.photoUri || '',
        type: lastScannedCode.type,
        errorCorrectionLevel: lastScannedCode.errorCorrectionLevel || '',
      }
    });

    // 마지막 스캔 코드 초기화
    setLastScannedCode(null);
  }, [lastScannedCode, router]);

  // 결과 창 닫기 핸들러 (스캔 계속)
  const handleCloseResultWindow = useCallback(() => {
    setLastScannedCode(null);
  }, []);

  // 다중 바코드 보류 데이터 닫기 핸들러
  // 모은 코드 목록 비우기. 확인 없이 지우되 실행 취소로 되돌릴 수 있게 한다
  const handleCloseMultiScan = useCallback(() => {
    const snapshotData = pendingMultiScanData;
    const snapshotCodes = scannedCodesRef.current;
    setPendingMultiScanData(null);
    scannedCodesRef.current = [];
    if (!snapshotData) return;
    feedback.warning(t('scanner.multiListCleared'), {
      actionLabel: t('common.undo'),
      onAction: () => {
        scannedCodesRef.current = snapshotCodes;
        setPendingMultiScanData(snapshotData);
      },
    });
  }, [pendingMultiScanData, feedback, t]);


  const handleBarCodeScanned = useCallback(
    async (scanResult) => {
      const { data, bounds, type, cornerPoints, raw, frameDimensions, errorCorrectionLevel } = scanResult;

      // 처리 중이어도 "보였다"는 사실은 기록해야 계속 비추는 중인지 알 수 있다 → 가드보다 먼저
      const seenAt = Date.now();
      const previousSeenAt = lastSeenAtRef.current.get(data);
      const stillInView = previousSeenAt !== undefined && seenAt - previousSeenAt < STILL_IN_VIEW_GAP;
      lastSeenAtRef.current.set(data, seenAt);
      if (lastSeenAtRef.current.size > 200) lastSeenAtRef.current.clear();

      // 사진 촬영 중이거나 네비게이션 중이거나 이미 처리 중이면 스캔 무시
      if (!isActive || !canScan || isCapturingPhotoRef.current || isNavigatingRef.current || isProcessingRef.current || routePromptOpenRef.current) return;

      // 수동 확정 모드: 저장하지 않고 들고 있다가 확정 키/버튼에서 처리한다 (여러 코드 모드는 "결과 보기"가 확정)
      if (scanConfirmModeRef.current === 'manual' && !multiCodeModeEnabledRef.current && confirmBypassRef.current !== data) {
        if (!(stillInView && lastConfirmedCodeRef.current === data)) holdPendingScan(scanResult);
        return;
      }

      // 같은 코드를 계속 비추고 있으면 다시 처리하지 않는다 (여러 코드 모드는 자체 누적 로직 사용)
      if (stillInView && !multiCodeModeEnabledRef.current && confirmBypassRef.current !== data) {
        if (errorCorrectionLevel) fillMissingEcLevel(data, errorCorrectionLevel);
        return;
      }

      // 카메라 프레임 크기 저장 (좌표 변환용)
      if (frameDimensions) {
        frameDimensionsRef.current = frameDimensions;
      }

      // 바코드 타입 정규화 (org.iso.Code39 -> code39)
      const normalizedType = type.toLowerCase().replace(/^org\.(iso|gs1)\./, '');

      // 바코드가 화면 중앙 십자가 근처에 있을 때만 스캔
      // 1D 바코드 여부 확인
      const is1DBarcode = ONE_D_BARCODE_TYPES.includes(normalizedType);

      // Vision Camera는 카메라 센서 좌표를 반환하므로 타겟 영역 검사 스킵
      // (카메라 센서 해상도 ≠ 화면 해상도)
      // Android에서도 bounds 형식 호환성 문제로 스킵
      if (Platform.OS === 'android') {
        console.log('[Android] Skipping bounds validation, allowing scan');
      } else {
        // iOS Vision Camera: 타겟 영역 검사 스킵 (좌표계 불일치)
        // 대신 디바운스로 중복 스캔 방지
        console.log('[iOS Vision Camera] Skipping target area check, using debounce only');
      }

      const now = Date.now();

      // 바코드 타입과 bounds 유무에 따라 최적화된 디바운스 적용
      let debounceDelay;
      if (is1DBarcode) {
        // 1D 바코드 (Code 39 등): bounds 유무와 관계없이 최적화된 딜레이 적용
        debounceDelay = bounds ? DEBOUNCE_DELAYS.ONE_D_BARCODE : DEBOUNCE_DELAYS.NO_BOUNDS;
      } else {
        // 2D 바코드 (QR 등): 기존 로직 유지
        debounceDelay = bounds ? DEBOUNCE_DELAYS.DEFAULT : DEBOUNCE_DELAYS.NO_BOUNDS;
      }
      if (lastScannedData.current === data && now - lastScannedTime.current < debounceDelay) {
        return;
      }

      if (lastScannedData.current !== data) {
        if (navigationTimerRef.current) {
          clearTimeout(navigationTimerRef.current);
          navigationTimerRef.current = null;
        }
      }

      lastScannedData.current = data;
      lastScannedTime.current = now;

      // 스캔 이벤트 추적
      if (normalizedType === 'qr' || normalizedType === 'qrcode') {
        trackQRScanned(normalizedType, data.startsWith('http') ? 'url' : 'text');
      } else {
        trackBarcodeScanned(normalizedType);
      }

      // 복권 QR 코드 감지 - 비활성화 상태에서 감지 시 활성화 유도 모달 표시
      if (LOTTERY_FEATURE_ENABLED && !lotteryScanEnabledRef.current && isLotteryQR(data) && !dontAskLotteryPrompt) {
        console.log('[ScannerScreen] Lottery QR detected but feature disabled, showing prompt');
        // 모달을 띄운 동안 일반 처리를 보류한다. 같이 진행하면 결과 화면·토스트와 모달이 겹친다
        isProcessingRef.current = true;
        setCanScan(false);
        setPendingLotteryCode(data);
        setLotteryPromptVisible(true);
        return;
      }

      // 복권 QR 코드 감지 및 처리 (설정에서 활성화된 경우에만)
      if (LOTTERY_FEATURE_ENABLED && lotteryScanEnabledRef.current && isLotteryQR(data)) {
        const lotteryData = parseLotteryQR(data);
        if (lotteryData) {
          console.log('[ScannerScreen] Lottery QR detected:', lotteryData.typeName, lotteryData.round);

          // 스캔 즉시 차단
          isProcessingRef.current = true;
          setCanScan(false);

          // 햅틱 피드백
          if (hapticEnabledRef.current) {
            haptics.success();
          }

          // 스캔 소리
          if (scanSoundEnabledRef.current && beepSoundPlayerRef.current) {
            try {
              beepSoundPlayerRef.current.seekTo(0);
              beepSoundPlayerRef.current.play();
            } catch (e) {
              console.log('Sound play error:', e);
            }
          }

          // 복권 기록 저장
          const result = await saveLotteryRecord(data, lotteryData, null);

          if (result) {
            // 새 복권이 저장된 경우 알림 스케줄링
            if (!result.isDuplicate) {
              updateLotteryNotificationOnScan();
            }

            if (result.isDuplicate) {
              // 중복 복권 - 기존 결과 화면으로 이동
              Alert.alert(
                t('lotteryScan.alreadyScanned'),
                t('lotteryScan.alreadyScannedMessage', { type: lotteryData.typeName, round: lotteryData.round }),
                [
                  {
                    text: t('lotteryScan.cancel'),
                    style: 'cancel',
                    onPress: () => {
                      isProcessingRef.current = false;
                      setCanScan(true);
                    },
                  },
                  {
                    text: t('lotteryScan.checkResult'),
                    onPress: () => {
                      router.push({
                        pathname: '/lottery-result',
                        params: { code: data },
                      });
                      safeTimeout(() => {
                        isProcessingRef.current = false;
                        setCanScan(true);
                      }, 500);
                    },
                  },
                ],
                { cancelable: false }
              );
            } else {
              // 새 복권 - 결과 화면으로 이동
              router.push({
                pathname: '/lottery-result',
                params: { code: data },
              });
              safeTimeout(() => {
                isProcessingRef.current = false;
                setCanScan(true);
              }, 500);
            }
          } else {
            // 저장 실패
            Alert.alert(t('common.error'), t('scanner.lotterySaveFailed'));
            isProcessingRef.current = false;
            setCanScan(true);
          }

          return; // 복권 처리 완료, 일반 스캔 로직 스킵
        }
      }

      // 복권 그룹에서 일반 QR/바코드 스캔 시 그룹 선택 모달 표시
      if (isCurrentGroupLottery() && !isLotteryQR(data) && !keepSavingToLotteryGroup) {
        console.log('[ScannerScreen] Non-lottery code scanned in lottery group, showing group selection');
        // 스캔 일시 정지
        isProcessingRef.current = true;
        setCanScan(false);
        // 대기 데이터 저장
        setPendingNonLotteryData({
          data,
          type: normalizedType,
          ecLevel: errorCorrectionLevel || null,
          bounds,
          cornerPoints,
        });
        // 그룹 선택 모달 표시
        setGroupSelectForNonLotteryVisible(true);
        return;
      }

      // 결정 단계: 라벨 분리·자동 규칙 결과. 모든 모드가 이 값을 쓴다
      const scanMeta = buildScanMeta(data, normalizedType);
      runRuleActions(scanMeta, data);
      if (scanMeta.routePrompt && !scanMeta.decision.skip) {
        const route = await askCategoryRouting(scanMeta.routePrompt);
        if (route && !scanMeta.decision.targetGroupId) scanMeta.decision.targetGroupId = scanMeta.routePrompt.groupId;
      }
      if (!scanMeta.decision.skip) recordStocktake(data, scanMeta);
      if (scanMeta.decision.skip) {
        // 규칙이 "저장하지 않음"으로 정한 코드: 알리고 스캔만 다시 켠다
        feedback.info(t('scanner.ruleSkipped'));
        safeTimeout(() => { isProcessingRef.current = false; setCanScan(true); }, 300);
        startResetTimer(RESET_DELAYS.NORMAL);
        return;
      }
      // 새 라벨 패턴: 스캔을 멈추면 안 되는 모드에서는 알림만. (자동열기 OFF 모드는 아래에서 모달로 묻고,
      // 결과 화면이 열리는 모드는 결과 화면이 묻는다)
      if (scanMeta.newPattern && (scanResultModeRef.current === 'toast' || batchScanEnabled || multiCodeModeEnabledRef.current)) {
        notifyDiscoveredPattern(scanMeta.newPattern);
      }

      // 토스트 모드: 연속 스캔 - 중복 감지 설정에 따라 처리
      if (scanResultModeRef.current === 'toast') {
        // 피드백은 중복 판정 뒤에 준다. 이미 찍은 라벨에 성공음·카운터가 올라가면
        // 작업자는 실제보다 많이 처리했다고 믿게 된다
        const giveSavedFeedback = () => {
          setContinuousScanCount(prev => prev + 1);
          if (hapticEnabledRef.current) {
            if (Platform.OS === 'android') {
              haptics.scan();
            } else {
              haptics.success();
            }
          }
          playScanBeep();
        };
        // 중복: 소리 없이 경고 진동만. 카운터는 그대로.
        // 카메라를 계속 대고 있으면 0.5초마다 다시 알리므로 같은 코드는 잠시 무시한다
        const giveDuplicateFeedback = () => {
          if (hapticEnabledRef.current) {
            haptics.warning(); reticleRef.current?.shake();
          }
          if (lastScannedData.current === data) {
            lastScannedTime.current = Date.now() + DUPLICATE_NOTICE_COOLDOWN;
          }
        };

        // 실시간 서버 전송 헬퍼 함수
        const sendToRealtimeServer = () => {
          if (realtimeSyncEnabled && activeSessionId) {
            const success = websocketClient.sendScanData({
              code: data,
              timestamp: Date.now(),
            }, activeSessionId);
            if (success) {
              setShowSendMessage(true);
              safeTimeout(() => setShowSendMessage(false), 1000);
            } else {
              console.warn('Failed to send scan data to server in continuous mode');
            }
          }
        };

        // EC Level 추출
        let detectedEcLevel = errorCorrectionLevel || null;

        // 중복 감지가 활성화된 경우 먼저 중복 여부 확인 (수량 누적 모드에선 중복이 아니라 수량 +1)
        if (duplicateDetectionRef.current && !quantityModeRef.current) {
          checkDuplicateInHistory(data).then(({ isDuplicate, existingCount }) => {
            if (isDuplicate) {
              const action = duplicateActionRef.current;

              if (action === 'skip') {
                // 자동 건너뛰기: 서버 전송 없이 토스트로 건너뛰었다고 알림
                giveDuplicateFeedback();
                showToast({
                  data,
                  type: normalizedType,
                  historyId: null,
                  isDuplicate: true,
                  scanCount: existingCount,
                  errorCorrectionLevel: detectedEcLevel,
                  skipped: true,
                });
                return;
              } else if (action === 'alert') {
                // 알림 후 추가: 확인 토스트로 물어봄 (스캔 일시 정지, 서버 전송은 확인 후)
                giveDuplicateFeedback();
                setCanScan(false);
                setConfirmToastData({
                  data,
                  type: normalizedType,
                  scanCount: existingCount,
                  errorCorrectionLevel: detectedEcLevel,
                });
                return;
              }
              // action === 'allow': 아래에서 정상 저장 및 서버 전송
            }

            // 중복이 아니거나 allow인 경우: 서버 전송 및 정상 저장
            markSessionSaved(data);
            giveSavedFeedback();
            sendToRealtimeServer();
            saveHistory(data, null, null, normalizedType, detectedEcLevel, scanMeta.decision.targetGroupId, scanMeta.extra).then((historyResult) => {
              showToast({
                data,
                type: normalizedType,
                historyId: historyResult.id,
                isDuplicate: historyResult.isDuplicate,
                scanCount: historyResult.count,
                quantity: historyResult.quantity,
                errorCorrectionLevel: detectedEcLevel,
              });
            });
          });
        } else {
          // 중복 감지 비활성화: 서버 전송 및 바로 저장
          markSessionSaved(data);
          giveSavedFeedback();
          sendToRealtimeServer();
          saveHistory(data, null, null, normalizedType, detectedEcLevel, scanMeta.decision.targetGroupId, scanMeta.extra).then((historyResult) => {
            showToast({
              data,
              type: normalizedType,
              historyId: historyResult.id,
              isDuplicate: historyResult.isDuplicate,
              scanCount: historyResult.count,
              quantity: historyResult.quantity,
              errorCorrectionLevel: detectedEcLevel,
            });
          }).catch((error) => {
            console.error('Toast mode history save error:', error);
            showToast({
              data,
              type: normalizedType,
              historyId: null,
              isDuplicate: false,
              scanCount: 1,
              errorCorrectionLevel: detectedEcLevel,
            });
          });
        }

        // 스캔 계속 진행 (차단하지 않음)
        return;
      }

      // 팝업 모드: 스캔 즉시 차단 (중복 스캔 방지) - ref로 동기적 차단
      isProcessingRef.current = true;
      setCanScan(false);

      // 배치 스캔 모드일 경우 중복 체크를 먼저 수행
      if (batchScanEnabled && duplicateDetectionRef.current && !quantityModeRef.current) {
        const isDuplicate = batchScannedItems.some(item => item.code === data);
        if (isDuplicate) {
          const action = duplicateActionRef.current;

          if (action === 'skip') {
            // 자동으로 건너뛰기. 무반응이면 인식이 안 된 줄 알고 계속 갖다 대므로 경고 진동 + 짧은 안내
            if (hapticEnabledRef.current) {
              haptics.warning(); reticleRef.current?.shake();
            }
            feedback.info(t('scanner.duplicateSkipped'));
            safeTimeout(() => {
              isProcessingRef.current = false;
              setCanScan(true);
            }, 500);
            startResetTimer(RESET_DELAYS.NORMAL);
            return;
          } else if (action === 'alert') {
            // 알림 후 추가: 사용자에게 물어봄
            Alert.alert(
              t('batchScan.duplicateAlertTitle'),
              t('batchScan.duplicateAlertMessage'),
              [
                {
                  text: t('batchScan.duplicateAlertCancel'),
                  style: 'cancel',
                  onPress: () => {
                    // 취소: 스캔만 재활성화
                    safeTimeout(() => {
                      isProcessingRef.current = false;
                      setCanScan(true);
                    }, 300);
                    startResetTimer(RESET_DELAYS.NORMAL);
                  },
                },
                {
                  text: t('batchScan.duplicateAlertAdd'),
                  onPress: () => {
                    // 추가: 중복이어도 배치에 추가
                    processBatchScan(data, normalizedType, errorCorrectionLevel, bounds, cornerPoints);
                  },
                },
              ],
              { cancelable: false }
            );
            return;
          }
          // action === 'allow': 중복 허용, 아래로 계속 진행
        }
      }

      // 햅틱 설정이 활성화된 경우에만 진동
      if (hapticEnabledRef.current) {
        if (Platform.OS === 'android') {
          // Android: Heavy impact로 더 강한 진동
          haptics.scan();
        } else {
          // iOS: 기존 Success notification
          haptics.success();
        }
      }

      // 스캔 소리 설정이 활성화된 경우에만 소리 재생
      if (scanSoundEnabledRef.current && beepSoundPlayerRef.current) {
        try {
          beepSoundPlayerRef.current.seekTo(0);
          beepSoundPlayerRef.current.play();
        } catch (error) {
          // 소리 재생 실패는 무시
        }
      }

      // Android: cornerPoints를 우선 사용 (더 정확한 위치)
      // bounds가 없으면 cornerPoints에서 생성 시도
      let effectiveBounds = bounds;
      if (Platform.OS === 'android' && cornerPoints && cornerPoints.length >= 4) {
        // Android에서는 cornerPoints가 더 정확함
        effectiveBounds = boundsFromCornerPoints(cornerPoints);
      } else if (!bounds && cornerPoints) {
        effectiveBounds = boundsFromCornerPoints(cornerPoints);
      }

      // 사진 저장이 활성화되어 있으면 촬영 (중복 코드는 사진 저장 스킵)
      let photoPromise = null;
      if (photoSaveEnabledRef.current) {
        // 히스토리에서 중복 여부 확인 - 중복이면 사진 저장 스킵 (저장 공간 절약)
        const duplicateCheck = await checkDuplicateInHistory(data);
        if (!duplicateCheck.isDuplicate) {
          photoPromise = capturePhoto().catch(() => null);
        }
      }

      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      // 네비게이션 타이머
      navigationTimerRef.current = setTimeout(async () => {
        try {
          // EC 레벨: 네이티브에서 받은 값 사용
          const detectedEcLevel = errorCorrectionLevel;

          // 사진 촬영 완료를 기다림
          let photoUri = null;
          let photoTimedOut = false;
          if (photoPromise) {
            const waitStartTime = Date.now();
            // 결과 화면으로 넘어가면 바로 카메라를 끈다(setIsActive(false)). 촬영 중에 끄면 사진이 취소돼 저장되지 않았다
            // → 카메라를 떠나는 경우엔 사진이 끝날 때까지(최대 2초) 기다린다. 카메라가 계속 켜져 있는 모드는 예전처럼 0.3초만
            const willLeaveCamera = !batchScanEnabled && !multiCodeModeEnabledRef.current && resultWindowAutoOpenRef.current;
            const timeoutPromise = new Promise(resolve => setTimeout(() => {
              resolve({ timedOut: true });
            }, willLeaveCamera ? 2000 : 300));
            const photoResult = await Promise.race([photoPromise, timeoutPromise]);
            const waitEndTime = Date.now();

            if (photoResult?.timedOut) {
              photoTimedOut = true;

              // 타임아웃되었지만 사진 캡처는 계속 진행 - 완료되면 히스토리에 추가
              photoPromise.then(result => {
                const uri = result?.croppedUri || result;
                if (uri) {
                  updateHistoryWithPhoto(data, uri);
                }
              }).catch(() => {});
            } else {
              photoUri = photoResult?.croppedUri || photoResult;
            }
          }

          // 실시간 서버전송이 활성화되어 있으면 웹소켓으로 데이터 전송
          if (realtimeSyncEnabled && activeSessionId) {
            const success = websocketClient.sendScanData({
              code: data,
              timestamp: Date.now(),
            }, activeSessionId);
            if (!success) {
              console.warn('Failed to send scan data to server');
            }
          }

          // 배치 스캔 모드일 경우
          if (batchScanEnabled) {
            // 중복은 이미 위에서 체크했으므로 바로 배치에 추가
            setBatchScannedItems(prev => [...prev, {
              code: data,
              timestamp: Date.now(),
              photoUri: photoUri || null,
              type: normalizedType,
              errorCorrectionLevel: detectedEcLevel,
              targetGroupId: scanMeta.decision.targetGroupId,
              extra: scanMeta.extra,
            }]);

            // 배치 + 실시간 전송 모드: "전송" 메시지 표시
            if (realtimeSyncEnabled && activeSessionId) {
              setShowSendMessage(true);
              safeTimeout(() => setShowSendMessage(false), 1000);
            }

            // 스캔 재활성화 (계속 스캔 가능)
            safeTimeout(() => {
              isProcessingRef.current = false;
              setCanScan(true);
            }, 500);
            startResetTimer(RESET_DELAYS.NORMAL);
            return;
          }

          // 여러 코드 인식 모드일 경우
          if (multiCodeModeEnabledRef.current) {
            // 이미 스캔된 코드인지 확인 (중복 방지)
            const isDuplicateInSession = scannedCodesRef.current.some(item => item.code === data);
            if (!isDuplicateInSession) {
              // 새 코드 추가
              scannedCodesRef.current = [...scannedCodesRef.current, {
                code: data,
                type: normalizedType,
                timestamp: Date.now(),
                errorCorrectionLevel: detectedEcLevel,
                extra: scanMeta.extra,
              }];

              // pendingMultiScanData 업데이트
              setPendingMultiScanData({
                imageUri: null,
                barcodes: JSON.stringify(scannedCodesRef.current.map(item => ({
                  value: item.code,
                  type: item.type,
                }))),
                count: scannedCodesRef.current.length,
                scannedCodes: scannedCodesRef.current,
              });
            }

            // 스캔 재활성화 (계속 스캔 가능)
            safeTimeout(() => {
              isProcessingRef.current = false;
              setCanScan(true);
            }, 300);
            startResetTimer(RESET_DELAYS.NORMAL);
            return;
          }

          // 일반 모드 (기존 로직)

          // 결과창 자동 열림이 비활성화된 경우: 카메라 유지, 테두리와 값 표시
          if (!resultWindowAutoOpenRef.current) {
            // 마지막 스캔된 코드 저장 (UI에 먼저 표시)
            setLastScannedCode({
              code: data,
              type: normalizedType,
              timestamp: Date.now(),
              isDuplicate: false,
              scanCount: 1,
              photoUri: photoUri || null,
              errorCorrectionLevel: detectedEcLevel || null,
              categoryId: scanMeta.extra?.categoryId,
              values: scanMeta.extra?.values,
            });
            if (scanMeta.newPattern) setNewPatternPrompt(scanMeta.newPattern);

            // 히스토리 저장 (비동기, 기다리지 않음 - 애니메이션 블록 방지)
            saveHistory(data, null, photoUri, normalizedType, detectedEcLevel, scanMeta.decision.targetGroupId, scanMeta.extra).then(historyResult => {
              // 히스토리 결과로 업데이트
              setLastScannedCode(prev => prev ? {
                ...prev,
                isDuplicate: historyResult.isDuplicate,
                scanCount: historyResult.count,
                quantity: historyResult.quantity,
              } : null);
              // 이 모드는 결과 화면이 안 열려서, 중복이어도 아무 표시가 없었다.
              // 문구는 하단 결과 카드 제목에 나오므로(스낵바까지 띄우면 두 번 보이고 카드를 가린다) 진동만 준다
              if (historyResult.isDuplicate && !quantityModeRef.current && hapticEnabledRef.current) {
                haptics.warning(); reticleRef.current?.shake();
              }
            }).catch(console.error);

            // 스캔 재활성화 (계속 스캔 가능) - 카메라는 활성 상태 유지
            safeTimeout(() => {
              isProcessingRef.current = false;
              setCanScan(true);
            }, 300);
            startResetTimer(RESET_DELAYS.NORMAL);
            return;
          }

          const enabled = await SecureStore.getItemAsync('scanLinkEnabled');

          // 네비게이션 전 카메라 중지 (멈춤 현상 방지)
          isNavigatingRef.current = true;
          setIsActive(false);

          if (enabled === 'true') {
            const base = await SecureStore.getItemAsync('baseUrl');
            if (base) {
              const sanitizedData = encodeURIComponent(data);
              const url = base.includes('{code}') ? base.replace('{code}', sanitizedData) : base + sanitizedData;

              // 스캔 연동 URL 그룹 ID 찾기
              let scanUrlGroupId = null;
              if (activeScanUrl) {
                scanUrlGroupId = `scan-url-${activeScanUrl.id}`;
                // URL 전송 메시지 표시
                setShowUrlSendMessage(true);
                safeTimeout(() => setShowUrlSendMessage(false), 1000);
              }

              // 히스토리 저장은 해당 URL 그룹에 저장
              saveHistory(data, url, photoUri, normalizedType, detectedEcLevel, scanUrlGroupId, scanMeta.extra).catch(console.error);
              router.push({ pathname: '/webview', params: { url } });
              startResetTimer(RESET_DELAYS.LINK);
              return;
            }
          }

          // 제품 검색 자동 실행 (상품 바코드인 경우)
          const isProductBarcode = PRODUCT_BARCODE_TYPES.includes(normalizedType);

          if (isProductBarcode) {
            const productAutoSearch = await AsyncStorage.getItem('productAutoSearch');

            if (productAutoSearch === 'true') {
              const savedSitesJson = await AsyncStorage.getItem('productSearchSites');

              if (savedSitesJson) {
                const searchSites = JSON.parse(savedSitesJson);
                // 활성화된 사이트 중 첫 번째 사이트로 검색
                const enabledSite = searchSites.find(site => site.enabled);

                if (enabledSite) {
                  const searchUrl = enabledSite.url.replace('{code}', encodeURIComponent(data));

                  // 히스토리 저장
                  saveHistory(data, searchUrl, photoUri, normalizedType, detectedEcLevel, scanMeta.decision.targetGroupId, scanMeta.extra).catch(console.error);

                  // openMode에 따라 웹뷰 또는 외부 브라우저로 열기
                  if (enabledSite.openMode === 'inApp') {
                    router.push({ pathname: '/webview', params: { url: searchUrl } });
                  } else {
                    // 외부 브라우저로 열기
                    Linking.openURL(searchUrl).catch(console.error);
                    // 결과 화면으로 이동
                    router.push({
                      pathname: '/result',
                      params: {
                        groupId: currentGroupIdRef.current, // 결과 화면에 저장된 그룹을 보여주기 위해
                        code: data,
                        isDuplicate: 'false',
                        scanCount: '1',
                        photoUri: photoUri || '',
                        type: normalizedType,
                        errorCorrectionLevel: detectedEcLevel || '',
                      }
                    });
                  }
                  startResetTimer(RESET_DELAYS.LINK);
                  return;
                }
              }
            }
          }

          // 히스토리 저장을 먼저 시작하고 결과는 빠르게 가져옴
          const historyResult = await saveHistory(data, null, photoUri, normalizedType, detectedEcLevel, scanMeta.decision.targetGroupId, scanMeta.extra);

          // 팝업 모드: 결과 화면으로 이동
          router.push({
            pathname: '/result',
            params: {
              groupId: currentGroupIdRef.current, // 결과 화면에 저장된 그룹을 보여주기 위해
              code: data,
              isDuplicate: historyResult.isDuplicate ? 'true' : 'false',
              scanCount: historyResult.count.toString(),
              photoUri: photoUri || '',
              type: normalizedType,
              errorCorrectionLevel: detectedEcLevel || '',
            }
          });
          startResetTimer(RESET_DELAYS.NORMAL);
        } catch (error) {
          console.error('Navigation error:', error);
          await saveHistory(data, null, null, type, null, scanMeta.decision.targetGroupId, scanMeta.extra);
          startResetTimer(RESET_DELAYS.NORMAL);
        } finally {
          navigationTimerRef.current = null;
        }
      }, 50);
    },
    [isActive, canScan, normalizeBounds, saveHistory, updateHistoryWithPhoto, router, startResetTimer, batchScanEnabled, batchScannedItems, capturePhoto, realtimeSyncEnabled, activeSessionId, winWidth, winHeight, fullScreenScanMode, scanUrlEnabled, activeScanUrl, showToast, playScanBeep, feedback, t, checkDuplicateInHistory, markSessionSaved, currentGroupId, fillMissingEcLevel, buildScanMeta, notifyDiscoveredPattern, holdPendingScan, runRuleActions, recordStocktake, askCategoryRouting],
  );

  const toggleTorch = useCallback(() => setTorchOn((prev) => !prev), []);

  // 스캔 화면 아래 모드 알약: 한 개 / 여러 개(여러 코드 인식) / 연속(연속 스캔).
  // 설정 화면의 두 모드 스위치와 같은 키를 같은 방식으로 쓴다(서로 배타, 켜면 URL 연동·실시간 전송·복권 인식은 꺼짐)
  const currentScanMode = multiCodeModeEnabled ? 'multi' : batchScanEnabled ? 'continuous' : 'single';
  const setScanMode = useCallback(async (mode) => {
    if (mode === currentScanMode) return;
    if (hapticEnabledRef.current) haptics.selection?.();
    const multi = mode === 'multi';
    const continuous = mode === 'continuous';
    setMultiCodeModeEnabled(multi);
    setBatchScanEnabled(continuous);
    setScanResultMode(continuous ? 'toast' : 'popup');
    if (mode !== 'single') {
      setScanUrlEnabled(false);
      setRealtimeSyncEnabled(false);
      setLotteryScanEnabled(false);
    }
    try {
      await AsyncStorage.multiSet([
        ['multiCodeModeEnabled', String(multi)],
        ['continuousScanEnabled', String(continuous)],
        ['batchScanEnabled', String(continuous)],
        ['scanResultMode', continuous ? 'toast' : 'popup'],
        ...(mode !== 'single' ? [['realtimeSyncEnabled', 'false'], ['lotteryScanEnabled', 'false']] : []),
      ]);
      if (mode !== 'single') await SecureStore.setItemAsync('scanLinkEnabled', 'false');
    } catch (error) {
      console.error('Save scan mode error:', error);
      feedback.error(t('settings.saveFailed'));
    }
  }, [currentScanMode, feedback, t]);

  // NFC: 읽은 값을 바코드와 같은 처리 과정으로 넘긴다 (type 'nfc')
  const handleBarCodeScannedRef = useRef(null);
  useEffect(() => { handleBarCodeScannedRef.current = handleBarCodeScanned; }, [handleBarCodeScanned]);
  const handleNfcValue = useCallback((decoded) => {
    if (!decoded || !decoded.value || !handleBarCodeScannedRef.current) return;
    handleBarCodeScannedRef.current({ data: decoded.value, type: 'nfc' });
  }, []);
  useEffect(() => {
    isNfcSupported().then(setNfcSupported).catch(() => setNfcSupported(false));
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !nfcEnabled || !nfcSupported) return undefined;
      let stop = null;
      let cancelled = false;
      startNfcListening(handleNfcValue).then((fn) => {
        if (cancelled) fn(); else stop = fn;
      });
      return () => {
        cancelled = true;
        if (stop) stop();
      };
    }, [nfcEnabled, nfcSupported, handleNfcValue])
  );
  const handleReadNfc = useCallback(async () => {
    const decoded = await readNfcOnce(t('nfc.iosAlert'));
    handleNfcValue(decoded);
  }, [t, handleNfcValue]);

  // 수동 확정: 들고 있던 코드를 지금 저장한다 (확정 키 또는 화면 버튼)
  const commitPendingScan = useCallback(() => {
    const pending = pendingScanRef.current;
    if (!pending || Date.now() - pending.seenAt > PENDING_SCAN_TTL) {
      if (hapticEnabledRef.current) haptics.warning(); reticleRef.current?.shake();
      feedback.info(t('scanConfirm.nothingToConfirm'));
      return;
    }
    if (pendingClearTimerRef.current) clearTimeout(pendingClearTimerRef.current);
    pendingScanRef.current = null;
    setPendingScan(null);
    const data = pending.scanResult.data;
    confirmBypassRef.current = data;
    lastConfirmedCodeRef.current = data;
    Promise.resolve(handleBarCodeScanned(pending.scanResult)).finally(() => {
      if (confirmBypassRef.current === data) confirmBypassRef.current = null;
    });
  }, [handleBarCodeScanned, feedback, t]);

  // 볼륨 키에 매핑된 동작
  const handleHardwareKeyAction = useCallback((action) => {
    switch (action) {
      case 'confirm':
        if (multiCodeModeEnabledRef.current) {
          if (pendingMultiScanData) handleViewMultiResults();
          else { if (hapticEnabledRef.current) haptics.warning(); reticleRef.current?.shake(); feedback.info(t('scanConfirm.nothingToConfirm')); }
        } else {
          commitPendingScan();
        }
        break;
      case 'torch':
        toggleTorch();
        break;
      case 'result':
        if (lastScannedCode) handleOpenResultWindow();
        else feedback.info(t('scanConfirm.nothingToConfirm'));
        break;
      case 'group':
        setGroupModalVisible(true);
        break;
      case 'multiResults':
        if (pendingMultiScanData) handleViewMultiResults();
        else feedback.info(t('scanConfirm.nothingToConfirm'));
        break;
      case 'dumpFrame':
        // 개발자용: 다음 분석 프레임을 PGM으로 저장 (adb pull로 꺼내 scripts/dm-bench 에 쓴다)
        cameraRef.current?.requestFrameDump?.();
        break;
      default:
        break;
    }
  }, [pendingMultiScanData, handleViewMultiResults, commitPendingScan, toggleTorch, lastScannedCode, handleOpenResultWindow, feedback, t]);
  const handleFrameDumped = useCallback((path) => {
    feedback.info(t('scanner.frameDumped', { path: path.replace(/^.*\/cache\//, 'cache/') }));
  }, [feedback, t]);
  useHardwareKeys({ keyMap: hardwareKeyMap, onAction: handleHardwareKeyAction });

  // 수동 확정 안내: 확정 키가 있으면 "볼륨 위 키를 눌러 확정", 없으면 화면 버튼 안내
  const confirmKey = Platform.OS === 'android' ? confirmKeyOf(hardwareKeyMap) : null;
  const confirmHintText = confirmKey
    ? t('scanConfirm.pressToConfirm', { key: t(`hardwareKeys.${confirmKey}`) })
    : t('scanConfirm.tapToConfirm');

  // 배치 스캔 완료 - 모든 항목을 히스토리에 저장
  const handleFinishBatch = useCallback(async () => {
    if (batchScannedItems.length === 0 || isFinishingBatch) return;

    setIsFinishingBatch(true);
    let savedCount = 0;
    try {
      // 스캔 연동 URL이 활성화되어 있으면 해당 그룹에 저장
      let targetGroupId = null;
      if (scanUrlEnabled && activeScanUrl) {
        targetGroupId = `scan-url-${activeScanUrl.id}`;
      }

      // 모든 배치 항목을 히스토리에 저장
      for (const item of batchScannedItems) {
        await saveHistory(item.code, null, item.photoUri, item.type, item.errorCorrectionLevel, item.targetGroupId || targetGroupId, item.extra || null);
        savedCount++;
      }

      // 배치 항목 초기화
      setBatchScannedItems([]);
      setIsFinishingBatch(false);

      // 네비게이션 전 카메라 중지 (멈춤 현상 방지)
      isNavigatingRef.current = true;
      setIsActive(false);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 히스토리 화면으로 이동
      router.push('/(tabs)/history');
    } catch (error) {
      console.error('Finish batch error:', error);
      // 이미 저장된 항목은 빼서, 다시 눌렀을 때 같은 코드가 두 번 들어가지 않게 한다
      setBatchScannedItems(prev => prev.slice(savedCount));
      setIsFinishingBatch(false);
      feedback.error(t('scanner.batchSaveFailed'));
    }
  }, [batchScannedItems, isFinishingBatch, saveHistory, router, scanUrlEnabled, activeScanUrl, feedback, t]);

  // 배치 스캔 초기화. "완료" 바로 옆이라 잘못 누르기 쉬워 실행 취소로 되돌릴 수 있게 한다
  const handleClearBatch = useCallback(() => {
    const snapshot = batchScannedItems;
    setBatchScannedItems([]);
    if (snapshot.length === 0) return;
    feedback.warning(t('scanner.batchCleared', { count: snapshot.length }), {
      actionLabel: t('common.undo'),
      onAction: () => setBatchScannedItems(snapshot),
    });
  }, [batchScannedItems, feedback, t]);

  // 그룹 선택 핸들러
  const handleSelectGroup = useCallback(async (groupId, groupName, isCloudSync = false, isScanUrlGroup = false, scanUrlId = null) => {
    try {
      setCurrentGroupId(groupId);
      setCurrentGroupName(groupName);
      // 스캔에서 고른 그룹을 기록 화면도 따라가게 한다. (반대 방향은 일부러 안 한다:
      // 기록에서 다른 그룹을 보기만 해도 스캔 저장 그룹이 바뀌던 버그가 있었다)
      await AsyncStorage.multiSet([['selectedGroupId', groupId], ['historyViewGroupId', groupId]]);
      setGroupModalVisible(false);

      // 스캔 URL 그룹 선택 시 URL 활성화 연동
      if (isScanUrlGroup && scanUrlId) {
        // URL 목록에서 해당 URL 활성화
        const urlListStr = await SecureStore.getItemAsync('scanUrlList');
        if (urlListStr) {
          const urlList = JSON.parse(urlListStr);
          const updatedUrlList = urlList.map(item => ({
            ...item,
            enabled: item.id === scanUrlId,
          }));
          await SecureStore.setItemAsync('scanUrlList', JSON.stringify(updatedUrlList));

          // 활성화된 URL 정보 설정
          const activeUrl = updatedUrlList.find(item => item.id === scanUrlId);
          if (activeUrl) {
            setActiveScanUrl(activeUrl);
            setScanUrlEnabled(true);
            await SecureStore.setItemAsync('scanLinkEnabled', 'true');
            await SecureStore.setItemAsync('baseUrl', activeUrl.url);
            console.log('[handleSelectGroup] Activated scan URL:', activeUrl.name);
          }
        }
      } else if (!isScanUrlGroup) {
        // 일반 그룹 선택 시 스캔 URL 표시만 해제 (URL 설정은 유지)
        setActiveScanUrl(null);
      }

      // 세션 그룹(클라우드 동기화 그룹) 선택 시 WebSocket 연결
      if (isCloudSync && realtimeSyncEnabled) {
        setActiveSessionId(groupId);

        // WebSocket 연결 (항상 config.serverUrl 사용)
        websocketClient.connect(config.serverUrl);
        websocketClient.setSessionId(groupId);
        // 개발 모드 user_id는 전송하지 않음 (dev- prefix 제외)
        const validUserId = user?.id && !user.id.startsWith('dev-') ? user.id : null;
        websocketClient.setUserId(validUserId);
        console.log('WebSocket connected for session group:', groupId, 'userId:', validUserId);
      } else {
        // 일반 그룹 선택 시 WebSocket 연결 해제
        setActiveSessionId('');
        if (websocketClient.getConnectionStatus()) {
          websocketClient.disconnect();
          console.log('WebSocket disconnected - selected non-session group');
        }
      }
    } catch (error) {
      console.error('Failed to select group:', error);
    }
  }, [realtimeSyncEnabled, user]);

  // 네이티브 이미지 피커로 갤러리 열기
  const handlePickImage = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert(
        t('generator.featureUnavailable') || '기능 사용 불가',
        t('generator.imagePickerUnavailable') || '이미지 선택 기능을 사용할 수 없습니다. 앱을 다시 빌드해주세요.'
      );
      return;
    }
    try {
      // 권한 요청
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error') || '오류',
          t('imageAnalysis.permissionDenied') || '사진 라이브러리 접근 권한이 필요합니다.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;

      // 즉시 로딩 표시 (화면 전환 딜레이 동안 사용자 피드백)
      setIsImageLoading(true);
      isNavigatingRef.current = true;
      setIsActive(false);

      // 다음 프레임에서 네비게이션 (로딩 UI가 먼저 렌더링되도록)
      requestAnimationFrame(() => {
        router.push({
          pathname: '/image-analysis',
          params: { imageUri: imageUri },
        });
      });
    } catch (error) {
      console.error('Image picker error:', error);
      setIsImageLoading(false);
      Alert.alert(t('settings.error'), t('imageAnalysis.pickerError'));
    }
  }, [router, t]);

  // 표시할 그룹 목록 (실시간 서버전송이 꺼져있으면 세션 그룹 필터링, 스캔 연동이 꺼져있으면 스캔 URL 그룹 필터링)
  const displayGroups = useMemo(() => {
    let filtered = availableGroups;

    // 실시간 서버전송이 꺼져있으면 클라우드 동기화 그룹 숨김
    if (!realtimeSyncEnabled) {
      filtered = filtered.filter(g => !g.isCloudSync);
    }

    // 스캔 연동 URL이 꺼져있으면 스캔 URL 그룹 숨김
    if (!scanUrlEnabled) {
      filtered = filtered.filter(g => !g.isScanUrlGroup);
    }

    // 기본 그룹 이름을 현재 언어로 변환
    return filtered.map(g => {
      if (g.id === 'default') {
        return { ...g, name: t('groupEdit.defaultGroup') };
      }
      return g;
    });
  }, [availableGroups, realtimeSyncEnabled, scanUrlEnabled, t]);

  if (hasPermission === null) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.permissionMsg} accessibilityLabel={t('scanner.permissionRequest')}>
          {t('scanner.permissionRequest')}
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    // 거부 화면에 탈출구가 없으면 사용자는 앱을 지우는 수밖에 없다
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={56} color="rgba(255,255,255,0.7)" />
        <Text style={styles.permissionMsg} accessibilityLabel={t('scanner.permissionDenied')}>
          {t('scanner.permissionDenied')}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel={t('scanner.openSettings')}
        >
          <Text style={[styles.permissionButtonText, { fontFamily: fonts.semiBold }]}>{t('scanner.openSettings')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, styles.permissionButtonSecondary]}
          onPress={requestCameraPermission}
          accessibilityRole="button"
          accessibilityLabel={t('scanner.retryPermission')}
        >
          <Text style={[styles.permissionButtonText, { fontFamily: fonts.semiBold }]}>{t('scanner.retryPermission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 카메라를 항상 마운트 상태로 유지하여 언마운트 시 네이티브 블로킹 방지 */}
      {/* isActive prop으로만 카메라 활성화/비활성화 제어 */}
      <NativeQRScanner
        key={cameraKey}
        ref={cameraRef}
        isActive={isActive}
        facing={cameraFacing}
        torch={torchOn ? 'on' : 'off'}
        barcodeTypes={barcodeTypes}
        onCodeScanned={handleBarCodeScanned}
        onMultipleCodesDetected={handleMultipleCodesDetected}
        onDetectedBarcodesChange={handleDetectedBarcodesChange}
        onVerifiedBarcodesChange={handleVerifiedBarcodesChange}
        onVisibleHighlightsChange={handleVisibleHighlightsChange}
        selectCenterBarcode={!multiCodeModeEnabled}
        showBarcodeValues={(multiCodeModeEnabled && showBarcodeValues) || (!multiCodeModeEnabled && singleCodeShowValue) || (!resultWindowAutoOpen && lastScannedCode)}
        style={StyleSheet.absoluteFillObject}
        showHighlights={true}
        highlightColor={SCAN_THEME.white}
        highlightFillColor="transparent"
        hideHighlightBoxes={!multiCodeModeEnabled}
        onPrimaryHighlightChange={handlePrimaryHighlightChange}
        scanRegion={scanRegion}
        scanRegionDebug={scanRegionDebug}
        scanTimingDebug={scanTimingDebug}
        onFrameDumped={handleFrameDumped}
      />

      {/* 스캔 영역 제한 표시 (전체면 아무것도 안 그린다) */}
      <ScanRegionOverlay mode={scanRegionMode} custom={scanRegionCustom} onRegionChange={setScanRegion} rememberAreaSize />

      <View style={styles.overlay} pointerEvents="box-none">
        {/* 현재 그룹 표시 (클릭 가능) - 글래스모피즘 효과 */}
        <TouchableOpacity
          style={[styles.groupBadge, { top: topOffset }]}
          onPress={() => setGroupModalVisible(true)}
          activeOpacity={0.8}
        >
          <BlurView intensity={40} tint="dark" style={styles.groupBadgeBlur}>
            <Ionicons name="folder-outline" size={17} color={SCAN_THEME.white} />
            <Text style={[styles.groupBadgeText, { color: SCAN_THEME.white }]}>
              {currentGroupId === 'default' ? t('groupEdit.defaultGroup') :
               currentGroupId === 'lottery-lotto' ? t('lotteryScan.lotteryTypes.lotto645') :
               currentGroupId === 'lottery-pension' ? t('lotteryScan.lotteryTypes.pension720') : currentGroupName}
            </Text>
            <Ionicons name="chevron-down" size={16} color={SCAN_THEME.whiteDim} style={{ marginLeft: 4 }} />
          </BlurView>
        </TouchableOpacity>

        {/* 상태 배지 스택: 위치를 +40씩 손으로 계산하면 연속 스캔 카운터와 겹쳤다 */}
        <View style={[styles.statusBadgeStack, { top: batchBadgeTop }]} pointerEvents="box-none">
          {/* 수량 누적 모드 표시 (같은 코드 → 수량 +1이라 모르고 쓰면 헷갈린다) */}
          {quantityMode && (
            <View style={[styles.batchModeBadge, styles.stackedBadge]}>
              <Ionicons name="add-circle" size={16} color={SCAN_THEME.primary} />
              <Text style={styles.batchModeBadgeText} maxFontSizeMultiplier={1.3}>{t('quantity.mode')}</Text>
            </View>
          )}

          {/* 진행 중인 재고 실사. 탭하면 실사 화면 */}
          {stocktakeBadge && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/stocktake-detail', params: { id: stocktakeBadge.id } })}
              style={[styles.batchModeBadge, styles.stackedBadge]}
              accessibilityRole="button"
            >
              <Ionicons name="clipboard" size={16} color={SCAN_THEME.primary} />
              <Text style={styles.batchModeBadgeText} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {t('stocktake.badge', { name: stocktakeBadge.name, done: stocktakeBadge.done, total: stocktakeBadge.total })}
                {stocktakeBadge.extra ? ` · ${t('stocktake.badgeExtra', { count: stocktakeBadge.extra })}` : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* 규칙으로 지정된 현재 위치. 탭하면 해제 */}
          {currentLocation && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => clearLocation(true)}
              style={[styles.batchModeBadge, styles.stackedBadge]}
              accessibilityRole="button"
              accessibilityHint={t('scanner.locationClearHint')}
            >
              <Ionicons name="location" size={16} color={SCAN_THEME.primary} />
              <Text style={styles.batchModeBadgeText} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {t('scanner.locationBadge', { code: currentLocation.code })}
              </Text>
              <Ionicons name="close" size={14} color="#fff" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}

          {/* 배치 모드 활성 표시 (연속 스캔이면 카운터를 같이 보여준다) */}
          {batchScanEnabled && (
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={showContinuousCounter ? resetContinuousCounter : undefined}
              disabled={!showContinuousCounter}
              style={[styles.batchModeBadge, styles.stackedBadge]}
              accessibilityRole={showContinuousCounter ? 'button' : 'text'}
              accessibilityHint={showContinuousCounter ? t('scanner.counterResetHint') : undefined}
            >
              <Ionicons name="layers" size={16} color={SCAN_THEME.success} />
              <Text style={styles.batchModeBadgeText} maxFontSizeMultiplier={1.3}>
                {t('scanner.batchModeActive')}
                {showContinuousCounter ? ` · ${t('scanner.scannedCount').replace('{count}', continuousScanCount.toString())}` : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* 실시간 서버 전송 표시 */}
          {realtimeSyncEnabled && activeSessionId && (
            <View style={[styles.realtimeSyncBadge, styles.stackedBadge]}>
              <Ionicons name="cloud-upload" size={16} color={SCAN_THEME.primary} />
              <Text style={styles.realtimeSyncBadgeText} maxFontSizeMultiplier={1.3}>{t('scanner.realtimeSync')}</Text>
            </View>
          )}

          {/* 스캔 연동 URL 표시 */}
          {scanUrlEnabled && (
            <View style={[styles.scanUrlBadge, styles.stackedBadge]}>
              <Ionicons name="link" size={16} color="#fff" />
              <Text style={styles.scanUrlBadgeText} maxFontSizeMultiplier={1.3}>{t('settings.useScanUrl')}</Text>
            </View>
          )}
        </View>

        {/* 전송 메시지 (배치 + 실시간 전송 모드) */}
        {showSendMessage && (
          <View style={styles.sendMessageBadge}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.sendMessageText}>{t('scanner.sending')}</Text>
          </View>
        )}

        {/* URL 전송 메시지 */}
        {showUrlSendMessage && (
          <View style={[styles.sendMessageBadge, { backgroundColor: 'rgba(46, 125, 50, 0.95)' }]}>
            <Ionicons name="link" size={20} color="#fff" />
            <Text style={styles.sendMessageText}>{t('scanner.urlSending')}</Text>
          </View>
        )}

        {/* 조준 코너: 대기 땐 가운데(영역이 있으면 영역 모서리), 코드가 잡히면 코드 테두리로 */}
        <ScanReticle ref={reticleRef} isActive={isActive} region={scanRegion} target={multiCodeModeEnabled ? null : primaryHighlight} />
      </View>

      {/* 배치 스캔 컨트롤 패널 */}
      {batchScanEnabled && batchScannedItems.length > 0 && (
        <BatchScanControls
          scannedCount={batchScannedItems.length}
          showScanCounter={showScanCounter}
          onClear={handleClearBatch}
          onFinish={handleFinishBatch}
          isFinishing={isFinishingBatch}
          style={{ bottom: bottomOffset }}
        />
      )}

      {/* 연속 스캔 카운터 배지 (배치 모드면 위 배치 배지에 합쳐 보여준다). 길게 누르면 초기화 */}
      {showContinuousCounter && !batchScanEnabled && (
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={resetContinuousCounter}
          style={[styles.continuousCounterBadge, { top: batchBadgeTop }]}
          accessibilityRole="button"
          accessibilityHint={t('scanner.counterResetHint')}
        >
          <Ionicons name="checkmark-circle" size={18} color="#34C759" />
          <Text style={styles.continuousCounterText} maxFontSizeMultiplier={1.3}>
            {t('scanner.scannedCount').replace('{count}', continuousScanCount.toString())}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={toggleTorch}
        activeOpacity={0.8}
        accessibilityLabel={torchOn ? t('scanner.torchOn') : t('scanner.torchOff')}
        accessibilityRole="button"
        style={[styles.torchButtonContainer, { top: topOffset }]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={[styles.torchButton, torchOn && styles.torchButtonActive]}
        >
          <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={20} color={torchOn ? '#111' : SCAN_THEME.white} />
        </BlurView>
      </TouchableOpacity>


      {/* 이미지 업로드 버튼 */}
      <TouchableOpacity
        onPress={handlePickImage}
        activeOpacity={0.8}
        accessibilityLabel={t('scanner.uploadImage')}
        accessibilityRole="button"
        style={[styles.imagePickerButtonContainer, { top: topOffset }]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={styles.imagePickerButton}
        >
          <Ionicons name="images-outline" size={20} color={SCAN_THEME.white} />
        </BlurView>
      </TouchableOpacity>

      {/* NFC 읽기 (iOS는 버튼으로 시스템 시트를 연다. Android는 스캐너가 떠 있는 동안 자동으로 듣는다) */}
      {Platform.OS === 'ios' && nfcEnabled && nfcSupported && (
        <TouchableOpacity
          onPress={handleReadNfc}
          activeOpacity={0.8}
          accessibilityLabel={t('nfc.read')}
          accessibilityRole="button"
          style={[styles.imagePickerButtonContainer, { top: topOffset + 56 }]}
        >
          <BlurView intensity={40} tint="dark" style={styles.imagePickerButton}>
            <MaterialCommunityIcons name="nfc" size={20} color={SCAN_THEME.white} />
          </BlurView>
        </TouchableOpacity>
      )}

      {/* 조준 안내 + 모드 알약 (아래 카드·버튼이 떠 있으면 숨긴다) */}
      {isActive && !lastScannedCode && !pendingMultiScanData && !(batchScanEnabled && batchScannedItems.length > 0)
        && !(realtimeSyncEnabled && !activeSessionId) && !(scanConfirmMode === 'manual' && pendingScan) && (
        <View style={[styles.modeArea, { bottom: tabBarOverlap + 20 }]} pointerEvents="box-none">
          <Text style={styles.aimHint} maxFontSizeMultiplier={1.3}>{t('scanner.aimHint')}</Text>
          <View style={styles.modePill} accessibilityRole="radiogroup">
            {[
              { id: 'single', label: t('scanner.modeSingle') },
              { id: 'multi', label: t('scanner.modeMulti') },
              { id: 'continuous', label: t('scanner.modeContinuous') },
            ].map((m) => {
              const on = currentScanMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setScanMode(m.id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={[styles.modeOption, on && styles.modeOptionOn]}
                >
                  <Text style={[styles.modeOptionText, on && styles.modeOptionTextOn]} maxFontSizeMultiplier={1.3}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 실시간 서버 전송 안내 메시지 - 글래스모피즘 효과 */}
      {realtimeSyncEnabled && !activeSessionId && (
        <View style={[styles.realtimeSyncGuide, { bottom: bottomOffset + 20 }]}>
          <BlurView intensity={80} tint="light" style={styles.realtimeSyncGuideBlur}>
            <Ionicons name="information-circle" size={20} color="rgba(255, 130, 130, 0.95)" />
            <Text style={[styles.realtimeSyncGuideText, { color: 'rgba(255,255,255,0.95)' }]}>
              {t('scanner.realtimeSyncGuide') || '실시간 서버 전송이 켜져 있습니다.\n저장할 서버 전송 그룹을 상단에서 선택해주세요.'}
            </Text>
          </BlurView>
        </View>
      )}

      {/* 그룹 선택 모달 - 글래스모피즘 효과 */}
      <Modal
        visible={groupModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGroupModalVisible(false)}
        >
          {/* Android에서 Modal은 별도 창이라 BlurView가 뒤를 흐리지 못하고 반투명만 돼서 카메라 위 선이 비쳤다 → 불투명 카드 */}
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.modalContentBlur, Platform.OS === 'android' && { backgroundColor: colors.surface, borderRadius: 28 }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="folder" size={24} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('groupEdit.selectGroup')}</Text>
              <TouchableOpacity
                onPress={() => setGroupModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.groupList}>
              {displayGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupItem,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)' },
                    currentGroupId === group.id && [styles.groupItemActive, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.1)' }]
                  ]}
                  onPress={() => handleSelectGroup(group.id, group.name, group.isCloudSync, group.isScanUrlGroup, group.scanUrlId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupItemContent}>
                    {group.isCloudSync && (
                      <Ionicons name="cloud" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                    )}
                    {group.isScanUrlGroup && (
                      <Ionicons name="link" size={18} color={colors.success} style={{ marginRight: 8 }} />
                    )}
                    <Text style={[
                      styles.groupItemText,
                      { color: colors.text },
                      currentGroupId === group.id && { color: colors.primary }
                    ]}>
                      {group.id === 'default' ? t('groupEdit.defaultGroup') :
                       group.id === 'lottery-lotto' ? t('lotteryScan.lotteryTypes.lotto645') :
                       group.id === 'lottery-pension' ? t('lotteryScan.lotteryTypes.pension720') : group.name}
                    </Text>
                  </View>
                  {currentGroupId === group.id && (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </TouchableOpacity>
      </Modal>

      {/* 새 라벨 패턴 → 카테고리 만들기 (자동열기 OFF 모드) */}
      <NewLabelPatternModal
        visible={!!newPatternPrompt}
        pattern={newPatternPrompt}
        categories={labelCategories}
        onCreate={handleCreateCategory}
        onSkip={() => setNewPatternPrompt(null)}
        onNeverAsk={handleNeverAskPattern}
      />

      {/* 복권 인식 활성화 유도 모달 */}
      <Modal
        visible={lotteryPromptVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeLotteryPrompt}
      >
        <View style={styles.lotteryPromptOverlay}>
          <View style={[styles.lotteryPromptContent, { backgroundColor: colors.surface }]}>
            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.lotteryPromptCloseButton}
              onPress={closeLotteryPrompt}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* 아이콘 */}
            <View style={[styles.lotteryPromptIconContainer, { backgroundColor: '#f39c1220' }]}>
              <Ionicons name="ticket" size={40} color="#f39c12" />
            </View>

            {/* 메시지 */}
            <Text style={[styles.lotteryPromptTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('scanner.lotteryPromptTitle')}
            </Text>
            <Text style={[styles.lotteryPromptMessage, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('scanner.lotteryPromptMessage')}
            </Text>

            {/* 버튼들 */}
            <View style={styles.lotteryPromptButtons}>
              <TouchableOpacity
                style={[styles.lotteryPromptButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  // 복권 인식 활성화
                  setLotteryScanEnabled(true);
                  lotteryScanEnabledRef.current = true;
                  await AsyncStorage.setItem('lotteryScanEnabled', 'true');
                  // 다른 고급 스캔 기능 비활성화 (상호 배타적)
                  await AsyncStorage.setItem('continuousScanEnabled', 'false');
                  await AsyncStorage.setItem('batchScanEnabled', 'false');
                  await AsyncStorage.setItem('multiCodeModeEnabled', 'false');
                  await SecureStore.setItemAsync('scanLinkEnabled', 'false');
                  await AsyncStorage.setItem('realtimeSyncEnabled', 'false');
                  // 마지막 스캔 기억을 지우고 스캔을 다시 켜면, 카메라를 대고 있는 그대로 바로 복권 처리가 이어진다
                  lastScannedData.current = null;
                  lastScannedTime.current = 0;
                  closeLotteryPrompt();
                  feedback.success(t('scanner.lotteryActivatedMessage'));
                }}
              >
                <Text style={[styles.lotteryPromptButtonText, { color: '#fff', fontFamily: fonts.semiBold }]}>
                  {t('scanner.lotteryPromptActivate')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.lotteryPromptButton, { backgroundColor: colors.inputBackground }]}
                onPress={async () => {
                  // 다시 묻지 않기 저장
                  setDontAskLotteryPrompt(true);
                  await AsyncStorage.setItem('dontAskLotteryPrompt', 'true');
                  closeLotteryPrompt();
                }}
              >
                <Text style={[styles.lotteryPromptButtonText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                  {t('scanner.lotteryPromptDontAsk')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 복권 그룹에서 일반 QR/바코드 스캔 시 그룹 선택 모달 */}
      <Modal
        visible={groupSelectForNonLotteryVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setGroupSelectForNonLotteryVisible(false);
          setPendingNonLotteryData(null);
          isProcessingRef.current = false;
          setCanScan(true);
        }}
      >
        <View style={styles.lotteryPromptOverlay}>
          <View style={[styles.lotteryPromptContent, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.lotteryPromptCloseButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                setGroupSelectForNonLotteryVisible(false);
                setPendingNonLotteryData(null);
                isProcessingRef.current = false;
                setCanScan(true);
              }}
            >
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* 아이콘 */}
            <View style={[styles.lotteryPromptIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="folder-open" size={40} color={colors.primary} />
            </View>

            {/* 메시지 */}
            <Text style={[styles.lotteryPromptTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('scanner.lotteryGroupTitle')}
            </Text>
            <Text style={[styles.lotteryPromptMessage, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('scanner.lotteryGroupMessage')}
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
                  // 현재 그룹에 계속 저장 설정
                  setKeepSavingToLotteryGroup(true);
                  setGroupSelectForNonLotteryVisible(false);

                  // 대기 중인 코드 저장
                  if (pendingNonLotteryData) {
                    const { data, type, ecLevel } = pendingNonLotteryData;
                    const meta = buildScanMeta(data, type);
                    await saveHistory(data, null, null, type, ecLevel, meta.decision.targetGroupId, meta.extra);

                    // 결과 화면으로 이동 (팝업 모드인 경우)
                    if (scanResultModeRef.current === 'popup' && resultWindowAutoOpenRef.current) {
                      router.push({
                        pathname: '/result',
                        params: { code: data, groupId: currentGroupIdRef.current },
                      });
                    }
                  }

                  setPendingNonLotteryData(null);
                  safeTimeout(() => {
                    isProcessingRef.current = false;
                    setCanScan(true);
                  }, 300);
                }}
              >
                <View style={styles.groupSelectItemContent}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  <View style={styles.groupSelectItemTextContainer}>
                    <Text style={[styles.groupSelectItemText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                      {t('scanner.keepLotteryGroup')}
                    </Text>
                    <Text style={[styles.groupSelectItemSubtext, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                      {t('scanner.keepLotteryGroupDesc')}
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
                      if (pendingNonLotteryData) {
                        const { data, type, ecLevel } = pendingNonLotteryData;
                        const meta = buildScanMeta(data, type);
                        await saveHistory(data, null, null, type, ecLevel, group.id, meta.extra);

                        // 결과 화면으로 이동 (팝업 모드인 경우)
                        if (scanResultModeRef.current === 'popup' && resultWindowAutoOpenRef.current) {
                          router.push({
                            pathname: '/result',
                            params: { code: data, groupId: currentGroupIdRef.current },
                          });
                        }
                      }

                      setPendingNonLotteryData(null);
                      safeTimeout(() => {
                        isProcessingRef.current = false;
                        setCanScan(true);
                      }, 300);
                    }}
                  >
                    <View style={styles.groupSelectItemContent}>
                      <Ionicons
                        name={group.icon || 'folder'}
                        size={24}
                        color={group.color || colors.textSecondary}
                      />
                      <Text style={[styles.groupSelectItemText, { color: colors.text, fontFamily: fonts.medium, marginLeft: 12 }]}>
                        {group.id === 'default' ? t('groupEdit.defaultGroup') : group.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 토스트 결과 표시 (연속 스캔 모드) */}
      <ScanToast
        visible={!!toastData}
        data={toastData}
        onPress={handleToastPress}
        onClose={handleToastClose}
        bottomOffset={bottomOffset + 50}
        showScanCounter={showScanCounter}
      />

      {/* 중복 확인 토스트 (연속 스캔 모드 - 알림 후 추가) */}
      <DuplicateConfirmToast
        visible={!!confirmToastData}
        data={confirmToastData}
        onAdd={handleConfirmAdd}
        onSkip={handleConfirmSkip}
        bottomOffset={bottomOffset + 50}
      />

      {/* 다중 바코드 감지 시 결과 보기 버튼 */}
      {multiCodeModeEnabled && pendingMultiScanData && (() => {
        // 유효한 코드만 필터링하여 개수 계산 (결과 페이지와 동일한 필터링)
        const parsedBarcodes = JSON.parse(pendingMultiScanData.barcodes || '[]');
        const validCount = parsedBarcodes.filter(code => {
          if (!code.value) return false;
          const value = String(code.value).trim();
          return value.length > 0 && value !== 'null' && value !== 'undefined';
        }).length;
        if (validCount === 0) return null;
        return (
        <View style={[styles.multiScanButtonContainer, { bottom: floatingButtonBottom }]}>
          <TouchableOpacity
            style={styles.multiScanButton}
            onPress={handleViewMultiResults}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code" size={20} color="#fff" />
            <Text style={styles.multiScanButtonText}>
              {t('scanner.viewMultiResults').replace('{count}', validCount.toString())}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.multiScanCloseButton}
            onPress={handleCloseMultiScan}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('scanner.clearMultiList')}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        );
      })()}

      {/* 수동 확정: 코드를 들고 있다가 키/버튼으로 저장 (결과 카드가 떠 있으면 그 위에) */}
      {scanConfirmMode === 'manual' && pendingScan && (
        <View style={[styles.resultWindowButtonContainer, { bottom: floatingButtonBottom + ((lastScannedCode && !resultWindowAutoOpen) ? 150 : 0) }]}>
          <BlurView intensity={50} tint="dark" style={styles.resultWindowButtonBlur}>
            <View style={styles.scannedCodeInfo}>
              <Text style={[styles.scannedCodeLabel, { color: SCAN_TEXT.secondary }]}>{confirmHintText}</Text>
              <Text style={[styles.scannedCodeValue, { color: SCAN_TEXT.primary }]} numberOfLines={1} ellipsizeMode="middle">{pendingScan.code}</Text>
            </View>
            <View style={styles.resultWindowButtonRow}>
              <TouchableOpacity
                style={styles.resultWindowButton}
                onPress={commitPendingScan}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('scanConfirm.confirmButton')}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.resultWindowButtonText}>{t('scanConfirm.confirmButton')}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}

      {/* 결과창 자동 열림 비활성화 시 결과 보기 버튼 - 글래스모피즘 효과 */}
      {lastScannedCode && !resultWindowAutoOpen && (
        <View style={[styles.resultWindowButtonContainer, { bottom: floatingButtonBottom }]}>
          {/* tint와 글자색을 같은 테마로 맞춘다. light 고정이면 다크모드에서 밝은 블러 위에 흰 글씨가 됐다 */}
          <BlurView intensity={50} tint="dark" style={styles.resultWindowButtonBlur}>
            <View style={styles.scannedCodeInfo}>
              <Text style={[styles.scannedCodeLabel, { color: lastScannedCode.isDuplicate && !lastScannedCode.quantity ? SCAN_THEME.warning : SCAN_TEXT.secondary }]}>
                {lastScannedCode.quantity
                  ? t('scanner.quantityNow', { count: lastScannedCode.quantity })
                  : lastScannedCode.isDuplicate
                  ? t('scanner.alreadyScannedCount', { count: lastScannedCode.scanCount })
                  : t('resultWindowSettings.scannedCode')}
              </Text>
              {/* 창고 라벨은 뒷자리로 구분하는 경우가 많아 가운데를 줄인다 */}
              <Text style={[styles.scannedCodeValue, { color: SCAN_TEXT.primary }]} numberOfLines={1} ellipsizeMode="middle">{lastScannedCode.code}</Text>
              {(() => {
                const label = labelOfItem(lastScannedCode, labelCategories);
                const summary = label ? formatLabelSummary(label, 3, t) : formatGs1Summary(parseGs1(lastScannedCode.code), t);
                return summary ? (
                  <Text style={[styles.scannedCodeLabel, { color: SCAN_TEXT.tertiary, marginTop: 2 }]} numberOfLines={1} ellipsizeMode="middle">{summary}</Text>
                ) : null;
              })()}
            </View>
            <View style={styles.resultWindowButtonRow}>
              <TouchableOpacity
                style={styles.resultWindowButton}
                onPress={handleOpenResultWindow}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.resultWindowButtonText}>
                  {t('resultWindowSettings.openResultButton')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resultWindowCloseButton}
                onPress={handleCloseResultWindow}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}

      {/* 이미지 분석 화면 전환 로딩 오버레이 */}
      {isImageLoading && (
        <View style={styles.imageLoadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.imageLoadingText}>{t('imageAnalysis.loadingImage') || '이미지 로딩 중...'}</Text>
        </View>
      )}

      {/* 하단 배너 광고 - 탭바 바로 위 */}
      <AdBanner
        wrapperStyle={{
          position: 'absolute',
          bottom: toastBottom,
          left: 0,
          right: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  imageLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  groupBadge: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정. 왼쪽 위(오른쪽은 사진·플래시 버튼)
    left: 16,
    maxWidth: '55%',
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
    backgroundColor: SCAN_THEME.glassDark,
  },
  groupBadgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
  },
  groupBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  statusBadgeStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  // 스택 안에서는 절대 위치를 풀어 세로로 쌓는다
  stackedBadge: {
    position: 'relative',
  },
  batchModeBadge: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  batchModeBadgeText: {
    color: SCAN_THEME.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  continuousCounterBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  continuousCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  realtimeSyncBadge: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  realtimeSyncBadgeText: {
    color: SCAN_THEME.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  realtimeSyncGuide: {
    position: 'absolute',
    left: 20,
    right: 20,
    // bottom은 인라인 스타일로 동적 설정
    overflow: 'hidden',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  realtimeSyncGuideBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  realtimeSyncGuideContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 111, 235, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  realtimeSyncGuideText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  scanUrlBadge: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scanUrlBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  sendMessageBadge: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 111, 235, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  sendMessageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  title: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 50,
    textAlign: 'center',
  },
  frame: {
    borderWidth: 3,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
  },
  torchButtonContainer: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정
    right: 16,
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
  },
  torchButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  modeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  aimHint: {
    color: SCAN_TEXT.primary,
    fontSize: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modePill: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 22,
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
  },
  modeOption: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
  },
  modeOptionOn: {
    backgroundColor: '#F2F4F7',
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: SCAN_TEXT.secondary,
  },
  modeOptionTextOn: {
    fontWeight: '600',
    color: '#0B0D10',
  },
  imagePickerButtonContainer: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정. 플래시(오른쪽 끝) 왼쪽
    right: 16 + 44 + 8,
  },
  imagePickerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
  },
  msg: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 18,
    backgroundColor: '#000',
    color: '#fff',
    padding: 20,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionMsg: {
    textAlign: 'center',
    fontSize: 17,
    color: '#fff',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    minWidth: 200,
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2F6FEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  permissionButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalContentBlur: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginLeft: 12,
  },
  modalCloseButton: {
    padding: 4,
  },
  groupList: {
    padding: 12,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F2F2F7',
  },
  groupItemActive: {
    backgroundColor: '#2F6FEB15',
    borderWidth: 2,
    borderColor: '#2F6FEB',
  },
  groupItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  groupItemTextActive: {
    color: '#2F6FEB',
  },
  multiScanButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiScanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SCAN_THEME.primary,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  multiScanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  multiScanCloseButton: {
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // 결과창 자동 열림 비활성화 시 버튼 스타일
  resultWindowButtonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    overflow: 'hidden',
    borderRadius: SCAN_THEME.cardRadius,
    backgroundColor: SCAN_THEME.glassDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SCAN_THEME.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  resultWindowButtonBlur: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scannedCodeInfo: {
    marginBottom: 12,
  },
  scannedCodeLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  scannedCodeValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  resultWindowButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultWindowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SCAN_THEME.primary,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  resultWindowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultWindowCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
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
  // 복권 그룹에서 일반 QR 스캔 시 그룹 선택 모달 스타일
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

export default ScannerScreen;
