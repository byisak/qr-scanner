// screens/PinVerifyScreen.js - PIN 확인 화면
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';
import { SIZE } from '../constants/Design';
import { PinKeypadWithRef } from '../components/PinKeypad';
import haptics from '../utils/haptics';

export default function PinVerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      await haptics.success();

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
      await haptics.error();
      setAttempts((prev) => prev + 1);
      setErrorMessage(t('security.incorrectPin') || 'PIN이 올바르지 않습니다.');
      setTimeout(() => {
        pinKeypadRef.current?.resetPin();
      }, 100);

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

  // 제목 아래 안내 (기존 문구 재사용)
  const getSubtitle = () => {
    if (mode === 'disable') {
      return t('security.disableAppLock');
    } else if (mode === 'change') {
      return t('security.changePin');
    }
    return '';
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
        {getSubtitle() ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {getSubtitle()}
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
