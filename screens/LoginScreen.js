// screens/LoginScreen.js - 로그인 화면 (실시간 전송용). 2026-10 리디자인: 소셜 로그인 먼저, 그다음 이메일 폼
import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';
import useKeyboardVisible from '../hooks/useKeyboardVisible';
import { RADIUS, SIZE, TYPE } from '../constants/Design';
import {
  useGoogleLogin,
  useAppleLogin,
} from '../hooks/useSocialLogin';

// 키보드 피하기: iOS·안드로이드 모두 'padding' (여백은 화면 바탕색으로 칠해진다).
// 안드로이드는 edge-to-edge라 adjustResize로 창이 줄지 않으니 키보드만큼 여백을 직접 줘야 한다.
// 예전 'height'는 키보드를 닫은 뒤에도 줄어든 높이가 남아(useKeyboardVisible 주석 참고) 아래에 밝은 띠가 보였다.
const KEYBOARD_BEHAVIOR = 'padding';

export default function LoginScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { loginWithEmail, loginWithGoogle, loginWithApple, getToken } = useAuth();
  const { syncWithServer } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;
  const keyboardVisible = useKeyboardVisible();

  // 소셜 로그인 훅
  const googleLogin = useGoogleLogin();
  const appleLogin = useAppleLogin();

  // 이메일 로그인 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // 진입 애니메이션 (살짝 올라오며 나타남)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 광고 기록 서버 동기화 (로그인 후 호출)
  const syncAdRecords = async (userId) => {
    try {
      const token = await getToken();
      if (userId && token) {
        await syncWithServer(userId, token);
        console.log('[AdSync] Post-login sync completed');
      }
    } catch (syncError) {
      console.warn('[AdSync] Post-login sync failed:', syncError);
      // 동기화 실패해도 로그인은 유지
    }
  };

  // 이메일 로그인 핸들러
  const handleEmailLogin = async () => {
    if (!email.trim()) {
      Alert.alert(t('settings.error'), t('auth.errorEmailRequired'));
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert(t('settings.error'), t('auth.errorInvalidEmail'));
      return;
    }
    if (!password) {
      Alert.alert(t('settings.error'), t('auth.errorPasswordRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithEmail(email, password);
      if (result.success) {
        // 광고 기록 서버 동기화
        await syncAdRecords(result.user?.id);
        router.dismissAll();
      } else {
        // 서버에서 받은 구체적인 에러 메시지 표시
        const errorMessage = result.error || t('auth.errorLoginFailed');
        Alert.alert(t('settings.error'), errorMessage);
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const sdkResult = await googleLogin.login();
      if (!sdkResult.success) {
        if (sdkResult.error !== 'Google login cancelled') {
          Alert.alert(t('settings.error'), sdkResult.error || t('auth.errorLoginFailed'));
        }
        return;
      }

      const result = await loginWithGoogle({
        accessToken: sdkResult.accessToken,
        idToken: sdkResult.idToken,
      });

      if (result.success) {
        // 광고 기록 서버 동기화
        await syncAdRecords(result.user?.id);
        router.back();
      } else {
        Alert.alert(t('settings.error'), result.error || t('auth.errorLoginFailed'));
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const sdkResult = await appleLogin.login();
      if (!sdkResult.success) {
        if (sdkResult.error !== 'Apple login cancelled') {
          Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
        }
        return;
      }

      const result = await loginWithApple({
        idToken: sdkResult.idToken,
        authorizationCode: sdkResult.authorizationCode,
        user: sdkResult.user,
      });

      if (result.success) {
        // 광고 기록 서버 동기화
        await syncAdRecords(result.user?.id);
        router.back();
      } else {
        Alert.alert(t('settings.error'), result.error || t('auth.errorLoginFailed'));
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = () => {
    router.push('/register');
  };

  const handleFindAccount = () => {
    router.push('/forgot-password');
  };

  const isFormValid = email && password;

  const inputStyle = (name) => [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: focusedInput === name ? colors.primary : colors.border,
      color: colors.text,
      fontFamily: fonts.regular,
    },
  ];
  const emailLoading = isLoading && !googleLogin.isLoading && !appleLogin.isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={KEYBOARD_BEHAVIOR}
          enabled={Platform.OS === 'ios' || keyboardVisible}
        >
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

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              {/* 제목 */}
              <View style={styles.titleSection}>
                <View style={[styles.iconTile, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.primaryText} />
                </View>
                <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
                  {t('auth.realtimeSyncLogin')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('auth.loginSubtitle')}
                </Text>
              </View>

              {/* 소셜 로그인 먼저: 탭 한 번 */}
              <View style={styles.socialSection}>
                <TouchableOpacity
                  style={[styles.socialButton, { backgroundColor: colors.raised, borderColor: colors.border }, isLoading && styles.buttonDisabled]}
                  onPress={handleGoogleLogin}
                  activeOpacity={0.8}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.loginWithGoogle')}
                >
                  {isLoading && googleLogin.isLoading ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color={colors.text} />
                      <Text style={[styles.socialButtonText, { color: colors.text, fontFamily: fonts.semiBold }]}>
                        {t('auth.loginWithGoogle')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* 애플 (iOS만) */}
                {Platform.OS === 'ios' && appleLogin.isAvailable && (
                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: colors.text, borderColor: colors.text }, isLoading && styles.buttonDisabled]}
                    onPress={handleAppleLogin}
                    activeOpacity={0.8}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.loginWithApple')}
                  >
                    {isLoading && appleLogin.isLoading ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={20} color={colors.background} />
                        <Text style={[styles.socialButtonText, { color: colors.background, fontFamily: fonts.semiBold }]}>
                          {t('auth.loginWithApple')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* 구분선 */}
              <View style={styles.separator}>
                <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.separatorText, { color: colors.textTertiary, fontFamily: fonts.medium }]}>
                  {t('auth.orContinueWith')}
                </Text>
                <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
              </View>

              {/* 이메일 폼 */}
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('auth.email')}
                  </Text>
                  <TextInput
                    style={inputStyle('email')}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                    accessibilityLabel={t('auth.email')}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                    {t('auth.password')}
                  </Text>
                  <View>
                    <TextInput
                      style={[inputStyle('password'), styles.passwordInput]}
                      placeholder={t('auth.passwordPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      accessibilityLabel={t('auth.password')}
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword(!showPassword)}
                      accessibilityRole="button"
                      accessibilityLabel={t('auth.password')}
                      accessibilityState={{ checked: showPassword }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 로그인: 입력이 갖춰지기 전엔 눌러도 안 되는 회색 */}
                <TouchableOpacity
                  style={[styles.loginButton, { backgroundColor: isFormValid ? colors.primary : colors.raised }]}
                  onPress={handleEmailLogin}
                  disabled={isLoading || !isFormValid}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isLoading || !isFormValid }}
                >
                  {emailLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.loginButtonText, { color: isFormValid ? '#fff' : colors.textTertiary, fontFamily: fonts.semiBold }]}>
                      {t('auth.login')}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* 링크 */}
                <View style={styles.linksRow}>
                  <TouchableOpacity style={styles.linkButton} onPress={handleSignup} accessibilityRole="button">
                    <Text style={[styles.linkText, { color: colors.text, fontFamily: fonts.medium }]}>
                      {t('auth.signup')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={handleFindAccount} accessibilityRole="button">
                    <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                      {t('auth.findAccount')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  closeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  content: {
    gap: 28,
  },
  titleSection: {
    gap: 10,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    ...TYPE.tabTitle,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  socialSection: {
    gap: 8,
  },
  socialButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  separatorText: {
    fontSize: 13,
  },
  form: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordInput: {
    paddingRight: 52,
  },
  passwordToggle: {
    position: 'absolute',
    right: 2,
    top: 2,
    width: SIZE.touch,
    height: SIZE.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkButton: {
    height: SIZE.touch,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
  },
});
