// screens/PinVerifyScreen.js - PIN 확인 화면
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { PinKeypadWithRef } from '../components/PinKeypad';
import * as Haptics from 'expo-haptics';

export default function PinVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { mode } = params; // 'disable' | 'change' | 'verify'
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { verifyPin, disableAppLock } = useAppLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [errorMessage, setErrorMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const pinKeypadRef = useRef(null);

  // PIN 입력 완료
  const handlePinComplete = async (pin) => {
    setErrorMessage('');

    const isValid = await verifyPin(pin);
    if (isValid) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (mode === 'disable') {
        // 앱 잠금 해제
        const result = await disableAppLock(pin);
        if (result.success) {
          Alert.alert(
            t('settings.success') || '성공',
            t('security.appLockDisabled') || '앱 잠금이 해제되었습니다.',
            [{ text: t('common.confirm') || '확인', onPress: () => router.back() }]
          );
        } else {
          Alert.alert(
            t('settings.error') || '오류',
            t('security.appLockDisableFailed') || '앱 잠금 해제에 실패했습니다.'
          );
        }
      } else if (mode === 'change') {
        // PIN 변경 - 새 PIN 설정 화면으로 이동
        router.replace({
          pathname: '/pin-setup',
          params: { mode: 'change' },
        });
      } else {
        // 단순 확인 - 성공 후 뒤로가기
        router.back();
      }
    } else {
      // PIN 불일치
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAttempts((prev) => prev + 1);
      setErrorMessage(t('security.incorrectPin') || 'PIN이 올바르지 않습니다.');
      pinKeypadRef.current?.resetPin();

      // 5회 실패 시 경고
      if (attempts >= 4) {
        Alert.alert(
          t('security.tooManyAttempts') || '시도 횟수 초과',
          t('security.tooManyAttemptsDesc') || '잠시 후 다시 시도해주세요.'
        );
      }
    }
  };

  const getTitle = () => {
    if (mode === 'disable') {
      return t('security.enterPinToDisable') || 'PIN 비밀번호 입력';
    } else if (mode === 'change') {
      return t('security.enterCurrentPin') || '현재 PIN 비밀번호 입력';
    }
    return t('security.enterPin') || 'PIN 비밀번호 입력';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

      {/* 하단 링크 */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.linkText, { fontFamily: fonts.medium }]}>
            {t('security.forgotPin') || 'PIN 비밀번호를 잊으셨나요?'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingTop: Platform.OS === 'android' ? 40 : 50,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    color: '#fff',
  },
});
