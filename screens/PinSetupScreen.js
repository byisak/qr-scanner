// screens/PinSetupScreen.js - PIN 설정 화면
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { PinKeypadWithRef } from '../components/PinKeypad';
import * as Haptics from 'expo-haptics';

export default function PinSetupScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { enableAppLock, biometricAvailable, biometricType } = useAppLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [step, setStep] = useState('enter'); // 'enter' | 'confirm'
  const [firstPin, setFirstPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pinKeypadRef = useRef(null);

  // PIN 입력 완료
  const handlePinComplete = async (pin) => {
    setErrorMessage('');

    if (step === 'enter') {
      // 첫 번째 PIN 입력
      setFirstPin(pin);
      setStep('confirm');
      setTimeout(() => {
        pinKeypadRef.current?.resetPin();
      }, 100);
    } else {
      // 확인 PIN 입력
      if (pin !== firstPin) {
        // PIN이 일치하지 않음
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMessage(t('security.pinMismatch') || 'PIN이 일치하지 않습니다. 다시 시도해주세요.');
        setStep('enter');
        setFirstPin('');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
        return;
      }

      // PIN 일치 - 생체인증 사용 여부 확인
      if (biometricAvailable) {
        const biometricLabel = biometricType === 'FaceID' ? 'Face ID' : 'Touch ID';
        Alert.alert(
          t('security.useBiometricTitle') || `${biometricLabel} 사용`,
          t('security.useBiometricMessage') || `${biometricLabel}를 앱 잠금에 사용하시겠습니까?`,
          [
            {
              text: t('common.cancel') || '아니오',
              style: 'cancel',
              onPress: () => savePin(pin, false),
            },
            {
              text: t('common.confirm') || '예',
              onPress: () => savePin(pin, true),
            },
          ]
        );
      } else {
        await savePin(pin, false);
      }
    }
  };

  // PIN 저장
  const savePin = async (pin, useBiometric) => {
    const result = await enableAppLock(pin, useBiometric);
    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('settings.success') || '성공',
        t('security.appLockEnabled') || '앱 잠금이 설정되었습니다.',
        [{ text: t('common.confirm') || '확인', onPress: () => router.back() }]
      );
    } else {
      Alert.alert(
        t('settings.error') || '오류',
        t('security.appLockEnableFailed') || '앱 잠금 설정에 실패했습니다.'
      );
    }
  };

  const getTitle = () => {
    if (step === 'enter') {
      return t('security.enterNewPin') || 'PIN 비밀번호 입력';
    }
    return t('security.confirmPin') || 'PIN 비밀번호 확인';
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {getTitle()}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
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
});
