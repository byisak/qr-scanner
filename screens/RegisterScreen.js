// screens/RegisterScreen.js - 회원가입 화면
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
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { register, checkEmailExists, getToken } = useAuth();
  const { syncWithServer } = useFeatureLock();
  const colors = isDark ? Colors.dark : Colors.light;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isEmailAvailable, setIsEmailAvailable] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isPasswordLongEnough = password.length >= 8;
  const hasAlphaAndNum = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password && passwordConfirm && password === passwordConfirm;

  const isFormValid =
    email &&
    validateEmail(email) &&
    isEmailChecked &&
    isEmailAvailable &&
    isPasswordLongEnough &&
    hasAlphaAndNum &&
    passwordsMatch &&
    nickname &&
    agreeTerms &&
    agreePrivacy;

  const handleEmailChange = (text) => {
    setEmail(text);
    setIsEmailChecked(false);
    setIsEmailAvailable(false);
  };

  const handleCheckEmail = async () => {
    if (!email.trim()) {
      Alert.alert(t('settings.error'), t('auth.errorEmailRequired'));
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert(t('settings.error'), t('auth.errorInvalidEmail'));
      return;
    }

    setIsCheckingEmail(true);
    try {
      const result = await checkEmailExists(email);
      setIsEmailChecked(true);
      if (result.success) {
        setIsEmailAvailable(!result.exists);
      } else {
        Alert.alert(t('settings.error'), result.error || t('auth.errorSignupFailed'));
        setIsEmailAvailable(false);
      }
    } catch (error) {
      Alert.alert(t('settings.error'), error.message);
      setIsEmailAvailable(false);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleRegister = async () => {
    // 유효성 검사
    if (!email.trim()) {
      Alert.alert(t('settings.error'), t('auth.errorEmailRequired'));
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert(t('settings.error'), t('auth.errorInvalidEmail'));
      return;
    }
    if (!isEmailChecked || !isEmailAvailable) {
      Alert.alert(t('settings.error'), t('auth.pleaseCheckEmail'));
      return;
    }
    if (!isPasswordLongEnough) {
      Alert.alert(t('settings.error'), t('auth.errorPasswordTooShort'));
      return;
    }
    if (!passwordsMatch) {
      Alert.alert(t('settings.error'), t('auth.errorPasswordMismatch'));
      return;
    }
    if (!nickname.trim()) {
      Alert.alert(t('settings.error'), t('auth.errorNicknameRequired'));
      return;
    }
    if (!agreeTerms) {
      Alert.alert(t('settings.error'), t('auth.errorAgreeTerms'));
      return;
    }
    if (!agreePrivacy) {
      Alert.alert(t('settings.error'), t('auth.errorAgreePrivacy'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(email, password, nickname);
      if (result.success) {
        // 광고 기록 서버 동기화 (회원가입 후)
        try {
          const token = await getToken();
          if (result.user?.id && token) {
            await syncWithServer(result.user.id, token);
            console.log('[AdSync] Post-register sync completed');
          }
        } catch (syncError) {
          console.warn('[AdSync] Post-register sync failed:', syncError);
          // 동기화 실패해도 회원가입은 유지
        }
        Alert.alert(t('settings.success'), t('auth.signupSuccess'), [
          {
            text: t('common.confirm'),
            onPress: () => router.dismissAll(),
          },
        ]);
      } else {
        Alert.alert(t('settings.error'), t('auth.errorSignupFailed'));
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorSignupFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderCheckbox = (checked) => (
    <View
      style={[
        styles.checkbox,
        checked
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: 'transparent', borderColor: isDark ? '#4A5260' : colors.textTertiary },
      ]}
    >
      {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
    </View>
  );

  // 유효성 아이콘: 충족 = 체크(성공색), 오류 = X(오류색), 아직 = 체크(옅은 글자색)
  const renderValidationIcon = (isValid, isError = false) => (
    <Ionicons
      name={isError ? 'close' : 'checkmark'}
      size={14}
      color={isValid ? colors.success : isError ? colors.error : colors.textTertiary}
    />
  );

  const fieldBorder = (name) => (focusedInput === name ? colors.primary : colors.border);
  const canCheckEmail = validateEmail(email) && !isCheckingEmail;

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
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('auth.signupTitle')}
        </Text>

        {/* 이메일 입력 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.email')}
          </Text>
          <View style={styles.emailInputRow}>
            <View style={[styles.inputWrapper, styles.emailInput, { backgroundColor: colors.surface, borderColor: fieldBorder('email') }]}>
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
            <TouchableOpacity
              style={[styles.checkButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
              onPress={handleCheckEmail}
              disabled={isCheckingEmail || !validateEmail(email)}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isCheckingEmail ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <Text
                  style={[
                    styles.checkButtonText,
                    {
                      color: canCheckEmail ? colors.primaryText : colors.textTertiary,
                      fontFamily: fonts.semiBold,
                    },
                  ]}
                >
                  {t('auth.checkDuplicate')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {/* 이메일 중복 확인 결과 */}
          {isEmailChecked && (
            <View style={styles.validationRow}>
              <View style={styles.validationItem}>
                {renderValidationIcon(isEmailAvailable, !isEmailAvailable)}
                <Text
                  style={[
                    styles.validationText,
                    {
                      color: isEmailAvailable ? colors.success : colors.error,
                      fontFamily: fonts.medium,
                    },
                  ]}
                >
                  {isEmailAvailable ? t('auth.emailAvailable') : t('auth.emailNotAvailable')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 비밀번호 입력 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.password')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: fieldBorder('password') }]}>
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
          {/* 비밀번호 유효성 표시 */}
          <View style={styles.validationRow}>
            <View style={styles.validationItem}>
              {renderValidationIcon(isPasswordLongEnough)}
              <Text
                style={[
                  styles.validationText,
                  {
                    color: isPasswordLongEnough ? colors.success : colors.textTertiary,
                    fontFamily: fonts.medium,
                  },
                ]}
              >
                {t('auth.passwordMinLength')}
              </Text>
            </View>
            <View style={styles.validationItem}>
              {renderValidationIcon(hasAlphaAndNum)}
              <Text
                style={[
                  styles.validationText,
                  {
                    color: hasAlphaAndNum ? colors.success : colors.textTertiary,
                    fontFamily: fonts.medium,
                  },
                ]}
              >
                {t('auth.passwordRequireAlphaNum')}
              </Text>
            </View>
          </View>
        </View>

        {/* 비밀번호 확인 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.passwordConfirm')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: fieldBorder('passwordConfirm') }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.passwordConfirmPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!showPasswordConfirm}
              autoCapitalize="none"
              onFocus={() => setFocusedInput('passwordConfirm')}
              onBlur={() => setFocusedInput(null)}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
              accessibilityRole="button"
            >
              <Ionicons
                name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {passwordConfirm.length > 0 && (
            <View style={styles.validationRow}>
              <View style={styles.validationItem}>
                {renderValidationIcon(!!passwordsMatch, !passwordsMatch)}
                <Text
                  style={[
                    styles.validationText,
                    {
                      color: passwordsMatch ? colors.success : colors.error,
                      fontFamily: fonts.medium,
                    },
                  ]}
                >
                  {passwordsMatch ? t('auth.passwordMatch') : t('auth.passwordNotMatch')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 닉네임 입력 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.nickname')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: fieldBorder('nickname') }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.nicknamePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
              onFocus={() => setFocusedInput('nickname')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        {/* 약관 동의 */}
        <View style={styles.agreementSection}>
          <TouchableOpacity
            style={styles.agreementRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreeTerms }}
          >
            {renderCheckbox(agreeTerms)}
            <Text style={[styles.agreementText, { color: colors.text, fontFamily: fonts.medium }]}>
              {t('auth.agreeTerms')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.agreementRow}
            onPress={() => setAgreePrivacy(!agreePrivacy)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreePrivacy }}
          >
            {renderCheckbox(agreePrivacy)}
            <Text style={[styles.agreementText, { color: colors.text, fontFamily: fonts.medium }]}>
              {t('auth.agreePrivacy')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 회원가입 버튼 */}
        <TouchableOpacity
          style={[
            styles.registerButton,
            { backgroundColor: isFormValid ? colors.primary : colors.raised },
          ]}
          onPress={handleRegister}
          disabled={isLoading || !isFormValid}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.registerButtonText,
                {
                  color: isFormValid ? '#FFFFFF' : colors.textTertiary,
                  fontFamily: fonts.semiBold,
                },
              ]}
            >
              {t('auth.signupButton')}
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
  title: {
    ...TYPE.tabTitle,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 16,
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
  emailInputRow: {
    flexDirection: 'row',
    gap: SPACE.gap,
  },
  emailInput: {
    flex: 1,
    paddingRight: 14,
  },
  checkButton: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  checkButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  validationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 14,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validationText: {
    fontSize: 13,
  },
  agreementSection: {
    marginTop: 4,
    marginBottom: 20,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.touch,
    paddingVertical: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agreementText: {
    fontSize: 14,
    flex: 1,
  },
  registerButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
