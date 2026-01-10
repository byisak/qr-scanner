// hooks/useSocialLogin.js - 소셜 로그인 SDK 통합 훅
import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import config from '../config/config';

// WebBrowser warm up for faster auth
WebBrowser.maybeCompleteAuthSession();

// Google OAuth discovery
const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * 카카오 로그인 훅
 * 패키지: @react-native-seoul/kakao-login (설치 필요)
 * 또는 expo-auth-session으로 웹 기반 OAuth
 */
export const useKakaoLogin = () => {
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      // 방법 1: @react-native-seoul/kakao-login 사용 (네이티브)
      // const KakaoLogin = require('@react-native-seoul/kakao-login');
      // const result = await KakaoLogin.login();
      // return { success: true, accessToken: result.accessToken };

      // 방법 2: expo-auth-session으로 웹 기반 OAuth (Expo 호환)
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${config.kakao.nativeAppKey}&redirect_uri=${encodeURIComponent(`${config.serverUrl}/api/auth/social/kakao`)}&response_type=code`;

      const result = await WebBrowser.openAuthSessionAsync(
        kakaoAuthUrl,
        `${config.naver.serviceUrlScheme}://oauth`
      );

      if (result.type === 'success' && result.url) {
        // URL에서 authorization code 추출
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          // 서버에서 code를 token으로 교환
          return { success: true, authorizationCode: code };
        }
      }

      return { success: false, error: 'Kakao login cancelled' };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { login, isLoading };
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
 * PKCE Authorization Code 플로우 사용
 */
export const useGoogleLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  // 구글 클라이언트 ID 안전하게 가져오기
  const iosClientId = config.google?.iosClientId || '';
  const webClientId = config.google?.webClientId || '';
  const clientId = Platform.OS === 'ios' ? iosClientId : webClientId;

  // iOS는 리버스 클라이언트 ID 사용
  const getRedirectUri = () => {
    if (Platform.OS === 'ios' && iosClientId) {
      // iOS 클라이언트 ID를 리버스하여 redirect URI 생성
      // 예: 123456789-abcdef.apps.googleusercontent.com -> com.googleusercontent.apps.123456789-abcdef:/oauthredirect
      const parts = iosClientId.split('.').reverse();
      const reversedClientId = parts.join('.');
      return `${reversedClientId}:/oauthredirect`;
    }
    return AuthSession.makeRedirectUri({ scheme: 'qrscanner' });
  };

  const redirectUri = getRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    googleDiscovery
  );

  // Authorization Code를 Access Token으로 교환
  const exchangeCodeForToken = async (code, codeVerifier) => {
    try {
      console.log('Exchanging code for token...');
      console.log('Client ID:', clientId);
      console.log('Redirect URI:', redirectUri);

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code,
          redirectUri,
          extraParams: {
            code_verifier: codeVerifier,
          },
        },
        googleDiscovery
      );
      console.log('Token exchange successful');
      return tokenResponse;
    } catch (error) {
      console.error('Google token exchange error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  };

  // Note: Token exchange is handled in the login function directly
  // to avoid duplicate exchange attempts (authorization codes can only be used once)

  const login = useCallback(async () => {
    if (!clientId) {
      console.error('Google client ID is not configured');
      return { success: false, error: 'Google login is not configured' };
    }

    setIsLoading(true);
    try {
      console.log('Starting Google login...');
      console.log('Using redirect URI:', redirectUri);

      const result = await promptAsync();
      console.log('Auth result type:', result?.type);

      if (result?.type === 'success') {
        const { params } = result;
        console.log('Auth params:', JSON.stringify(params, null, 2));

        if (params?.code && request?.codeVerifier) {
          const tokenResponse = await exchangeCodeForToken(params.code, request.codeVerifier);
          return {
            success: true,
            accessToken: tokenResponse.accessToken,
            idToken: tokenResponse.idToken,
          };
        }
      }

      return { success: false, error: 'Google login cancelled' };
    } catch (error) {
      console.error('Google login error:', error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      return { success: false, error: error?.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync, request, clientId, redirectUri]);

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
