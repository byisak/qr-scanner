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
    if (newPassword.length < 6) {
      Alert.alert(t('settings.error'), t('auth.errorPasswordLength') || '비밀번호는 6자 이상이어야 합니다');
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
    const result = await changePassword(currentPassword, newPassword);
    setIsChangingPassword(false);

    if (result.success) {
      setPasswordModalVisible(false);
      resetPasswordFields();
      Alert.alert(t('settings.success'), t('auth.passwordChangeSuccess') || '비밀번호가 변경되었습니다');
    } else {
      Alert.alert(t('settings.error'), result.error || t('auth.passwordChangeFailed') || '비밀번호 변경에 실패했습니다');
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
      <View style={styles.header}>
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
      >
        {/* 프로필 정보 섹션 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          {/* 닉네임 */}
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('auth.nickname')}
            </Text>
            {isEditingNickname ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.nicknameInput, { color: colors.text, fontFamily: fonts.regular, borderColor: colors.borderLight }]}
                  value={nickname}
                  onChangeText={setNickname}
                  autoFocus
                />
                <TouchableOpacity onPress={handleSaveNickname}>
                  <Text style={[styles.saveButton, { color: '#E67E22', fontFamily: fonts.semiBold }]}>
                    {t('common.save')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setNickname(user?.name || '');
                  setIsEditingNickname(false);
                }}>
                  <Text style={[styles.cancelButton, { color: colors.textTertiary, fontFamily: fonts.medium }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.valueRow}>
                <Text style={[styles.infoValue, { color: colors.text, fontFamily: fonts.regular }]}>
                  {user?.name || '-'}
                </Text>
                <TouchableOpacity onPress={() => setIsEditingNickname(true)}>
                  <Text style={[styles.editButton, { color: '#E67E22', fontFamily: fonts.medium }]}>
                    {t('common.edit')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 이메일 */}
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
              {t('auth.email')}
            </Text>
            <View style={styles.valueRow}>
              <Text style={[styles.infoValue, { color: colors.text, fontFamily: fonts.regular }]}>
                {user?.email || '-'}
              </Text>
              {user?.provider && (
                <Text style={[styles.providerBadge, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  ({getProviderName(user.provider)})
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 계정 관리 섹션 */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          {/* 비밀번호 변경 (이메일 로그인만) */}
          {user?.provider === 'email' && (
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => setPasswordModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuText, { color: colors.text, fontFamily: fonts.medium }]}>
                {t('auth.changePassword')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* 로그아웃 */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuText, { color: colors.text, fontFamily: fonts.medium }]}>
              {t('auth.logout')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* 회원탈퇴 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleWithdraw}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuText, { color: '#E74C3C', fontFamily: fonts.medium }]}>
              {t('auth.withdraw')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
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
                <Ionicons name="close" size={24} color={colors.text} />
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
                  placeholder={t('auth.enterNewPassword') || '새 비밀번호 입력 (6자 이상)'}
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
    paddingBottom: 10,
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
    paddingBottom: 40,
  },
  profileImageSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileImageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  changeImageButton: {
    marginTop: 12,
  },
  changeImageText: {
    fontSize: 15,
  },
  section: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
  },
  providerBadge: {
    fontSize: 13,
    marginLeft: 8,
  },
  editButton: {
    fontSize: 14,
    paddingLeft: 12,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nicknameInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveButton: {
    fontSize: 14,
  },
  cancelButton: {
    fontSize: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuText: {
    fontSize: 16,
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
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
