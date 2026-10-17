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

// ---------------------------------------------
// Android 구글 로그인: 네이티브 Google Sign-In
// ---------------------------------------------
// 브라우저(expo-auth-session) 방식은 Android에서 redirect_uri=qrscanner:// 를
// Google이 정책 위반(400 invalid_request)으로 막아서, Android는 기기의 구글 계정
// 선택창(Credential Manager)을 쓰는 네이티브 로그인으로 바꿨다.
// webClientId로 받은 ID 토큰(aud = 웹 클라이언트 ID)을 서버로 보낸다.
// iOS는 기존 브라우저 방식(iOS 클라이언트 ID + 리버스 클라이언트 ID 리다이렉트)을 그대로 쓴다.
let nativeGoogleConfigured = false;

const getNativeGoogleSignin = () => {
  if (Platform.OS !== 'android') return null;
  try {
    // 네이티브 모듈이 없는 환경(Expo Go 등)에서도 앱이 죽지 않도록 지연 로딩
    return require('@react-native-google-signin/google-signin');
  } catch (e) {
    console.warn('Google Sign-In native module unavailable:', e?.message);
    return null;
  }
};

const ensureNativeGoogleConfigured = (lib) => {
  if (nativeGoogleConfigured) return;
  lib.GoogleSignin.configure({
    webClientId: config.google?.webClientId || '',
    scopes: ['profile', 'email'],
    offlineAccess: false,
  });
  nativeGoogleConfigured = true;
};

/**
 * 앱 로그아웃 시 네이티브 구글 세션도 정리해서
 * 다음 로그인 때 계정 선택창이 다시 뜨게 한다. (Android 전용, 실패해도 무시)
 */
export const signOutNativeGoogle = async () => {
  const lib = getNativeGoogleSignin();
  if (!lib) return;
  try {
    ensureNativeGoogleConfigured(lib);
    await lib.GoogleSignin.signOut();
  } catch (e) {
    console.warn('Google native signOut failed:', e?.message);
  }
};

const nativeGoogleLogin = async () => {
  const lib = getNativeGoogleSignin();
  if (!lib) {
    return { success: false, error: 'Google login is not available', code: 'NOT_AVAILABLE' };
  }
  const { GoogleSignin, statusCodes, isErrorWithCode, isSuccessResponse } = lib;

  if (!config.google?.webClientId) {
    console.error('Google web client ID is not configured');
    return { success: false, error: 'Google login is not configured' };
  }

  try {
    ensureNativeGoogleConfigured(lib);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      // type === 'cancelled' : 사용자가 계정 선택창을 닫음
      return { success: false, error: 'Google login cancelled' };
    }

    let idToken = response.data?.idToken || null;
    let accessToken = null;
    try {
      const tokens = await GoogleSignin.getTokens();
      idToken = idToken || tokens?.idToken || null;
      accessToken = tokens?.accessToken || null;
    } catch (e) {
      // 서버는 ID 토큰만으로 검증하므로 액세스 토큰은 없어도 된다
      console.warn('Google getTokens failed:', e?.message);
    }

    if (!idToken) {
      return { success: false, error: 'Google ID token missing', code: 'NO_ID_TOKEN' };
    }

    return { success: true, idToken, ...(accessToken && { accessToken }) };
  } catch (error) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
        case statusCodes.IN_PROGRESS:
          // 취소했거나 이미 진행 중 → 알림 없이 조용히 끝낸다
          return { success: false, error: 'Google login cancelled' };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return {
            success: false,
            error: 'Google Play services not available',
            code: 'PLAY_SERVICES_NOT_AVAILABLE',
          };
        default:
          break;
      }
    }
    console.error('Google native login error:', error?.code, error?.message);
    return {
      success: false,
      error: error?.message || 'Login failed',
      code: error?.code ? String(error.code) : 'UNKNOWN',
    };
  }
};

/**
 * 구글 로그인 훅
 * - Android: 네이티브 Google Sign-In (위 nativeGoogleLogin)
 * - iOS: PKCE Authorization Code 플로우 (expo-auth-session)
 */
export const useGoogleLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  // 구글 클라이언트 ID 안전하게 가져오기
  const iosClientId = config.google?.iosClientId || '';
  const androidClientId = config.google?.androidClientId || '';
  const webClientId = config.google?.webClientId || '';
  const clientId = Platform.select({
    ios: iosClientId,
    android: androidClientId || webClientId,
    default: webClientId,
  });

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
    if (Platform.OS === 'android') {
      setIsLoading(true);
      try {
        return await nativeGoogleLogin();
      } finally {
        setIsLoading(false);
      }
    }

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

  return { login, isLoading, isReady: Platform.OS === 'android' ? true : !!request };
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
