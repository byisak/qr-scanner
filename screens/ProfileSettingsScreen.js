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
  const { user, logout, withdraw, updateProfile } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(user?.name || '');

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
              onPress={() => Alert.alert(t('auth.changePassword'), '준비 중입니다')}
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
});
