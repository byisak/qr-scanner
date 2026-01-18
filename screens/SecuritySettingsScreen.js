// screens/SecuritySettingsScreen.js - 인증/보안 설정 화면
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { Colors } from '../constants/Colors';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const {
    appLockEnabled,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    toggleBiometric,
    disableAppLock,
  } = useAppLock();
  const colors = isDark ? Colors.dark : Colors.light;

  // 화면 포커스 시 설정 새로고침
  useFocusEffect(
    useCallback(() => {
      // 설정 변경사항 반영
    }, [])
  );

  // PIN 비밀번호 변경
  const handleChangePinPress = () => {
    router.push('/pin-change');
  };

  // Face ID 토글
  const handleBiometricToggle = async (value) => {
    if (value && !biometricAvailable) {
      Alert.alert(
        t('security.biometricNotAvailable') || '생체인증 불가',
        t('security.biometricNotAvailableDesc') || '이 기기에서 생체인증을 사용할 수 없습니다. 기기 설정에서 Face ID 또는 지문을 등록해주세요.'
      );
      return;
    }

    const result = await toggleBiometric(value);
    if (!result.success) {
      Alert.alert(t('settings.error'), t('security.toggleBiometricError') || '설정 변경에 실패했습니다.');
    }
  };

  // 앱 잠금 해제 (비활성화)
  const handleDisableAppLock = () => {
    router.push({
      pathname: '/pin-verify',
      params: { mode: 'disable' },
    });
  };

  // 앱 잠금 활성화
  const handleEnableAppLock = () => {
    router.push({
      pathname: '/pin-setup',
      params: { mode: 'enable' },
    });
  };

  // 생체인증 타입에 따른 라벨
  const getBiometricLabel = () => {
    if (biometricType === 'FaceID') {
      return 'Face ID';
    } else if (biometricType === 'TouchID') {
      return 'Touch ID';
    }
    return t('security.biometric') || '생체인증';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('security.title') || '인증/보안'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 앱 잠금이 비활성화된 경우 */}
        {!appLockEnabled ? (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEnableAppLock}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrapper, { backgroundColor: '#3498DB15' }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#3498DB" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('security.enableAppLock') || '앱 잠금 설정'}
                </Text>
                <Text style={[styles.menuDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                  {t('security.enableAppLockDesc') || 'PIN 또는 생체인증으로 앱을 보호합니다'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* PIN 비밀번호 변경 */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                onPress={handleChangePinPress}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('security.changePin') || 'PIN 비밀번호 변경'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Face ID 사용 */}
              <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: colors.text, fontFamily: fonts.semiBold }]}>
                    {t('security.useBiometric') || `${getBiometricLabel()} 사용`}
                  </Text>
                  <Text style={[styles.menuDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                    {t('security.useBiometricDesc') || `${getBiometricLabel()}를 사용하여 본인 확인.`}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ true: colors.success, false: isDark ? '#39393d' : '#E5E5EA' }}
                  thumbColor="#fff"
                  disabled={!biometricAvailable}
                />
              </View>

              {/* 앱 잠금 해제 */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDisableAppLock}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: '#E74C3C', fontFamily: fonts.semiBold }]}>
                    {t('security.disableAppLock') || '앱 잠금 해제'}
                  </Text>
                  <Text style={[styles.menuDesc, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
                    {t('security.disableAppLockDesc') || '앱 잠금을 비활성화합니다'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* 설명 */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
          <Text style={[styles.infoText, { color: colors.textTertiary, fontFamily: fonts.regular }]}>
            {t('security.infoText') || '앱 잠금을 설정하면 앱 실행 시 PIN 비밀번호 또는 생체인증으로 본인 확인을 진행합니다.'}
          </Text>
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
  section: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  },
  menuLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
