// config/config.js - 앱 설정 관리
import Constants from 'expo-constants';

const config = {
  serverUrl: Constants.expoConfig?.extra?.serverUrl || 'http://localhost:3000',
};

export default config;
