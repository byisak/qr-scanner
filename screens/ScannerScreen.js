// screens/ScannerScreen.js - Expo Router 버전 (Vision Camera 적용)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
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
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
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
import * as ImagePicker from 'expo-image-picker';

// 복권 유틸리티
import { isLotteryQR, parseLotteryQR, LOTTERY_GROUPS } from '../utils/lotteryParser';
import { updateLotteryNotificationOnScan } from '../utils/lotteryNotification';

// 분리된 컴포넌트
import ScanAnimation from '../components/ScanAnimation'; // 플러스 표시만 활성화
import BatchScanControls from '../components/BatchScanControls';
import ScanToast from '../components/ScanToast';
import DuplicateConfirmToast from '../components/DuplicateConfirmToast';
import AdBanner from '../components/AdBanner';

function ScannerScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { triggerSync } = useSync();
  const { user } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();


  // iOS는 기존 값 유지, Android는 SafeArea insets 사용
  const topOffset = Platform.OS === 'ios' ? 60 : insets.top + 10;
  const batchBadgeTop = Platform.OS === 'ios' ? 105 : insets.top + 55;
  const bottomOffset = Platform.OS === 'ios' ? 200 : insets.bottom + 130;

  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [canScan, setCanScan] = useState(true); // 스캔 허용 여부 (카메라는 계속 활성)
  const [hapticEnabled, setHapticEnabled] = useState(true); // 햅틱 피드백 활성화 여부
  const [scanSoundEnabled, setScanSoundEnabled] = useState(true); // 스캔 소리 활성화 여부
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(true); // 사진 저장 활성화 여부 (기본값: 켬)
  const [batchScanEnabled, setBatchScanEnabled] = useState(false); // 배치 스캔 모드 활성화 여부
  const [batchScannedItems, setBatchScannedItems] = useState([]); // 배치로 스캔된 항목들
  const [showScanCounter, setShowScanCounter] = useState(true); // 스캔 카운터 표시 여부
  const [duplicateDetection, setDuplicateDetection] = useState(true); // 중복 감지 활성화 여부
  const [duplicateAction, setDuplicateAction] = useState('alert'); // 중복 처리 방식: 'alert', 'skip', 'allow'
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false); // 사진 촬영 중 여부
  const [cameraFacing, setCameraFacing] = useState('back'); // 카메라 방향 (back/front)
  const [currentGroupName, setCurrentGroupName] = useState('기본 그룹'); // 현재 선택된 그룹 이름
  const [currentGroupId, setCurrentGroupId] = useState('default'); // 현재 선택된 그룹 ID
  const [groupModalVisible, setGroupModalVisible] = useState(false); // 그룹 선택 모달 표시 여부
  const [availableGroups, setAvailableGroups] = useState([{ id: 'default', name: '기본 그룹', createdAt: Date.now() }]); // 사용 가능한 그룹 목록
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

  // 실시간 서버전송 관련 상태
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [showSendMessage, setShowSendMessage] = useState(false); // "전송" 메시지 표시 여부

  // 스캔 연동 URL 관련 상태
  const [scanUrlEnabled, setScanUrlEnabled] = useState(false);
  const [activeScanUrl, setActiveScanUrl] = useState(null); // { id, name, url }
  const [showUrlSendMessage, setShowUrlSendMessage] = useState(false); // URL 전송 메시지 표시

  // 스캔 결과 표시 모드 (popup: 결과 화면, toast: 하단 토스트)
  const [scanResultMode, setScanResultMode] = useState('popup');
  const [toastData, setToastData] = useState(null); // 토스트에 표시할 스캔 데이터
  const [confirmToastData, setConfirmToastData] = useState(null); // 중복 확인 토스트 데이터
  const [continuousScanCount, setContinuousScanCount] = useState(0); // 연속 스캔 카운터
  const [pendingMultiScanData, setPendingMultiScanData] = useState(null); // 다중 바코드 감지 시 보류 데이터 { imageUri, barcodes, scannedCodes }
  const [visibleHighlightsCount, setVisibleHighlightsCount] = useState(0); // 화면에 표시되는 하이라이트 개수
  const [multiCodeModeEnabled, setMultiCodeModeEnabled] = useState(false); // 여러 코드 인식 모드
  const [showBarcodeValues, setShowBarcodeValues] = useState(true); // 바코드 값 표시 여부
  const [resultWindowAutoOpen, setResultWindowAutoOpen] = useState(true); // 결과창 자동 열림 (기본값: true)
  const [lastScannedCode, setLastScannedCode] = useState(null); // 마지막 스캔된 코드 (결과창 자동 열림 비활성화 시 사용)
  const [lotteryScanEnabled, setLotteryScanEnabled] = useState(false); // 복권 인식 활성화 여부

  const lastScannedData = useRef(null);
  const lastScannedTime = useRef(0);
  const resetTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
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
    console.log('[ScannerScreen] Syncing scanSoundEnabled state to ref:', scanSoundEnabled);
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
    console.log(`[ScannerScreen] multiCodeModeEnabled changed: ${multiCodeModeEnabled}`);
    multiCodeModeEnabledRef.current = multiCodeModeEnabled;
    // 모드 비활성화 시 스캔된 코드 초기화
    if (!multiCodeModeEnabled) {
      scannedCodesRef.current = [];
      setPendingMultiScanData(null);
    }
  }, [multiCodeModeEnabled]);

  // resultWindowAutoOpen 상태를 ref에 동기화
  useEffect(() => {
    console.log(`[ScannerScreen] resultWindowAutoOpen changed: ${resultWindowAutoOpen}`);
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
    setToastData({ ...toastInfo, timestamp: Date.now() });
  }, []);

  // 토스트 클릭 시 결과 화면으로 이동
  const handleToastPress = useCallback(() => {
    if (toastData) {
      router.push({
        pathname: '/result',
        params: {
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

  useEffect(() => {
    (async () => {
      try {
        // Vision Camera 권한 요청
        const status = await Camera.requestCameraPermission();
        setHasPermission(status === 'granted');

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
        console.log('[ScannerScreen] Initial load - scanSoundEnabled from storage:', scanSound);
        if (scanSound !== null) {
          const enabled = scanSound === 'true';
          console.log('[ScannerScreen] Initial load - setting scanSoundEnabled to:', enabled);
          setScanSoundEnabled(enabled);
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
        console.error('Camera permission error:', error);
        setHasPermission(false);
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
      isNavigatingRef.current = false; // 네비게이션 플래그 리셋
      isProcessingRef.current = false; // 처리 중 플래그 리셋
      isProcessingMultiRef.current = false; // 다중 바코드 처리 플래그 리셋
      scannedCodesRef.current = []; // 여러 코드 인식 모드 스캔 목록 리셋
      setPendingMultiScanData(null); // 다중 바코드 보류 데이터 리셋
      setContinuousScanCount(0); // 연속 스캔 카운터 리셋
      resetAll();

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
          console.log('[ScannerScreen] Loaded scanSoundEnabled from storage:', scanSound);
          if (scanSound !== null) {
            const enabled = scanSound === 'true';
            console.log('[ScannerScreen] Setting scanSoundEnabled to:', enabled);
            setScanSoundEnabled(enabled);
          }

          const photoSave = await AsyncStorage.getItem('photoSaveEnabled');
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

          // 스캔 결과 표시 모드 로드
          const resultMode = await AsyncStorage.getItem('scanResultMode');
          if (resultMode) {
            setScanResultMode(resultMode);
          }

          // 여러 코드 인식 모드 로드
          const multiCodeMode = await AsyncStorage.getItem('multiCodeModeEnabled');
          console.log(`[ScannerScreen] Loaded multiCodeModeEnabled from storage: "${multiCodeMode}" -> ${multiCodeMode === 'true'}`);
          setMultiCodeModeEnabled(multiCodeMode === 'true');

          // 바코드 값 표시 설정 로드
          const showValues = await AsyncStorage.getItem('multiCodeShowValues');
          setShowBarcodeValues(showValues === null ? true : showValues === 'true');

          // 결과창 자동 열림 설정 로드
          const autoOpen = await AsyncStorage.getItem('resultWindowAutoOpen');
          setResultWindowAutoOpen(autoOpen === null ? true : autoOpen === 'true');

          // 복권 인식 활성화 설정 로드
          const lotteryScan = await AsyncStorage.getItem('lotteryScanEnabled');
          setLotteryScanEnabled(lotteryScan === 'true');

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
            const groupsData2 = await AsyncStorage.getItem('scanGroups');
            if (groupsData2) {
              const groups2 = JSON.parse(groupsData2);
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
        console.log('[ScannerScreen] === CLEANUP START ===');

        // 먼저 콜백 차단 (새로운 스캔 결과 무시)
        isNavigatingRef.current = true;
        isProcessingRef.current = true; // 처리 중 플래그도 설정하여 완전 차단
        isCapturingPhotoRef.current = false;
        console.log('[ScannerScreen] Callbacks blocked');

        clearAllTimers();
        console.log('[ScannerScreen] Timers cleared');

        // 카메라 비활성화를 지연시켜 탭 전환 애니메이션이 먼저 실행되도록 함
        // setTimeout을 사용하여 다음 프레임에서 카메라 중지
        // ref에 저장하여 빠른 탭 전환 시 취소할 수 있도록 함
        console.log('[ScannerScreen] Scheduling camera deactivation...');
        cleanupTimeoutRef.current = setTimeout(() => {
          console.log('[ScannerScreen] Deactivating camera NOW');
          setIsActive(false);
          cleanupTimeoutRef.current = null;
          console.log('[ScannerScreen] Camera deactivated');
        }, 50);

        console.log('[ScannerScreen] === CLEANUP END ===');
      };
    }, [resetAll, clearAllTimers]),
  );

  // 히스토리에서 중복 여부만 확인 (저장하지 않음)
  const checkDuplicateInHistory = useCallback(async (code) => {
    try {
      const selectedGroupId = currentGroupId || 'default';
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      const historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };
      const currentHistory = historyByGroup[selectedGroupId] || [];

      const existingItem = currentHistory.find(item => item.code === code);
      return {
        isDuplicate: !!existingItem,
        existingCount: existingItem?.count || 0,
      };
    } catch (e) {
      console.error('Check duplicate error:', e);
      return { isDuplicate: false, existingCount: 0 };
    }
  }, [currentGroupId]);

  const saveHistory = useCallback(async (code, url = null, photoUri = null, barcodeType = 'qr', ecLevel = null, targetGroupId = null) => {
    try {
      // targetGroupId가 있으면 해당 그룹에, 없으면 현재 선택된 그룹에 저장
      let selectedGroupId = targetGroupId || currentGroupId;

      // 그룹별 히스토리 가져오기
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : { default: [] };

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

        const updatedItem = {
          ...existingItem,
          timestamp: now, // 최신 스캔 시간으로 업데이트
          count: (existingItem.count || 1) + 1, // 스캔 횟수 증가
          scanTimes: scanTimes, // 모든 스캔 시간 저장
          photos: photos, // 모든 사진 저장
          ...(url && { url }), // URL이 있으면 업데이트
          type: barcodeType, // 바코드 타입
          ...(ecLevel && { errorCorrectionLevel: ecLevel }), // QR 오류 검증 레벨
        };

        // 기존 항목 제거하고 맨 앞에 추가 (최신순으로)
        currentHistory.splice(existingIndex, 1);
        historyByGroup[selectedGroupId] = [updatedItem, ...currentHistory].slice(0, 1000);
      } else {
        // 새로운 스캔
        const record = {
          code,
          timestamp: now,
          count: 1,
          scanTimes: [now], // 첫 스캔 시간을 배열로 저장
          photos: photoUri ? [photoUri] : [], // 사진 배열
          ...(url && { url }),
          type: barcodeType, // 바코드 타입
          ...(ecLevel && { errorCorrectionLevel: ecLevel }), // QR 오류 검증 레벨
        };
        historyByGroup[selectedGroupId] = [record, ...currentHistory].slice(0, 1000);
      }

      // 저장
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
      triggerSync();

      // 중복 여부 반환 (ResultScreen에서 사용)
      return { isDuplicate, count: isDuplicate ? historyByGroup[selectedGroupId][0].count : 1, errorCorrectionLevel: ecLevel };
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
          setTimeout(() => setShowSendMessage(false), 1000);
        }
      }

      saveHistory(data, null, null, type, errorCorrectionLevel).then((historyResult) => {
        showToast({
          data,
          type,
          historyId: historyResult.id,
          isDuplicate: true,
          scanCount: historyResult.count,
          errorCorrectionLevel,
        });
      });
    }
    setConfirmToastData(null);
    setCanScan(true);
  }, [confirmToastData, saveHistory, showToast, realtimeSyncEnabled, activeSessionId]);

  // 중복 확인 토스트 - 건너뛰기 버튼
  const handleConfirmSkip = useCallback(() => {
    if (confirmToastData) {
      const { data, type, scanCount, errorCorrectionLevel } = confirmToastData;
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
  const updateHistoryWithPhoto = useCallback(async (code, photoUri) => {
    if (!photoUri) return;

    try {
      const selectedGroupId = currentGroupId || 'default';
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      const historyByGroup = historyData ? JSON.parse(historyData) : {};
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
          await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
          triggerSync();
          console.log('[updateHistoryWithPhoto] Photo added to history:', photoUri);
        }
      }
    } catch (e) {
      console.error('Update history with photo error:', e);
    }
  }, [currentGroupId]);

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
          name: '기본 그룹',
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
              return [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }, ...prev];
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
          updated = [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }, ...updated];
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

      // 그룹별 히스토리 가져오기
      const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
      let historyByGroup = historyData ? JSON.parse(historyData) : {};

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
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));
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
  }, [ensureLotteryGroup, triggerSync]);

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

    console.log('[convertVisionCameraCoords] ========================================');
    console.log('[convertVisionCameraCoords] Input:', { x: x.toFixed(1), y: y.toFixed(1), w: width.toFixed(1), h: height.toFixed(1) });
    console.log('[convertVisionCameraCoords] Screen:', { winWidth, winHeight });
    console.log('[convertVisionCameraCoords] RawFrame:', { RAW_FRAME_W, RAW_FRAME_H });

    // 좌표가 0-1 사이면 정규화된 좌표
    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      console.log('[convertVisionCameraCoords] Normalized coords');
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
      console.log('[convertVisionCameraCoords] Swapped frame dims for portrait:', { FRAME_W, FRAME_H });
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

    console.log('[convertVisionCameraCoords] Scale:', scale.toFixed(4), 'Offset:', { x: offsetX.toFixed(1), y: offsetY.toFixed(1) });
    console.log('[convertVisionCameraCoords] Result:', { x: result.x.toFixed(1), y: result.y.toFixed(1), w: result.width.toFixed(1), h: result.height.toFixed(1) });
    return result;
  }, [winWidth, winHeight]);

  const normalizeBounds = useCallback(
    (bounds, frameDimensions = null) => {
      // bounds 형식 확인 및 로깅
      if (!bounds) {
        console.log('No bounds provided');
        return null;
      }

      console.log('[normalizeBounds] Input:', JSON.stringify(bounds));

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

      console.log('Unknown bounds format:', JSON.stringify(bounds));
      return null;
    },
    [convertVisionCameraCoords],
  );

  const startResetTimer = useCallback((delay) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      setTimeout(() => setShowSendMessage(false), 1000);
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
    setTimeout(() => {
      isProcessingRef.current = false;
      setCanScan(true);
    }, 500);
    startResetTimer(RESET_DELAYS.NORMAL);
  }, [realtimeSyncEnabled, activeSessionId, capturePhoto, startResetTimer]);

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
              setTimeout(() => setShowSendMessage(false), 1000);
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
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

      if (newCodesAdded && hapticEnabledRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      }
    });

    // 보류 데이터 및 스캔된 코드 초기화
    setPendingMultiScanData(null);
    scannedCodesRef.current = [];

    // 플래그 해제 (약간의 딜레이 후)
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 2000);
  }, [pendingMultiScanData, router]);

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
  const handleCloseMultiScan = useCallback(() => {
    setPendingMultiScanData(null);
    scannedCodesRef.current = [];
  }, []);

  const handleBarCodeScanned = useCallback(
    async (scanResult) => {
      const { data, bounds, type, cornerPoints, raw, frameDimensions, errorCorrectionLevel } = scanResult;
      // 사진 촬영 중이거나 네비게이션 중이거나 이미 처리 중이면 스캔 무시
      if (!isActive || !canScan || isCapturingPhotoRef.current || isNavigatingRef.current || isProcessingRef.current) return;

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

      // 복권 QR 코드 감지 및 처리 (설정에서 활성화된 경우에만)
      if (lotteryScanEnabledRef.current && isLotteryQR(data)) {
        const lotteryData = parseLotteryQR(data);
        if (lotteryData) {
          console.log('[ScannerScreen] Lottery QR detected:', lotteryData.typeName, lotteryData.round);

          // 스캔 즉시 차단
          isProcessingRef.current = true;
          setCanScan(false);

          // 햅틱 피드백
          if (hapticEnabledRef.current) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
                '이미 스캔된 복권',
                `${lotteryData.typeName} ${lotteryData.round}회 복권이 이미 저장되어 있습니다.\n당첨 결과를 확인하시겠습니까?`,
                [
                  {
                    text: '취소',
                    style: 'cancel',
                    onPress: () => {
                      isProcessingRef.current = false;
                      setCanScan(true);
                    },
                  },
                  {
                    text: '결과 확인',
                    onPress: () => {
                      router.push({
                        pathname: '/lottery-result',
                        params: { code: data },
                      });
                      setTimeout(() => {
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
              setTimeout(() => {
                isProcessingRef.current = false;
                setCanScan(true);
              }, 500);
            }
          } else {
            // 저장 실패
            Alert.alert('오류', '복권 정보 저장에 실패했습니다.');
            isProcessingRef.current = false;
            setCanScan(true);
          }

          return; // 복권 처리 완료, 일반 스캔 로직 스킵
        }
      }

      // 토스트 모드: 연속 스캔 - 중복 감지 설정에 따라 처리
      if (scanResultModeRef.current === 'toast') {
        // 연속 스캔 카운터 증가
        setContinuousScanCount(prev => prev + 1);

        // 실시간 서버 전송 헬퍼 함수
        const sendToRealtimeServer = () => {
          if (realtimeSyncEnabled && activeSessionId) {
            const success = websocketClient.sendScanData({
              code: data,
              timestamp: Date.now(),
            }, activeSessionId);
            if (success) {
              setShowSendMessage(true);
              setTimeout(() => setShowSendMessage(false), 1000);
            } else {
              console.warn('Failed to send scan data to server in continuous mode');
            }
          }
        };

        // EC Level 추출
        let detectedEcLevel = errorCorrectionLevel || null;

        // 중복 감지가 활성화된 경우 먼저 중복 여부 확인
        if (duplicateDetectionRef.current) {
          checkDuplicateInHistory(data).then(({ isDuplicate, existingCount }) => {
            if (isDuplicate) {
              const action = duplicateActionRef.current;

              if (action === 'skip') {
                // 자동 건너뛰기: 서버 전송 없이 토스트로 건너뛰었다고 알림
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
            sendToRealtimeServer();
            saveHistory(data, null, null, normalizedType, detectedEcLevel).then((historyResult) => {
              showToast({
                data,
                type: normalizedType,
                historyId: historyResult.id,
                isDuplicate: historyResult.isDuplicate,
                scanCount: historyResult.count,
                errorCorrectionLevel: detectedEcLevel,
              });
            });
          });
        } else {
          // 중복 감지 비활성화: 서버 전송 및 바로 저장
          sendToRealtimeServer();
          saveHistory(data, null, null, normalizedType, detectedEcLevel).then((historyResult) => {
            showToast({
              data,
              type: normalizedType,
              historyId: historyResult.id,
              isDuplicate: historyResult.isDuplicate,
              scanCount: historyResult.count,
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
      if (batchScanEnabled && duplicateDetectionRef.current) {
        const isDuplicate = batchScannedItems.some(item => item.code === data);
        if (isDuplicate) {
          const action = duplicateActionRef.current;

          if (action === 'skip') {
            // 자동으로 건너뛰기: 아무 피드백 없이 스캔만 재활성화
            setTimeout(() => {
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
                    setTimeout(() => {
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else {
          // iOS: 기존 Success notification
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }

      // 스캔 소리 설정이 활성화된 경우에만 소리 재생
      console.log('[ScannerScreen] Checking scan sound - enabled:', scanSoundEnabledRef.current, 'player exists:', !!beepSoundPlayerRef.current);
      if (scanSoundEnabledRef.current && beepSoundPlayerRef.current) {
        console.log('[ScannerScreen] Playing scan sound');
        try {
          // 처음부터 재생하도록 위치 초기화
          beepSoundPlayerRef.current.seekTo(0);
          beepSoundPlayerRef.current.play();
        } catch (error) {
          console.log('Scan sound playback error:', error);
        }
      } else {
        console.log('[ScannerScreen] Scan sound skipped');
      }

      // Android: cornerPoints를 우선 사용 (더 정확한 위치)
      // bounds가 없으면 cornerPoints에서 생성 시도
      let effectiveBounds = bounds;
      if (Platform.OS === 'android' && cornerPoints && cornerPoints.length >= 4) {
        // Android에서는 cornerPoints가 더 정확함
        console.log('[Android] Using cornerPoints for bounds');
        effectiveBounds = boundsFromCornerPoints(cornerPoints);
      } else if (!bounds && cornerPoints) {
        console.log('Creating bounds from corner points');
        effectiveBounds = boundsFromCornerPoints(cornerPoints);
      }

      // 사진 저장이 활성화되어 있으면 촬영 (중복 코드는 사진 저장 스킵)
      let photoPromise = null;
      const photoStartTime = Date.now();
      console.log('[ScannerScreen] Photo save enabled:', photoSaveEnabledRef.current);
      if (photoSaveEnabledRef.current) {
        // 히스토리에서 중복 여부 확인 - 중복이면 사진 저장 스킵 (저장 공간 절약)
        const duplicateCheck = await checkDuplicateInHistory(data);
        if (!duplicateCheck.isDuplicate) {
          console.log('[ScannerScreen] Starting photo capture at:', photoStartTime);
          photoPromise = capturePhoto().then(result => {
            console.log('[ScannerScreen] Photo capture completed in:', Date.now() - photoStartTime, 'ms');
            return result;
          }).catch(err => {
            console.log('Background photo capture error:', err);
            return null;
          });
        } else {
          console.log('[ScannerScreen] Skipping photo for duplicate code (already in history):', data);
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
            const timeoutPromise = new Promise(resolve => setTimeout(() => {
              console.log('[ScannerScreen] Photo timeout triggered after 300ms');
              resolve({ timedOut: true });
            }, 300));
            const photoResult = await Promise.race([photoPromise, timeoutPromise]);
            const waitEndTime = Date.now();

            if (photoResult?.timedOut) {
              photoTimedOut = true;
              console.log('[ScannerScreen] Photo wait timed out after:', waitEndTime - waitStartTime, 'ms');

              // 타임아웃되었지만 사진 캡처는 계속 진행 - 완료되면 히스토리에 추가
              photoPromise.then(result => {
                const uri = result?.croppedUri || result;
                if (uri) {
                  console.log('[ScannerScreen] Background photo ready, updating history:', uri);
                  updateHistoryWithPhoto(data, uri);
                }
              }).catch(err => {
                console.log('[ScannerScreen] Background photo failed:', err);
              });
            } else {
              photoUri = photoResult?.croppedUri || photoResult;
              console.log('[ScannerScreen] Photo ready in time:', waitEndTime - waitStartTime, 'ms');
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
            }]);

            // 배치 + 실시간 전송 모드: "전송" 메시지 표시
            if (realtimeSyncEnabled && activeSessionId) {
              setShowSendMessage(true);
              setTimeout(() => setShowSendMessage(false), 1000);
            }

            // 스캔 재활성화 (계속 스캔 가능)
            setTimeout(() => {
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
            setTimeout(() => {
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
            });

            // 히스토리 저장 (비동기, 기다리지 않음 - 애니메이션 블록 방지)
            saveHistory(data, null, photoUri, normalizedType, detectedEcLevel).then(historyResult => {
              // 히스토리 결과로 업데이트
              setLastScannedCode(prev => prev ? {
                ...prev,
                isDuplicate: historyResult.isDuplicate,
                scanCount: historyResult.count,
              } : null);
            }).catch(console.error);

            // 스캔 재활성화 (계속 스캔 가능) - 카메라는 활성 상태 유지
            setTimeout(() => {
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
              const url = base.includes('{code}') ? base.replace('{code}', data) : base + data;

              // 스캔 연동 URL 그룹 ID 찾기
              let scanUrlGroupId = null;
              if (activeScanUrl) {
                scanUrlGroupId = `scan-url-${activeScanUrl.id}`;
                // URL 전송 메시지 표시
                setShowUrlSendMessage(true);
                setTimeout(() => setShowUrlSendMessage(false), 1000);
              }

              // 히스토리 저장은 해당 URL 그룹에 저장
              saveHistory(data, url, photoUri, normalizedType, detectedEcLevel, scanUrlGroupId).catch(console.error);
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
                  const searchUrl = enabledSite.url.replace('{code}', data);

                  // 히스토리 저장
                  saveHistory(data, searchUrl, photoUri, normalizedType, detectedEcLevel).catch(console.error);

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
          const historyResult = await saveHistory(data, null, photoUri, normalizedType, detectedEcLevel);

          // 팝업 모드: 결과 화면으로 이동
          router.push({
            pathname: '/result',
            params: {
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
          await saveHistory(data, null, null, type, null);
          startResetTimer(RESET_DELAYS.NORMAL);
        } finally {
          navigationTimerRef.current = null;
        }
      }, 50);
    },
    [isActive, canScan, normalizeBounds, saveHistory, updateHistoryWithPhoto, router, startResetTimer, batchScanEnabled, batchScannedItems, capturePhoto, realtimeSyncEnabled, activeSessionId, winWidth, winHeight, fullScreenScanMode, scanUrlEnabled, activeScanUrl, showToast],
  );

  const toggleTorch = useCallback(() => setTorchOn((prev) => !prev), []);

  // 배치 스캔 완료 - 모든 항목을 히스토리에 저장
  const handleFinishBatch = useCallback(async () => {
    if (batchScannedItems.length === 0) return;

    try {
      // 스캔 연동 URL이 활성화되어 있으면 해당 그룹에 저장
      let targetGroupId = null;
      if (scanUrlEnabled && activeScanUrl) {
        targetGroupId = `scan-url-${activeScanUrl.id}`;
      }

      // 모든 배치 항목을 히스토리에 저장
      for (const item of batchScannedItems) {
        await saveHistory(item.code, null, item.photoUri, item.type, item.errorCorrectionLevel, targetGroupId);
      }

      // 배치 항목 초기화
      setBatchScannedItems([]);

      // 네비게이션 전 카메라 중지 (멈춤 현상 방지)
      isNavigatingRef.current = true;
      setIsActive(false);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 히스토리 화면으로 이동
      router.push('/(tabs)/history');
    } catch (error) {
      console.error('Finish batch error:', error);
    }
  }, [batchScannedItems, saveHistory, router, scanUrlEnabled, activeScanUrl]);

  // 배치 스캔 초기화
  const handleClearBatch = useCallback(() => {
    setBatchScannedItems([]);
  }, []);

  // 그룹 선택 핸들러
  const handleSelectGroup = useCallback(async (groupId, groupName, isCloudSync = false, isScanUrlGroup = false, scanUrlId = null) => {
    try {
      setCurrentGroupId(groupId);
      setCurrentGroupName(groupName);
      await AsyncStorage.setItem('selectedGroupId', groupId);
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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;

      isNavigatingRef.current = true;
      setIsActive(false);

      router.push({
        pathname: '/image-analysis',
        params: { imageUri: imageUri },
      });
    } catch (error) {
      console.error('Image picker error:', error);
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
      <View style={styles.container}>
        <Text style={styles.msg} accessibilityLabel={t('scanner.permissionRequest')}>
          {t('scanner.permissionRequest')}
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.msg} accessibilityLabel={t('scanner.permissionDenied')}>
          {t('scanner.permissionDenied')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 카메라를 항상 마운트 상태로 유지하여 언마운트 시 네이티브 블로킹 방지 */}
      {/* isActive prop으로만 카메라 활성화/비활성화 제어 */}
      <NativeQRScanner
        key={`${multiCodeModeEnabled ? 'multi' : 'single'}-${[...barcodeTypes].sort().join(',')}`}
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
        showBarcodeValues={(multiCodeModeEnabled && showBarcodeValues) || (!resultWindowAutoOpen && lastScannedCode)}
        style={StyleSheet.absoluteFillObject}
        showHighlights={true}
        highlightColor="lime"
      />

      <View style={styles.overlay} pointerEvents="box-none">
        {/* 현재 그룹 표시 (클릭 가능) - 글래스모피즘 효과 */}
        <TouchableOpacity
          style={[styles.groupBadge, { top: topOffset }]}
          onPress={() => setGroupModalVisible(true)}
          activeOpacity={0.8}
        >
          <BlurView intensity={80} tint="light" style={styles.groupBadgeBlur}>
            <Ionicons name="folder" size={16} color="rgba(255,255,255,0.95)" />
            <Text style={[styles.groupBadgeText, { color: 'rgba(255,255,255,0.95)' }]}>
              {currentGroupId === 'default' ? t('groupEdit.defaultGroup') :
               currentGroupId === 'lottery-lotto' ? '로또 6/45' :
               currentGroupId === 'lottery-pension' ? '연금복권720+' : currentGroupName}
            </Text>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.95)" style={{ marginLeft: 4 }} />
          </BlurView>
        </TouchableOpacity>

        {/* 배치 모드 활성 표시 */}
        {batchScanEnabled && (
          <View style={[styles.batchModeBadge, { top: batchBadgeTop }]}>
            <Ionicons name="layers" size={16} color="#fff" />
            <Text style={styles.batchModeBadgeText}>{t('scanner.batchModeActive')}</Text>
          </View>
        )}

        {/* 실시간 서버 전송 표시 */}
        {realtimeSyncEnabled && activeSessionId && (
          <View style={[styles.realtimeSyncBadge, { top: batchScanEnabled ? batchBadgeTop + 40 : batchBadgeTop }]}>
            <Ionicons name="cloud-upload" size={16} color="#fff" />
            <Text style={styles.realtimeSyncBadgeText}>{t('scanner.realtimeSync') || '실시간 서버 전송'}</Text>
          </View>
        )}

        {/* 스캔 연동 URL 표시 */}
        {scanUrlEnabled && (
          <View style={[styles.scanUrlBadge, {
            top: batchScanEnabled
              ? (realtimeSyncEnabled && activeSessionId ? batchBadgeTop + 80 : batchBadgeTop + 40)
              : (realtimeSyncEnabled && activeSessionId ? batchBadgeTop + 40 : batchBadgeTop)
          }]}>
            <Ionicons name="link" size={16} color="#fff" />
            <Text style={styles.scanUrlBadgeText}>{t('settings.useScanUrl')}</Text>
          </View>
        )}

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

        {/* 중앙 플러스 표시 */}
        <ScanAnimation isActive={isActive} />
      </View>

      {/* 배치 스캔 컨트롤 패널 */}
      {batchScanEnabled && batchScannedItems.length > 0 && (
        <BatchScanControls
          scannedCount={batchScannedItems.length}
          showScanCounter={showScanCounter}
          onClear={handleClearBatch}
          onFinish={handleFinishBatch}
          style={{ bottom: bottomOffset }}
        />
      )}

      {/* 연속 스캔 카운터 배지 */}
      {scanResultMode === 'toast' && showScanCounter && continuousScanCount > 0 && (
        <View style={[styles.continuousCounterBadge, { top: batchBadgeTop }]}>
          <Ionicons name="checkmark-circle" size={18} color="#34C759" />
          <Text style={styles.continuousCounterText}>
            {t('scanner.scannedCount').replace('{count}', continuousScanCount.toString())}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={toggleTorch}
        activeOpacity={0.8}
        accessibilityLabel={torchOn ? t('scanner.torchOn') : t('scanner.torchOff')}
        accessibilityRole="button"
        style={[styles.torchButtonContainer, { top: topOffset }]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint="light"
            style={[styles.torchButton, torchOn && styles.torchButtonActive]}
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={20} color={torchOn ? '#FFD60A' : 'rgba(255,255,255,0.95)'} />
          </BlurView>
        ) : (
          <View style={[styles.torchButton, styles.torchButtonAndroid, torchOn && styles.torchButtonActive]}>
            <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={20} color={torchOn ? '#FFD60A' : 'rgba(255,255,255,0.95)'} />
          </View>
        )}
      </TouchableOpacity>

      {/* 이미지 업로드 버튼 */}
      <TouchableOpacity
        onPress={handlePickImage}
        activeOpacity={0.8}
        accessibilityLabel={t('scanner.uploadImage')}
        accessibilityRole="button"
        style={[styles.imagePickerButtonContainer, { top: topOffset }]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint="light"
            style={styles.imagePickerButton}
          >
            <Ionicons name="images" size={20} color="rgba(255,255,255,0.95)" />
          </BlurView>
        ) : (
          <View style={[styles.imagePickerButton, styles.imagePickerButtonAndroid]}>
            <Ionicons name="images" size={20} color="rgba(255,255,255,0.95)" />
          </View>
        )}
      </TouchableOpacity>

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
          <BlurView intensity={80} tint="light" style={styles.modalContentBlur} onStartShouldSetResponder={() => true}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="folder" size={24} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('groupEdit.selectGroup')}</Text>
              <TouchableOpacity
                onPress={() => setGroupModalVisible(false)}
                style={styles.modalCloseButton}
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
                       group.id === 'lottery-lotto' ? '로또 6/45' :
                       group.id === 'lottery-pension' ? '연금복권720+' : group.name}
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
      {pendingMultiScanData && (() => {
        // 유효한 코드만 필터링하여 개수 계산 (결과 페이지와 동일한 필터링)
        const parsedBarcodes = JSON.parse(pendingMultiScanData.barcodes || '[]');
        const validCount = parsedBarcodes.filter(code => {
          if (!code.value) return false;
          const value = String(code.value).trim();
          return value.length > 0 && value !== 'null' && value !== 'undefined';
        }).length;
        if (validCount === 0) return null;
        return (
        <View style={[styles.multiScanButtonContainer, { bottom: Platform.OS === 'ios' ? 140 : insets.bottom + 106 }]}>
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
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        );
      })()}

      {/* 결과창 자동 열림 비활성화 시 결과 보기 버튼 - 글래스모피즘 효과 */}
      {lastScannedCode && !resultWindowAutoOpen && (
        <View style={[styles.resultWindowButtonContainer, { bottom: Platform.OS === 'ios' ? 140 : insets.bottom + 106 }]}>
          <BlurView intensity={80} tint="light" style={styles.resultWindowButtonBlur}>
            <View style={styles.scannedCodeInfo}>
              <Text style={[styles.scannedCodeLabel, { color: colors.textSecondary }]}>{t('resultWindowSettings.scannedCode')}</Text>
              <Text style={[styles.scannedCodeValue, { color: colors.text }]} numberOfLines={1}>{lastScannedCode.code}</Text>
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
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}

      {/* 하단 배너 광고 - 탭바 바로 위 */}
      <AdBanner
        wrapperStyle={{
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 83 : insets.bottom + 49,
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
  groupBadge: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  groupBadgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  batchModeBadge: {
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
  batchModeBadgeText: {
    color: '#fff',
    fontSize: 14,
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
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  realtimeSyncBadgeText: {
    color: '#fff',
    fontSize: 14,
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
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
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
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
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
    left: 20,
  },
  torchButton: {
    padding: 12,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  torchButtonAndroid: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  torchButtonActive: {
    backgroundColor: 'rgba(255,214,10,0.15)',
  },
  imagePickerButtonContainer: {
    position: 'absolute',
    // top은 인라인 스타일로 동적 설정
    right: 20,
  },
  imagePickerButton: {
    padding: 12,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerButtonAndroid: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#007AFF15',
    borderWidth: 2,
    borderColor: '#007AFF',
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
    color: '#007AFF',
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
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
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
    backgroundColor: 'rgba(100, 100, 100, 0.95)',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // 결과창 자동 열림 비활성화 시 버튼 스타일
  resultWindowButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    overflow: 'hidden',
    borderRadius: 16,
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
    color: '#000',
    fontSize: 16,
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
    backgroundColor: 'rgba(0, 200, 83, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  resultWindowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultWindowCloseButton: {
    backgroundColor: 'rgba(100, 100, 100, 0.95)',
    padding: 14,
    borderRadius: 12,
  },
});

export default ScannerScreen;
