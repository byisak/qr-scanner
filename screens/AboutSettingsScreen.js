// screens/AboutSettingsScreen.js - 설정 > 정보: 문의하기 / 이용약관 · 개인정보처리방침 · 사용 분석 동의 · 버전
// 약관·방침·분석 동의 행은 예전 SettingsScreen.js "앱 정보 및 지원" 섹션에서 그대로 옮겨 왔다.
// "준비 중"만 뜨던 개선 제안·1:1 문의는 메일 앱을 여는 "문의하기" 하나로 바꿨다
import React, { useState, useEffect, useRef } from 'react';
import { Text, Switch, Alert, Linking, Platform, Modal, View, TextInput, Pressable, StyleSheet, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analytics';
import { SettingsSubScreen, Group, SettingRow, NavRight, settingsStyles as s, useSettingsUi } from '../components/SettingsKit';

export const SUPPORT_EMAIL = 'support@scanview.app';
export const APP_VERSION = Constants.expoConfig?.version || '';

// 버전을 7번 누르면 진단 메뉴(스캔 디버그 표시만, 잠금 해제 없음). 암호는 해시로만 둔다
const DIAG_TAPS = 7;
const DIAG_SALT = 'scanview-diag:';
const DIAG_HASH = 'a649d967d3118b579c2445067c8161bdbf88824cf7ac4341b6cbf9397fa9968c';
const DIAG_KEY = 'diagUnlocked';

export default function AboutSettingsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const feedback = useFeedback();
  const { t, colors, fonts, isDark, switchColors, rowProps } = useSettingsUi();

  // 진단 메뉴: 버전 연속 탭 → 암호 (한 번 맞히면 이 기기에서는 계속 열림)
  const tapRef = useRef({ count: 0, at: 0 });
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);
  const openDiagnostics = () => router.push('/developer-options');
  const handleVersionTap = async () => {
    const now = Date.now();
    const tap = tapRef.current;
    tap.count = now - tap.at < 2000 ? tap.count + 1 : 1;
    tap.at = now;
    if (tap.count < DIAG_TAPS) return;
    tap.count = 0;
    const unlocked = await AsyncStorage.getItem(DIAG_KEY).catch(() => null);
    if (unlocked === 'true') { openDiagnostics(); return; }
    setPw(''); setPwError(false); setPwOpen(true);
  };
  const submitPassword = async () => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, DIAG_SALT + pw);
    if (hash !== DIAG_HASH) { setPwError(true); return; }
    await AsyncStorage.setItem(DIAG_KEY, 'true').catch(() => {});
    setPwOpen(false);
    openDiagnostics();
  };

  // 분석 동의 상태
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  useEffect(() => {
    getAnalyticsConsent().then(setAnalyticsEnabled).catch(() => {});
  }, []);

  // 분석 동의 토글
  const handleAnalyticsToggle = async (value) => {
    setAnalyticsEnabled(value);
    await setAnalyticsConsent(value);
  };

  // 메일 앱을 연다. 메일 앱이 없으면 주소를 보여 주고 복사할 수 있게 한다
  const handleContact = async () => {
    const subject = `${t('settingsHub.contactSubject')} (v${APP_VERSION}, ${Platform.OS})`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        t('settingsHub.noMailTitle'),
        t('settingsHub.noMailMessage', { email: SUPPORT_EMAIL }),
        [
          { text: t('common.close'), style: 'cancel' },
          {
            text: t('settingsHub.copyEmail'),
            onPress: async () => {
              await Clipboard.setStringAsync(SUPPORT_EMAIL);
              feedback.success(t('settingsHub.emailCopied'));
            },
          },
        ]
      );
    }
  };

  return (
    <SettingsSubScreen title={t('settingsHub.info')}>
      <Group colors={colors}>
        {/* 문의하기 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.contact')}
          desc={SUPPORT_EMAIL}
          onPress={handleContact}
        >
          <NavRight {...rowProps} />
        </SettingRow>
      </Group>

      <Group colors={colors} style={{ marginTop: 6 }}>
        {/* 서비스 이용약관 */}
        <SettingRow {...rowProps}
          label={t('settings.termsOfService')}
          onPress={() => router.push({
            pathname: '/webview',
            params: { url: `https://scanview.app/legal/terms?lang=${language}&theme=${isDark ? 'dark' : 'light'}` }
          })}
        >
          <NavRight {...rowProps} />
        </SettingRow>

        {/* 개인정보 처리방침 */}
        <SettingRow {...rowProps}
          label={t('settings.privacyPolicy')}
          onPress={() => router.push({
            pathname: '/webview',
            params: { url: `https://scanview.app/legal/privacy?lang=${language}&theme=${isDark ? 'dark' : 'light'}` }
          })}
        >
          <NavRight {...rowProps} />
        </SettingRow>

        {/* 사용 분석 동의 */}
        <SettingRow {...rowProps}
          label={t('settings.analyticsConsent') || '사용 분석 동의'}
          desc={t('settings.analyticsConsentDesc') || '앱 개선을 위한 익명 사용 데이터 수집'}
        >
          <Switch
            value={analyticsEnabled}
            onValueChange={handleAnalyticsToggle}
            {...switchColors}
            accessibilityLabel={t('settings.analyticsConsent')}
          />
        </SettingRow>

        {/* 버전정보 */}
        <SettingRow {...rowProps}
          label={t('settingsHub.version')}
          onPress={handleVersionTap}
        >
          <Text style={[s.value, { color: colors.textSecondary, fontFamily: fonts.medium }]}>{APP_VERSION}</Text>
        </SettingRow>
      </Group>

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ds.backdrop}>
          <View style={[ds.card, { backgroundColor: colors.surface }]}>
            <Text style={[ds.title, { color: colors.text, fontFamily: fonts.semiBold }]}>{t('settingsHub.diagPasswordTitle')}</Text>
            <TextInput
              value={pw}
              onChangeText={(v) => { setPw(v); setPwError(false); }}
              onSubmitEditing={submitPassword}
              placeholder={t('settingsHub.diagPasswordPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              keyboardType="number-pad"
              autoFocus
              style={[ds.input, { color: colors.text, borderColor: pwError ? colors.error : colors.border, fontFamily: fonts.regular }]}
            />
            {pwError && <Text style={[ds.error, { color: colors.error, fontFamily: fonts.regular }]}>{t('settingsHub.diagPasswordWrong')}</Text>}
            <View style={ds.buttons}>
              <Pressable onPress={() => setPwOpen(false)} style={ds.button} accessibilityRole="button">
                <Text style={{ color: colors.textSecondary, fontFamily: fonts.medium }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={submitPassword} style={ds.button} accessibilityRole="button">
                <Text style={{ color: colors.primary, fontFamily: fonts.semiBold }}>{t('common.confirm')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SettingsSubScreen>
  );
}

const ds = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 32 },
  card: { borderRadius: 16, padding: 20 },
  title: { fontSize: 17, marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  error: { fontSize: 13, marginTop: 6 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 8 },
  button: { paddingHorizontal: 14, paddingVertical: 8 },
});
