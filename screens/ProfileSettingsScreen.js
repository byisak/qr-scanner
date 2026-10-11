// screens/ProfileSettingsScreen.js - 프로필/계정 설정 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Platform,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import MaterialPressable from '../components/MaterialPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { user, logout, withdraw, updateProfile, changePassword } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(user?.name || '');

  // 비밀번호 변경 관련 상태
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null); // 입력칸 포커스 테두리 표시용

  // 프로필 이니셜 가져오기
  const getInitials = () => {
    const name = user?.name || user?.email || '?';
    return name.charAt(0).toUpperCase();
  };

  // 프로바이더 아이콘 가져오기
  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'kakao':
        return 'chatbubble';
      case 'google':
        return 'logo-google';
      case 'apple':
        return 'logo-apple';
      case 'email':
        return 'mail';
      default:
        return 'person';
    }
  };

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      Alert.alert(t('settings.error'), t('auth.errorNicknameRequired'));
      return;
    }

    const result = await updateProfile({ name: nickname });
    if (result.success) {
      setIsEditingNickname(false);
      Alert.alert(t('settings.success'), t('auth.profileUpdateSuccess'));
    }
  };

  const resetPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  // 비밀번호 유효성 검사 함수
  const validatePassword = (password) => {
    if (password.length < 8) {
      return { valid: false, message: t('auth.errorPasswordMin8') || '비밀번호는 최소 8자 이상이어야 합니다.' };
    }
    if (password.length > 100) {
      return { valid: false, message: t('auth.errorPasswordMax100') || '비밀번호는 100자를 초과할 수 없습니다.' };
    }
    if (!/[A-Za-z]/.test(password)) {
      return { valid: false, message: t('auth.errorPasswordLetter') || '비밀번호에 영문자를 포함해야 합니다.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: t('auth.errorPasswordNumber') || '비밀번호에 숫자를 포함해야 합니다.' };
    }
    return { valid: true, message: null };
  };

  const handleChangePassword = async () => {
    // 유효성 검사
    if (!currentPassword) {
      Alert.alert(t('settings.error'), t('auth.errorCurrentPasswordRequired') || '현재 비밀번호를 입력해주세요');
      return;
    }
    if (!newPassword) {
      Alert.alert(t('settings.error'), t('auth.errorNewPasswordRequired') || '새 비밀번호를 입력해주세요');
      return;
    }

    // 새 비밀번호 강도 검사
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      Alert.alert(t('settings.error'), validation.message);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('settings.error'), t('auth.errorPasswordMismatch') || '새 비밀번호가 일치하지 않습니다');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert(t('settings.error'), t('auth.errorSamePassword') || '현재 비밀번호와 다른 비밀번호를 입력해주세요');
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword, confirmPassword);
    setIsChangingPassword(false);

    if (result.success) {
      setPasswordModalVisible(false);
      resetPasswordFields();
      // 성공 시 로그아웃 후 로그인 화면으로 이동
      Alert.alert(
        t('settings.success'),
        t('auth.passwordChangeSuccessRelogin') || '비밀번호가 변경되었습니다. 다시 로그인해주세요.',
        [
          {
            text: t('common.confirm'),
            onPress: async () => {
              await logout();
              router.replace('/');
            },
          },
        ]
      );
    } else {
      // 에러 코드별 처리
      let errorMessage = result.error || t('auth.passwordChangeFailed') || '비밀번호 변경에 실패했습니다';
      if (result.errorCode === 'AUTH_INVALID_CREDENTIALS') {
        errorMessage = t('auth.errorCurrentPasswordWrong') || '현재 비밀번호가 올바르지 않습니다.';
      }
      Alert.alert(t('settings.error'), errorMessage);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.back();
        },
      },
    ]);
  };

  const handleWithdraw = () => {
    Alert.alert(t('auth.withdraw'), t('auth.withdrawConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          await withdraw();
          router.back();
        },
      },
    ]);
  };

  const getProviderName = (provider) => {
    switch (provider) {
      case 'kakao':
        return t('auth.kakaoLogin');
      case 'google':
        return t('auth.googleLogin');
      case 'apple':
        return t('auth.appleLogin');
      case 'email':
        return t('auth.emailLogin');
      default:
        return provider;
    }
  };

  // 비밀번호 입력칸 (라벨 위, 눈 아이콘 토글)
  const renderPasswordField = (field, label, value, onChangeText, visible, setVisible, placeholder) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
        {label}
      </Text>
      <View style={[styles.passwordInputWrapper, {
        borderColor: focusedField === field ? colors.primary : colors.border,
        backgroundColor: colors.inputBackground,
      }]}>
        <TextInput
          style={[styles.passwordInput, { color: colors.text, fontFamily: fonts.regular }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setFocusedField(field)}
          onBlur={() => setFocusedField(null)}
        />
        <MaterialPressable style={styles.eyeButton} onPress={() => setVisible(!visible)} accessibilityRole="button">
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textSecondary}
          />
        </MaterialPressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 하위 화면 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <MaterialPressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </MaterialPressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {t('auth.profileSettings')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 프로필 카드 */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileTop}>
            {/* 아바타 */}
            <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.avatarText, { color: colors.primaryText, fontFamily: fonts.bold }]}>
                {getInitials()}
              </Text>
            </View>

            {/* 닉네임 · 이메일 */}
            <View style={styles.profileInfo}>
              {isEditingNickname ? (
                <TextInput
                  style={[styles.nicknameInput, {
                    color: colors.text,
                    fontFamily: fonts.medium,
                    borderColor: colors.primary,
                    backgroundColor: colors.inputBackground,
                  }]}
                  value={nickname}
                  onChangeText={setNickname}
                  autoFocus
                  maxLength={20}
                  placeholderTextColor={colors.textTertiary}
                />
              ) : (
                <MaterialPressable
                  style={styles.nicknameRow}
                  onPress={() => setIsEditingNickname(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text style={[styles.nickname, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
                    {user?.name || '-'}
                  </Text>
                  <Ionicons name="pencil" size={14} color={colors.textTertiary} />
                </MaterialPressable>
              )}
              {!isEditingNickname && (
                <Text style={[styles.email, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
                  {user?.email || '-'}
                </Text>
              )}
            </View>

            {isEditingNickname && (
              <View style={styles.editButtons}>
                <MaterialPressable
                  style={[styles.editActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveNickname}
                  accessibilityRole="button"
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </MaterialPressable>
                <MaterialPressable
                  style={[styles.editActionButton, styles.editCancelButton, { backgroundColor: colors.raised, borderColor: colors.border }]}
                  onPress={() => {
                    setNickname(user?.name || '');
                    setIsEditingNickname(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <Ionicons name="close" size={20} color={colors.text} />
                </MaterialPressable>
              </View>
            )}
          </View>

          {/* 로그인 방식 배지 */}
          <View style={[styles.providerTag, { backgroundColor: colors.raised }]}>
            <Ionicons
              name={getProviderIcon(user?.provider)}
              size={12}
              color={colors.textSecondary}
            />
            <Text style={[styles.providerTagText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
              {getProviderName(user?.provider)}
            </Text>
          </View>
        </View>

        {/* 계정 관리 섹션 */}
        <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {t('auth.accountManagement') || '계정 관리'}
        </Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* 비밀번호 변경 (이메일 로그인만) */}
          {user?.provider === 'email' && (
            <>
              <MaterialPressable
                style={styles.row}
                onPress={() => setPasswordModalVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('auth.changePassword')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </MaterialPressable>
              <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />
            </>
          )}

          {/* 로그아웃 */}
          <MaterialPressable
            style={styles.row}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.label, { color: colors.error, fontFamily: fonts.medium }]}>
              {t('auth.logout')}
            </Text>
          </MaterialPressable>
        </View>

        {/* 위험 영역 섹션 */}
        <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
          {t('auth.dangerZone') || '위험 영역'}
        </Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* 회원탈퇴 */}
          <MaterialPressable
            style={[styles.row, styles.rowWithDesc]}
            onPress={handleWithdraw}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.error, fontFamily: fonts.medium }]}>
                {t('auth.withdraw')}
              </Text>
              <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('auth.withdrawDesc') || '모든 데이터가 삭제됩니다'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </MaterialPressable>
        </View>
      </ScrollView>

      {/* 비밀번호 변경 모달 */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPasswordModalVisible(false);
          resetPasswordFields();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 24 }]}>
            {/* 모달 핸들 */}
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                {t('auth.changePassword')}
              </Text>
              <MaterialPressable
                onPress={() => {
                  setPasswordModalVisible(false);
                  resetPasswordFields();
                }}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </MaterialPressable>
            </View>

            {/* 현재 비밀번호 */}
            {renderPasswordField(
              'current',
              t('auth.currentPassword') || '현재 비밀번호',
              currentPassword,
              setCurrentPassword,
              showCurrentPassword,
              setShowCurrentPassword,
              t('auth.enterCurrentPassword') || '현재 비밀번호 입력',
            )}

            {/* 새 비밀번호 */}
            {renderPasswordField(
              'new',
              t('auth.newPassword') || '새 비밀번호',
              newPassword,
              setNewPassword,
              showNewPassword,
              setShowNewPassword,
              t('auth.enterNewPassword') || '새 비밀번호 입력 (8자 이상)',
            )}

            {/* 비밀번호 확인 */}
            {renderPasswordField(
              'confirm',
              t('auth.confirmNewPassword') || '새 비밀번호 확인',
              confirmPassword,
              setConfirmPassword,
              showConfirmPassword,
              setShowConfirmPassword,
              t('auth.enterConfirmPassword') || '새 비밀번호 다시 입력',
            )}

            {/* 변경 버튼 */}
            <MaterialPressable
              style={[styles.changeButton, { backgroundColor: isChangingPassword ? colors.raised : colors.primary }]}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: isChangingPassword, busy: isChangingPassword }}
            >
              {isChangingPassword ? (
                <ActivityIndicator color={colors.textTertiary} />
              ) : (
                <Text style={[styles.changeButtonText, { fontFamily: fonts.semiBold }]}>
                  {t('auth.changePassword')}
                </Text>
              )}
            </MaterialPressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPE.screenTitle,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: SIZE.touch,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACE.screen,
    paddingTop: 8,
    gap: SPACE.gap,
  },
  // 프로필 카드
  profileCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACE.card,
    gap: 14,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: SIZE.touch,
    gap: 6,
  },
  nickname: {
    fontSize: 18,
    fontWeight: '600',
    flexShrink: 1,
  },
  email: {
    fontSize: 13,
    lineHeight: 18,
  },
  providerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.badge,
    gap: 6,
  },
  providerTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nicknameInput: {
    height: 48,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editActionButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelButton: {
    borderWidth: 1,
  },
  // 섹션 · 묶음 카드
  sectionHeader: {
    ...TYPE.sectionHeader,
    marginTop: 14,
    marginHorizontal: 4,
  },
  group: {
    borderRadius: RADIUS.group,
    borderWidth: 1,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: SIZE.row,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowWithDesc: {
    minHeight: SIZE.rowWithDesc,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...TYPE.body,
    flex: 1,
  },
  rowLabel: {
    ...TYPE.body,
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    paddingHorizontal: SPACE.card,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingLeft: 14,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  eyeButton: {
    width: SIZE.touch,
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeButton: {
    height: SIZE.primaryButton,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
