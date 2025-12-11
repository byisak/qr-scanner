// config/config.js - 앱 설정 관리
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

const config = {
  // 서버 URL
  serverUrl: extra.serverUrl || 'http://localhost:3000',

  // 소셜 로그인 설정 (공개키만 - Secret은 서버에서 관리)
  kakao: {
    nativeAppKey: extra.kakao?.nativeAppKey || '',
  },
  naver: {
    clientId: extra.naver?.clientId || '',
    serviceUrlScheme: extra.naver?.serviceUrlScheme || 'qrscanner',
  },
  google: {
    webClientId: extra.google?.webClientId || '',
    iosClientId: extra.google?.iosClientId || '',
    androidClientId: extra.google?.androidClientId || '',
  },
};

export default config;
