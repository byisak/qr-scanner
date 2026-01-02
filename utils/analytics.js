// utils/analytics.js - Firebase Analytics 유틸리티
import analytics from '@react-native-firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_CONSENT_KEY = '@analytics_consent';

// 분석 동의 상태 확인
export const getAnalyticsConsent = async () => {
  try {
    const consent = await AsyncStorage.getItem(ANALYTICS_CONSENT_KEY);
    return consent === 'true';
  } catch {
    return false;
  }
};

// 분석 동의 설정
export const setAnalyticsConsent = async (enabled) => {
  try {
    await AsyncStorage.setItem(ANALYTICS_CONSENT_KEY, enabled ? 'true' : 'false');
    await analytics().setAnalyticsCollectionEnabled(enabled);
  } catch (error) {
    console.error('Analytics consent error:', error);
  }
};

// 화면 조회 추적
export const trackScreenView = async (screenName, screenClass) => {
  try {
    const consent = await getAnalyticsConsent();
    if (!consent) return;

    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  } catch (error) {
    console.error('Track screen error:', error);
  }
};

// 이벤트 추적
export const trackEvent = async (eventName, params = {}) => {
  try {
    const consent = await getAnalyticsConsent();
    if (!consent) return;

    await analytics().logEvent(eventName, params);
  } catch (error) {
    console.error('Track event error:', error);
  }
};

// 사용자 속성 설정
export const setUserProperty = async (name, value) => {
  try {
    const consent = await getAnalyticsConsent();
    if (!consent) return;

    await analytics().setUserProperty(name, value);
  } catch (error) {
    console.error('Set user property error:', error);
  }
};

// ===== 미리 정의된 이벤트들 =====

// QR 코드 스캔
export const trackQRScanned = (qrType, contentType) => {
  return trackEvent('qr_scanned', {
    qr_type: qrType,
    content_type: contentType,
  });
};

// 바코드 스캔
export const trackBarcodeScanned = (barcodeType) => {
  return trackEvent('barcode_scanned', {
    barcode_type: barcodeType,
  });
};

// QR 코드 생성
export const trackQRGenerated = (qrType) => {
  return trackEvent('qr_generated', {
    qr_type: qrType,
  });
};

// 바코드 생성
export const trackBarcodeGenerated = (barcodeFormat) => {
  return trackEvent('barcode_generated', {
    barcode_format: barcodeFormat,
  });
};

// QR 코드 저장
export const trackQRSaved = (format) => {
  return trackEvent('qr_saved', {
    format: format, // 'image' or 'history'
  });
};

// QR 코드 공유
export const trackQRShared = (method) => {
  return trackEvent('qr_shared', {
    share_method: method,
  });
};

// 히스토리 조회
export const trackHistoryViewed = (itemCount) => {
  return trackEvent('history_viewed', {
    item_count: itemCount,
  });
};

// 설정 변경
export const trackSettingChanged = (settingName, value) => {
  return trackEvent('setting_changed', {
    setting_name: settingName,
    setting_value: String(value),
  });
};

// 기능 사용
export const trackFeatureUsed = (featureName) => {
  return trackEvent('feature_used', {
    feature_name: featureName,
  });
};

// 광고 시청
export const trackAdWatched = (adType, featureUnlocked) => {
  return trackEvent('ad_watched', {
    ad_type: adType,
    feature_unlocked: featureUnlocked,
  });
};

// 에러 발생
export const trackError = (errorType, errorMessage) => {
  return trackEvent('app_error', {
    error_type: errorType,
    error_message: errorMessage?.substring(0, 100),
  });
};
