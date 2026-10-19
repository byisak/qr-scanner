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

// ===== 핵심 기능 사용 (화면에 머문 시간보다 실제로 쓰는지가 중요) =====
// 잠금 기능에 막힘: 어떤 기능을 사람들이 가장 원하는지 (가격·무료 범위 결정용)
export const trackFeatureLockHit = (featureId) => trackEvent('feature_lock_hit', { feature_id: featureId });
// 유료(Pro) 안내 화면 열람
export const trackPaywallView = (source) => trackEvent('paywall_view', { source: source || 'unknown' });
// 기록 내보내기
export const trackExport = (format, groupCount, itemCount) =>
  trackEvent('export_done', { format, group_count: groupCount, item_count: itemCount });
// 실시간 PC 전송 세션 만들기
export const trackRealtimeSessionCreated = (isPublic, hasPassword) =>
  trackEvent('realtime_session_created', { is_public: isPublic ? 1 : 0, has_password: hasPassword ? 1 : 0 });
// 재고 실사 시작·완료
export const trackStocktakeStarted = (itemCount) => trackEvent('stocktake_started', { item_count: itemCount });
export const trackStocktakeFinished = (expected, missing, extra) =>
  trackEvent('stocktake_finished', { expected_count: expected, missing_count: missing, extra_count: extra });
