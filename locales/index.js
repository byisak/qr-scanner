// locales/index.js - Language exports
import ko from './ko';
import en from './en';
import ja from './ja';
import zh from './zh';
import es from './es';

export const translations = {
  ko,
  en,
  ja,
  zh,
  es,
};

export const languages = [
  { code: 'ko', name: '한국어', nativeName: 'Korean' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: '日本語', nativeName: 'Japanese' },
  { code: 'zh', name: '中文', nativeName: 'Chinese' },
  { code: 'es', name: 'Español', nativeName: 'Spanish' },
];

export default translations;
