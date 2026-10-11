// screens/PinChangeScreen.js - PIN 변경 화면
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { SIZE } from '../constants/Design';
import { PinKeypadWithRef } from '../components/PinKeypad';
import haptics from '../utils/haptics';

export default function PinChangeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        await haptics.success();
        setCurrentPin(pin);
        setStep('new');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
      } else {
        await haptics.error();
        setErrorMessage(t('security.incorrectPin') || 'PIN이 올바르지 않습니다.');
        setTimeout(() => {
          pinKeypadRef.current?.resetPin();
        }, 100);
      }
    } else if (step === 'new') {
      // 새 PIN 입력
      if (pin === currentPin) {
        await haptics.error();
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
        await haptics.error();
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
        await haptics.success();
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      {/* 헤더: 닫기 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View style={styles.titleContainer}>
        <View style={[styles.iconTile, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.primaryText} />
        </View>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {getTitle()}
        </Text>
        {t('security.changePin') ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('security.changePin')}
          </Text>
        ) : null}
      </View>

      {/* PIN 키패드 (오류 문구는 점 아래에 표시) */}
      <PinKeypadWithRef
        ref={pinKeypadRef}
        onComplete={handlePinComplete}
        pinLength={6}
        shuffleKeys={true}
        colors={colors}
        fonts={fonts}
        errorMessage={errorMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  closeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
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
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
});
