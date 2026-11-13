import { buildWifiQr, parseWifiQr, escapeWifiValue } from '../utils/wifiQr';

describe('wifiQr', () => {
  test('기본 형식 읽기', () => {
    expect(parseWifiQr('WIFI:T:WPA;S:MyNet;P:pass1234;;')).toEqual({ encryption: 'WPA', ssid: 'MyNet', password: 'pass1234' });
  });

  test('특수 문자 이스케이프', () => {
    expect(escapeWifiValue('a;b:c,d"e\\f')).toBe('a\\;b\\:c\\,d\\"e\\\\f');
  });

  test('특수 문자가 든 값은 만들고 읽어도 그대로', () => {
    const input = { ssid: 'Cafe; "2F": A,B', password: 'p\\a;s:s,w"d', security: 'WPA', hidden: true };
    const parsed = parseWifiQr(buildWifiQr(input));
    expect(parsed).toEqual({ encryption: 'WPA', ssid: input.ssid, password: input.password, hidden: true });
  });

  test('보안 없음이면 비밀번호를 넣지 않는다', () => {
    const qr = buildWifiQr({ ssid: 'Open', password: 'ignored', security: 'nopass' });
    expect(qr).toBe('WIFI:T:nopass;S:Open;;');
    expect(parseWifiQr(qr)).toEqual({ encryption: 'nopass', ssid: 'Open' });
  });

  test('항목 순서가 달라도 읽는다', () => {
    expect(parseWifiQr('WIFI:S:Net;T:WEP;P:abc;H:true;;')).toEqual({ encryption: 'WEP', ssid: 'Net', password: 'abc', hidden: true });
  });

  test('WIFI: 가 아니면 null', () => {
    expect(parseWifiQr('https://example.com')).toBeNull();
    expect(parseWifiQr(undefined)).toBeNull();
  });
});
