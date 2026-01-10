// screens/LoginScreen.js - 세련된 로그인 화면 (실시간 전송용)
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import {
  useGoogleLogin,
  useAppleLogin,
} from '../hooks/useSocialLogin';

const { width } = Dimensions.get('window');

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
  const [focusedInput, setFocusedInput] = useState(null);

  // 애니메이션
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;

  // 장식 원 애니메이션
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const circle3Anim = useRef(new Animated.Value(0)).current;
  const circle1Scale = useRef(new Animated.Value(1)).current;
  const circle2Scale = useRef(new Animated.Value(1)).current;
  const circle3Scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 진입 애니메이션
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 아이콘 부유 애니메이션
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(iconFloat, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 장식 원 1 - 느린 상하 움직임
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle1Anim, {
          toValue: 20,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(circle1Anim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 장식 원 1 - 스케일 펄스
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle1Scale, {
          toValue: 1.1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(circle1Scale, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 장식 원 2 - 대각선 움직임
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle2Anim, {
          toValue: 15,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(circle2Anim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 장식 원 2 - 스케일 펄스
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle2Scale, {
          toValue: 0.9,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(circle2Scale, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 장식 원 3 - 좌우 움직임
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle3Anim, {
          toValue: -12,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(circle3Anim, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 장식 원 3 - 스케일 펄스
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle3Scale, {
          toValue: 1.15,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(circle3Scale, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  const isFormValid = email && password;

  return (
    <View style={styles.container}>
      {/* 배경 그라데이션 */}
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#f093fb']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* 배경 장식 원 - 애니메이션 적용 */}
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decorCircle1,
          {
            transform: [
              { translateY: circle1Anim },
              { scale: circle1Scale },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decorCircle2,
          {
            transform: [
              { translateX: circle2Anim },
              { translateY: circle2Anim },
              { scale: circle2Scale },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decorCircle3,
          {
            transform: [
              { translateX: circle3Anim },
              { scale: circle3Scale },
            ],
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
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
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* 로고 섹션 */}
              <View style={styles.logoSection}>
                <Animated.View
                  style={[
                    styles.iconWrapper,
                    { transform: [{ translateY: iconFloat }] },
                  ]}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="cloud-upload" size={40} color="#fff" />
                  </View>
                </Animated.View>
                <Text style={[styles.title, { fontFamily: fonts.bold }]}>
                  {t('auth.realtimeSyncLogin') || '실시간 전송'}
                </Text>
                <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>
                  {t('auth.loginSubtitle') || '로그인하여 실시간 동기화를 시작하세요'}
                </Text>
              </View>

              {/* 카드 섹션 */}
              <View style={[styles.card, isDark && styles.cardDark]}>
                {/* 이메일 입력 */}
                <View style={styles.inputGroup}>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === 'email' && styles.inputFocused,
                      isDark && styles.inputWrapperDark,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={focusedInput === 'email' ? '#667eea' : '#999'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { fontFamily: fonts.regular }, isDark && styles.inputDark]}
                      placeholder={t('auth.emailPlaceholder') || '이메일 주소'}
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                {/* 비밀번호 입력 */}
                <View style={styles.inputGroup}>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === 'password' && styles.inputFocused,
                      isDark && styles.inputWrapperDark,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={focusedInput === 'password' ? '#667eea' : '#999'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { fontFamily: fonts.regular }, isDark && styles.inputDark]}
                      placeholder={t('auth.passwordPlaceholder') || '비밀번호'}
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#999"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 링크 */}
                <View style={styles.linksRow}>
                  <TouchableOpacity onPress={handleSignup}>
                    <Text style={[styles.linkText, { fontFamily: fonts.medium }]}>
                      {t('auth.signup') || '회원가입'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleFindAccount}>
                    <Text style={[styles.linkText, { fontFamily: fonts.medium }]}>
                      {t('auth.findAccount') || '계정 찾기'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 로그인 버튼 */}
                <TouchableOpacity
                  style={[styles.loginButton, !isFormValid && styles.loginButtonDisabled]}
                  onPress={handleEmailLogin}
                  disabled={isLoading || !isFormValid}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isFormValid ? ['#667eea', '#764ba2'] : ['#ccc', '#aaa']}
                    style={styles.loginButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading && !googleLogin.isLoading && !appleLogin.isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={[styles.loginButtonText, { fontFamily: fonts.semiBold }]}>
                          {t('auth.login') || '로그인'}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonArrow} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* 구분선 */}
                <View style={styles.separator}>
                  <View style={[styles.separatorLine, isDark && styles.separatorLineDark]} />
                  <Text style={[styles.separatorText, { fontFamily: fonts.medium }]}>
                    {t('auth.orContinueWith') || 'SNS 계정으로 계속'}
                  </Text>
                  <View style={[styles.separatorLine, isDark && styles.separatorLineDark]} />
                </View>

                {/* 소셜 로그인 */}
                <View style={styles.socialSection}>
                  {/* 구글 */}
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
                        <View style={styles.googleIconWrapper}>
                          <Text style={styles.googleIcon}>G</Text>
                        </View>
                        <Text style={[styles.socialButtonText, { fontFamily: fonts.semiBold }]}>
                          Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* 애플 (iOS만) */}
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
                          <Ionicons name="logo-apple" size={20} color="#fff" />
                          <Text style={[styles.socialButtonText, styles.appleText, { fontFamily: fonts.semiBold }]}>
                            Apple
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 하단 정보 */}
              <View style={styles.footer}>
                <Ionicons name="shield-checkmark-outline" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={[styles.footerText, { fontFamily: fonts.regular }]}>
                  {t('auth.secureConnection') || '안전한 암호화 연결'}
                </Text>
              </View>
            </Animated.View>
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
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decorCircle1: {
    width: 200,
    height: 200,
    top: -50,
    right: -50,
  },
  decorCircle2: {
    width: 150,
    height: 150,
    bottom: 100,
    left: -75,
  },
  decorCircle3: {
    width: 100,
    height: 100,
    top: '40%',
    right: -30,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 0,
    paddingBottom: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 32,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardDark: {
    backgroundColor: '#1e1e2e',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapperDark: {
    backgroundColor: '#2a2a3e',
  },
  inputFocused: {
    borderColor: '#667eea',
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#333',
  },
  inputDark: {
    color: '#fff',
  },
  passwordToggle: {
    padding: 8,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  linkText: {
    fontSize: 14,
    color: '#667eea',
  },
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  buttonArrow: {
    marginLeft: 8,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  separatorLineDark: {
    backgroundColor: '#3a3a4e',
  },
  separatorText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#999',
  },
  socialSection: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  googleIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleText: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
});
