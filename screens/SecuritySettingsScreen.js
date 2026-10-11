// screens/SecuritySettingsScreen.js - 인증/보안 설정 화면
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { RADIUS, SPACE, SIZE, TYPE } from '../constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialPressable from '../components/MaterialPressable';

export default function SecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
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
    // Face ID / Touch ID는 Apple 상표라 Android에서는 일반 명칭을 쓴다
    if (biometricType === 'FaceID') {
      return Platform.OS === 'ios' ? 'Face ID' : (t('security.faceRecognition') || '얼굴 인식');
    } else if (biometricType === 'TouchID') {
      return Platform.OS === 'ios' ? 'Touch ID' : (t('security.fingerprint') || '지문');
    }
    return t('security.biometric') || '생체인증';
  };

  const switchColors = {
    trackColor: { true: colors.primary, false: colors.switchOff },
    thumbColor: '#fff',
    ios_backgroundColor: colors.switchOff,
  };

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
          {t('security.title') || '인증/보안'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 앱 잠금이 비활성화된 경우 */}
        {!appLockEnabled ? (
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialPressable
              style={[styles.row, styles.rowWithDesc]}
              onPress={handleEnableAppLock}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('security.enableAppLock') || '앱 잠금 설정'}
                </Text>
                <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('security.enableAppLockDesc') || 'PIN 또는 생체인증으로 앱을 보호합니다'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </MaterialPressable>
          </View>
        ) : (
          <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* PIN 비밀번호 변경 */}
            <MaterialPressable
              style={styles.row}
              onPress={handleChangePinPress}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('security.changePin') || 'PIN 비밀번호 변경'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </MaterialPressable>

            <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />

            {/* Face ID 사용 */}
            <View style={[styles.row, styles.rowWithDesc]}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.text, fontFamily: fonts.medium }]}>
                  {t('security.useBiometric') || `${getBiometricLabel()} 사용`}
                </Text>
                <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('security.useBiometricDesc') || `${getBiometricLabel()}를 사용하여 본인 확인.`}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                {...switchColors}
                disabled={!biometricAvailable}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />

            {/* 앱 잠금 해제 */}
            <MaterialPressable
              style={[styles.row, styles.rowWithDesc]}
              onPress={handleDisableAppLock}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: colors.error, fontFamily: fonts.medium }]}>
                  {t('security.disableAppLock') || '앱 잠금 해제'}
                </Text>
                <Text style={[styles.desc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                  {t('security.disableAppLockDesc') || '앱 잠금을 비활성화합니다'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </MaterialPressable>
          </View>
        )}

        {/* 설명 */}
        <View style={[styles.infoBox, { backgroundColor: colors.raised }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
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
    gap: SPACE.section,
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
  },
  desc: {
    ...TYPE.caption,
    lineHeight: 17,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: RADIUS.control,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
