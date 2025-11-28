// locales/index.js - Language exports
import ko from './ko';
import en from './en';

export const translations = {
  ko,
  en,
};

export const languages = [
  { code: 'ko', name: '한국어', nativeName: 'Korean' },
  { code: 'en', name: 'English', nativeName: 'English' },
];

export default translations;
