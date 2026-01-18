// screens/ProfileSettingsScreen.js - 프로필/계정 설정 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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

export default function ProfileSettingsScreen() {
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

  // 프로바이더 색상 가져오기
  const getProviderColor = (provider) => {
    switch (provider) {
      case 'kakao':
        return '#FEE500';
      case 'google':
        return '#4285F4';
      case 'apple':
        return isDark ? '#FFFFFF' : '#000000';
      case 'email':
        return '#E67E22';
      default:
        return colors.primary;
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('auth.profileSettings')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 카드 */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          {/* 아바타 */}
          <View style={[styles.avatarContainer, { backgroundColor: getProviderColor(user?.provider) }]}>
            <Text style={[styles.avatarText, {
              color: user?.provider === 'kakao' ? '#3C1E1E' : '#FFFFFF',
              fontFamily: fonts.bold
            }]}>
              {getInitials()}
            </Text>
            <View style={[styles.providerBadge, { backgroundColor: colors.surface }]}>
              <Ionicons
                name={getProviderIcon(user?.provider)}
                size={14}
                color={getProviderColor(user?.provider)}
              />
            </View>
          </View>

          {/* 닉네임 */}
          <View style={styles.profileInfo}>
            {isEditingNickname ? (
              <View style={styles.editNicknameContainer}>
                <TextInput
                  style={[styles.nicknameInput, {
                    color: colors.text,
                    fontFamily: fonts.semiBold,
                    borderColor: colors.primary,
                    backgroundColor: colors.background
                  }]}
                  value={nickname}
                  onChangeText={setNickname}
                  autoFocus
                  maxLength={20}
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[styles.editActionButton, { backgroundColor: colors.primary }]}
                    onPress={handleSaveNickname}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editActionButton, { backgroundColor: colors.border }]}
                    onPress={() => {
                      setNickname(user?.name || '');
                      setIsEditingNickname(false);
                    }}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.nicknameRow}
                onPress={() => setIsEditingNickname(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.nickname, { color: colors.text, fontFamily: fonts.bold }]}>
                  {user?.name || '-'}
                </Text>
                <Ionicons name="pencil" size={16} color={colors.textTertiary} style={styles.editIcon} />
              </TouchableOpacity>
            )}
            <Text style={[styles.email, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {user?.email || '-'}
            </Text>
            <View style={[styles.providerTag, { backgroundColor: isDark ? colors.border : colors.borderLight }]}>
              <Ionicons
                name={getProviderIcon(user?.provider)}
                size={12}
                color={colors.textSecondary}
              />
              <Text style={[styles.providerTagText, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                {getProviderName(user?.provider)}
              </Text>
            </View>
          </View>
        </View>

        {/* 계정 관리 섹션 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.accountManagement') || '계정 관리'}
          </Text>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            {/* 비밀번호 변경 (이메일 로그인만) */}
            {user?.provider === 'email' && (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
                onPress={() => setPasswordModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconWrapper, { backgroundColor: '#3498DB15' }]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#3498DB" />
                </View>
                <Text style={[styles.menuText, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('auth.changePassword')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* 로그아웃 */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrapper, { backgroundColor: '#9B59B615' }]}>
                <Ionicons name="log-out-outline" size={20} color="#9B59B6" />
              </View>
              <Text style={[styles.menuText, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('auth.logout')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 위험 영역 섹션 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
            {t('auth.dangerZone') || '위험 영역'}
          </Text>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            {/* 회원탈퇴 */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleWithdraw}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrapper, { backgroundColor: '#E74C3C15' }]}>
                <Ionicons name="trash-outline" size={20} color="#E74C3C" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: '#E74C3C', fontFamily: fonts.medium }]}>
                  {t('auth.withdraw')}
                </Text>
                <Text style={[styles.menuDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('auth.withdrawDesc') || '모든 데이터가 삭제됩니다'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
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
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* 모달 핸들 */}
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: fonts.bold }]}>
                {t('auth.changePassword')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPasswordModalVisible(false);
                  resetPasswordFields();
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 현재 비밀번호 */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                {t('auth.currentPassword') || '현재 비밀번호'}
              </Text>
              <View style={[styles.passwordInputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, fontFamily: fonts.regular }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  placeholder={t('auth.enterCurrentPassword') || '현재 비밀번호 입력'}
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 새 비밀번호 */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                {t('auth.newPassword') || '새 비밀번호'}
              </Text>
              <View style={[styles.passwordInputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, fontFamily: fonts.regular }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  placeholder={t('auth.enterNewPassword') || '새 비밀번호 입력 (8자 이상)'}
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 비밀번호 확인 */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
                {t('auth.confirmNewPassword') || '새 비밀번호 확인'}
              </Text>
              <View style={[styles.passwordInputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, fontFamily: fonts.regular }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder={t('auth.enterConfirmPassword') || '새 비밀번호 다시 입력'}
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 변경 버튼 */}
            <TouchableOpacity
              style={[styles.changeButton, isChangingPassword && styles.changeButtonDisabled]}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              activeOpacity={0.8}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.changeButtonText, { fontFamily: fonts.semiBold }]}>
                  {t('auth.changePassword')}
                </Text>
              )}
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  // 프로필 카드
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  providerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfo: {
    alignItems: 'center',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nickname: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  editIcon: {
    marginLeft: 8,
  },
  email: {
    fontSize: 14,
    marginTop: 4,
  },
  providerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  providerTagText: {
    fontSize: 12,
  },
  editNicknameContainer: {
    alignItems: 'center',
    gap: 12,
  },
  nicknameInput: {
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 200,
    textAlign: 'center',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 섹션
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  // 메뉴 아이템
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    flex: 1,
  },
  menuDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingRight: 8,
  },
  changeButton: {
    backgroundColor: '#E67E22',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  changeButtonDisabled: {
    opacity: 0.7,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
