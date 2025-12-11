// contexts/AuthContext.js - 인증 상태 관리 Context
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = 'auth_data';
const TOKEN_STORAGE_KEY = 'auth_token';

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

  // 로그인
  const login = async (userData, token) => {
    try {
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(userData));
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
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
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      setUser(null);
      setIsLoggedIn(false);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // 회원가입 (백엔드 연결 전 mock)
  const register = async (email, password, name) => {
    try {
      // TODO: 백엔드 API 연결
      // 현재는 mock 데이터로 처리
      const mockUser = {
        id: `user_${Date.now()}`,
        email,
        name,
        profileImage: null,
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      const mockToken = `mock_token_${Date.now()}`;

      await login(mockUser, mockToken);
      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: error.message };
    }
  };

  // 이메일 로그인 (백엔드 연결 전 mock)
  const loginWithEmail = async (email, password) => {
    try {
      // TODO: 백엔드 API 연결
      // 현재는 mock 데이터로 처리
      const mockUser = {
        id: `user_${Date.now()}`,
        email,
        name: email.split('@')[0],
        profileImage: null,
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      const mockToken = `mock_token_${Date.now()}`;

      await login(mockUser, mockToken);
      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Email login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 카카오 로그인 (백엔드 연결 전 mock)
  const loginWithKakao = async () => {
    try {
      // TODO: 카카오 SDK 연동 및 백엔드 API 연결
      // 현재는 mock 데이터로 처리
      const mockUser = {
        id: `kakao_${Date.now()}`,
        email: 'kakao_user@kakao.com',
        name: '카카오 사용자',
        profileImage: null,
        provider: 'kakao',
        createdAt: new Date().toISOString(),
      };
      const mockToken = `kakao_token_${Date.now()}`;

      await login(mockUser, mockToken);
      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 구글 로그인 (백엔드 연결 전 mock)
  const loginWithGoogle = async () => {
    try {
      // TODO: 구글 SDK 연동 및 백엔드 API 연결
      // 현재는 mock 데이터로 처리
      const mockUser = {
        id: `google_${Date.now()}`,
        email: 'google_user@gmail.com',
        name: 'Google User',
        profileImage: null,
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      const mockToken = `google_token_${Date.now()}`;

      await login(mockUser, mockToken);
      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    }
  };

  // 애플 로그인 (백엔드 연결 전 mock)
  const loginWithApple = async () => {
    try {
      // TODO: 애플 SDK 연동 및 백엔드 API 연결
      // 현재는 mock 데이터로 처리
      const mockUser = {
        id: `apple_${Date.now()}`,
        email: 'apple_user@icloud.com',
        name: 'Apple User',
        profileImage: null,
        provider: 'apple',
        createdAt: new Date().toISOString(),
      };
      const mockToken = `apple_token_${Date.now()}`;

      await login(mockUser, mockToken);
      return { success: true, user: mockUser };
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

      const updatedUser = { ...user, ...updates };
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  };

  // 회원 탈퇴
  const withdraw = async () => {
    try {
      // TODO: 백엔드 API 연결하여 계정 삭제
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

  const value = {
    user,
    isLoggedIn,
    isLoading,
    login,
    logout,
    register,
    loginWithEmail,
    loginWithKakao,
    loginWithGoogle,
    loginWithApple,
    updateProfile,
    withdraw,
    getToken,
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
