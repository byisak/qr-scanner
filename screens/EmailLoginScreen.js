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
import { RADIUS, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EmailLoginScreen() {
  const insets = useSafeAreaInsets();
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
  const [focusedInput, setFocusedInput] = useState(null);

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

  const canSubmit = !!(email && password);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'ios' ? 3 : 12) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 타이틀 */}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
            {t('auth.loginTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('auth.loginSubtitle')}
          </Text>
        </View>

        {/* 이메일 입력 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
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
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.password')}
          </Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: colors.surface,
                borderColor: focusedInput === 'password' ? colors.primary : colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={colors.textTertiary}
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
              accessibilityRole="button"
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 로그인 버튼 */}
        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: canSubmit ? colors.primary : colors.raised },
          ]}
          onPress={handleLogin}
          disabled={isLoading || !email || !password}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.loginButtonText,
                {
                  color: canSubmit ? '#FFFFFF' : colors.textTertiary,
                  fontFamily: fonts.semiBold,
                },
              ]}
            >
              {t('auth.login')}
            </Text>
          )}
        </TouchableOpacity>

        {/* 회원가입 / 계정찾기 링크 */}
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
  },
  backButton: {
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
  },
  titleBlock: {
    marginBottom: 28,
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
    marginBottom: 12,
  },
  label: {
    ...TYPE.sectionHeader,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingLeft: 14,
    paddingRight: 2,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
  },
  passwordToggle: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  linkButton: {
    minHeight: SIZE.touch,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
