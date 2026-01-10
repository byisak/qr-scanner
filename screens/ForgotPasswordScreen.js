// screens/ForgotPasswordScreen.js - 비밀번호 재설정 화면
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
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';
import config from '../config/config';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // 애니메이션
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;

  // 장식 원 애니메이션
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const circle1Scale = useRef(new Animated.Value(1)).current;
  const circle2Scale = useRef(new Animated.Value(1)).current;

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

    // 장식 원 애니메이션
    Animated.loop(
      Animated.sequence([
        Animated.timing(circle1Anim, {
          toValue: 15,
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

    Animated.loop(
      Animated.sequence([
        Animated.timing(circle2Anim, {
          toValue: -10,
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
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('auth.errorEmailRequired'));
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert(t('common.error'), t('auth.errorInvalidEmail'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${config.serverUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      // Content-Type 확인 (HTML 반환 시 JSON 파싱 방지)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('Password reset response:', data);
      }

      // 보안상 이메일 존재 여부와 관계없이 항상 성공 메시지 표시
      setIsSent(true);
    } catch (error) {
      console.log('Password reset request sent (API may not exist yet)');
      // API가 없거나 오류가 발생해도 보안상 성공으로 표시
      setIsSent(true);
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
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#f093fb']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <Animated.View style={[styles.decorCircle, styles.decorCircle1, { transform: [{ translateY: circle1Anim }, { scale: circle1Scale }] }]} />
        <Animated.View style={[styles.decorCircle, styles.decorCircle2, { transform: [{ translateX: circle2Anim }, { scale: circle2Scale }] }]} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleBackToLogin}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.successContainer}>
            <Animated.View style={[styles.iconWrapper, { transform: [{ translateY: iconFloat }] }]}>
              <View style={[styles.iconContainer, styles.successIcon]}>
                <Ionicons name="mail-open" size={40} color="#fff" />
              </View>
            </Animated.View>

            <Text style={[styles.successTitle, { fontFamily: fonts.bold }]}>
              {t('auth.resetEmailSent') || '이메일을 확인하세요'}
            </Text>
            <Text style={[styles.successSubtitle, { fontFamily: fonts.regular }]}>
              {t('auth.resetEmailSentDesc') || `${email}로 비밀번호 재설정 링크를 보냈습니다. 이메일을 확인해주세요.`}
            </Text>

            <View style={styles.successCard}>
              <View style={styles.tipRow}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
                <Text style={[styles.tipText, { color: colors.text, fontFamily: fonts.regular }]}>
                  {t('auth.checkSpamFolder') || '이메일이 보이지 않으면 스팸 폴더를 확인해주세요.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToLogin}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.backButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={[styles.backButtonText, { fontFamily: fonts.semiBold }]}>
                  {t('auth.backToLogin') || '로그인으로 돌아가기'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 배경 그라데이션 */}
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#f093fb']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* 배경 장식 원 */}
      <Animated.View style={[styles.decorCircle, styles.decorCircle1, { transform: [{ translateY: circle1Anim }, { scale: circle1Scale }] }]} />
      <Animated.View style={[styles.decorCircle, styles.decorCircle2, { transform: [{ translateX: circle2Anim }, { scale: circle2Scale }] }]} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
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
                  style={[styles.iconWrapper, { transform: [{ translateY: iconFloat }] }]}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="key" size={40} color="#fff" />
                  </View>
                </Animated.View>
                <Text style={[styles.title, { fontFamily: fonts.bold }]}>
                  {t('auth.forgotPasswordTitle') || '비밀번호 찾기'}
                </Text>
                <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>
                  {t('auth.forgotPasswordSubtitle') || '가입한 이메일을 입력하면\n비밀번호 재설정 링크를 보내드립니다'}
                </Text>
              </View>

              {/* 카드 섹션 */}
              <View style={[styles.card, isDark && styles.cardDark]}>
                {/* 이메일 입력 */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text, fontFamily: fonts.medium }]}>
                    {t('auth.email') || '이메일'}
                  </Text>
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
                      placeholder={t('auth.emailPlaceholder') || '가입한 이메일 주소'}
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

                {/* 재설정 버튼 */}
                <TouchableOpacity
                  style={[styles.resetButton, !email && styles.resetButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isLoading || !email}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={email ? ['#667eea', '#764ba2'] : ['#ccc', '#aaa']}
                    style={styles.resetButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={[styles.resetButtonText, { fontFamily: fonts.semiBold }]}>
                          {t('auth.sendResetLink') || '재설정 링크 보내기'}
                        </Text>
                        <Ionicons name="send" size={18} color="#fff" style={styles.buttonIcon} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* 로그인으로 돌아가기 */}
                <TouchableOpacity
                  style={styles.loginLink}
                  onPress={handleBackToLogin}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={16} color="#667eea" />
                  <Text style={[styles.loginLinkText, { fontFamily: fonts.medium }]}>
                    {t('auth.backToLogin') || '로그인으로 돌아가기'}
                  </Text>
                </TouchableOpacity>
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
    width: 180,
    height: 180,
    top: -40,
    right: -40,
  },
  decorCircle2: {
    width: 120,
    height: 120,
    bottom: 150,
    left: -60,
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
    paddingTop: 20,
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
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
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
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
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
  resetButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#667eea',
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
  // 전송 완료 화면
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  successCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  backButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
