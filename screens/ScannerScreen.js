// screens/ScannerScreen.js - Expo Router 버전
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
import { CameraView, Camera } from 'expo-camera';
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
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

const DEBOUNCE_DELAY = 500;
const DEBOUNCE_DELAY_NO_BOUNDS = 2000; // bounds 없는 바코드는 더 긴 디바운스 (2초)
const RESET_DELAY_LINK = 1200;
const RESET_DELAY_NORMAL = 800;

function ScannerScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

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
  const qrCodeRef = useRef(null); // QR 코드 생성용 ref
  const beepSoundPlayerRef = useRef(null); // 스캔 소리 플레이어 ref

  const [qrBounds, setQrBounds] = useState(null);
  const [qrCodeToCapture, setQrCodeToCapture] = useState(null); // QR 코드 생성용 데이터

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
        const { status } = await Camera.requestCameraPermissionsAsync();
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
        if (groupsData) {
          const groups = JSON.parse(groupsData);
          const currentGroup = groups.find(g => g.id === selectedGroupId);
          if (currentGroup) {
            setCurrentGroupName(currentGroup.name);
          }
          // 사용 가능한 그룹 목록 설정
          setAvailableGroups(groups);
        }

        // 실시간 서버전송 설정 로드
        const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
        if (realtimeSync === 'true') {
          setRealtimeSyncEnabled(true);
          const savedActiveSessionId = await AsyncStorage.getItem('activeSessionId');
          if (savedActiveSessionId) {
            setActiveSessionId(savedActiveSessionId);

            // WebSocket 서버에 연결
            const sessionUrls = await AsyncStorage.getItem('sessionUrls');
            if (sessionUrls) {
              const urls = JSON.parse(sessionUrls);
              const activeSession = urls.find(s => s.id === savedActiveSessionId);
              if (activeSession) {
                // URL에서 서버 주소 추출 (http://138.2.58.102:3000/sessionId -> http://138.2.58.102:3000)
                const serverUrl = activeSession.url.substring(0, activeSession.url.lastIndexOf('/'));
                websocketClient.connect(serverUrl);
                websocketClient.setSessionId(savedActiveSessionId);
                console.log('WebSocket connected to:', serverUrl);
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
          if (groupsData) {
            const groups = JSON.parse(groupsData);
            const currentGroup = groups.find(g => g.id === selectedGroupId);
            if (currentGroup) {
              setCurrentGroupName(currentGroup.name);
            }
            // 사용 가능한 그룹 목록 설정
            setAvailableGroups(groups);
          }

          // 실시간 서버전송 설정 로드
          const realtimeSync = await AsyncStorage.getItem('realtimeSyncEnabled');
          if (realtimeSync === 'true') {
            setRealtimeSyncEnabled(true);
            const savedActiveSessionId = await AsyncStorage.getItem('activeSessionId');
            if (savedActiveSessionId) {
              setActiveSessionId(savedActiveSessionId);

              // WebSocket 서버에 연결
              const sessionUrls = await AsyncStorage.getItem('sessionUrls');
              if (sessionUrls) {
                const urls = JSON.parse(sessionUrls);
                const activeSession = urls.find(s => s.id === savedActiveSessionId);
                if (activeSession) {
                  // URL에서 서버 주소 추출 (http://138.2.58.102:3000/sessionId -> http://138.2.58.102:3000)
                  const serverUrl = activeSession.url.substring(0, activeSession.url.lastIndexOf('/'));
                  websocketClient.connect(serverUrl);
                  websocketClient.setSessionId(savedActiveSessionId);
                  console.log('WebSocket connected to:', serverUrl);
                }
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

  const saveHistory = useCallback(async (code, url = null, photoUri = null, barcodeType = 'qr') => {
    try {
      let selectedGroupId = currentGroupId;

      // 실시간 서버전송이 활성화되어 있고 활성 세션 ID가 있으면 해당 그룹에 저장
      if (realtimeSyncEnabled && activeSessionId) {
        // 세션 ID 그룹 자동 생성 또는 가져오기
        const groupsData = await AsyncStorage.getItem('scanGroups');
        let groups = groupsData ? JSON.parse(groupsData) : [{ id: 'default', name: '기본 그룹', createdAt: Date.now() }];

        // 세션 ID 그룹이 이미 있는지 확인
        let sessionGroup = groups.find(g => g.id === activeSessionId);

        if (!sessionGroup) {
          // 세션 ID 그룹이 없으면 생성
          sessionGroup = {
            id: activeSessionId,
            name: activeSessionId,
            createdAt: Date.now(),
            isCloudSync: true, // 클라우드 동기화 그룹 표시
          };
          groups.push(sessionGroup);
          await AsyncStorage.setItem('scanGroups', JSON.stringify(groups));
        }

        // 선택된 그룹을 세션 ID 그룹으로 변경
        selectedGroupId = activeSessionId;
        await AsyncStorage.setItem('selectedGroupId', activeSessionId);
        setCurrentGroupId(activeSessionId);
        setCurrentGroupName(sessionGroup.name);
        // availableGroups 업데이트
        setAvailableGroups(groups);
      }

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
        };
        historyByGroup[selectedGroupId] = [record, ...currentHistory].slice(0, 1000);
      }

      // 저장
      await AsyncStorage.setItem('scanHistoryByGroup', JSON.stringify(historyByGroup));

      // 중복 여부 반환 (ResultScreen에서 사용)
      return { isDuplicate, count: isDuplicate ? historyByGroup[selectedGroupId][0].count : 1 };
    } catch (e) {
      console.error('Save history error:', e);
      return { isDuplicate: false, count: 1 };
    }
  }, [realtimeSyncEnabled, activeSessionId, currentGroupId]);

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

      // 형식 1: { origin: { x, y }, size: { width, height } }
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

  // QR 코드 재생성 방식으로 이미지 저장
  const generateQRCodeImage = useCallback(async (qrData, barcodeType = 'qr') => {
    try {
      // 사진 디렉토리 생성
      const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
      }

      // QR 코드 렌더링 트리거
      setQrCodeToCapture({ data: qrData, type: barcodeType });

      // 렌더링 완료 대기
      await new Promise(resolve => setTimeout(resolve, 150));

      // QR 코드 뷰가 준비되었는지 확인
      if (!qrCodeRef.current) {
        console.log('QR code view not ready');
        setQrCodeToCapture(null);
        return null;
      }

      // QR 코드 뷰를 이미지로 캡처 (base64 데이터로 받음)
      const dataUri = await captureRef(qrCodeRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'data-uri',
      });

      // 파일명 생성 (타임스탬프 사용)
      const fileName = `qr_${Date.now()}.jpg`;
      const newPath = photoDir + fileName;

      // base64 데이터를 파일로 저장
      // data:image/jpeg;base64,/9j/4AAQ... 형식에서 base64 부분만 추출
      const base64Data = dataUri.split(',')[1];
      await FileSystem.writeAsStringAsync(newPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('QR code image saved:', newPath);

      // 초기화
      setQrCodeToCapture(null);

      return newPath;
    } catch (error) {
      console.error('QR code generation error:', error);
      setQrCodeToCapture(null);
      return null;
    }
  }, []);

  const capturePhoto = useCallback(async (bounds = null) => {
    isCapturingPhotoRef.current = true; // 동기적으로 즉시 설정
    setIsCapturingPhoto(true);

    // React state 업데이트가 렌더링에 반영될 시간 제공
    // 이렇게 하면 카메라가 마운트 상태를 유지하도록 보장
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      // 카메라 ref 체크 (isActive 체크 제거 - ref로 관리)
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

      // 사진 촬영
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      // 사진 촬영 후에도 체크
      if (!photo || !photo.uri) {
        console.log('Photo capture failed');
        return null;
      }

      let finalUri = photo.uri;

      // QR 코드 bounds가 있으면 해당 영역만 crop
      if (bounds) {
        try {
          const normalized = normalizeBounds(bounds);
          if (normalized) {
            // 여유 공간 추가 (QR 코드 주변 10% 여백)
            const padding = Math.max(normalized.width, normalized.height) * 0.1;
            const cropX = Math.max(0, normalized.x - padding);
            const cropY = Math.max(0, normalized.y - padding);
            const cropWidth = Math.min(
              winWidth - cropX,
              normalized.width + padding * 2
            );
            const cropHeight = Math.min(
              winHeight - cropY,
              normalized.height + padding * 2
            );

            // 이미지 crop
            const croppedImage = await ImageManipulator.manipulateAsync(
              photo.uri,
              [
                {
                  crop: {
                    originX: cropX,
                    originY: cropY,
                    width: cropWidth,
                    height: cropHeight,
                  },
                },
              ],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
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
      const fileName = `scan_${Date.now()}.jpg`;
      const newPath = photoDir + fileName;

      // 사진 이동
      await FileSystem.moveAsync({
        from: finalUri,
        to: newPath,
      });

      console.log('Photo saved:', newPath);
      return newPath;
    } catch (error) {
      console.error('Photo capture error:', error);
      return null;
    } finally {
      isCapturingPhotoRef.current = false; // 동기적으로 즉시 해제
      setIsCapturingPhoto(false);
    }
  }, [normalizeBounds, winWidth, winHeight]);

  const handleBarCodeScanned = useCallback(
    async ({ data, bounds, type, cornerPoints }) => {
      if (!isActive || !canScan) return; // canScan 추가 확인

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

      // 바코드가 화면 중앙 십자가 근처에 있을 때만 스캔
      // bounds가 없거나 정규화할 수 없으면 디바운스만 적용 (위치 확인 불가능)
      if (bounds) {
        const normalized = normalizeBounds(bounds);
        if (normalized) {
          // 바코드의 중심점 계산
          const barcodeCenterX = normalized.x + normalized.width / 2;
          const barcodeCenterY = normalized.y + normalized.height / 2;

          // 화면 중앙점
          const screenCenterX = winWidth / 2;
          const screenCenterY = winHeight / 2;

          // 타겟 영역 크기 (화면 중앙 ±50px 범위)
          const targetRadius = 50;

          // 바코드 중심이 타겟 영역에 없으면 스캔하지 않음
          const distanceFromCenter = Math.sqrt(
            Math.pow(barcodeCenterX - screenCenterX, 2) + Math.pow(barcodeCenterY - screenCenterY, 2)
          );

          if (distanceFromCenter > targetRadius) {
            return; // 타겟 영역 밖이면 스캔하지 않음
          }
        } else {
          // bounds는 있지만 정규화 실패 - 위치 확인 불가능하므로 스캔 거부
          console.log(`Cannot normalize bounds for ${normalizedType}, skipping scan`);
          return;
        }
      } else {
        // bounds가 없는 경우 - 위치 확인 불가능하므로 디바운스로만 제어
        console.log(`No bounds for ${normalizedType}, relying on debounce only`);
      }

      const now = Date.now();

      // bounds 유무에 따라 다른 디바운스 적용
      const debounceDelay = bounds ? DEBOUNCE_DELAY : DEBOUNCE_DELAY_NO_BOUNDS;
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

      // 실시간 서버전송이 활성화되어 있는데 주소가 생성되지 않은 경우
      if (realtimeSyncEnabled && !activeSessionId) {
        Alert.alert(
          t('scanner.noSessionUrl'),
          t('scanner.pleaseGenerateUrl'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.title'),
              onPress: () => router.push('/settings')
            }
          ]
        );
        setTimeout(() => setCanScan(true), 500);
        return;
      }

      // 햅틱 설정이 활성화된 경우에만 진동
      if (hapticEnabledRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

      // bounds가 없으면 cornerPoints에서 생성 시도
      let effectiveBounds = bounds;
      if (!bounds && cornerPoints) {
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

      // QR 코드 이미지 생성 (카메라 사진 대신 깨끗한 QR 코드 생성)
      const photoPromise = photoSaveEnabledRef.current ? generateQRCodeImage(data, type) : Promise.resolve(null);

      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      navigationTimerRef.current = setTimeout(async () => {
        try {
          // 사진 촬영이 완료될 때까지 대기 (이미 시작됨)
          const photoUri = await photoPromise;

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
              await saveHistory(data, url, photoUri, normalizedType);
              setCanScan(false);
              router.push({ pathname: '/webview', params: { url } });
              startResetTimer(RESET_DELAY_LINK);
              return;
            }
          }

          const historyResult = await saveHistory(data, null, photoUri, normalizedType);
          setCanScan(false);
          router.push({
            pathname: '/result',
            params: {
              code: data,
              isDuplicate: historyResult.isDuplicate ? 'true' : 'false',
              scanCount: historyResult.count.toString(),
              photoUri: photoUri || '',
            }
          });
          startResetTimer(RESET_DELAY_NORMAL);
        } catch (error) {
          console.error('Navigation error:', error);
          await saveHistory(data, null, null, type);
          startResetTimer(RESET_DELAY_NORMAL);
        } finally {
          navigationTimerRef.current = null;
        }
      }, 50);
    },
    [isActive, canScan, normalizeBounds, saveHistory, router, startResetTimer, batchScanEnabled, batchScannedItems, capturePhoto, realtimeSyncEnabled, activeSessionId, winWidth, winHeight, fullScreenScanMode],
  );

  const toggleTorch = useCallback(() => setTorchOn((prev) => !prev), []);

  // 배치 스캔 완료 - 모든 항목을 히스토리에 저장
  const handleFinishBatch = useCallback(async () => {
    if (batchScannedItems.length === 0) return;

    try {
      // 모든 배치 항목을 히스토리에 저장
      for (const item of batchScannedItems) {
        await saveHistory(item.code, null, item.photoUri, item.type);
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
  const handleSelectGroup = useCallback(async (groupId, groupName) => {
    try {
      setCurrentGroupId(groupId);
      setCurrentGroupName(groupName);
      await AsyncStorage.setItem('selectedGroupId', groupId);
      setGroupModalVisible(false);
    } catch (error) {
      console.error('Failed to select group:', error);
    }
  }, []);

  // 표시할 그룹 목록 (실시간 서버전송이 꺼져있으면 세션 그룹 필터링)
  const displayGroups = useMemo(() => {
    if (realtimeSyncEnabled) {
      return availableGroups;
    }
    return availableGroups.filter(g => !g.isCloudSync);
  }, [availableGroups, realtimeSyncEnabled]);

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
      {(isActive || isCapturingPhoto || isCapturingPhotoRef.current) && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={cameraFacing}
          onBarcodeScanned={handleBarCodeScanned}
          enableTorch={torchOn}
          barcodeScannerSettings={{
            barcodeTypes: barcodeTypes,
          }}
        />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        {/* 현재 그룹 표시 (클릭 가능) */}
        <TouchableOpacity
          style={styles.groupBadge}
          onPress={() => setGroupModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="folder" size={16} color="#fff" />
          <Text style={styles.groupBadgeText}>{currentGroupName}</Text>
          <Ionicons name="chevron-down" size={16} color="#fff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* 배치 모드 활성 표시 */}
        {batchScanEnabled && (
          <View style={styles.batchModeBadge}>
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
        <View style={styles.batchControlPanel}>
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
        style={styles.torchButton}
        onPress={toggleTorch}
        activeOpacity={0.8}
        accessibilityLabel={torchOn ? t('scanner.torchOn') : t('scanner.torchOff')}
        accessibilityRole="button"
      >
        <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={32} color="white" />
      </TouchableOpacity>

      {/* 숨겨진 QR 코드 생성용 View */}
      {qrCodeToCapture && (
        <View
          ref={qrCodeRef}
          style={{
            position: 'absolute',
            left: -9999, // 화면 밖으로 숨김
            top: 0,
            backgroundColor: 'white',
            padding: 20,
          }}
          collapsable={false}
        >
          <QRCode
            value={qrCodeToCapture.data}
            size={300}
            backgroundColor="white"
            color="black"
          />
        </View>
      )}

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
              <Text style={styles.modalTitle}>그룹 선택</Text>
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
                  onPress={() => handleSelectGroup(group.id, group.name)}
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
    top: Platform.OS === 'ios' ? 60 : 40,
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
    top: Platform.OS === 'ios' ? 105 : 85,
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
    bottom: Platform.OS === 'ios' ? 200 : 180,
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
  torchButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 22,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
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
