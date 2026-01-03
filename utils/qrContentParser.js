// utils/qrContentParser.js - QR 코드 콘텐츠 타입 감지 및 파싱

/**
 * QR 콘텐츠 타입 정의
 */
export const QR_CONTENT_TYPES = {
  URL: 'url',
  PHONE: 'phone',
  SMS: 'sms',
  EMAIL: 'email',
  WIFI: 'wifi',
  GEO: 'geo',
  CONTACT: 'contact',
  EVENT: 'event',
  TEXT: 'text',
};

/**
 * 타입별 아이콘 매핑
 */
export const QR_TYPE_ICONS = {
  [QR_CONTENT_TYPES.URL]: 'globe-outline',
  [QR_CONTENT_TYPES.PHONE]: 'call-outline',
  [QR_CONTENT_TYPES.SMS]: 'chatbubble-outline',
  [QR_CONTENT_TYPES.EMAIL]: 'mail-outline',
  [QR_CONTENT_TYPES.WIFI]: 'wifi-outline',
  [QR_CONTENT_TYPES.GEO]: 'location-outline',
  [QR_CONTENT_TYPES.CONTACT]: 'person-outline',
  [QR_CONTENT_TYPES.EVENT]: 'calendar-outline',
  [QR_CONTENT_TYPES.TEXT]: 'text-outline',
};

/**
 * 타입별 색상 매핑
 */
export const QR_TYPE_COLORS = {
  [QR_CONTENT_TYPES.URL]: '#667eea',
  [QR_CONTENT_TYPES.PHONE]: '#34C759',
  [QR_CONTENT_TYPES.SMS]: '#FF9500',
  [QR_CONTENT_TYPES.EMAIL]: '#007AFF',
  [QR_CONTENT_TYPES.WIFI]: '#5856D6',
  [QR_CONTENT_TYPES.GEO]: '#FF3B30',
  [QR_CONTENT_TYPES.CONTACT]: '#FF2D55',
  [QR_CONTENT_TYPES.EVENT]: '#FF9500',
  [QR_CONTENT_TYPES.TEXT]: '#8E8E93',
};

/**
 * URL 파싱
 */
const parseUrl = (data) => {
  try {
    const url = new URL(data);
    return {
      url: data,
      protocol: url.protocol,
      hostname: url.hostname,
      pathname: url.pathname,
    };
  } catch {
    return { url: data };
  }
};

/**
 * 전화번호 파싱 (tel:+821012345678)
 */
const parsePhone = (data) => {
  const match = data.match(/^tel:(.+)$/i);
  if (match) {
    return {
      phoneNumber: match[1].trim(),
    };
  }
  return null;
};

/**
 * SMS 파싱 (sms:+821012345678?body=Hello 또는 SMSTO:...)
 */
const parseSms = (data) => {
  // sms: 형식
  let match = data.match(/^sms:([^?]+)(?:\?body=(.*))?$/i);
  if (match) {
    return {
      phoneNumber: match[1].trim(),
      body: match[2] ? decodeURIComponent(match[2]) : '',
    };
  }

  // SMSTO: 형식
  match = data.match(/^SMSTO:([^:]+)(?::(.*))?$/i);
  if (match) {
    return {
      phoneNumber: match[1].trim(),
      body: match[2] || '',
    };
  }

  return null;
};

/**
 * 이메일 파싱 (mailto: 또는 MATMSG:)
 */
const parseEmail = (data) => {
  // mailto: 형식
  if (data.toLowerCase().startsWith('mailto:')) {
    const urlPart = data.substring(7);
    const [emailPart, queryPart] = urlPart.split('?');
    const result = { email: emailPart };

    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      if (params.get('subject')) result.subject = params.get('subject');
      if (params.get('body')) result.body = params.get('body');
      if (params.get('cc')) result.cc = params.get('cc');
      if (params.get('bcc')) result.bcc = params.get('bcc');
    }

    return result;
  }

  // MATMSG: 형식
  if (data.startsWith('MATMSG:')) {
    const result = {};
    const toMatch = data.match(/TO:([^;]+)/i);
    const subMatch = data.match(/SUB:([^;]+)/i);
    const bodyMatch = data.match(/BODY:([^;]+)/i);

    if (toMatch) result.email = toMatch[1];
    if (subMatch) result.subject = subMatch[1];
    if (bodyMatch) result.body = bodyMatch[1];

    return result;
  }

  return null;
};

/**
 * WiFi 파싱 (WIFI:T:WPA;S:NetworkName;P:password;;)
 */
const parseWifi = (data) => {
  if (!data.startsWith('WIFI:')) return null;

  const result = {};

  // 암호화 타입
  const typeMatch = data.match(/T:([^;]*)/i);
  if (typeMatch) result.encryption = typeMatch[1] || 'nopass';

  // SSID (네트워크 이름)
  const ssidMatch = data.match(/S:([^;]*)/i);
  if (ssidMatch) result.ssid = ssidMatch[1];

  // 비밀번호
  const passMatch = data.match(/P:([^;]*)/i);
  if (passMatch) result.password = passMatch[1];

  // 숨김 네트워크
  const hiddenMatch = data.match(/H:([^;]*)/i);
  if (hiddenMatch) result.hidden = hiddenMatch[1].toLowerCase() === 'true';

  return result;
};

/**
 * 위치 파싱 (geo:37.5665,126.9780 또는 geo:37.5665,126.9780?q=Seoul)
 */
const parseGeo = (data) => {
  const match = data.match(/^geo:(-?\d+\.?\d*),(-?\d+\.?\d*)(?:\?(.*))?$/i);
  if (!match) return null;

  const result = {
    latitude: parseFloat(match[1]),
    longitude: parseFloat(match[2]),
  };

  if (match[3]) {
    const params = new URLSearchParams(match[3]);
    if (params.get('q')) result.query = params.get('q');
    if (params.get('z')) result.zoom = parseInt(params.get('z'), 10);
  }

  return result;
};

/**
 * vCard 파싱
 */
const parseVCard = (data) => {
  if (!data.includes('BEGIN:VCARD')) return null;

  const result = {};

  // 이름
  const fnMatch = data.match(/FN:(.+)/i);
  if (fnMatch) result.fullName = fnMatch[1].trim();

  const nMatch = data.match(/N:([^;]*);([^;]*)/i);
  if (nMatch) {
    result.lastName = nMatch[1].trim();
    result.firstName = nMatch[2].trim();
  }

  // 전화번호 (여러 개 가능)
  const telMatches = data.match(/TEL[^:]*:(.+)/gi);
  if (telMatches) {
    result.phones = telMatches.map(t => {
      const num = t.match(/TEL[^:]*:(.+)/i);
      return num ? num[1].trim() : '';
    }).filter(Boolean);
  }

  // 이메일
  const emailMatches = data.match(/EMAIL[^:]*:(.+)/gi);
  if (emailMatches) {
    result.emails = emailMatches.map(e => {
      const addr = e.match(/EMAIL[^:]*:(.+)/i);
      return addr ? addr[1].trim() : '';
    }).filter(Boolean);
  }

  // 조직
  const orgMatch = data.match(/ORG:(.+)/i);
  if (orgMatch) result.organization = orgMatch[1].trim();

  // 직함
  const titleMatch = data.match(/TITLE:(.+)/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  // 주소
  const adrMatch = data.match(/ADR[^:]*:([^;]*;?)+/i);
  if (adrMatch) {
    const parts = adrMatch[0].replace(/ADR[^:]*:/i, '').split(';');
    result.address = parts.filter(Boolean).join(' ').trim();
  }

  // URL
  const urlMatch = data.match(/URL:(.+)/i);
  if (urlMatch) result.url = urlMatch[1].trim();

  // 메모
  const noteMatch = data.match(/NOTE:(.+)/i);
  if (noteMatch) result.note = noteMatch[1].trim();

  return result;
};

/**
 * MECARD 파싱 (MECARD:N:홍길동;TEL:01012345678;EMAIL:test@test.com;;)
 */
const parseMeCard = (data) => {
  if (!data.startsWith('MECARD:')) return null;

  const result = {};

  // 이름
  const nameMatch = data.match(/N:([^;]+)/i);
  if (nameMatch) result.fullName = nameMatch[1].trim();

  // 전화번호
  const telMatch = data.match(/TEL:([^;]+)/i);
  if (telMatch) result.phones = [telMatch[1].trim()];

  // 이메일
  const emailMatch = data.match(/EMAIL:([^;]+)/i);
  if (emailMatch) result.emails = [emailMatch[1].trim()];

  // 주소
  const adrMatch = data.match(/ADR:([^;]+)/i);
  if (adrMatch) result.address = adrMatch[1].trim();

  // URL
  const urlMatch = data.match(/URL:([^;]+)/i);
  if (urlMatch) result.url = urlMatch[1].trim();

  // 메모
  const noteMatch = data.match(/NOTE:([^;]+)/i);
  if (noteMatch) result.note = noteMatch[1].trim();

  return result;
};

/**
 * iCalendar 이벤트 파싱
 */
const parseEvent = (data) => {
  if (!data.includes('BEGIN:VCALENDAR') && !data.includes('BEGIN:VEVENT')) return null;

  const result = {};

  // 제목
  const summaryMatch = data.match(/SUMMARY:(.+)/i);
  if (summaryMatch) result.title = summaryMatch[1].trim();

  // 설명
  const descMatch = data.match(/DESCRIPTION:(.+)/i);
  if (descMatch) result.description = descMatch[1].trim();

  // 장소
  const locationMatch = data.match(/LOCATION:(.+)/i);
  if (locationMatch) result.location = locationMatch[1].trim();

  // 시작 시간
  const dtStartMatch = data.match(/DTSTART[^:]*:(\d{8}T?\d{0,6})/i);
  if (dtStartMatch) {
    result.startDate = parseICalDate(dtStartMatch[1]);
  }

  // 종료 시간
  const dtEndMatch = data.match(/DTEND[^:]*:(\d{8}T?\d{0,6})/i);
  if (dtEndMatch) {
    result.endDate = parseICalDate(dtEndMatch[1]);
  }

  // 주최자
  const organizerMatch = data.match(/ORGANIZER[^:]*:(.+)/i);
  if (organizerMatch) result.organizer = organizerMatch[1].trim();

  return result;
};

/**
 * iCalendar 날짜 파싱 (20240101T120000 -> Date)
 */
const parseICalDate = (dateStr) => {
  if (!dateStr) return null;

  try {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);

    let hour = 0, minute = 0, second = 0;
    if (dateStr.length >= 15) {
      hour = parseInt(dateStr.substring(9, 11), 10);
      minute = parseInt(dateStr.substring(11, 13), 10);
      second = parseInt(dateStr.substring(13, 15), 10);
    }

    return new Date(year, month, day, hour, minute, second);
  } catch {
    return null;
  }
};

/**
 * QR 콘텐츠 타입 감지 및 파싱
 * @param {string} data - QR 코드 데이터
 * @returns {Object} 파싱 결과
 */
export const parseQRContent = (data) => {
  if (!data || typeof data !== 'string') {
    return {
      type: QR_CONTENT_TYPES.TEXT,
      data: { text: '' },
      raw: '',
      icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.TEXT],
      color: QR_TYPE_COLORS[QR_CONTENT_TYPES.TEXT],
    };
  }

  const trimmedData = data.trim();
  const lowerData = trimmedData.toLowerCase();

  // URL 체크
  if (lowerData.startsWith('http://') || lowerData.startsWith('https://')) {
    return {
      type: QR_CONTENT_TYPES.URL,
      data: parseUrl(trimmedData),
      raw: trimmedData,
      icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.URL],
      color: QR_TYPE_COLORS[QR_CONTENT_TYPES.URL],
    };
  }

  // 전화번호 체크
  if (lowerData.startsWith('tel:')) {
    const parsed = parsePhone(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.PHONE,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.PHONE],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.PHONE],
      };
    }
  }

  // SMS 체크
  if (lowerData.startsWith('sms:') || lowerData.startsWith('smsto:')) {
    const parsed = parseSms(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.SMS,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.SMS],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.SMS],
      };
    }
  }

  // 이메일 체크
  if (lowerData.startsWith('mailto:') || trimmedData.startsWith('MATMSG:')) {
    const parsed = parseEmail(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.EMAIL,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.EMAIL],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.EMAIL],
      };
    }
  }

  // WiFi 체크
  if (trimmedData.startsWith('WIFI:')) {
    const parsed = parseWifi(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.WIFI,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.WIFI],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.WIFI],
      };
    }
  }

  // 위치 체크
  if (lowerData.startsWith('geo:')) {
    const parsed = parseGeo(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.GEO,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.GEO],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.GEO],
      };
    }
  }

  // vCard 체크
  if (trimmedData.includes('BEGIN:VCARD')) {
    const parsed = parseVCard(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.CONTACT,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.CONTACT],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.CONTACT],
      };
    }
  }

  // MECARD 체크
  if (trimmedData.startsWith('MECARD:')) {
    const parsed = parseMeCard(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.CONTACT,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.CONTACT],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.CONTACT],
      };
    }
  }

  // 이벤트 체크
  if (trimmedData.includes('BEGIN:VCALENDAR') || trimmedData.includes('BEGIN:VEVENT')) {
    const parsed = parseEvent(trimmedData);
    if (parsed) {
      return {
        type: QR_CONTENT_TYPES.EVENT,
        data: parsed,
        raw: trimmedData,
        icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.EVENT],
        color: QR_TYPE_COLORS[QR_CONTENT_TYPES.EVENT],
      };
    }
  }

  // 기본: 텍스트
  return {
    type: QR_CONTENT_TYPES.TEXT,
    data: { text: trimmedData },
    raw: trimmedData,
    icon: QR_TYPE_ICONS[QR_CONTENT_TYPES.TEXT],
    color: QR_TYPE_COLORS[QR_CONTENT_TYPES.TEXT],
  };
};

/**
 * 전화번호 포맷팅
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  // 한국 전화번호 포맷팅
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('82')) {
    const local = '0' + cleaned.substring(2);
    if (local.length === 11) {
      return local.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (local.length === 10) {
      return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
  }
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phone;
};

export default parseQRContent;
