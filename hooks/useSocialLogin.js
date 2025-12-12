// hooks/useSocialLogin.js - 소셜 로그인 SDK 통합 훅
import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as KakaoLogin from '@react-native-seoul/kakao-login';
import config from '../config/config';

// WebBrowser warm up for faster auth
WebBrowser.maybeCompleteAuthSession();

/**
 * 카카오 로그인 훅
 * 패키지: @react-native-seoul/kakao-login 사용 (네이티브 SDK)
 */
export const useKakaoLogin = () => {
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      // 네이티브 SDK로 로그인
      const token = await KakaoLogin.login();

      return {
        success: true,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        idToken: token.idToken,
      };
    } catch (error) {
      console.error('Kakao login error:', error);
      if (error.code === 'E_CANCELLED_OPERATION') {
        return { success: false, error: 'Kakao login cancelled' };
      }
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 프로필 가져오기
  const getProfile = useCallback(async () => {
    try {
      const profile = await KakaoLogin.getProfile();
      return { success: true, profile };
    } catch (error) {
      console.error('Kakao getProfile error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      await KakaoLogin.logout();
      return { success: true };
    } catch (error) {
      console.error('Kakao logout error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // 연결 끊기 (탈퇴)
  const unlink = useCallback(async () => {
    try {
      await KakaoLogin.unlink();
      return { success: true };
    } catch (error) {
      console.error('Kakao unlink error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  return { login, getProfile, logout, unlink, isLoading };
};

/**
 * 네이버 로그인 훅
 * expo-auth-session으로 웹 기반 OAuth
 */
export const useNaverLogin = () => {
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = Math.random().toString(36).substring(7);
      const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${config.naver.clientId}&redirect_uri=${encodeURIComponent(`${config.serverUrl}/api/auth/callback/naver`)}&state=${state}`;

      const result = await WebBrowser.openAuthSessionAsync(
        naverAuthUrl,
        `${config.naver.serviceUrlScheme}://oauth`
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (code && returnedState === state) {
          return { success: true, authorizationCode: code };
        }
      }

      return { success: false, error: 'Naver login cancelled' };
    } catch (error) {
      console.error('Naver login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { login, isLoading };
};

/**
 * 구글 로그인 훅
 * expo-auth-session/providers/google 사용
 */
export const useGoogleLogin = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: config.google.webClientId,
    iosClientId: config.google.iosClientId,
    androidClientId: config.google.androidClientId,
  });

  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await promptAsync();

      if (result?.type === 'success') {
        const { authentication } = result;
        return {
          success: true,
          accessToken: authentication?.accessToken,
          idToken: authentication?.idToken,
        };
      }

      return { success: false, error: 'Google login cancelled' };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync]);

  return { login, isLoading, isReady: !!request };
};

/**
 * 애플 로그인 훅
 * expo-apple-authentication 사용 (iOS 전용)
 */
export const useAppleLogin = () => {
  const [isLoading, setIsLoading] = useState(false);

  const isAvailable = Platform.OS === 'ios';

  const login = useCallback(async () => {
    if (!isAvailable) {
      return { success: false, error: 'Apple login is only available on iOS' };
    }

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      return {
        success: true,
        idToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        user: {
          id: credential.user,
          email: credential.email,
          fullName: credential.fullName,
        },
      };
    } catch (error) {
      if (error.code === 'ERR_CANCELED') {
        return { success: false, error: 'Apple login cancelled' };
      }
      console.error('Apple login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  return { login, isLoading, isAvailable };
};

/**
 * 통합 소셜 로그인 훅
 */
export const useSocialLogin = () => {
  const kakao = useKakaoLogin();
  const naver = useNaverLogin();
  const google = useGoogleLogin();
  const apple = useAppleLogin();

  return {
    kakao,
    naver,
    google,
    apple,
  };
};

export default useSocialLogin;
