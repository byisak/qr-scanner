// screens/ForgotPasswordScreen.js - 비밀번호 재설정 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import useKeyboardVisible from '../hooks/useKeyboardVisible';
import { RADIUS, SIZE, TYPE } from '../constants/Design';
import config from '../config/config';

// 키보드 피하기: iOS·안드로이드 모두 'padding' (여백은 화면 바탕색으로 칠해진다).
// 안드로이드는 edge-to-edge라 adjustResize로 창이 줄지 않으니 키보드만큼 여백을 직접 줘야 한다.
// 예전 'height'는 키보드를 닫은 뒤에도 줄어든 높이가 남아(useKeyboardVisible 주석 참고) 아래에 밝은 띠가 보였다.
const KEYBOARD_BEHAVIOR = 'padding';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t, fonts, language } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const keyboardVisible = useKeyboardVisible();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [requestError, setRequestError] = useState(null);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('auth.errorEmailRequired'));
      return;
    }
    if (!validateEmail(email.trim())) {
      Alert.alert(t('common.error'), t('auth.errorInvalidEmail'));
      return;
    }

    setIsLoading(true);
    setRequestError(null);
    try {
      const response = await fetch(`${config.serverUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), locale: language }),
      });

      // 보안상 서버는 가입 여부와 관계없이 같은 응답을 준다 → 요청이 제대로 받아들여졌을 때만 '확인해 주세요' 화면으로
      if (!response.ok) {
        console.warn('[ForgotPassword] request failed:', response.status);
        setRequestError(t('auth.errorResetRequestFailed'));
        return;
      }
      setIsSent(true);
    } catch (error) {
      // 네트워크 자체가 실패하면 보낸 척하지 않고 알려 준다
      console.warn('[ForgotPassword] network error:', error?.message);
      setRequestError(t('auth.errorResetRequestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  // 전송 완료 화면
  if (isSent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleBackToLogin}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.successContainer}>
          <View style={[styles.iconTile, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="mail-unread-outline" size={24} color={colors.success} />
          </View>

          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('auth.resetEmailSent')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('auth.resetEmailSentDesc')}
          </Text>

          {/* 입력한 주소를 보여 줘서 오타를 스스로 알아챌 수 있게 */}
          <View style={[styles.tipRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.tipText, { color: colors.text, fontFamily: fonts.medium }]}>
              {email.trim().toLowerCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleBackToLogin}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: '#FFFFFF', fontFamily: fonts.semiBold }]}>
              {t('auth.backToLogin')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canSubmit = !!email;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={KEYBOARD_BEHAVIOR}
        enabled={Platform.OS === 'ios' || keyboardVisible}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 제목 */}
          <View style={styles.titleBlock}>
            <View style={[styles.iconTile, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="key" size={24} color={colors.primaryText} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('auth.forgotPasswordTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {t('auth.forgotPasswordSubtitle')}
            </Text>
          </View>

          {/* 이메일 입력 */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {t('auth.email')}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: focusedInput === 'email' ? colors.primary : colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (requestError) setRequestError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
            {/* 요청 실패(네트워크·서버 오류) */}
            {requestError && (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={14} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error, fontFamily: fonts.medium }]}>
                  {requestError}
                </Text>
              </View>
            )}
          </View>

          {/* 재설정 버튼 */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: canSubmit ? colors.primary : colors.raised }]}
            onPress={handleResetPassword}
            disabled={isLoading || !email}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: canSubmit ? '#FFFFFF' : colors.textTertiary, fontFamily: fonts.semiBold },
                ]}
              >
                {t('auth.sendResetLink')}
              </Text>
            )}
          </TouchableOpacity>

          {/* 로그인으로 돌아가기 */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={handleBackToLogin}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={[styles.loginLinkText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('auth.backToLogin')}
            </Text>
          </TouchableOpacity>

          {/* 하단 정보 */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.footerText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
              {t('auth.secureConnection')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  closeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    flexGrow: 1,
  },
  titleBlock: {
    marginBottom: 28,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    ...TYPE.tabTitle,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    ...TYPE.sectionHeader,
    marginBottom: 6,
  },
  inputWrapper: {
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    minHeight: SIZE.touch,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: 24,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
  },
  // 전송 완료 화면
  successContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    padding: 14,
    marginTop: 24,
    marginBottom: 24,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
