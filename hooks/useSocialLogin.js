// hooks/useSocialLogin.js - 소셜 로그인 SDK 통합 훅
import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  login as kakaoLogin,
  logout as kakaoLogout,
  getProfile as kakaoGetProfile,
  unlink as kakaoUnlink,
  getAccessToken as kakaoGetAccessToken,
  shippingAddresses as kakaoShippingAddresses,
  serviceTerms as kakaoServiceTerms,
} from '@react-native-seoul/kakao-login';
import config from '../config/config';

// WebBrowser warm up for faster auth
WebBrowser.maybeCompleteAuthSession();

/**
 * 카카오 로그인 훅
 * @react-native-seoul/kakao-login 사용 (네이티브)
 * 설치: yarn add @react-native-seoul/kakao-login
 * 설정: https://github.com/crossplatformkorea/react-native-kakao-login
 */
export const useKakaoLogin = () => {
  const [isLoading, setIsLoading] = useState(false);

  // 로그인 (카카오톡 앱이 없으면 카카오계정 로그인으로 자동 전환)
  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await kakaoLogin();
      return {
        success: true,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        idToken: token.idToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scopes: token.scopes,
      };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const message = await kakaoLogout();
      return { success: true, message };
    } catch (error) {
      console.error('Kakao logout error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 프로필 가져오기
  const getProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await kakaoGetProfile();
      return { success: true, profile };
    } catch (error) {
      console.error('Kakao getProfile error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 연결 끊기 (회원 탈퇴)
  const unlink = useCallback(async () => {
    setIsLoading(true);
    try {
      const message = await kakaoUnlink();
      return { success: true, message };
    } catch (error) {
      console.error('Kakao unlink error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 액세스 토큰 조회
  const getAccessToken = useCallback(async () => {
    try {
      const tokenInfo = await kakaoGetAccessToken();
      return { success: true, tokenInfo };
    } catch (error) {
      console.error('Kakao getAccessToken error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // 배송지 가져오기
  const getShippingAddresses = useCallback(async () => {
    setIsLoading(true);
    try {
      const addresses = await kakaoShippingAddresses();
      return { success: true, addresses };
    } catch (error) {
      console.error('Kakao shippingAddresses error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 서비스 약관 동의 내역 확인 (카카오싱크 전용)
  const getServiceTerms = useCallback(async () => {
    setIsLoading(true);
    try {
      const terms = await kakaoServiceTerms();
      return { success: true, terms };
    } catch (error) {
      console.error('Kakao serviceTerms error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    login,
    logout,
    getProfile,
    unlink,
    getAccessToken,
    getShippingAddresses,
    getServiceTerms,
    isLoading,
  };
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
