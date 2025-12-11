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
import { Colors } from '../constants/Colors';

export default function RegisterScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { register, checkEmailExists } = useAuth();
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

  const renderCheckbox = (checked, onPress) => (
    <TouchableOpacity
      style={[
        styles.checkbox,
        {
          backgroundColor: checked ? '#E67E22' : 'transparent',
          borderColor: checked ? '#E67E22' : colors.borderLight,
        },
      ]}
      onPress={onPress}
    >
      {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
    </TouchableOpacity>
  );

  const renderValidationIcon = (isValid) => (
    <Ionicons
      name={isValid ? 'checkmark-circle' : 'ellipse-outline'}
      size={16}
      color={isValid ? '#27AE60' : colors.textTertiary}
    />
  );

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
          {t('auth.signupTitle')}
        </Text>

        {/* 이메일 입력 */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('auth.email')}
          </Text>
          <View style={styles.emailInputRow}>
            <View style={[styles.inputWrapper, styles.emailInput, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.checkButton,
                {
                  backgroundColor: validateEmail(email) && !isCheckingEmail ? '#E67E22' : colors.borderLight,
                },
              ]}
              onPress={handleCheckEmail}
              disabled={isCheckingEmail || !validateEmail(email)}
              activeOpacity={0.8}
            >
              {isCheckingEmail ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  style={[
                    styles.checkButtonText,
                    {
                      color: validateEmail(email) ? '#fff' : colors.textTertiary,
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
                {renderValidationIcon(isEmailAvailable)}
                <Text
                  style={[
                    styles.validationText,
                    {
                      color: isEmailAvailable ? '#27AE60' : '#E74C3C',
                      fontFamily: fonts.regular,
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
          {/* 비밀번호 유효성 표시 */}
          <View style={styles.validationRow}>
            <View style={styles.validationItem}>
              {renderValidationIcon(isPasswordLongEnough)}
              <Text
                style={[
                  styles.validationText,
                  {
                    color: isPasswordLongEnough ? '#27AE60' : colors.textTertiary,
                    fontFamily: fonts.regular,
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
                    color: hasAlphaAndNum ? '#27AE60' : colors.textTertiary,
                    fontFamily: fonts.regular,
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
          <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('auth.passwordConfirm')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.passwordConfirmPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!showPasswordConfirm}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
            >
              <Ionicons
                name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
          {passwordConfirm.length > 0 && (
            <View style={styles.validationRow}>
              <View style={styles.validationItem}>
                {renderValidationIcon(passwordsMatch)}
                <Text
                  style={[
                    styles.validationText,
                    {
                      color: passwordsMatch ? '#27AE60' : '#E74C3C',
                      fontFamily: fonts.regular,
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
          <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semiBold }]}>
            {t('auth.nickname')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: fonts.regular }]}
              placeholder={t('auth.nicknamePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* 약관 동의 */}
        <View style={styles.agreementSection}>
          <TouchableOpacity
            style={styles.agreementRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
            activeOpacity={0.7}
          >
            {renderCheckbox(agreeTerms, () => setAgreeTerms(!agreeTerms))}
            <Text style={[styles.agreementText, { color: colors.text, fontFamily: fonts.regular }]}>
              {t('auth.agreeTerms')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.agreementRow}
            onPress={() => setAgreePrivacy(!agreePrivacy)}
            activeOpacity={0.7}
          >
            {renderCheckbox(agreePrivacy, () => setAgreePrivacy(!agreePrivacy))}
            <Text style={[styles.agreementText, { color: colors.text, fontFamily: fonts.regular }]}>
              {t('auth.agreePrivacy')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 회원가입 버튼 */}
        <TouchableOpacity
          style={[
            styles.registerButton,
            { backgroundColor: isFormValid ? '#E67E22' : colors.borderLight },
          ]}
          onPress={handleRegister}
          disabled={isLoading || !isFormValid}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[
                styles.registerButtonText,
                {
                  color: isFormValid ? '#fff' : colors.textTertiary,
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
  emailInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  emailInput: {
    flex: 1,
  },
  checkButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
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
    height: 52,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 8,
  },
  validationRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
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
    marginTop: 8,
    marginBottom: 24,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
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
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
