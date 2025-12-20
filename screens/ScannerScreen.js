// screens/ScannerScreen.js - Expo Router 버전 (Vision Camera 적용)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Platform,
  Alert,
  Modal,
  ScrollView,
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
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import websocketClient from '../utils/websocket';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQRAnalyzer } from '../components/QRAnalyzer';

const DEBOUNCE_DELAY = 500;
const DEBOUNCE_DELAY_NO_BOUNDS = 1000; // bounds 없는 바코드 디바운스 (1초로 단축)
const DEBOUNCE_DELAY_1D_BARCODE = 800; // 1D 바코드 (code39 등) 전용 디바운스

// 1D 바코드 타입 목록 (Code 39 포함)
const ONE_D_BARCODE_TYPES = ['ean13', 'ean8', 'code128', 'code39', 'code93', 'upce', 'upca', 'itf14', 'codabar'];
const RESET_DELAY_LINK = 1200;
const RESET_DELAY_NORMAL = 800;

function ScannerScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // QR 코드 EC 레벨 분석용 훅
  const { analyzeImage, QRAnalyzerView } = useQRAnalyzer();

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
  const [photoSaveEnabled, setPhotoSaveEnabled] = useState(false); // 사진 저장 활성화 여부
  const [batchScanEnabled, setBatchScanEnabled] = useState(false); // 배치 스캔 모드 활성화 여부
  const [batchScannedItems, setBatchScannedItems] = useState([]); // 배치로 스캔된 항목들
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false); // 사진 촬영 중 여부
  const [cameraFacing, setCameraFacing] = useState('back'); // 카메라 방향 (back/front)
  const [currentGroupName, setCurrentGroupName] = useState('기본 그룹'); // 현재 선택된 그룹 이름
  const [currentGroupId, setCurrentGroupId] = useState('default'); // 현재 선택된 그룹 ID
  const [groupModalVisible, setGroupModalVisible] = useState(false); // 그룹 선택 모달 표시 여부
  const [availableGroups, setAvailableGroups] = useState([{ id: 'default', name: '기본 그룹', createdAt: Date.now() }]); // 사용 가능한 그룹 목록
  // 기본값: 자주 사용되는 바코드 타입들
  const [barcodeTypes, setBarcodeTypes] = useState([
    'qr',
    'ean13',
    'ean8',
    'code128',
    'upce',
    'upca',
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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const lastScannedData = useRef(null);
  const lastScannedTime = useRef(0);
  const resetTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const smoothBounds = useRef(null);
  const cameraRef = useRef(null);
  const photoSaveEnabledRef = useRef(false); // ref로 관리하여 함수 재생성 방지
  const hapticEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지
  const scanSoundEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지
  const isCapturingPhotoRef = useRef(false); // ref로 동기적 추적 (카메라 마운트 유지용)
  const beepSoundPlayerRef = useRef(null); // 스캔 소리 플레이어 ref

  const [qrBounds, setQrBounds] = useState(null);

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
              : ['qr', 'ean13', 'ean8', 'code128', 'upce', 'upca']
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
        if (photoSave !== null) {
          setPhotoSaveEnabled(photoSave === 'true');
        }

        const batchScan = await AsyncStorage.getItem('batchScanEnabled');
        if (batchScan !== null) {
          setBatchScanEnabled(batchScan === 'true');
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

        if (groupsData) {
          const groups = JSON.parse(groupsData);
          // 삭제된 그룹 필터링, 실시간 서버전송이 꺼져있으면 세션 그룹도 필터링
          const filteredGroups = groups.filter(g => {
            if (g.isDeleted) return false;
            if (!isRealtimeSyncEnabled && g.isCloudSync) return false;
            return true;
          });

          // 기본 그룹 이름을 현재 언어로 변환
          const localizedGroups = filteredGroups.map(g => {
            if (g.id === 'default') {
              return { ...g, name: t('groupEdit.defaultGroup') };
            }
            return g;
          });

          const currentGroup = localizedGroups.find(g => g.id === selectedGroupId);
          if (currentGroup) {
            setCurrentGroupName(currentGroup.name);
          } else if (localizedGroups.length > 0) {
            // 현재 선택된 그룹이 삭제되었으면 기본 그룹으로 변경
            setCurrentGroupId('default');
            setCurrentGroupName(t('groupEdit.defaultGroup'));
            await AsyncStorage.setItem('selectedGroupId', 'default');
          }
          // 사용 가능한 그룹 목록 설정
          setAvailableGroups(localizedGroups);
        }

        // 실시간 서버전송 설정 로드
        if (isRealtimeSyncEnabled) {
          setRealtimeSyncEnabled(true);

          // 현재 선택된 그룹이 세션 그룹인지 확인하여 WebSocket 연결
          if (groupsData) {
            const parsedGroups = JSON.parse(groupsData);
            const selectedGroup = parsedGroups.find(g => g.id === selectedGroupId && !g.isDeleted);
            if (selectedGroup && selectedGroup.isCloudSync) {
              setActiveSessionId(selectedGroupId);

              // WebSocket 서버에 연결
              const sessionUrls = await AsyncStorage.getItem('sessionUrls');
              if (sessionUrls) {
                const urls = JSON.parse(sessionUrls);
                const session = urls.find(s => s.id === selectedGroupId);
                if (session) {
                  const serverUrl = session.url.substring(0, session.url.lastIndexOf('/'));
                  websocketClient.connect(serverUrl);
                  websocketClient.setSessionId(selectedGroupId);
                  console.log('WebSocket connected for session group:', selectedGroupId);
                }
              }
            }
          }
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
    setQrBounds(null);
    smoothBounds.current = null;
    lastScannedData.current = null;
    lastScannedTime.current = 0;
    clearAllTimers();
  }, [clearAllTimers]);

  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      setCanScan(true); // 화면 복귀 시 스캔 허용
      resetAll();

      (async () => {
        try {
          const saved = await AsyncStorage.getItem('selectedBarcodes');
          if (saved) {
            const parsed = JSON.parse(saved);
            setBarcodeTypes(
              parsed.length > 0
                ? parsed
                : ['qr', 'ean13', 'ean8', 'code128', 'upce', 'upca']
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
          if (photoSave !== null) {
            setPhotoSaveEnabled(photoSave === 'true');
          }

          const batchScan = await AsyncStorage.getItem('batchScanEnabled');
          if (batchScan !== null) {
            setBatchScanEnabled(batchScan === 'true');
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

          if (groupsData) {
            const groups = JSON.parse(groupsData);
            // 삭제된 그룹 필터링, 실시간 서버전송이 꺼져있으면 세션 그룹도 필터링
            const filteredGroups = groups.filter(g => {
              if (g.isDeleted) return false;
              if (!isRealtimeSyncEnabled && g.isCloudSync) return false;
              return true;
            });

            // 기본 그룹 이름을 현재 언어로 변환
            const localizedGroups = filteredGroups.map(g => {
              if (g.id === 'default') {
                return { ...g, name: t('groupEdit.defaultGroup') };
              }
              return g;
            });

            const currentGroup = localizedGroups.find(g => g.id === selectedGroupId);
            if (currentGroup) {
              setCurrentGroupName(currentGroup.name);
            } else if (localizedGroups.length > 0) {
              // 현재 선택된 그룹이 삭제되었으면 기본 그룹으로 변경
              setCurrentGroupId('default');
              setCurrentGroupName(t('groupEdit.defaultGroup'));
              await AsyncStorage.setItem('selectedGroupId', 'default');
            }
            // 사용 가능한 그룹 목록 설정
            setAvailableGroups(localizedGroups);
          }

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

                // WebSocket 서버에 연결
                const sessionUrls = await AsyncStorage.getItem('sessionUrls');
                if (sessionUrls) {
                  const urls = JSON.parse(sessionUrls);
                  const session = urls.find(s => s.id === selectedGroupId);
                  if (session) {
                    const serverUrl = session.url.substring(0, session.url.lastIndexOf('/'));
                    websocketClient.connect(serverUrl);
                    websocketClient.setSessionId(selectedGroupId);
                    console.log('WebSocket connected for session group:', selectedGroupId);
                  }
                }
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
        } catch (error) {
          console.error('Load barcode settings error:', error);
        }
      })();

      return () => {
        setIsActive(false); // 다른 탭으로 이동 시 카메라 비활성화
        clearAllTimers();
        // 사진 촬영 중이라도 cleanup 시 ref 초기화 (다음 활성화 시 새로 시작)
        isCapturingPhotoRef.current = false;
      };
    }, [resetAll, clearAllTimers]),
  );

  useEffect(() => {
    setQrBounds(null);
    smoothBounds.current = null;
  }, [winWidth, winHeight]);

  useEffect(() => {
    if (qrBounds) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [qrBounds, scaleAnim, opacityAnim]);

  const saveHistory = useCallback(async (code, url = null, photoUri = null, barcodeType = 'qr', ecLevel = null) => {
    try {
      // 현재 선택된 그룹에 저장 (세션 그룹이면 세션 그룹에, 일반 그룹이면 일반 그룹에)
      let selectedGroupId = currentGroupId;

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

      // 중복 여부 반환 (ResultScreen에서 사용)
      return { isDuplicate, count: isDuplicate ? historyByGroup[selectedGroupId][0].count : 1, errorCorrectionLevel: ecLevel };
    } catch (e) {
      console.error('Save history error:', e);
      return { isDuplicate: false, count: 1, errorCorrectionLevel: null };
    }
  }, [currentGroupId]);

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

  const normalizeBounds = useCallback(
    (bounds) => {
      // bounds 형식 확인 및 로깅
      if (!bounds) {
        console.log('No bounds provided');
        return null;
      }

      console.log('[normalizeBounds] Input:', JSON.stringify(bounds));

      // 형식 1: { origin: { x, y }, size: { width, height } } (iOS)
      if (bounds.origin && bounds.size) {
        const { origin, size } = bounds;
        const isPixel = origin.x > 1 || origin.y > 1;

        const scaleX = isPixel ? 1 : winWidth;
        const scaleY = isPixel ? 1 : winHeight;

        return {
          x: origin.x * scaleX,
          y: origin.y * scaleY,
          width: size.width * scaleX,
          height: size.height * scaleY,
        };
      }

      // 형식 2: { x, y, width, height } (일부 1차원 바코드)
      if (bounds.x !== undefined && bounds.y !== undefined && bounds.width && bounds.height) {
        const isPixel = bounds.x > 1 || bounds.y > 1;
        const scaleX = isPixel ? 1 : winWidth;
        const scaleY = isPixel ? 1 : winHeight;

        return {
          x: bounds.x * scaleX,
          y: bounds.y * scaleY,
          width: bounds.width * scaleX,
          height: bounds.height * scaleY,
        };
      }

      // 형식 3: { boundingBox: { x, y, width, height } }
      if (bounds.boundingBox) {
        const box = bounds.boundingBox;
        const isPixel = box.x > 1 || box.y > 1;
        const scaleX = isPixel ? 1 : winWidth;
        const scaleY = isPixel ? 1 : winHeight;

        return {
          x: box.x * scaleX,
          y: box.y * scaleY,
          width: box.width * scaleX,
          height: box.height * scaleY,
        };
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
    [winWidth, winHeight],
  );

  const startResetTimer = useCallback((delay) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setQrBounds(null);
      smoothBounds.current = null;
      resetTimerRef.current = null;
    }, delay);
  }, []);

  const capturePhoto = useCallback(async (bounds = null) => {
    isCapturingPhotoRef.current = true; // 동기적으로 즉시 설정
    setIsCapturingPhoto(true);

    // React state 업데이트가 렌더링에 반영될 시간 제공
    // 카메라가 마운트 상태를 유지하도록 충분한 시간 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // 카메라 ref 체크
      if (!cameraRef.current) {
        console.log('Camera not ready');
        return null;
      }

      // 사진 디렉토리 생성
      const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
      }

      // 사진 촬영 전 한번 더 체크
      if (!cameraRef.current) {
        console.log('Camera unmounted before capture');
        return null;
      }

      // Vision Camera 사진 촬영 (무음, 고품질) - NativeQRScanner의 ref 메서드 사용
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        shutterSound: false,
      });

      // 사진 촬영 후에도 체크
      if (!photo || !photo.uri) {
        console.log('Photo capture failed');
        return null;
      }

      let finalUri = photo.uri;

      // QR 코드 bounds가 있으면 해당 영역만 crop
      if (bounds && photo.width && photo.height) {
        try {
          const normalized = normalizeBounds(bounds);
          if (normalized) {
            // 화면 좌표를 카메라 사진 좌표로 변환
            const scaleX = photo.width / winWidth;
            const scaleY = photo.height / winHeight;

            console.log(`Photo size: ${photo.width}x${photo.height}, Screen size: ${winWidth}x${winHeight}`);
            console.log(`Scale factors: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);

            // 여유 공간 (QR 코드 주변 20% 여백) - 화면 좌표 기준
            const padding = Math.max(normalized.width, normalized.height) * 0.2;

            // 화면 좌표를 이미지 좌표로 변환 (원본 해상도 그대로 크롭)
            const cropX = Math.max(0, (normalized.x - padding) * scaleX);
            const cropY = Math.max(0, (normalized.y - padding) * scaleY);
            const cropWidth = Math.min(
              photo.width - cropX,
              (normalized.width + padding * 2) * scaleX
            );
            const cropHeight = Math.min(
              photo.height - cropY,
              (normalized.height + padding * 2) * scaleY
            );

            console.log(`Screen bounds: x=${normalized.x.toFixed(0)}, y=${normalized.y.toFixed(0)}, w=${normalized.width.toFixed(0)}, h=${normalized.height.toFixed(0)}`);
            console.log(`Padding (screen): ${padding.toFixed(0)}px`);

            console.log(`Crop area: x=${cropX.toFixed(0)}, y=${cropY.toFixed(0)}, w=${cropWidth.toFixed(0)}, h=${cropHeight.toFixed(0)}`);

            // 이미지 crop
            const croppedImage = await ImageManipulator.manipulateAsync(
              photo.uri,
              [
                {
                  crop: {
                    originX: Math.round(cropX),
                    originY: Math.round(cropY),
                    width: Math.round(cropWidth),
                    height: Math.round(cropHeight),
                  },
                },
              ],
              { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
            );

            finalUri = croppedImage.uri;
            console.log('QR code area cropped successfully');
          }
        } catch (cropError) {
          console.error('Crop error, using full image:', cropError);
          // crop 실패 시 원본 이미지 사용
        }
      }

      // 파일명 생성 (타임스탬프 사용)
      const timestamp = Date.now();
      const fileName = `scan_${timestamp}.jpg`;
      const newPath = photoDir + fileName;

      // 크롭된 사진 저장
      await FileSystem.moveAsync({
        from: finalUri,
        to: newPath,
      });

      // 원본 이미지도 저장 (EC 레벨 분석용)
      let originalPath = null;
      if (finalUri !== photo.uri) {
        const originalFileName = `scan_${timestamp}_original.jpg`;
        originalPath = photoDir + originalFileName;
        await FileSystem.copyAsync({
          from: photo.uri,
          to: originalPath,
        });
        console.log('Original photo saved:', originalPath);
      }

      console.log('Photo saved:', newPath);
      return { croppedUri: newPath, originalUri: originalPath || newPath };
    } catch (error) {
      console.error('Photo capture error:', error);
      return null;
    } finally {
      isCapturingPhotoRef.current = false; // 동기적으로 즉시 해제
      setIsCapturingPhoto(false);
    }
  }, [normalizeBounds, winWidth, winHeight]);

  const handleBarCodeScanned = useCallback(
    async (scanResult) => {
      const { data, bounds, type, cornerPoints, raw } = scanResult;
      // 사진 촬영 중이면 스캔 무시
      if (!isActive || !canScan || isCapturingPhotoRef.current) return;

      // 전체 스캔 결과 로깅 (디버깅용)
      console.log('Full scan result:', JSON.stringify(scanResult, null, 2));

      // bounds 정보 로깅 (디버깅용)
      console.log(`Barcode detected - Type: ${type}, Has bounds: ${!!bounds}, Has cornerPoints: ${!!cornerPoints}`);
      if (bounds) {
        console.log(`Bounds data:`, JSON.stringify(bounds));
      }
      if (cornerPoints) {
        console.log(`Corner points:`, cornerPoints);
      }

      // 바코드 타입 정규화 (org.iso.Code39 -> code39)
      const normalizedType = type.toLowerCase().replace(/^org\.(iso|gs1)\./, '');
      console.log(`Normalized type: ${normalizedType}`);

      // QR 코드 메타데이터 추출 (오류 검증 레벨 등)
      let errorCorrectionLevel = null;
      if (normalizedType === 'qr' || normalizedType === 'qrcode') {
        // 스캔 결과에서 errorCorrectionLevel 추출 시도
        if (scanResult.errorCorrectionLevel) {
          errorCorrectionLevel = scanResult.errorCorrectionLevel;
        } else if (scanResult.ecLevel) {
          errorCorrectionLevel = scanResult.ecLevel;
        } else if (raw) {
          // raw 데이터에서 EC 레벨 추출 시도 (QR 코드 포맷 분석)
          // QR 코드의 첫 번째 바이트에서 EC 레벨 힌트를 얻을 수 있음
          console.log('Raw data available:', raw);
        }
        console.log(`QR Error Correction Level: ${errorCorrectionLevel || 'Unknown'}`);
      }

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
        debounceDelay = bounds ? DEBOUNCE_DELAY_1D_BARCODE : DEBOUNCE_DELAY_NO_BOUNDS;
      } else {
        // 2D 바코드 (QR 등): 기존 로직 유지
        debounceDelay = bounds ? DEBOUNCE_DELAY : DEBOUNCE_DELAY_NO_BOUNDS;
      }
      if (lastScannedData.current === data && now - lastScannedTime.current < debounceDelay) {
        return;
      }

      if (lastScannedData.current !== data) {
        setQrBounds(null);
        smoothBounds.current = null;
        if (navigationTimerRef.current) {
          clearTimeout(navigationTimerRef.current);
          navigationTimerRef.current = null;
        }
      }

      if (lastScannedData.current === data && smoothBounds.current) {
        const newB = normalizeBounds(bounds);
        if (newB) {
          const dx = Math.abs(newB.x - smoothBounds.current.x);
          const dy = Math.abs(newB.y - smoothBounds.current.y);
          const dw = Math.abs(newB.width - smoothBounds.current.width);
          const dh = Math.abs(newB.height - smoothBounds.current.height);

          if (dx < 10 && dy < 10 && dw < 10 && dh < 10) return;
        }
      }

      lastScannedData.current = data;
      lastScannedTime.current = now;

      // 스캔 즉시 차단 (중복 스캔 방지)
      setCanScan(false);

      // 배치 스캔 모드일 경우 중복 체크를 먼저 수행
      if (batchScanEnabled) {
        const isDuplicate = batchScannedItems.some(item => item.code === data);
        if (isDuplicate) {
          // 중복이면 아무 피드백 없이 스캔만 재활성화
          setTimeout(() => setCanScan(true), 500);
          startResetTimer(RESET_DELAY_NORMAL);
          return;
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

      let normalized = normalizeBounds(effectiveBounds);

      // bounds와 cornerPoints 모두 없는 경우, 코너 라인 없이 스캔 (십자가만 표시)
      if (!normalized && !bounds && !cornerPoints) {
        console.log(`No position data available for barcode type: ${normalizedType}, scanning without corner lines`);
      }

      if (normalized) {
        if (!smoothBounds.current) {
          smoothBounds.current = normalized;
        } else {
          smoothBounds.current = {
            x: smoothBounds.current.x + (normalized.x - smoothBounds.current.x) * 0.35,
            y: smoothBounds.current.y + (normalized.y - smoothBounds.current.y) * 0.35,
            width:
              smoothBounds.current.width + (normalized.width - smoothBounds.current.width) * 0.35,
            height:
              smoothBounds.current.height +
              (normalized.height - smoothBounds.current.height) * 0.35,
          };
        }
        setQrBounds({ ...smoothBounds.current });
      }

      // 실제 카메라 사진 촬영 (무음, 바코드 영역 크롭)
      const photoPromise = photoSaveEnabledRef.current ? capturePhoto(effectiveBounds) : Promise.resolve(null);

      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      navigationTimerRef.current = setTimeout(async () => {
        try {
          // 사진 촬영이 완료될 때까지 대기 (이미 시작됨)
          const photoResult = await photoPromise;
          const photoUri = photoResult?.croppedUri || photoResult;
          const originalUri = photoResult?.originalUri || photoResult;

          // QR 코드인 경우, 원본 사진에서 EC 레벨 분석 (2단계 시도)
          let detectedEcLevel = errorCorrectionLevel;
          let ecLevelAnalysisFailed = false;
          const isQRCodeType = normalizedType === 'qr' || normalizedType === 'qrcode';

          if (originalUri && isQRCodeType) {
            try {
              // 1단계: 원본 이미지로 직접 분석
              console.log('Analyzing EC level from original image:', originalUri);
              let analysisResult = await analyzeImage(originalUri);
              console.log('Analysis result (original):', analysisResult);

              // 2단계: 실패시 이미지 개선 후 재시도
              if (!analysisResult.success || !analysisResult.ecLevel) {
                console.log('Original analysis failed, trying with improved image...');
                try {
                  // 이미지 개선: 적절한 크기로 리사이즈 + PNG 무손실 포맷
                  const improvedImage = await ImageManipulator.manipulateAsync(
                    originalUri,
                    [{ resize: { width: 800 } }],
                    { compress: 1, format: ImageManipulator.SaveFormat.PNG }
                  );
                  console.log('Improved image created:', improvedImage.uri);

                  analysisResult = await analyzeImage(improvedImage.uri);
                  console.log('Analysis result (improved):', analysisResult);
                } catch (improveError) {
                  console.log('Image improvement error:', improveError);
                }
              }

              if (analysisResult.success && analysisResult.ecLevel) {
                detectedEcLevel = analysisResult.ecLevel;
                console.log(`EC Level detected from image: ${detectedEcLevel}`);
              } else {
                console.log('EC Level analysis failed after all attempts');
                ecLevelAnalysisFailed = true;
              }
            } catch (analysisError) {
              console.log('EC Level analysis error:', analysisError);
              ecLevelAnalysisFailed = true;
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
            setTimeout(() => setCanScan(true), 500);
            startResetTimer(RESET_DELAY_NORMAL);
            return;
          }

          // 일반 모드 (기존 로직)
          const enabled = await SecureStore.getItemAsync('scanLinkEnabled');

          if (enabled === 'true') {
            const base = await SecureStore.getItemAsync('baseUrl');
            if (base) {
              const url = base.includes('{code}') ? base.replace('{code}', data) : base + data;
              await saveHistory(data, url, photoUri, normalizedType, detectedEcLevel);
              router.push({ pathname: '/webview', params: { url } });
              startResetTimer(RESET_DELAY_LINK);
              return;
            }
          }

          const historyResult = await saveHistory(data, null, photoUri, normalizedType, detectedEcLevel);
          router.push({
            pathname: '/result',
            params: {
              code: data,
              isDuplicate: historyResult.isDuplicate ? 'true' : 'false',
              scanCount: historyResult.count.toString(),
              photoUri: photoUri || '',
              type: normalizedType,
              errorCorrectionLevel: detectedEcLevel || '',
              ecLevelAnalysisFailed: ecLevelAnalysisFailed ? 'true' : 'false',
            }
          });
          startResetTimer(RESET_DELAY_NORMAL);
        } catch (error) {
          console.error('Navigation error:', error);
          await saveHistory(data, null, null, type, null);
          startResetTimer(RESET_DELAY_NORMAL);
        } finally {
          navigationTimerRef.current = null;
        }
      }, 50);
    },
    [isActive, canScan, normalizeBounds, saveHistory, router, startResetTimer, batchScanEnabled, batchScannedItems, capturePhoto, realtimeSyncEnabled, activeSessionId, winWidth, winHeight, fullScreenScanMode, analyzeImage],
  );

  const toggleTorch = useCallback(() => setTorchOn((prev) => !prev), []);

  // 배치 스캔 완료 - 모든 항목을 히스토리에 저장
  const handleFinishBatch = useCallback(async () => {
    if (batchScannedItems.length === 0) return;

    try {
      // 모든 배치 항목을 히스토리에 저장
      for (const item of batchScannedItems) {
        await saveHistory(item.code, null, item.photoUri, item.type, item.errorCorrectionLevel);
      }

      // 배치 항목 초기화
      setBatchScannedItems([]);

      // 히스토리 화면으로 이동
      router.push('/(tabs)/history');
    } catch (error) {
      console.error('Finish batch error:', error);
    }
  }, [batchScannedItems, saveHistory, router]);

  // 배치 스캔 초기화
  const handleClearBatch = useCallback(() => {
    setBatchScannedItems([]);
  }, []);

  // 그룹 선택 핸들러
  const handleSelectGroup = useCallback(async (groupId, groupName, isCloudSync = false) => {
    try {
      setCurrentGroupId(groupId);
      setCurrentGroupName(groupName);
      await AsyncStorage.setItem('selectedGroupId', groupId);
      setGroupModalVisible(false);

      // 세션 그룹(클라우드 동기화 그룹) 선택 시 WebSocket 연결
      if (isCloudSync && realtimeSyncEnabled) {
        setActiveSessionId(groupId);

        // WebSocket 연결
        const sessionUrls = await AsyncStorage.getItem('sessionUrls');
        if (sessionUrls) {
          const urls = JSON.parse(sessionUrls);
          const session = urls.find(s => s.id === groupId);
          if (session) {
            const serverUrl = session.url.substring(0, session.url.lastIndexOf('/'));
            websocketClient.connect(serverUrl);
            websocketClient.setSessionId(groupId);
            console.log('WebSocket connected for session group:', groupId);
          }
        }
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
  }, [realtimeSyncEnabled]);

  // 표시할 그룹 목록 (실시간 서버전송이 꺼져있으면 세션 그룹 필터링, 기본 그룹 이름 다국어 적용)
  const displayGroups = useMemo(() => {
    const filtered = realtimeSyncEnabled
      ? availableGroups
      : availableGroups.filter(g => !g.isCloudSync);

    // 기본 그룹 이름을 현재 언어로 변환
    return filtered.map(g => {
      if (g.id === 'default') {
        return { ...g, name: t('groupEdit.defaultGroup') };
      }
      return g;
    });
  }, [availableGroups, realtimeSyncEnabled, t]);

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
      {/* QR 코드 EC 레벨 분석용 숨겨진 WebView */}
      <QRAnalyzerView />

      {(isActive || isCapturingPhoto || isCapturingPhotoRef.current) && (
        <NativeQRScanner
          ref={cameraRef}
          isActive={isActive}
          facing={cameraFacing}
          torch={torchOn ? 'on' : 'off'}
          barcodeTypes={barcodeTypes}
          onCodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        {/* 현재 그룹 표시 (클릭 가능) */}
        <TouchableOpacity
          style={[styles.groupBadge, { top: topOffset }]}
          onPress={() => setGroupModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="folder" size={16} color="#fff" />
          <Text style={styles.groupBadgeText}>
            {currentGroupId === 'default' ? t('groupEdit.defaultGroup') : currentGroupName}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#fff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* 배치 모드 활성 표시 */}
        {batchScanEnabled && (
          <View style={[styles.batchModeBadge, { top: batchBadgeTop }]}>
            <Ionicons name="layers" size={16} color="#fff" />
            <Text style={styles.batchModeBadgeText}>{t('scanner.batchModeActive')}</Text>
          </View>
        )}

        {/* 전송 메시지 (배치 + 실시간 전송 모드) */}
        {showSendMessage && (
          <View style={styles.sendMessageBadge}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.sendMessageText}>{t('scanner.sending')}</Text>
          </View>
        )}

        {/* 중앙 십자가 타겟 (항상 표시) */}
        {!qrBounds && (
          <View style={styles.centerTarget} pointerEvents="none">
            {/* 수평선 */}
            <View style={styles.targetLineHorizontal} />
            {/* 수직선 */}
            <View style={styles.targetLineVertical} />
            {/* 중심 원 */}
            <View style={styles.targetCenter} />
          </View>
        )}
      </View>

      {qrBounds && (() => {
        // QR 코드 크기에 비례하는 코너 크기 계산
        const cornerSize = Math.max(20, Math.min(qrBounds.width * 0.18, 40));
        const borderWidth = Math.max(1.5, Math.min(cornerSize * 0.08, 2.5));
        const offset = borderWidth * 0.7;

        return (
          <Animated.View
            style={[
              styles.qrBorder,
              {
                left: qrBounds.x - 8,
                top: qrBounds.y - 8,
                width: qrBounds.width + 16,
                height: qrBounds.height + 16,
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
                borderRadius: qrBounds.width * 0.08,
              },
            ]}
            pointerEvents="none"
            accessibilityLabel="QR 코드 감지됨"
          >
            <View
              style={[
                styles.corner,
                styles.topLeft,
                { width: cornerSize, height: cornerSize, top: -offset, left: -offset },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.topRight,
                { width: cornerSize, height: cornerSize, top: -offset, right: -offset },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.bottomLeft,
                { width: cornerSize, height: cornerSize, bottom: -offset, left: -offset },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.bottomRight,
                { width: cornerSize, height: cornerSize, bottom: -offset, right: -offset },
              ]}
            />
          </Animated.View>
        );
      })()}

      {/* 배치 스캔 컨트롤 패널 */}
      {batchScanEnabled && batchScannedItems.length > 0 && (
        <View style={[styles.batchControlPanel, { bottom: bottomOffset }]}>
          <View style={styles.batchCountContainer}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={styles.batchCountText}>
              {t('scanner.scannedCount').replace('{count}', batchScannedItems.length.toString())}
            </Text>
          </View>
          <View style={styles.batchButtons}>
            <TouchableOpacity
              style={[styles.batchButton, styles.batchButtonClear]}
              onPress={handleClearBatch}
              activeOpacity={0.8}
              accessibilityLabel={t('scanner.clearBatch')}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={styles.batchButtonTextClear}>{t('scanner.clearBatch')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.batchButton, styles.batchButtonFinish]}
              onPress={handleFinishBatch}
              activeOpacity={0.8}
              accessibilityLabel={t('scanner.finishBatch')}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={styles.batchButtonTextFinish}>{t('scanner.finishBatch')}</Text>
            </TouchableOpacity>
          </View>
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


      {/* 그룹 선택 모달 */}
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
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Ionicons name="folder" size={24} color="#007AFF" />
              <Text style={styles.modalTitle}>{t('groupEdit.selectGroup')}</Text>
              <TouchableOpacity
                onPress={() => setGroupModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.groupList}>
              {displayGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupItem,
                    currentGroupId === group.id && styles.groupItemActive
                  ]}
                  onPress={() => handleSelectGroup(group.id, group.name, group.isCloudSync)}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupItemContent}>
                    {group.isCloudSync && (
                      <Ionicons name="cloud" size={18} color="#007AFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={[
                      styles.groupItemText,
                      currentGroupId === group.id && styles.groupItemTextActive
                    ]}>
                      {group.name}
                    </Text>
                  </View>
                  {currentGroupId === group.id && (
                    <Ionicons name="checkmark" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  groupBadgeText: {
    color: '#fff',
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
  batchControlPanel: {
    position: 'absolute',
    // bottom은 인라인 스타일로 동적 설정
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  batchCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  batchCountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  batchButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  batchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    gap: 6,
  },
  batchButtonClear: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  batchButtonFinish: {
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
  },
  batchButtonTextClear: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  batchButtonTextFinish: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  qrBorder: {
    position: 'absolute',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    borderColor: '#FFD60A',
  },
  topLeft: { borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  topRight: { borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bottomLeft: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
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
  msg: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 18,
    backgroundColor: '#000',
    color: '#fff',
    padding: 20,
  },
  centerTarget: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    marginLeft: -50,
    marginTop: -50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetLineHorizontal: {
    position: 'absolute',
    width: 40,
    height: 3,
    backgroundColor: '#FFD60A',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetLineVertical: {
    position: 'absolute',
    width: 3,
    height: 40,
    backgroundColor: '#FFD60A',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD60A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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
});

export default ScannerScreen;
