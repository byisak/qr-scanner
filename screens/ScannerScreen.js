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
  const resultOpacity = useRef(new Animated.Value(0)).current;

  const lastScannedData = useRef(null);
  const lastScannedTime = useRef(0);
  const resetTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const smoothBounds = useRef(null);

  const [qrBounds, setQrBounds] = useState(null);
  const [scannedData, setScannedData] = useState('');

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
    setScannedData('');
    smoothBounds.current = null;
    lastScannedData.current = null;
    lastScannedTime.current = 0;
    clearAllTimers();
  }, [clearAllTimers]);

  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
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
        } catch (error) {
          console.error('Load barcode settings error:', error);
        }
      })();

      return () => {
        setIsActive(false);
        clearAllTimers();
        resetAll();
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

  useEffect(() => {
    if (scannedData) {
      Animated.sequence([
        Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(resultOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setScannedData(''));
    }
  }, [scannedData, resultOpacity]);

  const saveHistory = useCallback(async (code, url = null) => {
    try {
      const record = { code, timestamp: Date.now(), ...(url && { url }) };
      const raw = await AsyncStorage.getItem('scanHistory');
      let history = raw ? JSON.parse(raw) : [];
      history = [record, ...history].slice(0, 1000);
      await AsyncStorage.setItem('scanHistory', JSON.stringify(history));
    } catch (e) {
      console.error('Save history error:', e);
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

  const handleBarCodeScanned = useCallback(
    async ({ data, bounds }) => {
      if (!isActive) return;
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
      setScannedData(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
          const enabled = await SecureStore.getItemAsync('scanLinkEnabled');

          if (enabled === 'true') {
            const base = await SecureStore.getItemAsync('baseUrl');
            if (base) {
              const url = base.includes('{code}') ? base.replace('{code}', data) : base + data;
              await saveHistory(data, url);
              router.push({ pathname: '/webview', params: { url } });
              startResetTimer(RESET_DELAY_LINK);
              return;
            }
          }

          await saveHistory(data);
          router.push({ pathname: '/result', params: { code: data } });
          startResetTimer(RESET_DELAY_NORMAL);
        } catch (error) {
          console.error('Navigation error:', error);
          await saveHistory(data);
          startResetTimer(RESET_DELAY_NORMAL);
        } finally {
          navigationTimerRef.current = null;
        }
      }, 150);
    },
    [isActive, isQrInScanArea, normalizeBounds, saveHistory, router, startResetTimer],
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
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={isActive ? handleBarCodeScanned : undefined}
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: barcodeTypes,
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
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

      {scannedData ? (
        <Animated.View
          style={[styles.resultContainer, { opacity: resultOpacity }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <View style={styles.resultBox}>
            <Ionicons name="checkmark-circle" size={48} color="#00FF00" />
            <Text style={styles.resultLabel}>스캔 완료!</Text>
          </View>
        </Animated.View>
      ) : null}

      {qrBounds && (
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
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </Animated.View>
      )}

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
  resultContainer: {
    position: 'absolute',
    top: '15%',
    alignSelf: 'center',
    width: '88%',
    maxWidth: 380,
  },
  resultBox: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 22,
    padding: 26,
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#00FF00',
    shadowColor: '#00FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  resultLabel: {
    color: '#00FF00',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  qrBorder: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFD60A',
    backgroundColor: 'rgba(255, 214, 10, 0.12)',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#FFD60A',
  },
  topLeft: { top: -3, left: -3, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 8 },
  topRight: { top: -3, right: -3, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 8 },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 8,
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
