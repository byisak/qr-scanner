// components/AppLockScreen.js - 앱 잠금 화면 컴포넌트
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { PinKeypadWithRef } from './PinKeypad';
import * as Haptics from 'expo-haptics';

const { height } = Dimensions.get('window');

export default function AppLockScreen() {
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const {
    isLocked,
    biometricEnabled,
    biometricType,
    verifyPin,
    authenticateWithBiometric,
    unlock,
  } = useAppLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [errorMessage, setErrorMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const pinKeypadRef = useRef(null);

  // 생체인증 자동 시도
  useEffect(() => {
    if (isLocked && biometricEnabled) {
      handleBiometricAuth();
    }
  }, [isLocked, biometricEnabled]);

  // 생체인증 실행
  const handleBiometricAuth = async () => {
    const biometricLabel = biometricType === 'FaceID' ? 'Face ID' : 'Touch ID';
    const result = await authenticateWithBiometric(
      t('security.biometricPrompt') || `${biometricLabel}로 잠금 해제`
    );

    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      unlock();
    }
  };

  // PIN 입력 완료
  const handlePinComplete = async (pin) => {
    setErrorMessage('');

    const isValid = await verifyPin(pin);
    if (isValid) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      unlock();
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAttempts((prev) => prev + 1);
      setErrorMessage(t('security.incorrectPin') || 'PIN이 올바르지 않습니다.');
      pinKeypadRef.current?.resetPin();
    }
  };

  const getBiometricIcon = () => {
    if (biometricType === 'FaceID') {
      return 'scan-outline';
    }
    return 'finger-print-outline';
  };

  if (!isLocked) {
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
        {/* 타이틀 */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('security.enterPin') || 'PIN 비밀번호 입력'}
          </Text>
          {errorMessage ? (
            <Text style={[styles.errorText, { fontFamily: fonts.regular }]}>
              {errorMessage}
            </Text>
          ) : null}
        </View>

        {/* PIN 키패드 */}
        <PinKeypadWithRef
          ref={pinKeypadRef}
          onComplete={handlePinComplete}
          pinLength={6}
          shuffleKeys={true}
          colors={colors}
          fonts={fonts}
        />

        {/* 하단 - 생체인증 버튼 또는 PIN 찾기 링크 */}
        <View style={styles.bottomContainer}>
          {biometricEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricAuth}
              activeOpacity={0.7}
            >
              <Ionicons name={getBiometricIcon()} size={28} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity>
            <Text style={[styles.linkText, { fontFamily: fonts.medium }]}>
              {t('security.forgotPin') || 'PIN 비밀번호를 잊으셨나요?'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 60 : 80,
  },
  titleContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 12,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 120,
    backgroundColor: '#0A2A5E',
    gap: 20,
  },
  biometricButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    color: '#fff',
  },
});
