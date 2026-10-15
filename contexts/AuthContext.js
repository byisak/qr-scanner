// contexts/AuthContext.js - 인증 상태 관리 Context
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config/config';
import { useFeatureLock } from './FeatureLockContext';
import websocketClient from '../utils/websocket';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = 'auth_data';
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const DEVICE_ID_KEY = 'device_id';

// API 기본 URL
const API_URL = `${config.serverUrl}/api/auth`;

// ============================================================
// 🔧 개발 모드 설정 (배포 시 false로 변경)
// ============================================================
const DEV_MODE = false; // 실제 백엔드 API 사용
// ============================================================

// 기기 ID 생성 (암호학적으로 안전한 UUID v4)
const generateDeviceId = async () => {
  try {
    const Crypto = require('expo-crypto');
    return Crypto.randomUUID();
  } catch {
    // fallback: expo-crypto 사용 불가 시
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
};

// 기기 ID 가져오기 (없으면 생성)
const getOrCreateDeviceId = async () => {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      const uuid = await generateDeviceId();
      deviceId = `mobile-${uuid}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('[Auth] 기기 ID 생성 오류:', error);
    const uuid = await generateDeviceId();
    return `mobile-${uuid}`;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { autoSync } = useFeatureLock();

  // 저장된 인증 정보 로드
  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      const authData = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);

      if (authData && token) {
        const userData = JSON.parse(authData);
        setUser(userData);
        setIsLoggedIn(true);

        // 로그인된 상태로 앱 실행 시 마지막 접속 시간 업데이트
        // 백그라운드에서 실행 (앱 시작 지연 방지)
        setTimeout(() => {
          updateLastActivityInternal(token);
        }, 2000);
      }
    } catch (error) {
      console.error('Load auth data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 내부용 마지막 접속 시간 업데이트 (loadAuthData에서 사용)
  const updateLastActivityInternal = async (token) => {
    try {
      const response = await fetch(`${API_URL}/activity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('[Auth] 마지막 접속 시간 업데이트 완료');
      }
    } catch (error) {
      // 네트워크 오류는 무시
      console.log('[Auth] 접속 시간 업데이트 실패 (무시됨)');
    }
  };

  // 로그인 (로컬 저장)
  const login = async (userData, accessToken, refreshToken) => {
    try {
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(userData));
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }
      setUser(userData);
      setIsLoggedIn(true);

      // 로그인 성공 후 광고 기록 동기화 (로컬 데이터를 서버에 업로드)
      if (autoSync) {
        setTimeout(() => {
          autoSync().then((result) => {
            if (result.success) {
              console.log('[Auth] Ad records synced after login');
            }
          });
        }, 1000); // 1초 후 동기화 (상태 안정화 후)
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      // 서버에 로그아웃 요청 (선택적)
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (token) {
        try {
          const deviceId = await getOrCreateDeviceId();
          await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ deviceId }),
          });
        } catch (e) {
          // 서버 로그아웃 실패해도 로컬은 정리
          console.warn('Server logout failed:', e);
        }
      }

      // 실시간 서버 전송 비활성화
      await AsyncStorage.setItem('realtimeSyncEnabled', 'false');

      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      setUser(null);
      setIsLoggedIn(false);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // 회원가입
  const register = async (email, password, name) => {
    const requestUrl = `${API_URL}/register`;
    console.log('[Auth] ===== 회원가입 요청 =====');
    console.log('[Auth] URL:', requestUrl);
    console.log('[Auth] Email:', email);
    console.log('[Auth] Name:', name);

    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, deviceId }),
      });

      console.log('[Auth] 응답 상태:', response.status, response.statusText);

      const data = await response.json();
      console.log('[Auth] 응답 데이터:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Registration failed';
        console.warn('[Auth] 회원가입 실패:', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      if (data.success && data.user && data.accessToken) {
        await login(data.user, data.accessToken, data.refreshToken);
        console.log('[Auth] 회원가입 성공:', data.user.email);
        return { success: true, user: data.user };
      }

      console.warn('[Auth] 서버 응답 형식 오류');
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.warn('[Auth] 회원가입 네트워크 오류:', error.message);
      console.error('[Auth] 오류 상세:', error);
      return { success: false, error: error.message };
    }
  };

  // 이메일 로그인
  const loginWithEmail = async (email, password) => {
    console.log('[Auth] ===== 이메일 로그인 요청 =====');
    console.log('[Auth] Email:', email);


    const requestUrl = `${API_URL}/login`;
    console.log('[Auth] URL:', requestUrl);

    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, deviceId }),
      });

      console.log('[Auth] 응답 상태:', response.status, response.statusText);

      const data = await response.json();
      console.log('[Auth] 응답 데이터:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Login failed';
        console.log('[Auth] 로그인 실패:', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      if (data.success && data.user && data.accessToken) {
        await login(data.user, data.accessToken, data.refreshToken);
        console.log('[Auth] 로그인 성공:', data.user.email);
        return { success: true, user: data.user };
      }

      console.warn('[Auth] 서버 응답 형식 오류');
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.warn('[Auth] 로그인 네트워크 오류:', error.message);
      console.error('[Auth] 오류 상세:', error);
      return { success: false, error: error.message };
    }
  };

  // 카카오 로그인 (서버로 인증 코드 또는 토큰 전송)
  const loginWithKakao = async ({ authorizationCode, accessToken }) => {
    try {
      if (!authorizationCode && !accessToken) {
        return { success: false, error: 'No authorization code or access token provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/kakao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(authorizationCode && { code: authorizationCode }),
          ...(accessToken && { accessToken }),
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Kakao login failed'
        };
      }

      if (data.success && data.user && data.accessToken) {
        await login(data.user, data.accessToken, data.refreshToken);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 네이버 로그인 (서버로 인증 코드 전송)
  const loginWithNaver = async ({ authorizationCode }) => {
    try {
      if (!authorizationCode) {
        return { success: false, error: 'No authorization code provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/naver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: authorizationCode, deviceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Naver login failed'
        };
      }

      if (data.success && data.user && data.accessToken) {
        await login(data.user, data.accessToken, data.refreshToken);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Naver login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 구글 로그인 (서버로 액세스 토큰 또는 ID 토큰 전송)
  const loginWithGoogle = async ({ accessToken, idToken }) => {
    try {
      if (!accessToken && !idToken) {
        return { success: false, error: 'No access token or ID token provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(accessToken && { accessToken }),
          ...(idToken && { idToken }),
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Google login failed'
        };
      }

      if (data.success && data.user && data.accessToken) {
        await login(data.user, data.accessToken, data.refreshToken);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 애플 로그인 (서버로 ID 토큰 전송)
  const loginWithApple = async ({ idToken, authorizationCode, user: appleUser }) => {
    try {
      if (!idToken) {
        return { success: false, error: 'No ID token provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          ...(authorizationCode && { authorizationCode }),
          ...(appleUser && { appleUser }),
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Apple login failed'
        };
      }

      if (data.success && data.user && data.accessToken) {
        await login(data.user, data.accessToken, data.refreshToken);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Apple login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 프로필 업데이트
  const updateProfile = async (updates) => {
    try {
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }

      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);

      const response = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        // 서버 업데이트 실패해도 로컬은 업데이트
        console.warn('Server profile update failed:', data);
      }

      const updatedUser = data.user || { ...user, ...updates };
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Update profile error:', error);
      // 네트워크 오류 시 로컬만 업데이트
      const updatedUser = { ...user, ...updates };
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    }
  };

  // 회원 탈퇴
  const withdraw = async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);

      if (token) {
        const response = await fetch(`${API_URL}/withdraw`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const data = await response.json();
          return {
            success: false,
            error: data.error?.message || data.message || 'Withdraw failed'
          };
        }
      }

      await logout();
      return { success: true };
    } catch (error) {
      console.error('Withdraw error:', error);
      return { success: false, error: error.message };
    }
  };

  // 토큰 가져오기
  const getToken = async () => {
    try {
      return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  };

  // 마지막 접속 시간 업데이트 (서버로 전송)
  const updateLastActivity = async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (!token) {
        return { success: false, error: 'No token' };
      }

      const response = await fetch(`${API_URL}/activity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // 토큰 만료 시 갱신 시도
        if (response.status === 401) {
          const refreshResult = await refreshAccessToken();
          if (refreshResult.success) {
            // 갱신된 토큰으로 재시도
            const newToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
            await fetch(`${API_URL}/activity`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json',
              },
            });
          }
        }
        return { success: false };
      }

      console.log('[Auth] 마지막 접속 시간 업데이트 완료');
      return { success: true };
    } catch (error) {
      // 네트워크 오류는 무시 (앱 사용에 영향 없음)
      console.log('[Auth] 접속 시간 업데이트 실패 (무시됨):', error.message);
      return { success: false, error: error.message };
    }
  };

  // 이메일 중복 확인
  const checkEmailExists = async (email) => {
    try {
      const response = await fetch(`${API_URL}/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Check failed'
        };
      }

      return {
        success: true,
        exists: data.exists,
        message: data.message
      };
    } catch (error) {
      console.error('Check email error:', error);
      return { success: false, error: error.message };
    }
  };

  // 비밀번호 변경
  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    try {
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }


      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      const requestUrl = `${API_URL}/change-password`;

      console.log('[Auth] ===== 비밀번호 변경 요청 =====');
      console.log('[Auth] URL:', requestUrl);
      console.log('[Auth] Method: PUT');

      const response = await fetch(requestUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      console.log('[Auth] 응답 상태:', response.status, response.statusText);

      // JSON 파싱 에러 처리
      let data;
      const contentType = response.headers.get('content-type');
      console.log('[Auth] Content-Type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('[Auth] 비-JSON 응답:', textResponse.substring(0, 200));
        return { success: false, error: '서버 응답 오류. 잠시 후 다시 시도해주세요.' };
      }

      try {
        data = await response.json();
        console.log('[Auth] 응답 데이터:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return { success: false, error: '서버 응답 파싱 오류.' };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Password change failed',
          errorCode: data.error?.code || null
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.message };
    }
  };

  // 토큰 갱신
  const refreshAccessToken = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      console.log('🔄 refreshAccessToken: refreshToken 존재:', !!refreshToken);

      if (!refreshToken) {
        return { success: false, error: 'No refresh token' };
      }

      const deviceId = await getOrCreateDeviceId();
      console.log('🔄 refreshAccessToken: API 호출 시작...');
      const response = await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      const data = await response.json();
      console.log('🔄 refreshAccessToken: API 응답:', { status: response.status, ok: response.ok, hasAccessToken: !!data.accessToken });

      if (!response.ok) {
        // 리프레시 토큰도 만료되면 로그아웃
        console.log('🔄 refreshAccessToken: 응답 실패, 로그아웃 처리');
        await logout();
        return { success: false, error: 'Session expired' };
      }

      if (data.accessToken) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, data.accessToken);
        if (data.refreshToken) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        console.log('🔄 refreshAccessToken: 새 토큰 저장 완료');
        return { success: true, accessToken: data.accessToken };
      }

      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('Refresh token error:', error);
      return { success: false, error: error.message };
    }
  };

  // 실시간 서버 전송(REST)이 최신 토큰을 쓰고, 401이면 갱신할 수 있게 도우미를 등록
  useEffect(() => {
    websocketClient.setAuthHandlers({ getToken, refreshAccessToken });
  });

  const value = {
    user,
    isLoggedIn,
    isLoading,
    login,
    logout,
    register,
    loginWithEmail,
    loginWithKakao,
    loginWithNaver,
    loginWithGoogle,
    loginWithApple,
    updateProfile,
    changePassword,
    withdraw,
    getToken,
    refreshAccessToken,
    checkEmailExists,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 커스텀 훅
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
