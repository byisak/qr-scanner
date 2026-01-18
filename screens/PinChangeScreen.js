// screens/PinChangeScreen.js - PIN 변경 화면
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { PinKeypadWithRef } from '../components/PinKeypad';
import * as Haptics from 'expo-haptics';

export default function PinChangeScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { verifyPin, setPin } = useAppLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [step, setStep] = useState('current'); // 'current' | 'new' | 'confirm'
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pinKeypadRef = useRef(null);

  // PIN 입력 완료
  const handlePinComplete = async (pin) => {
    setErrorMessage('');

    if (step === 'current') {
      // 현재 PIN 확인
      const isValid = await verifyPin(pin);
      if (isValid) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCurrentPin(pin);
        setStep('new');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMessage(t('security.incorrectPin') || 'PIN이 올바르지 않습니다.');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
      }
    } else if (step === 'new') {
      // 새 PIN 입력
      if (pin === currentPin) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMessage(t('security.samePinError') || '현재 PIN과 다른 PIN을 입력해주세요.');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
        return;
      }
      setNewPin(pin);
      setStep('confirm');
      setTimeout(() => {
        pinKeypadRef.current?.resetPin();
      }, 100);
    } else {
      // 새 PIN 확인
      if (pin !== newPin) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMessage(t('security.pinMismatch') || 'PIN이 일치하지 않습니다. 다시 시도해주세요.');
        setStep('new');
        setNewPin('');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
        return;
      }

      // PIN 변경
      const result = await setPin(pin);
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t('settings.success') || '성공',
          t('security.pinChanged') || 'PIN이 변경되었습니다.',
          [{ text: t('common.confirm') || '확인', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          t('settings.error') || '오류',
          t('security.pinChangeFailed') || 'PIN 변경에 실패했습니다.'
        );
      }
    }
  };

  const getTitle = () => {
    if (step === 'current') {
      return t('security.enterCurrentPin') || '현재 PIN 비밀번호 입력';
    } else if (step === 'new') {
      return t('security.enterNewPin') || '새 PIN 비밀번호 입력';
    }
    return t('security.confirmNewPin') || '새 PIN 비밀번호 확인';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        bottomLink={t('security.forgotPin') || 'PIN 비밀번호를 잊으셨나요?'}
        onBottomLinkPress={() => router.back()}
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
