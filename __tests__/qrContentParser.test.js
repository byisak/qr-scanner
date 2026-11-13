import { parseQRContent, formatPhoneNumber, QR_CONTENT_TYPES as T } from '../utils/qrContentParser';

describe('parseQRContent', () => {
  test('URL', () => {
    const r = parseQRContent('  https://Example.com/a/b?x=1 ');
    expect(r.type).toBe(T.URL);
    expect(r.raw).toBe('https://Example.com/a/b?x=1');
    expect(r.data.url).toBe('https://Example.com/a/b?x=1');
  });

  test('전화', () => {
    const r = parseQRContent('tel:+821012345678');
    expect(r.type).toBe(T.PHONE);
    expect(r.data.phoneNumber).toBe('+821012345678');
  });

  test('SMS (sms: / SMSTO:)', () => {
    expect(parseQRContent('sms:+821012345678?body=Hello%20there')).toMatchObject({
      type: T.SMS,
      data: { phoneNumber: '+821012345678', body: 'Hello there' },
    });
    expect(parseQRContent('SMSTO:01012345678:안녕하세요')).toMatchObject({
      type: T.SMS,
      data: { phoneNumber: '01012345678', body: '안녕하세요' },
    });
  });

  test('이메일 (mailto: / MATMSG:)', () => {
    expect(parseQRContent('mailto:a@b.com?subject=Hi&body=Hello%20you')).toMatchObject({
      type: T.EMAIL,
      data: { email: 'a@b.com', subject: 'Hi', body: 'Hello you' },
    });
    expect(parseQRContent('MATMSG:TO:a@b.com;SUB:Hi;BODY:Hello;;')).toMatchObject({
      type: T.EMAIL,
      data: { email: 'a@b.com', subject: 'Hi', body: 'Hello' },
    });
  });

  test('Wi-Fi', () => {
    expect(parseQRContent('WIFI:T:WPA;S:My\\;Net;P:p\\:w;;')).toMatchObject({
      type: T.WIFI,
      data: { encryption: 'WPA', ssid: 'My;Net', password: 'p:w' },
    });
  });

  test('위치', () => {
    expect(parseQRContent('geo:37.5665,126.9780?q=Seoul&z=15')).toMatchObject({
      type: T.GEO,
      data: { latitude: 37.5665, longitude: 126.978, query: 'Seoul', zoom: 15 },
    });
    expect(parseQRContent('geo:-33.86,-151.2').data).toEqual({ latitude: -33.86, longitude: -151.2 });
  });

  test('vCard', () => {
    const vcard = [
      'BEGIN:VCARD', 'VERSION:3.0', 'N:홍;길동', 'FN:홍길동', 'ORG:큐비온', 'TITLE:대리',
      'TEL;TYPE=CELL:010-1234-5678', 'TEL;TYPE=WORK:02-123-4567', 'EMAIL:hong@example.com',
      'URL:https://example.com', 'NOTE:메모', 'END:VCARD',
    ].join('\n');
    const r = parseQRContent(vcard);
    expect(r.type).toBe(T.CONTACT);
    expect(r.data).toMatchObject({
      fullName: '홍길동',
      lastName: '홍',
      firstName: '길동',
      organization: '큐비온',
      title: '대리',
      phones: ['010-1234-5678', '02-123-4567'],
      emails: ['hong@example.com'],
      url: 'https://example.com',
      note: '메모',
    });
  });

  test('vCard: 줄바꿈이 CRLF이고 N에 옵션이 붙어도 이름만 읽는다', () => {
    const r = parseQRContent('BEGIN:VCARD\r\nVERSION:2.1\r\nN;CHARSET=UTF-8:Kim;Minsu;;;\r\nTEL:010\r\nEND:VCARD');
    expect(r.data).toMatchObject({ lastName: 'Kim', firstName: 'Minsu', phones: ['010'] });
    expect(r.data.fullName).toBeUndefined();
  });

  test('MECARD', () => {
    expect(parseQRContent('MECARD:N:홍길동;TEL:01012345678;EMAIL:hong@example.com;;')).toMatchObject({
      type: T.CONTACT,
      data: { fullName: '홍길동', phones: ['01012345678'], emails: ['hong@example.com'] },
    });
  });

  test('일정', () => {
    const ev = ['BEGIN:VEVENT', 'SUMMARY:회의', 'LOCATION:회의실', 'DTSTART:20261018T143000', 'DTEND:20261018T153000', 'END:VEVENT'].join('\n');
    const r = parseQRContent(ev);
    expect(r.type).toBe(T.EVENT);
    expect(r.data.title).toBe('회의');
    expect(r.data.location).toBe('회의실');
    expect(r.data.startDate).toEqual(new Date(2026, 9, 18, 14, 30, 0));
    expect(r.data.endDate).toEqual(new Date(2026, 9, 18, 15, 30, 0));
  });

  test('나머지는 텍스트', () => {
    expect(parseQRContent('180100048|91163||0014')).toMatchObject({ type: T.TEXT, data: { text: '180100048|91163||0014' } });
    expect(parseQRContent('8801234567890').type).toBe(T.TEXT);
  });

  test('빈 값·문자열이 아닌 값도 죽지 않는다', () => {
    for (const v of ['', null, undefined, 123, {}]) {
      expect(parseQRContent(v)).toMatchObject({ type: T.TEXT, raw: '' });
    }
  });

  test('모든 결과에 아이콘과 색이 있다', () => {
    for (const s of ['https://a.b', 'tel:1', 'sms:1', 'mailto:a@b.c', 'WIFI:S:a;;', 'geo:1,2', 'BEGIN:VCARD\nFN:a', 'MECARD:N:a;;', 'BEGIN:VEVENT\nSUMMARY:a', 'x']) {
      const r = parseQRContent(s);
      expect(r.icon).toBeTruthy();
      expect(r.color).toBeTruthy();
    }
  });
});

describe('formatPhoneNumber', () => {
  test('한국 번호', () => {
    expect(formatPhoneNumber('+821012345678')).toBe('010-1234-5678');
    expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678');
  });
  test('모르는 형식은 그대로', () => {
    expect(formatPhoneNumber('+1 555 0100')).toBe('+1 555 0100');
    expect(formatPhoneNumber('')).toBe('');
  });
});
