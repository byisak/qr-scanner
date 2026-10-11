// components/AppLockScreen.js - 앱 잠금 화면 컴포넌트
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { PinKeypadWithRef } from './PinKeypad';
import haptics from '../utils/haptics';

export default function AppLockScreen() {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const {
    isLocked,
    isLoading,
    biometricEnabled,
    biometricType,
    verifyPin,
    authenticateWithBiometric,
    unlock,
  } = useAppLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [errorMessage, setErrorMessage] = useState('');
  const [biometricAttempted, setBiometricAttempted] = useState(false);
  const pinKeypadRef = useRef(null);

  // 생체인증 자동 시도 (한 번만)
  useEffect(() => {
    if (isLocked && biometricEnabled && !biometricAttempted && !isLoading) {
      setBiometricAttempted(true);
      // 약간의 딜레이 후 생체인증 시도
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLocked, biometricEnabled, biometricAttempted, isLoading]);

  // 잠금 해제 시 상태 리셋
  useEffect(() => {
    if (!isLocked) {
      setBiometricAttempted(false);
      setErrorMessage('');
    }
  }, [isLocked]);

  // 생체인증 실행
  const handleBiometricAuth = async () => {
    // Face ID / Touch ID는 Apple 상표라 Android에서는 일반 명칭을 쓴다
    let biometricLabel;
    if (biometricType === 'FaceID') {
      biometricLabel = Platform.OS === 'ios' ? 'Face ID' : (t('security.faceRecognition') || '얼굴 인식');
    } else {
      biometricLabel = Platform.OS === 'ios' ? 'Touch ID' : (t('security.fingerprint') || '지문');
    }
    const result = await authenticateWithBiometric(
      t('security.biometricPrompt', { type: biometricLabel }) || `${biometricLabel}로 잠금 해제`
    );

    if (result.success) {
      await haptics.success();
      // PIN 도트 애니메이션 후 잠금 해제
      if (pinKeypadRef.current?.fillDotsWithAnimation) {
        pinKeypadRef.current.fillDotsWithAnimation(() => {
          unlock();
        });
      } else {
        unlock();
      }
    }
  };

  // PIN 입력 완료
  const handlePinComplete = async (pin) => {
    setErrorMessage('');

    const isValid = await verifyPin(pin);
    if (isValid) {
      await haptics.success();
      unlock();
    } else {
      await haptics.error();
      setErrorMessage(t('security.incorrectPin') || 'PIN이 올바르지 않습니다.');
      setTimeout(() => {
        pinKeypadRef.current?.resetPin();
      }, 100);
    }
  };

  // 로딩 중이거나 잠금 해제된 경우 렌더링하지 않음
  if (isLoading || !isLocked) {
    return null;
  }

  return (
    <Modal
      visible={isLocked}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* 타이틀 영역 (SafeArea 적용) */}
        <SafeAreaView edges={['top']}>
          <View style={styles.titleContainer}>
            <View style={[styles.iconTile, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="lock-closed-outline" size={24} color={colors.primaryText} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('security.enterPin') || 'PIN 비밀번호 입력'}
            </Text>
          </View>
        </SafeAreaView>

        {/* PIN 키패드 (하단 끝까지 채움) */}
        <PinKeypadWithRef
          ref={pinKeypadRef}
          onComplete={handlePinComplete}
          pinLength={6}
          shuffleKeys={true}
          colors={colors}
          fonts={fonts}
          showBiometric={biometricEnabled}
          onBiometricPress={handleBiometricAuth}
          errorMessage={errorMessage}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
