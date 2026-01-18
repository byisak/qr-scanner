// contexts/AuthContext.js - 인증 상태 관리 Context (단순화 버전)
// 토큰 검증 제거 - userId만 사용
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config/config';
import { useFeatureLock } from './FeatureLockContext';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = 'auth_data';
const DEVICE_ID_KEY = 'device_id';

// API 기본 URL
const API_URL = `${config.serverUrl}/api/auth`;

// 기기 ID 생성 (UUID v4)
const generateDeviceId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 기기 ID 가져오기 (없으면 생성)
const getOrCreateDeviceId = async () => {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `mobile-${generateDeviceId()}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      console.log('[Auth] 새 기기 ID 생성:', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('[Auth] 기기 ID 생성 오류:', error);
    return `mobile-${generateDeviceId()}`; // fallback
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

      if (authData) {
        const userData = JSON.parse(authData);
        setUser(userData);
        setIsLoggedIn(true);
        console.log('[Auth] 저장된 사용자 로드:', userData.email);
      }
    } catch (error) {
      console.error('Load auth data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 로그인 (로컬 저장) - 토큰 없이 사용자 정보만 저장
  const login = async (userData) => {
    try {
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
      setIsLoggedIn(true);

      // 로그인 성공 후 광고 기록 동기화
      if (autoSync) {
        setTimeout(() => {
          autoSync().then((result) => {
            if (result.success) {
              console.log('[Auth] Ad records synced after login');
            }
          });
        }, 1000);
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
      // 실시간 서버 전송 비활성화
      await AsyncStorage.setItem('realtimeSyncEnabled', 'false');

      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
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

    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, deviceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Registration failed';
        return { success: false, error: errorMsg };
      }

      if (data.success && data.user) {
        await login(data.user);
        console.log('[Auth] 회원가입 성공:', data.user.email);
        return { success: true, user: data.user };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('[Auth] 회원가입 오류:', error);
      return { success: false, error: error.message };
    }
  };

  // 이메일 로그인
  const loginWithEmail = async (email, password) => {
    console.log('[Auth] ===== 이메일 로그인 요청 =====');
    const requestUrl = `${API_URL}/login`;

    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, deviceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Login failed';
        return { success: false, error: errorMsg };
      }

      if (data.success && data.user) {
        await login(data.user);
        console.log('[Auth] 로그인 성공:', data.user.email);
        return { success: true, user: data.user };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('[Auth] 로그인 오류:', error);
      return { success: false, error: error.message };
    }
  };

  // 카카오 로그인
  const loginWithKakao = async ({ authorizationCode, accessToken }) => {
    try {
      if (!authorizationCode && !accessToken) {
        return { success: false, error: 'No authorization code or access token provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/kakao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(authorizationCode && { code: authorizationCode }),
          ...(accessToken && { accessToken }),
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message || 'Kakao login failed' };
      }

      if (data.success && data.user) {
        await login(data.user);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 네이버 로그인
  const loginWithNaver = async ({ authorizationCode }) => {
    try {
      if (!authorizationCode) {
        return { success: false, error: 'No authorization code provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/naver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authorizationCode, deviceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message || 'Naver login failed' };
      }

      if (data.success && data.user) {
        await login(data.user);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Naver login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 구글 로그인
  const loginWithGoogle = async ({ accessToken, idToken }) => {
    try {
      if (!accessToken && !idToken) {
        return { success: false, error: 'No access token or ID token provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(accessToken && { accessToken }),
          ...(idToken && { idToken }),
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message || 'Google login failed' };
      }

      if (data.success && data.user) {
        await login(data.user);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 애플 로그인
  const loginWithApple = async ({ idToken, authorizationCode, user: appleUser }) => {
    try {
      if (!idToken) {
        return { success: false, error: 'No ID token provided' };
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await fetch(`${API_URL}/social/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          ...(authorizationCode && { authorizationCode }),
          ...(appleUser && { appleUser }),
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message || 'Apple login failed' };
      }

      if (data.success && data.user) {
        await login(data.user);
        return { success: true, user: data.user, isNewUser: data.isNewUser };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Apple login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 프로필 업데이트 - userId 헤더 사용
  const updateProfile = async (updates) => {
    try {
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }

      const response = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'X-User-Id': user.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

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
      if (user) {
        const response = await fetch(`${API_URL}/withdraw`, {
          method: 'DELETE',
          headers: {
            'X-User-Id': user.id,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const data = await response.json();
          return { success: false, error: data.error?.message || 'Withdraw failed' };
        }
      }

      await logout();
      return { success: true };
    } catch (error) {
      console.error('Withdraw error:', error);
      return { success: false, error: error.message };
    }
  };

  // userId 가져오기 (이전 getToken 대체)
  const getUserId = () => {
    return user?.id || null;
  };

  // 이메일 중복 확인
  const checkEmailExists = async (email) => {
    try {
      const response = await fetch(`${API_URL}/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message || 'Check failed' };
      }

      return { success: true, exists: data.exists, message: data.message };
    } catch (error) {
      console.error('Check email error:', error);
      return { success: false, error: error.message };
    }
  };

  // 비밀번호 변경 - userId 헤더 사용
  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    try {
      if (!user) {
        return { success: false, error: 'Not logged in' };
      }

      const response = await fetch(`${API_URL}/change-password`, {
        method: 'PUT',
        headers: {
          'X-User-Id': user.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Password change failed',
          errorCode: data.error?.code || null
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.message };
    }
  };

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
    getUserId,
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
