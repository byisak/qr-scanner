// contexts/AuthContext.js - 인증 상태 관리 Context
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import config from '../config/config';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = 'auth_data';
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// API 기본 URL
const API_URL = `${config.serverUrl}/api/auth`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      }
    } catch (error) {
      console.error('Load auth data error:', error);
    } finally {
      setIsLoading(false);
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
          await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (e) {
          // 서버 로그아웃 실패해도 로컬은 정리
          console.warn('Server logout failed:', e);
        }
      }

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
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      console.log('[Auth] 응답 상태:', response.status, response.statusText);

      const data = await response.json();
      console.log('[Auth] 응답 데이터:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Registration failed';
        console.error('[Auth] 회원가입 실패:', errorMsg);
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

      console.error('[Auth] 서버 응답 형식 오류');
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('[Auth] 회원가입 네트워크 오류:', error.message);
      console.error('[Auth] 오류 상세:', error);
      return { success: false, error: error.message };
    }
  };

  // 이메일 로그인
  const loginWithEmail = async (email, password) => {
    const requestUrl = `${API_URL}/login`;
    console.log('[Auth] ===== 이메일 로그인 요청 =====');
    console.log('[Auth] URL:', requestUrl);
    console.log('[Auth] Email:', email);

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('[Auth] 응답 상태:', response.status, response.statusText);

      const data = await response.json();
      console.log('[Auth] 응답 데이터:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'Login failed';
        console.error('[Auth] 로그인 실패:', errorMsg);
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

      console.error('[Auth] 서버 응답 형식 오류');
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('[Auth] 로그인 네트워크 오류:', error.message);
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

      const response = await fetch(`${API_URL}/social/kakao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(authorizationCode && { code: authorizationCode }),
          ...(accessToken && { accessToken }),
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

      const response = await fetch(`${API_URL}/social/naver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: authorizationCode }),
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

      const response = await fetch(`${API_URL}/social/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(accessToken && { accessToken }),
          ...(idToken && { idToken }),
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

      const response = await fetch(`${API_URL}/social/apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          ...(authorizationCode && { authorizationCode }),
          ...(appleUser && { appleUser }),
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

  // 토큰 갱신
  const refreshAccessToken = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        return { success: false, error: 'No refresh token' };
      }

      const response = await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 리프레시 토큰도 만료되면 로그아웃
        await logout();
        return { success: false, error: 'Session expired' };
      }

      if (data.accessToken) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, data.accessToken);
        if (data.refreshToken) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        return { success: true, accessToken: data.accessToken };
      }

      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('Refresh token error:', error);
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
