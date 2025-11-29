// locales/index.js - Language exports
import ko from './ko';
import en from './en';
import ja from './ja';
import zh from './zh';

export const translations = {
  ko,
  en,
  ja,
  zh,
};

export const languages = [
  { code: 'ko', name: '한국어', nativeName: 'Korean' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: '日本語', nativeName: 'Japanese' },
  { code: 'zh', name: '中文', nativeName: 'Chinese' },
];

export default translations;
