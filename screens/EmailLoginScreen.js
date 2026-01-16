// screens/EmailLoginScreen.js - 이메일/비밀번호 로그인 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureLock } from '../contexts/FeatureLockContext';
import { Colors } from '../constants/Colors';

export default function EmailLoginScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { loginWithEmail, getToken } = useAuth();
  const { syncWithServer } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
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
        // 광고 기록 서버 동기화 (로그인 성공 후)
        try {
          const token = await getToken();
          if (result.user?.id && token) {
            await syncWithServer(result.user.id, token);
            console.log('[AdSync] Post-login sync completed');
          }
        } catch (syncError) {
          console.warn('[AdSync] Post-login sync failed:', syncError);
          // 동기화 실패해도 로그인은 유지
        }
        // 설정 화면으로 돌아가기
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

  const handleSignup = () => {
    router.push('/register');
  };

  const handleFindAccount = () => {
    router.push('/forgot-password');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 타이틀 */}
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('auth.loginTitle')}
        </Text>

        {/* 이메일 입력 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('auth.email')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={colors.textTertiary}
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
          <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('auth.password')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={colors.textTertiary}
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
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 회원가입 / 계정찾기 링크 */}
        <View style={styles.linksRow}>
          <TouchableOpacity onPress={handleSignup}>
            <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('auth.signup')}
            </Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <TouchableOpacity onPress={handleFindAccount}>
            <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('auth.findAccount')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 로그인 버튼 */}
        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: email && password ? '#E67E22' : colors.borderLight },
          ]}
          onPress={handleLogin}
          disabled={isLoading || !email || !password}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[
                styles.loginButtonText,
                {
                  color: email && password ? '#fff' : colors.textTertiary,
                  fontFamily: fonts.semiBold,
                },
              ]}
            >
              {t('auth.login')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 10,
  },
  backButton: {
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 8,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  linkText: {
    fontSize: 14,
    paddingHorizontal: 12,
  },
  divider: {
    width: 1,
    height: 14,
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
