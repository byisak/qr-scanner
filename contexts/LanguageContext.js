// contexts/LanguageContext.js - Language context for global state
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../locales';
import { getFontFamily, getFontStyle } from '../constants/Fonts';

const LanguageContext = createContext();

const LANGUAGE_STORAGE_KEY = 'selectedLanguage';
const DEFAULT_LANGUAGE = 'ko';
// 현재 언어에 키가 없을 때 찾아보는 순서. 키 문자열이 화면에 그대로 보이는 것보다 영어가 낫다
const FALLBACK_LANGUAGES = ['en', 'ko'];

// 점으로 구분된 키로 번역 객체를 찾는다. 없으면 undefined
const lookup = (table, key) => {
  let value = table;
  for (const k of key.split('.')) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return value;
};

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
  const changeLanguage = useCallback(async (newLanguage) => {
    try {
      if (translations[newLanguage]) {
        setLanguage(newLanguage);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
      }
    } catch (error) {
      console.error('Change language error:', error);
    }
  }, []);

  // 번역 함수. 현재 언어 → en → ko 순으로 찾고, 어디에도 없으면 키를 돌려준다
  const t = useCallback((key, params = {}) => {
    let value = lookup(translations[language], key);
    if (value === undefined) {
      for (const fallback of FALLBACK_LANGUAGES) {
        if (fallback === language) continue;
        value = lookup(translations[fallback], key);
        if (value !== undefined) break;
      }
      if (__DEV__ && value === undefined) {
        console.warn(`[i18n] missing key "${key}" in ${language} and fallbacks`);
      }
    }

    if (value === undefined) return key;

    // 값이 문자열이면 파라미터 치환 ({{param}} 형식 지원)
    if (typeof value === 'string') {
      return Object.keys(params).reduce((str, param) => {
        return str.split(`{{${param}}}`).join(params[param]);
      }, value);
    }

    return value || key;
  }, [language]);

  // Get font family for current language
  const fonts = useMemo(() => getFontFamily(language), [language]);

  // Get font style helper
  const fontStyle = useCallback((weight = 'regular') => getFontStyle(language, weight), [language]);

  // value를 메모하지 않으면 Provider가 렌더될 때마다 모든 화면이 다시 렌더된다
  const value = useMemo(() => ({
    language,
    changeLanguage,
    t,
    isLoading,
    fonts,
    fontStyle,
  }), [language, changeLanguage, t, isLoading, fonts, fontStyle]);

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
