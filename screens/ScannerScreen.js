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
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const SCAN_AREA_SIZE = 240;
const DEBOUNCE_DELAY = 500;
const RESET_DELAY_LINK = 1200;
const RESET_DELAY_NORMAL = 800;

function ScannerScreen() {
  const router = useRouter();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const scanArea = useMemo(() => {
    const size = Math.min(winWidth * 0.7, winHeight * 0.5, SCAN_AREA_SIZE);
    return {
      width: size,
      height: size,
      x: (winWidth - size) / 2,
      y: (winHeight - size) / 2,
    };
  }, [winWidth, winHeight]);

  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [canScan, setCanScan] = useState(true); // 스캔 허용 여부 (카메라는 계속 활성)
  const [hapticEnabled, setHapticEnabled] = useState(true); // 햅틱 피드백 활성화 여부
  const [currentGroupName, setCurrentGroupName] = useState('기본 그룹'); // 현재 선택된 그룹 이름
  // 기본값: 자주 사용되는 바코드 타입들
  const [barcodeTypes, setBarcodeTypes] = useState([
    'qr',
    'ean13',
    'ean8',
    'code128',
    'upce',
    'upca',
  ]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const lastScannedData = useRef(null);
  const lastScannedTime = useRef(0);
  const resetTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const smoothBounds = useRef(null);
  const cameraRef = useRef(null);

  const [qrBounds, setQrBounds] = useState(null);

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

        // 현재 선택된 그룹 이름 로드
        const selectedGroupId = await AsyncStorage.getItem('selectedGroupId') || 'default';
        const groupsData = await AsyncStorage.getItem('scanGroups');
        if (groupsData) {
          const groups = JSON.parse(groupsData);
          const currentGroup = groups.find(g => g.id === selectedGroupId);
          if (currentGroup) {
            setCurrentGroupName(currentGroup.name);
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

          // 현재 선택된 그룹 이름 로드
          const selectedGroupId = await AsyncStorage.getItem('selectedGroupId') || 'default';
          const groupsData = await AsyncStorage.getItem('scanGroups');
          if (groupsData) {
            const groups = JSON.parse(groupsData);
            const currentGroup = groups.find(g => g.id === selectedGroupId);
            if (currentGroup) {
              setCurrentGroupName(currentGroup.name);
            }
          }
        } catch (error) {
          console.error('Load barcode settings error:', error);
        }
      })();

      return () => {
        clearAllTimers();
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

  const saveHistory = useCallback(async (code, url = null, photoUri = null) => {
    try {
      // 선택된 그룹 ID 가져오기
      const selectedGroupId = await AsyncStorage.getItem('selectedGroupId') || 'default';

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
          ...(url && { url })
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
  }, []);

  const normalizeBounds = useCallback(
    (bounds) => {
      if (!bounds?.origin) return null;
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
    },
    [winWidth, winHeight],
  );

  const isQrInScanArea = useCallback(
    (bounds) => {
      const b = normalizeBounds(bounds);
      if (!b) return false;

      const areaLeft = scanArea.x;
      const areaRight = scanArea.x + scanArea.width;
      const areaTop = scanArea.y;
      const areaBottom = scanArea.y + scanArea.height;

      const overlapX = Math.max(0, Math.min(b.x + b.width, areaRight) - Math.max(b.x, areaLeft));
      const overlapY = Math.max(0, Math.min(b.y + b.height, areaBottom) - Math.max(b.y, areaTop));
      const overlapArea = overlapX * overlapY;
      const qrArea = b.width * b.height;

      return overlapArea > qrArea * 0.7;
    },
    [normalizeBounds, scanArea],
  );

  const startResetTimer = useCallback((delay) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setQrBounds(null);
      smoothBounds.current = null;
      resetTimerRef.current = null;
    }, delay);
  }, []);

  const capturePhoto = useCallback(async () => {
    let previousAudioMode = null;
    try {
      if (!cameraRef.current) return null;

      // 사진 디렉토리 생성
      const photoDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
      }

      // 오디오 음소거 (셔터음 끄기)
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch (audioError) {
        console.log('Audio mode error (non-critical):', audioError);
      }

      // 사진 촬영
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      // 파일명 생성 (타임스탬프 사용)
      const fileName = `scan_${Date.now()}.jpg`;
      const newPath = photoDir + fileName;

      // 사진 이동
      await FileSystem.moveAsync({
        from: photo.uri,
        to: newPath,
      });

      return newPath;
    } catch (error) {
      console.error('Photo capture error:', error);
      return null;
    } finally {
      // 오디오 모드 복원
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
        });
      } catch (audioError) {
        console.log('Audio restore error (non-critical):', audioError);
      }
    }
  }, []);

  const handleBarCodeScanned = useCallback(
    async ({ data, bounds }) => {
      if (!isActive || !canScan) return; // canScan 추가 확인
      if (!isQrInScanArea(bounds)) return;

      const now = Date.now();

      if (lastScannedData.current === data && now - lastScannedTime.current < DEBOUNCE_DELAY) {
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

      // 햅틱 설정이 활성화된 경우에만 진동
      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const normalized = normalizeBounds(bounds);
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

      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      navigationTimerRef.current = setTimeout(async () => {
        try {
          // 바코드 인식 시 사진 촬영
          const photoUri = await capturePhoto();

          const enabled = await SecureStore.getItemAsync('scanLinkEnabled');

          if (enabled === 'true') {
            const base = await SecureStore.getItemAsync('baseUrl');
            if (base) {
              const url = base.includes('{code}') ? base.replace('{code}', data) : base + data;
              await saveHistory(data, url, photoUri);
              setCanScan(false); // 결과 창 표시 시 스캔만 비활성화 (카메라는 유지)
              router.push({ pathname: '/webview', params: { url } });
              startResetTimer(RESET_DELAY_LINK);
              return;
            }
          }

          const historyResult = await saveHistory(data, null, photoUri);
          setCanScan(false); // 결과 창 표시 시 스캔만 비활성화 (카메라는 유지)
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
          await saveHistory(data);
          startResetTimer(RESET_DELAY_NORMAL);
        } finally {
          navigationTimerRef.current = null;
        }
      }, 50);
    },
    [isActive, canScan, isQrInScanArea, normalizeBounds, saveHistory, router, startResetTimer, hapticEnabled, capturePhoto],
  );

  const toggleTorch = useCallback(() => setTorchOn((prev) => !prev), []);

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.msg} accessibilityLabel="카메라 권한 요청 중">
          카메라 권한 요청 중...
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.msg} accessibilityLabel="카메라 권한이 필요합니다">
          카메라 권한을 허용해 주세요
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={isActive ? handleBarCodeScanned : undefined}
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: barcodeTypes,
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        {/* 현재 그룹 표시 */}
        <View style={styles.groupBadge}>
          <Ionicons name="folder" size={16} color="#fff" />
          <Text style={styles.groupBadgeText}>{currentGroupName}</Text>
        </View>

        <Text style={styles.title} accessibilityLabel="바코드를 사각형 안에 맞춰주세요">
          {barcodeTypes.length === 1 && barcodeTypes[0] === 'qr'
            ? 'QR 코드를 사각형 안에 맞춰주세요'
            : '바코드를 사각형 안에 맞춰주세요'}
        </Text>
        {!qrBounds && (
          <View
            style={[
              styles.frame,
              {
                width: scanArea.width,
                height: scanArea.height,
                borderRadius: scanArea.width * 0.08,
              },
            ]}
            accessibilityLabel="스캔 영역"
          />
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

      <TouchableOpacity
        style={styles.torchButton}
        onPress={toggleTorch}
        activeOpacity={0.8}
        accessibilityLabel={torchOn ? '손전등 끄기' : '손전등 켜기'}
        accessibilityRole="button"
      >
        <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={32} color="white" />
      </TouchableOpacity>
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
});

export default ScannerScreen;
