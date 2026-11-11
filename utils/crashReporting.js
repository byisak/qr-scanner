// utils/crashReporting.js - Firebase Crashlytics (비정상 종료 보고)
// 수집 여부는 '사용 분석 동의'를 그대로 따른다. 스캔·생성한 코드 내용은 보내지 않는다.
import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
  log as crashLog,
  recordError as crashRecordError,
  setAttribute as crashSetAttribute,
} from '@react-native-firebase/crashlytics';

const safe = (fn) => {
  try {
    const r = fn();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch {
    // Crashlytics가 없거나 초기화 전이면 조용히 넘어간다 (보고 때문에 앱이 죽으면 안 된다)
  }
};

export const setCrashReportingEnabled = (enabled) =>
  safe(() => setCrashlyticsCollectionEnabled(getCrashlytics(), !!enabled));

// 크래시 직전 흐름을 알 수 있게 남기는 짧은 기록 (크래시 보고에 같이 붙는다)
export const crashBreadcrumb = (message) => safe(() => crashLog(getCrashlytics(), String(message).slice(0, 200)));

// 앱이 죽지는 않았지만 알아야 할 오류 (예: 카메라 오류)
export const recordNonFatal = (error, name) =>
  safe(() => {
    const err = error instanceof Error ? error : new Error(String(error?.message || error));
    crashRecordError(getCrashlytics(), err, name);
  });

export const setCrashAttribute = (key, value) =>
  safe(() => crashSetAttribute(getCrashlytics(), key, String(value)));
