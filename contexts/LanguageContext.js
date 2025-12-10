// contexts/LanguageContext.js - Language context for global state
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../locales';
import { getFontFamily, getFontStyle } from '../constants/Fonts';

const LanguageContext = createContext();

const LANGUAGE_STORAGE_KEY = 'selectedLanguage';
const DEFAULT_LANGUAGE = 'ko';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  // 저장된 언어 로드
  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && translations[savedLanguage]) {
        setLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Load language error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 언어 변경
  const changeLanguage = async (newLanguage) => {
    try {
      if (translations[newLanguage]) {
        setLanguage(newLanguage);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
      }
    } catch (error) {
      console.error('Change language error:', error);
    }
  };

  // 번역 함수
  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        // 키를 찾을 수 없으면 키 자체를 반환
        return key;
      }
    }

    // 값이 문자열이면 파라미터 치환
    if (typeof value === 'string') {
      return Object.keys(params).reduce((str, param) => {
        return str.replace(`{${param}}`, params[param]);
      }, value);
    }

    return value || key;
  };

  // Get font family for current language
  const fonts = getFontFamily(language);

  // Get font style helper
  const fontStyle = (weight = 'regular') => getFontStyle(language, weight);

  const value = {
    language,
    changeLanguage,
    t,
    isLoading,
    fonts,
    fontStyle,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// 커스텀 훅
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
