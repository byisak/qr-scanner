// screens/LoginScreen.js - 통합 로그인 화면 (이메일 + 소셜)
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
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import {
  useGoogleLogin,
  useAppleLogin,
} from '../hooks/useSocialLogin';

export default function LoginScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { loginWithEmail, loginWithGoogle, loginWithApple } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;

  // 소셜 로그인 훅
  const googleLogin = useGoogleLogin();
  const appleLogin = useAppleLogin();

  // 이메일 로그인 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 이메일 로그인 핸들러
  const handleEmailLogin = async () => {
    // 유효성 검사
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
        router.dismissAll();
      } else {
        Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
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
      // 1. SDK로 구글 인증
      const sdkResult = await googleLogin.login();
      if (!sdkResult.success) {
        if (sdkResult.error !== 'Google login cancelled') {
          Alert.alert(t('settings.error'), sdkResult.error || t('auth.errorLoginFailed'));
        }
        return;
      }

      // 2. 서버에 토큰 전송
      const result = await loginWithGoogle({
        accessToken: sdkResult.accessToken,
        idToken: sdkResult.idToken,
      });

      if (result.success) {
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
      // 1. SDK로 애플 인증
      const sdkResult = await appleLogin.login();
      if (!sdkResult.success) {
        if (sdkResult.error !== 'Apple login cancelled') {
          Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
        }
        return;
      }

      // 2. 서버에 ID 토큰 전송
      const result = await loginWithApple({
        idToken: sdkResult.idToken,
        authorizationCode: sdkResult.authorizationCode,
        user: sdkResult.user,
      });

      if (result.success) {
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
    Alert.alert(t('auth.findAccount'), '준비 중입니다');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFF5E6' }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 로고 및 타이틀 */}
          <View style={styles.logoSection}>
            <Text style={[styles.logoText, { fontFamily: fonts.bold }]}>QR Scanner</Text>
            <Text style={[styles.subtitle, { fontFamily: fonts.medium }]}>
              {t('auth.loginSubtitle')}
            </Text>
          </View>

          {/* 이메일 로그인 섹션 */}
          <View style={styles.emailSection}>
            {/* 이메일 입력 */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fonts.semiBold }]}>
                {t('auth.email')}
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, { fontFamily: fonts.regular }]}
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* 비밀번호 입력 */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { fontFamily: fonts.semiBold }]}>
                {t('auth.password')}
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, { fontFamily: fonts.regular }]}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 회원가입 / 계정찾기 링크 */}
            <View style={styles.linksRow}>
              <TouchableOpacity onPress={handleSignup}>
                <Text style={[styles.linkText, { fontFamily: fonts.medium }]}>
                  {t('auth.signup')}
                </Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity onPress={handleFindAccount}>
                <Text style={[styles.linkText, { fontFamily: fonts.medium }]}>
                  {t('auth.findAccount')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 이메일 로그인 버튼 */}
            <TouchableOpacity
              style={[
                styles.emailLoginButton,
                { backgroundColor: email && password ? '#E67E22' : '#ccc' },
              ]}
              onPress={handleEmailLogin}
              disabled={isLoading || !email || !password}
              activeOpacity={0.8}
            >
              {isLoading && !googleLogin.isLoading && !appleLogin.isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.emailLoginButtonText,
                    {
                      color: email && password ? '#fff' : '#999',
                      fontFamily: fonts.semiBold,
                    },
                  ]}
                >
                  {t('auth.login')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 구분선 */}
          <View style={styles.separatorContainer}>
            <View style={styles.separatorLine} />
            <Text style={[styles.separatorText, { fontFamily: fonts.medium }]}>
              {t('auth.orContinueWith') || '또는'}
            </Text>
            <View style={styles.separatorLine} />
          </View>

          {/* 소셜 로그인 버튼들 */}
          <View style={styles.socialSection}>
            {/* 구글 로그인 */}
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton, isLoading && styles.buttonDisabled]}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading && googleLogin.isLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <View style={styles.buttonIcon}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={[styles.socialButtonText, styles.googleText, { fontFamily: fonts.semiBold }]}>
                    {t('auth.loginWithGoogle')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* 애플 로그인 (iOS만) */}
            {Platform.OS === 'ios' && appleLogin.isAvailable && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton, isLoading && styles.buttonDisabled]}
                onPress={handleAppleLogin}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading && appleLogin.isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <View style={styles.buttonIcon}>
                      <Ionicons name="logo-apple" size={20} color="#fff" />
                    </View>
                    <Text style={[styles.socialButtonText, styles.appleText, { fontFamily: fonts.semiBold }]}>
                      {t('auth.loginWithApple')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 24,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E67E22',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    lineHeight: 26,
  },
  // 이메일 로그인 섹션
  emailSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  passwordToggle: {
    padding: 8,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  linkText: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 12,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: '#ddd',
  },
  emailLoginButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emailLoginButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  // 구분선
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  separatorText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#999',
  },
  // 소셜 로그인 섹션
  socialSection: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 구글
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleText: {
    color: '#333',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  // 애플
  appleButton: {
    backgroundColor: '#000',
  },
  appleText: {
    color: '#fff',
  },
});
