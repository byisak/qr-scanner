// config/config.js - 앱 설정 관리
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

const config = {
  // 서버 URL
  serverUrl: extra.serverUrl || 'http://localhost:3000',

  // ============================================================
  // 소셜 로그인 설정 (공개키만 - Secret은 서버에서 관리)
  // ============================================================

  // 카카오: iOS/Android 동일 키 사용
  // - 발급: https://developers.kakao.com → 내 애플리케이션 → 앱 키
  // - 개발자 콘솔에서 플랫폼 등록 필요:
  //   - iOS: 번들 ID (com.yourcompany.qrscanner)
  //   - Android: 패키지명 + 키해시
  kakao: {
    nativeAppKey: extra.kakao?.nativeAppKey || '',
  },

  // 네이버: iOS/Android 동일 키 사용
  // - 발급: https://developers.naver.com → 애플리케이션 등록
  // - 개발자 콘솔에서 플랫폼 등록 필요:
  //   - iOS: URL Scheme
  //   - Android: 패키지명
  naver: {
    clientId: extra.naver?.clientId || '',
    serviceUrlScheme: extra.naver?.serviceUrlScheme || 'qrscanner',
  },

  // 구글: 플랫폼별 별도 키 필요
  // - 발급: https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
  // - OAuth 2.0 클라이언트 ID를 플랫폼별로 생성:
  //   - webClientId: 웹 애플리케이션 (서버 토큰 검증용, 필수)
  //   - iosClientId: iOS 앱용
  //   - androidClientId: Android 앱용 (패키지명 + SHA-1 지문 필요)
  google: {
    webClientId: extra.google?.webClientId || '',
    iosClientId: extra.google?.iosClientId || '',
    androidClientId: extra.google?.androidClientId || '',
  },
};

export default config;
