// contexts/AppLockContext.js - 앱 잠금 상태 관리
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const AppLockContext = createContext();

// 저장소 키
const APP_LOCK_ENABLED_KEY = 'appLockEnabled';
const APP_LOCK_PIN_KEY = 'appLockPin';
const APP_LOCK_BIOMETRIC_KEY = 'appLockBiometric';

export function AppLockProvider({ children }) {
  // 앱 잠금 설정 상태
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinSet, setPinSet] = useState(false);

  // 잠금 화면 표시 상태
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 생체인증 가능 여부
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null); // 'FaceID', 'TouchID', 'Fingerprint'

  // 초기 설정 로드
  useEffect(() => {
    loadSettings();
    checkBiometricAvailability();
  }, []);

  // 앱 상태 변화 감지 (백그라운드에서 돌아올 때 잠금)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && appLockEnabled) {
        setIsLocked(true);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [appLockEnabled]);

  // 생체인증 가능 여부 확인
  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      setBiometricAvailable(available);

      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('FaceID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('TouchID');
        }
      }
    } catch (error) {
      console.error('Check biometric availability error:', error);
      setBiometricAvailable(false);
    }
  };

  // 설정 로드
  const loadSettings = async () => {
    try {
      const [lockEnabled, biometric, pin] = await Promise.all([
        SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY),
        SecureStore.getItemAsync(APP_LOCK_BIOMETRIC_KEY),
        SecureStore.getItemAsync(APP_LOCK_PIN_KEY),
      ]);

      const isEnabled = lockEnabled === 'true';
      const isBiometric = biometric === 'true';
      const hasPin = pin !== null && pin.length > 0;

      setAppLockEnabled(isEnabled);
      setBiometricEnabled(isBiometric);
      setPinSet(hasPin);

      // 앱 시작 시 잠금 설정되어 있으면 잠금 화면 표시
      if (isEnabled) {
        setIsLocked(true);
      }
    } catch (error) {
      console.error('Load app lock settings error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // PIN 설정
  const setPin = async (pin) => {
    try {
      await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, pin);
      setPinSet(true);
      return { success: true };
    } catch (error) {
      console.error('Set PIN error:', error);
      return { success: false, error: error.message };
    }
  };

  // PIN 확인
  const verifyPin = async (pin) => {
    try {
      const storedPin = await SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
      return storedPin === pin;
    } catch (error) {
      console.error('Verify PIN error:', error);
      return false;
    }
  };

  // PIN 변경
  const changePin = async (currentPin, newPin) => {
    try {
      const isValid = await verifyPin(currentPin);
      if (!isValid) {
        return { success: false, error: 'INVALID_PIN' };
      }
      await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, newPin);
      return { success: true };
    } catch (error) {
      console.error('Change PIN error:', error);
      return { success: false, error: error.message };
    }
  };

  // 앱 잠금 활성화
  const enableAppLock = async (pin, useBiometric = false) => {
    try {
      await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, pin);
      await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(APP_LOCK_BIOMETRIC_KEY, useBiometric ? 'true' : 'false');

      setAppLockEnabled(true);
      setBiometricEnabled(useBiometric);
      setPinSet(true);

      return { success: true };
    } catch (error) {
      console.error('Enable app lock error:', error);
      return { success: false, error: error.message };
    }
  };

  // 앱 잠금 비활성화
  const disableAppLock = async (pin) => {
    try {
      const isValid = await verifyPin(pin);
      if (!isValid) {
        return { success: false, error: 'INVALID_PIN' };
      }

      await SecureStore.deleteItemAsync(APP_LOCK_PIN_KEY);
      await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, 'false');
      await SecureStore.setItemAsync(APP_LOCK_BIOMETRIC_KEY, 'false');

      setAppLockEnabled(false);
      setBiometricEnabled(false);
      setPinSet(false);
      setIsLocked(false);

      return { success: true };
    } catch (error) {
      console.error('Disable app lock error:', error);
      return { success: false, error: error.message };
    }
  };

  // 생체인증 토글
  const toggleBiometric = async (enabled) => {
    try {
      await SecureStore.setItemAsync(APP_LOCK_BIOMETRIC_KEY, enabled ? 'true' : 'false');
      setBiometricEnabled(enabled);
      return { success: true };
    } catch (error) {
      console.error('Toggle biometric error:', error);
      return { success: false, error: error.message };
    }
  };

  // 생체인증 실행
  const authenticateWithBiometric = async (promptMessage = '본인 확인') => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: '취소',
        fallbackLabel: 'PIN 입력',
        disableDeviceFallback: true,
      });
      return result;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: error.message };
    }
  };

  // 잠금 해제
  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  const value = {
    // 상태
    appLockEnabled,
    biometricEnabled,
    pinSet,
    isLocked,
    isLoading,
    biometricAvailable,
    biometricType,

    // 함수
    setPin,
    verifyPin,
    changePin,
    enableAppLock,
    disableAppLock,
    toggleBiometric,
    authenticateWithBiometric,
    unlock,
    checkBiometricAvailability,
  };

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
}
