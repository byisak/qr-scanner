// utils/urlSafety.js - 스캔한 URL이 알려진 위험 사이트인지 서버(/api/url-check, Google 위험 사이트 목록)에 묻는다
// 결과: 'safe' | 'danger' | 'unknown'. 네트워크 오류·시간 초과·서버에 키가 없으면 'unknown'(아무 표시 안 함)
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config/config';
import { trackEvent } from './analytics';

export const URL_SAFETY_KEY = 'urlSafetyCheckEnabled';
const TIMEOUT_MS = 5000;
const cache = new Map(); // url → { at, result }
const TTL_MS = 30 * 60 * 1000;

export async function isUrlSafetyEnabled() {
  try {
    return (await AsyncStorage.getItem(URL_SAFETY_KEY)) !== 'false'; // 기본 켬
  } catch {
    return true;
  }
}

export async function checkUrlSafety(url) {
  if (!/^https?:\/\//i.test(url || '')) return { status: 'unknown', threats: [] };
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  if (!(await isUrlSafetyEnabled())) return { status: 'unknown', threats: [] };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.serverUrl}/api/url-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    const data = await res.json();
    const result = { status: data?.status || 'unknown', threats: Array.isArray(data?.threats) ? data.threats : [] };
    if (result.status !== 'unknown') cache.set(url, { at: Date.now(), result });
    if (result.status === 'danger') trackEvent('url_warning_shown', { threat: result.threats[0] || 'unknown' });
    return result;
  } catch {
    return { status: 'unknown', threats: [] };
  } finally {
    clearTimeout(timer);
  }
}
