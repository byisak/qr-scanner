# QR 코드 타입별 액션 구현 계획

## 개요
스캔된 QR 코드의 내용을 분석하여 타입에 맞는 액션 버튼과 기능을 제공합니다.

---

## 1. QR 콘텐츠 타입 감지 유틸리티 생성

### 파일: `utils/qrContentParser.js`

감지할 QR 타입과 패턴:

| 타입 | 패턴 | 예시 |
|------|------|------|
| **URL** | `http://`, `https://` | `https://google.com` |
| **전화** | `tel:` | `tel:+821012345678` |
| **SMS** | `sms:`, `SMSTO:` | `sms:+821012345678?body=Hello` |
| **이메일** | `mailto:`, `MATMSG:` | `mailto:test@test.com` |
| **WiFi** | `WIFI:` | `WIFI:T:WPA;S:MyNetwork;P:password;;` |
| **위치** | `geo:` | `geo:37.5665,126.9780` |
| **연락처** | `BEGIN:VCARD`, `MECARD:` | vCard 형식 |
| **일정** | `BEGIN:VCALENDAR`, `BEGIN:VEVENT` | iCalendar 형식 |
| **텍스트** | 기타 모든 텍스트 | 일반 문자열 |

### 파싱 함수 구현:
```javascript
// 반환 예시
{
  type: 'phone',        // 감지된 타입
  data: {               // 파싱된 데이터
    phoneNumber: '+821012345678'
  },
  raw: 'tel:+821012345678',  // 원본 데이터
  icon: 'call-outline',      // 표시용 아이콘
  label: '전화번호'           // 표시용 레이블
}
```

---

## 2. ResultScreen 수정

### 2.1 타입별 액션 버튼

| QR 타입 | 주요 액션 버튼 |
|---------|----------------|
| **URL** | 🌐 열기, 📋 복사, 📤 공유 |
| **전화** | 📞 전화걸기, 📋 복사, 👤 연락처 추가 |
| **SMS** | 💬 문자 보내기, 📋 복사 |
| **이메일** | ✉️ 이메일 보내기, 📋 복사 |
| **WiFi** | 📶 WiFi 연결 (설정 열기), 📋 비밀번호 복사 |
| **위치** | 🗺️ 지도에서 보기, 🧭 길찾기 |
| **연락처** | 👤 연락처 추가, 📞 전화, ✉️ 이메일 |
| **일정** | 📅 캘린더에 추가, 📋 복사 |
| **텍스트** | 📋 복사, 📤 공유, 🔍 웹 검색 |

### 2.2 타입별 상세 정보 표시

```
┌─────────────────────────────────────┐
│ [전화 아이콘] 전화번호              │
├─────────────────────────────────────┤
│                                     │
│      +82 10-1234-5678               │
│                                     │
├─────────────────────────────────────┤
│  [📞 전화걸기]  [👤 연락처 추가]    │
│                                     │
│  [📋 복사]      [📤 공유]           │
└─────────────────────────────────────┘
```

### 2.3 위치 QR - 미니맵 표시

```
┌─────────────────────────────────────┐
│ [위치 아이콘] 위치                  │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │       [미니 지도]               │ │
│ │           📍                    │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│  위도: 37.5665                      │
│  경도: 126.9780                     │
├─────────────────────────────────────┤
│  [🗺️ 지도 앱 열기]  [🧭 길찾기]    │
└─────────────────────────────────────┘
```

---

## 3. HistoryScreen 수정

### 3.1 타입 아이콘 표시
각 히스토리 항목에 QR 콘텐츠 타입 아이콘 추가:
- URL → 🌐
- 전화 → 📞
- 위치 → 📍
- 일정 → 📅
- 등등

### 3.2 빠른 액션 버튼
히스토리 항목 스와이프 또는 롱프레스 시 빠른 액션:
- 전화 QR → 바로 전화걸기
- URL → 바로 열기
- 위치 → 바로 지도 열기

---

## 4. 필요한 네이티브 기능

| 기능 | 라이브러리 | 설명 |
|------|------------|------|
| 전화걸기 | `Linking.openURL('tel:')` | 기본 제공 |
| SMS 보내기 | `Linking.openURL('sms:')` | 기본 제공 |
| 이메일 | `Linking.openURL('mailto:')` | 기본 제공 |
| 지도 열기 | `Linking.openURL('maps:')` 또는 Google Maps URL | 기본 제공 |
| 연락처 추가 | `expo-contacts` | 설치 필요 |
| 캘린더 추가 | `expo-calendar` | 설치 필요 |
| WiFi 설정 | 설정 앱 열기 | 플랫폼별 처리 |

---

## 5. 구현 순서

### Phase 1: 기본 구조 (필수)
1. ✅ `utils/qrContentParser.js` 생성 - QR 콘텐츠 파싱 유틸리티
2. ✅ `components/QRActionButtons.js` 생성 - 타입별 액션 버튼 컴포넌트
3. ✅ ResultScreen 수정 - 파서 연동 및 액션 버튼 표시

### Phase 2: 기본 액션 (Linking 사용)
4. ✅ 전화걸기 (`tel:`)
5. ✅ SMS 보내기 (`sms:`)
6. ✅ 이메일 보내기 (`mailto:`)
7. ✅ 지도 열기 (Google Maps / Apple Maps URL)

### Phase 3: 네이티브 연동
8. ⬜ `expo-contacts` 설치 및 연락처 추가 기능
9. ⬜ `expo-calendar` 설치 및 일정 추가 기능
10. ⬜ WiFi 설정 화면 열기

### Phase 4: UI 개선
11. ⬜ 위치 QR - 미니맵 표시
12. ⬜ 연락처 QR - 상세 정보 카드 표시
13. ⬜ 일정 QR - 일정 정보 카드 표시

### Phase 5: 히스토리 연동
14. ⬜ HistoryScreen에 타입 아이콘 표시
15. ⬜ 히스토리 항목 빠른 액션 추가

---

## 6. 번역 키 추가 필요

```javascript
// locales/ko.js에 추가
qrTypes: {
  url: 'URL',
  phone: '전화번호',
  sms: 'SMS',
  email: '이메일',
  wifi: 'WiFi',
  location: '위치',
  contact: '연락처',
  event: '일정',
  text: '텍스트',
},
qrActions: {
  call: '전화걸기',
  sendSms: '문자 보내기',
  sendEmail: '이메일 보내기',
  openMap: '지도에서 보기',
  getDirections: '길찾기',
  addContact: '연락처 추가',
  addToCalendar: '캘린더에 추가',
  copyPassword: '비밀번호 복사',
  openWifiSettings: 'WiFi 설정 열기',
  searchWeb: '웹에서 검색',
},
```

---

## 7. 예상 작업 시간

| 단계 | 예상 시간 |
|------|-----------|
| Phase 1 | 1-2시간 |
| Phase 2 | 1시간 |
| Phase 3 | 2-3시간 |
| Phase 4 | 2-3시간 |
| Phase 5 | 1-2시간 |
| **총계** | **7-11시간** |

---

## 8. 파일 변경 목록

### 새로 생성
- `utils/qrContentParser.js`
- `components/QRActionButtons.js`
- `components/QRTypeIcon.js`
- `components/MiniMap.js` (위치 QR용)

### 수정
- `screens/ResultScreen.js`
- `screens/HistoryScreen.js`
- `locales/ko.js`, `en.js`, `ja.js`, `zh.js`, `es.js`
- `package.json` (expo-contacts, expo-calendar 추가 시)

---

## 승인 후 구현 시작
이 계획을 검토해주시고, 진행 여부와 우선순위를 알려주세요.
