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
  InteractionManager,
  FlatList,
  Image,
  ActivityIndicator,
  Linking,
  Animated,
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
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { Colors } from '../constants/Colors';
import websocketClient from '../utils/websocket';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';

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
  const { isDark } = useTheme();
  const { triggerSync } = useSync();
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

  // 스캔 연동 URL 관련 상태
  const [scanUrlEnabled, setScanUrlEnabled] = useState(false);
  const [activeScanUrl, setActiveScanUrl] = useState(null); // { id, name, url }
  const [showUrlSendMessage, setShowUrlSendMessage] = useState(false); // URL 전송 메시지 표시

  // 스캔 화면 로딩 애니메이션 상태
  const [scannerReady, setScannerReady] = useState(false);
  const qrIconOpacity = useRef(new Animated.Value(1)).current;
  const guideTextOpacity = useRef(new Animated.Value(1)).current;
  const cornerExpand = useRef(new Animated.Value(0)).current; // 0: 안쪽, 1: 바깥쪽
  const cornerOpacity = useRef(new Animated.Value(1)).current;
  const crosshairOpacity = useRef(new Animated.Value(0)).current;

  // 코너 이동 거리 (안쪽에서 바깥쪽으로)
  const CORNER_MOVE_DISTANCE = 50;

  // 스캔 화면 로딩 애니메이션 시퀀스
  useEffect(() => {
    if (isActive && !scannerReady) {
      // 애니메이션 값 초기화
      qrIconOpacity.setValue(1);
      guideTextOpacity.setValue(1);
      cornerExpand.setValue(0); // 안쪽에서 시작
      cornerOpacity.setValue(1);
      crosshairOpacity.setValue(0);

      // 초기 상태 0.5초 유지 후 애니메이션 시작
      const startTimer = setTimeout(() => {
        // QR 아이콘/안내 텍스트 페이드 아웃 + 코너 빠르게 바깥으로 확장
        Animated.parallel([
          Animated.timing(qrIconOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(guideTextOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          // 빠르게 바깥으로 (오버슛)
          Animated.timing(cornerExpand, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // 약간 안쪽으로 모임
          Animated.timing(cornerExpand, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            // 페이드 인/아웃으로 사라짐
            Animated.sequence([
              Animated.timing(cornerOpacity, { toValue: 0.3, duration: 300, useNativeDriver: true }),
              Animated.timing(cornerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(cornerOpacity, { toValue: 0.3, duration: 300, useNativeDriver: true }),
              Animated.timing(cornerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
              // 마지막 페이드 아웃 + 십자가 페이드 인
              Animated.parallel([
                Animated.timing(cornerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(crosshairOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
              ]),
            ]).start(() => {
              setScannerReady(true);
            });
          });
        });
      }, 500);

      return () => {
        clearTimeout(startTimer);
      };
    }
  }, [isActive, scannerReady]);

  // 화면 비활성화 시 애니메이션 리셋
  useEffect(() => {
    if (!isActive) {
      setScannerReady(false);
    }
  }, [isActive]);

  const lastScannedData = useRef(null);
  const lastScannedTime = useRef(0);
  const resetTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const cameraRef = useRef(null);
  const photoSaveEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지 (기본값: 켬)
  const hapticEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지
  const scanSoundEnabledRef = useRef(true); // ref로 관리하여 함수 재생성 방지
  const isCapturingPhotoRef = useRef(false); // ref로 동기적 추적 (카메라 마운트 유지용)
  const beepSoundPlayerRef = useRef(null); // 스캔 소리 플레이어 ref
  const isNavigatingRef = useRef(false); // 네비게이션 진행 중 플래그 (크래시 방지)
  const isProcessingRef = useRef(false); // 스캔 처리 중 플래그 (동기적 차단용)

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
        // null이면 기본값 true 유지, 저장된 값이 있으면 해당 값 사용
        setPhotoSaveEnabled(photoSave === null ? true : photoSave === 'true');

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
      setIsActive(true);
      setCanScan(true); // 화면 복귀 시 스캔 허용
      isNavigatingRef.current = false; // 네비게이션 플래그 리셋
      isProcessingRef.current = false; // 처리 중 플래그 리셋
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
          setPhotoSaveEnabled(photoSave === null ? true : photoSave === 'true');

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
        console.log('[ScannerScreen] Scheduling camera deactivation...');
        setTimeout(() => {
          console.log('[ScannerScreen] Deactivating camera NOW');
          setIsActive(false);
          console.log('[ScannerScreen] Camera deactivated');
        }, 50);

        console.log('[ScannerScreen] === CLEANUP END ===');
      };
    }, [resetAll, clearAllTimers]),
  );

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
        debounceDelay = bounds ? DEBOUNCE_DELAY_1D_BARCODE : DEBOUNCE_DELAY_NO_BOUNDS;
      } else {
        // 2D 바코드 (QR 등): 기존 로직 유지
        debounceDelay = bounds ? DEBOUNCE_DELAY : DEBOUNCE_DELAY_NO_BOUNDS;
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

      // 스캔 즉시 차단 (중복 스캔 방지) - ref로 동기적 차단
      isProcessingRef.current = true;
      setCanScan(false);

      // 배치 스캔 모드일 경우 중복 체크를 먼저 수행
      if (batchScanEnabled) {
        const isDuplicate = batchScannedItems.some(item => item.code === data);
        if (isDuplicate) {
          // 중복이면 아무 피드백 없이 스캔만 재활성화
          setTimeout(() => {
            isProcessingRef.current = false;
            setCanScan(true);
          }, 500);
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

      // 사진 저장이 활성화되어 있으면 촬영
      let photoPromise = null;
      const photoStartTime = Date.now();
      console.log('[ScannerScreen] Photo save enabled:', photoSaveEnabledRef.current);
      if (photoSaveEnabledRef.current) {
        console.log('[ScannerScreen] Starting photo capture at:', photoStartTime);
        photoPromise = capturePhoto().then(result => {
          console.log('[ScannerScreen] Photo capture completed in:', Date.now() - photoStartTime, 'ms');
          return result;
        }).catch(err => {
          console.log('Background photo capture error:', err);
          return null;
        });
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
            startResetTimer(RESET_DELAY_NORMAL);
            return;
          }

          // 일반 모드 (기존 로직)
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
              startResetTimer(RESET_DELAY_LINK);
              return;
            }
          }

          // 제품 검색 자동 실행 (상품 바코드인 경우)
          const productBarcodeTypes = ['ean13', 'ean8', 'upca', 'upce', 'itf14'];
          const isProductBarcode = productBarcodeTypes.includes(normalizedType);

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
                  startResetTimer(RESET_DELAY_LINK);
                  return;
                }
              }
            }
          }

          // 히스토리 저장을 먼저 시작하고 결과는 빠르게 가져옴
          const historyResult = await saveHistory(data, null, photoUri, normalizedType, detectedEcLevel);

          // 즉시 네비게이션
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
    [isActive, canScan, normalizeBounds, saveHistory, updateHistoryWithPhoto, router, startResetTimer, batchScanEnabled, batchScannedItems, capturePhoto, realtimeSyncEnabled, activeSessionId, winWidth, winHeight, fullScreenScanMode, scanUrlEnabled, activeScanUrl],
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

  // 갤러리 사진 목록 상태
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryEndCursor, setGalleryEndCursor] = useState(null);
  const [galleryHasMore, setGalleryHasMore] = useState(true);
  const [galleryLoadingMore, setGalleryLoadingMore] = useState(false);

  // 갤러리 열기
  const handlePickImage = useCallback(async () => {
    try {
      // 미디어 라이브러리 권한 요청
      const { status } = await MediaLibrary.requestPermissionsAsync();
      // iOS 14+에서는 'limited' 권한도 허용
      if (status !== 'granted' && status !== 'limited') {
        Alert.alert(
          t('result.permissionDenied'),
          t('result.permissionDeniedMessage')
        );
        return;
      }

      setGalleryLoading(true);
      setGalleryModalVisible(true);
      setGalleryPhotos([]);
      setGalleryEndCursor(null);
      setGalleryHasMore(true);

      // 최근 사진 100개씩 가져오기 (무한 스크롤)
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 100,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      setGalleryPhotos(assets.assets);
      setGalleryEndCursor(assets.endCursor);
      setGalleryHasMore(assets.hasNextPage);
      setGalleryLoading(false);
    } catch (error) {
      console.error('Gallery error:', error);
      setGalleryLoading(false);
      Alert.alert(t('settings.error'), t('imageAnalysis.pickerError'));
    }
  }, [t]);

  // 갤러리 더 불러오기 (무한 스크롤)
  const handleLoadMorePhotos = useCallback(async () => {
    if (galleryLoadingMore || !galleryHasMore || !galleryEndCursor) return;

    try {
      setGalleryLoadingMore(true);

      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 100,
        after: galleryEndCursor,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      setGalleryPhotos(prev => [...prev, ...assets.assets]);
      setGalleryEndCursor(assets.endCursor);
      setGalleryHasMore(assets.hasNextPage);
      setGalleryLoadingMore(false);
    } catch (error) {
      console.error('Load more photos error:', error);
      setGalleryLoadingMore(false);
    }
  }, [galleryLoadingMore, galleryHasMore, galleryEndCursor]);

  // 사진 선택 시
  const handleSelectPhoto = useCallback(async (asset) => {
    try {
      setGalleryModalVisible(false);

      // 에셋 정보 가져오기 (로컬 URI 포함)
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      const imageUri = assetInfo.localUri || asset.uri;

      // 네비게이션 전 카메라 중지
      isNavigatingRef.current = true;
      setIsActive(false);

      // 이미지 분석 화면으로 이동
      router.push({
        pathname: '/image-analysis',
        params: { imageUri: imageUri },
      });
    } catch (error) {
      console.error('Photo select error:', error);
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
        ref={cameraRef}
        isActive={isActive}
        facing={cameraFacing}
        torch={torchOn ? 'on' : 'off'}
        barcodeTypes={barcodeTypes}
        onCodeScanned={handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
        showHighlights={true}
        highlightColor="lime"
      />

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

        {/* 스캔 연동 URL 표시 */}
        {scanUrlEnabled && (
          <View style={[styles.scanUrlBadge, { top: batchScanEnabled ? batchBadgeTop + 40 : batchBadgeTop }]}>
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

        {/* 스캔 로딩 애니메이션 오버레이 */}
        <View style={styles.scanAnimationContainer} pointerEvents="none">
          {/* Step 1: QR 아이콘 */}
          <Animated.View style={[styles.qrIconContainer, { opacity: qrIconOpacity }]}>
            <Ionicons name="qr-code" size={80} color="rgba(255, 255, 255, 0.9)" />
          </Animated.View>

          {/* Step 1-2: 코너 사각형 (위치 이동 애니메이션) */}
          <View style={styles.cornerContainer}>
            {/* 좌상단 코너 ⌜ - 안쪽에서 바깥쪽으로 이동 */}
            <Animated.View
              style={[
                styles.corner,
                styles.cornerTopLeft,
                {
                  opacity: cornerOpacity,
                  transform: [
                    { translateX: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15] }) },
                    { translateY: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.cornerLine, { width: 40, height: 4, top: 0, left: 0 }]} />
              <View style={[styles.cornerLine, { width: 4, height: 40, top: 0, left: 0 }]} />
            </Animated.View>
            {/* 우상단 코너 ⌝ */}
            <Animated.View
              style={[
                styles.corner,
                styles.cornerTopRight,
                {
                  opacity: cornerOpacity,
                  transform: [
                    { translateX: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15] }) },
                    { translateY: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.cornerLine, { width: 40, height: 4, top: 0, right: 0 }]} />
              <View style={[styles.cornerLine, { width: 4, height: 40, top: 0, right: 0 }]} />
            </Animated.View>
            {/* 좌하단 코너 ⌞ */}
            <Animated.View
              style={[
                styles.corner,
                styles.cornerBottomLeft,
                {
                  opacity: cornerOpacity,
                  transform: [
                    { translateX: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [CORNER_MOVE_DISTANCE, 0, -CORNER_MOVE_DISTANCE * 0.15] }) },
                    { translateY: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.cornerLine, { width: 40, height: 4, bottom: 0, left: 0 }]} />
              <View style={[styles.cornerLine, { width: 4, height: 40, bottom: 0, left: 0 }]} />
            </Animated.View>
            {/* 우하단 코너 ⌟ */}
            <Animated.View
              style={[
                styles.corner,
                styles.cornerBottomRight,
                {
                  opacity: cornerOpacity,
                  transform: [
                    { translateX: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15] }) },
                    { translateY: cornerExpand.interpolate({ inputRange: [0, 1, 1.15], outputRange: [-CORNER_MOVE_DISTANCE, 0, CORNER_MOVE_DISTANCE * 0.15] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.cornerLine, { width: 40, height: 4, bottom: 0, right: 0 }]} />
              <View style={[styles.cornerLine, { width: 4, height: 40, bottom: 0, right: 0 }]} />
            </Animated.View>
          </View>

          {/* Step 1: 안내 텍스트 */}
          <Animated.View style={[styles.guideTextContainer, { opacity: guideTextOpacity }]}>
            <Text style={styles.guideText}>{t('scanner.guideText')}</Text>
          </Animated.View>

          {/* Step 3: 중앙 십자가 (최종 상태) */}
          <Animated.View style={[styles.centerTarget, { opacity: crosshairOpacity }]}>
            {/* 수평선 */}
            <View style={styles.targetLineHorizontal} />
            {/* 수직선 */}
            <View style={styles.targetLineVertical} />
            {/* 중심 원 */}
            <View style={styles.targetCenter} />
          </Animated.View>
        </View>
      </View>

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
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
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
                    { backgroundColor: colors.inputBackground },
                    currentGroupId === group.id && [styles.groupItemActive, { borderColor: colors.primary }]
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
                      {group.name}
                    </Text>
                  </View>
                  {currentGroupId === group.id && (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 갤러리 모달 */}
      <Modal
        visible={galleryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setGalleryModalVisible(false)}
      >
        <View style={styles.galleryModalContainer}>
          <View style={[styles.galleryModalContent, { paddingTop: insets.top }]}>
            <View style={styles.galleryModalHeader}>
              <Text style={styles.galleryModalTitle}>{t('imageAnalysis.selectPhoto')}</Text>
              <TouchableOpacity
                onPress={() => setGalleryModalVisible(false)}
                style={styles.galleryModalCloseButton}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {galleryLoading ? (
              <View style={styles.galleryLoading}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.galleryLoadingText}>{t('common.loading')}</Text>
              </View>
            ) : (
              <FlatList
                data={galleryPhotos}
                numColumns={5}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.galleryGrid}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.galleryPhotoItem}
                    onPress={() => handleSelectPhoto(item)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.galleryPhotoImage}
                    />
                  </TouchableOpacity>
                )}
                onEndReached={handleLoadMorePhotos}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  galleryLoadingMore ? (
                    <View style={styles.galleryFooterLoading}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.galleryEmpty}>
                    <Ionicons name="images-outline" size={48} color="#666" />
                    <Text style={styles.galleryEmptyText}>{t('imageAnalysis.noPhotos')}</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
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
  // 스캔 애니메이션 컨테이너
  scanAnimationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrIconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerContainer: {
    position: 'absolute',
    width: 250,
    height: 250,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
  },
  cornerLine: {
    position: 'absolute',
    backgroundColor: '#FFD60A',
    borderRadius: 2,
  },
  guideTextContainer: {
    position: 'absolute',
    bottom: '30%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  guideText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
    width: 30,
    height: 1.5,
    backgroundColor: '#FFD60A',
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetLineVertical: {
    position: 'absolute',
    width: 1.5,
    height: 30,
    backgroundColor: '#FFD60A',
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetCenter: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
  // 갤러리 모달 스타일
  galleryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  galleryModalContent: {
    flex: 1,
  },
  galleryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  galleryModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  galleryModalCloseButton: {
    padding: 4,
  },
  galleryLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryLoadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
  },
  galleryGrid: {
    padding: 2,
  },
  galleryPhotoItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 1,
  },
  galleryPhotoImage: {
    flex: 1,
    borderRadius: 4,
  },
  galleryEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  galleryEmptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
  galleryFooterLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default ScannerScreen;
