// utils/wifiQr.js - WiFi QR 코드(WIFI:T:WPA;S:이름;P:비밀번호;;) 만들기·읽기
// 표준(ZXing 형식)에서는 값 안의 \ ; , : " 앞에 역슬래시를 붙인다.
// 이전에는 이스케이프 없이 만들어서 비밀번호에 ; 같은 문자가 있으면 연결이 안 됐다.

const SPECIAL = /([\\;,:"])/g;

export function escapeWifiValue(value) {
  return String(value ?? '').replace(SPECIAL, '\\$1');
}

/** WiFi QR 문자열 만들기. security: 'WPA' | 'WEP' | 'nopass' */
export function buildWifiQr({ ssid, password, security, hidden }) {
  const type = security || 'WPA';
  const parts = [`T:${type}`, `S:${escapeWifiValue(ssid)}`];
  // 보안 없음이면 비밀번호를 넣지 않는다
  if (type !== 'nopass') parts.push(`P:${escapeWifiValue(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/**
 * WiFi QR 문자열 읽기. 역슬래시 이스케이프를 풀고 ; 로 항목을 나눈다.
 * 반환: { encryption, ssid, password, hidden } (없는 항목은 빠짐), WIFI: 가 아니면 null
 */
export function parseWifiQr(data) {
  if (typeof data !== 'string') return null;
  const text = data.trim();
  if (!/^WIFI:/i.test(text)) return null;
  const body = text.slice(5);

  const fields = {};
  let key = '';
  let value = '';
  let readingKey = true;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (!readingKey && ch === '\\' && i + 1 < body.length) {
      value += body[++i];
      continue;
    }
    if (readingKey) {
      if (ch === ':') {
        readingKey = false;
      } else if (ch === ';') {
        key = '';
      } else {
        key += ch;
      }
      continue;
    }
    if (ch === ';') {
      if (key) fields[key.toUpperCase()] = value;
      key = '';
      value = '';
      readingKey = true;
      continue;
    }
    value += ch;
  }
  if (!readingKey && key) fields[key.toUpperCase()] = value;

  const result = {};
  if ('T' in fields) result.encryption = fields.T || 'nopass';
  if ('S' in fields) result.ssid = fields.S;
  if ('P' in fields) result.password = fields.P;
  if ('H' in fields) result.hidden = fields.H.toLowerCase() === 'true';
  return result;
}
