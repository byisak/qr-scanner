// screens/LoginScreen.js - 소셜 로그인 선택 화면
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

export default function LoginScreen() {
  const router = useRouter();
  const { language, t, fonts } = useLanguage();
  const { isDark } = useTheme();
  const { loginWithKakao, loginWithGoogle, loginWithApple } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;

  // 한국어일 때 카카오, 다른 언어일 때 구글
  const isKorean = language === 'ko';

  const handleKakaoLogin = async () => {
    try {
      const result = await loginWithKakao();
      if (result.success) {
        router.back();
      } else {
        Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        router.back();
      } else {
        Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
    }
  };

  const handleAppleLogin = async () => {
    try {
      const result = await loginWithApple();
      if (result.success) {
        router.back();
      } else {
        Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
      }
    } catch (error) {
      Alert.alert(t('settings.error'), t('auth.errorLoginFailed'));
    }
  };

  const handleEmailLogin = () => {
    router.push('/email-login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFF5E6' }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
      </View>

      {/* 로고 및 타이틀 */}
      <View style={styles.logoSection}>
        <Text style={[styles.logoText, { fontFamily: fonts.bold }]}>QR Scanner</Text>
        <Text style={[styles.subtitle, { fontFamily: fonts.medium }]}>
          {t('auth.loginSubtitle')}
        </Text>
      </View>

      {/* 이미지 영역 */}
      <View style={styles.imageSection}>
        <View style={styles.imagePlaceholder}>
          <Ionicons name="qr-code-outline" size={120} color="#E67E22" />
        </View>
      </View>

      {/* 로그인 버튼들 */}
      <View style={styles.buttonSection}>
        {/* 최근 로그인 표시 (옵션) */}
        {/* <View style={styles.recentLoginBadge}>
          <Text style={styles.recentLoginText}>{t('auth.recentLogin')}</Text>
        </View> */}

        {/* 카카오 또는 구글 로그인 (언어에 따라) */}
        {isKorean ? (
          <TouchableOpacity
            style={[styles.loginButton, styles.kakaoButton]}
            onPress={handleKakaoLogin}
            activeOpacity={0.8}
          >
            <View style={styles.buttonIcon}>
              <Ionicons name="chatbubble" size={20} color="#000" />
            </View>
            <Text style={[styles.buttonText, styles.kakaoText, { fontFamily: fonts.semiBold }]}>
              {t('auth.loginWithKakao')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.loginButton, styles.googleButton]}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <View style={styles.buttonIcon}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={[styles.buttonText, styles.googleText, { fontFamily: fonts.semiBold }]}>
              {t('auth.loginWithGoogle')}
            </Text>
          </TouchableOpacity>
        )}

        {/* 네이버 로그인 (한국어만) */}
        {isKorean && (
          <TouchableOpacity
            style={[styles.loginButton, styles.naverButton]}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <View style={styles.buttonIcon}>
              <Text style={[styles.naverIcon, { fontFamily: fonts.bold }]}>N</Text>
            </View>
            <Text style={[styles.buttonText, styles.naverText, { fontFamily: fonts.semiBold }]}>
              네이버로 로그인
            </Text>
          </TouchableOpacity>
        )}

        {/* 애플 로그인 (iOS만) */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.loginButton, styles.appleButton]}
            onPress={handleAppleLogin}
            activeOpacity={0.8}
          >
            <View style={styles.buttonIcon}>
              <Ionicons name="logo-apple" size={20} color="#fff" />
            </View>
            <Text style={[styles.buttonText, styles.appleText, { fontFamily: fonts.semiBold }]}>
              {t('auth.loginWithApple')}
            </Text>
          </TouchableOpacity>
        )}

        {/* 이메일 로그인 링크 */}
        <TouchableOpacity
          style={styles.emailLoginLink}
          onPress={handleEmailLogin}
          activeOpacity={0.7}
        >
          <Text style={[styles.emailLoginText, { fontFamily: fonts.medium }]}>
            {t('auth.loginWithEmail')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E67E22',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
  },
  imageSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  imagePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 20,
    backgroundColor: 'rgba(230, 126, 34, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  recentLoginBadge: {
    alignSelf: 'center',
    backgroundColor: '#666',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  recentLoginText: {
    color: '#fff',
    fontSize: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 카카오
  kakaoButton: {
    backgroundColor: '#FEE500',
  },
  kakaoText: {
    color: '#000',
  },
  // 네이버
  naverButton: {
    backgroundColor: '#03C75A',
  },
  naverText: {
    color: '#fff',
  },
  naverIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  // 구글
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleText: {
    color: '#333',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  // 애플
  appleButton: {
    backgroundColor: '#000',
  },
  appleText: {
    color: '#fff',
  },
  // 이메일 로그인
  emailLoginLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  emailLoginText: {
    fontSize: 15,
    color: '#666',
    textDecorationLine: 'underline',
  },
});
