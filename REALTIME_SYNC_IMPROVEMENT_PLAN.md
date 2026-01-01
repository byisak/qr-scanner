# 실시간 서버 연동 개선 계획

## 현재 구현 분석

### URL 생성 방식
- **세션 ID**: 8자리 영숫자 (62^8 ≈ 218조 조합)
- **URL 형식**: `http://158.247.248.140:3000/{sessionId}`

---

## 1. 보안 개선 사항

### 1.1 HTTPS 적용 (Critical)
- [ ] 서버에 SSL 인증서 적용
- [ ] `config.js`에서 `https://` URL 사용
- [ ] 웹소켓 연결도 `wss://` 프로토콜 사용

### 1.2 세션 ID 보안 강화
- [ ] 세션 ID 길이를 12자리로 증가 (62^12 ≈ 3.2×10^21)
- [ ] UUID v4 사용 옵션 추가 (더 높은 엔트로피)
- [ ] 예측 불가능한 암호학적 난수 생성기 사용 (`expo-crypto`)

```javascript
// 개선된 세션 ID 생성
import * as Crypto from 'expo-crypto';

const generateSecureSessionId = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(9);
  return Array.from(randomBytes)
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .substring(0, 12);
};
```

### 1.3 비밀번호 보안 강화
- [ ] 비밀번호를 `AsyncStorage` 대신 `SecureStore`에 저장
- [ ] 비밀번호 해싱 후 서버 전송 (bcrypt/argon2)
- [ ] 세션 접속 시 비밀번호 검증 서버 API 구현

### 1.4 세션 만료 정책
- [ ] 활동 없는 세션 자동 비활성화 (예: 7일)
- [ ] 세션별 만료 시간 설정 옵션
- [ ] 만료 전 알림 기능

### 1.5 접근 제어
- [ ] 세션 소유자만 삭제/수정 가능하도록 API 보호
- [ ] 세션 조회 시 user_id 기반 필터링
- [ ] Rate Limiting 적용 (스캔 데이터 전송 제한)

---

## 2. 사용자 경험 개선 사항

### 2.1 친숙한 URL (High Priority)
- [ ] IP 주소 대신 도메인 사용 (`scan.example.com`)
- [ ] 짧은 URL 형식 지원 (`scan.example.com/abc123`)

### 2.2 세션 URL QR 코드 생성 (High Priority)
- [ ] 세션 URL을 QR 코드로 생성하여 표시
- [ ] QR 코드 저장/공유 기능
- [ ] 다른 기기에서 QR 스캔으로 웹 대시보드 바로 열기

```javascript
// QR 코드 생성 컴포넌트 추가
<TouchableOpacity onPress={() => showQRCodeModal(session.url)}>
  <Ionicons name="qr-code-outline" size={18} color="#fff" />
</TouchableOpacity>
```

### 2.3 네이티브 공유 기능
- [ ] iOS/Android 공유 시트로 URL 공유
- [ ] 공유 메시지 템플릿 (예: "QR 스캔 데이터를 실시간으로 확인하세요: {url}")

```javascript
import * as Sharing from 'expo-sharing';

const handleShareUrl = async (url, sessionName) => {
  await Share.share({
    message: `${sessionName} 세션의 스캔 데이터를 확인하세요:\n${url}`,
    url: url,
  });
};
```

### 2.4 세션 이름 지정 개선
- [ ] 세션 생성 시 이름 입력 모달
- [ ] 기본 이름 자동 생성 (날짜/시간 기반)
- [ ] 이모지 지원으로 시각적 구분

### 2.5 세션 미리보기 카드
- [ ] 세션 카드에 실시간 스캔 수 표시
- [ ] 마지막 활동 시간 (예: "5분 전")
- [ ] 연결 상태 표시 (실시간 연결됨/오프라인)

### 2.6 간편 PIN 코드 (4자리)
- [ ] 복잡한 비밀번호 대신 4자리 PIN 옵션
- [ ] PIN 입력 UI (숫자 키패드)
- [ ] 3회 실패 시 잠금

---

## 3. 추가 기능 아이디어

### 3.1 커스텀 별칭 URL (Pro 기능)
- [ ] 사용자가 원하는 별칭 설정 (`scan.example.com/my-store`)
- [ ] 별칭 중복 체크
- [ ] 별칭 변경/삭제 기능

### 3.2 오프라인 큐
- [ ] 네트워크 오프라인 시 스캔 데이터 로컬 저장
- [ ] 연결 복구 시 자동 동기화
- [ ] 동기화 대기 중 스캔 수 표시

```javascript
// 오프라인 큐 관리
const offlineQueue = {
  async addToQueue(scanData) {
    const queue = await AsyncStorage.getItem('offlineScanQueue') || '[]';
    const parsed = JSON.parse(queue);
    parsed.push({ ...scanData, queuedAt: Date.now() });
    await AsyncStorage.setItem('offlineScanQueue', JSON.stringify(parsed));
  },

  async syncQueue() {
    const queue = await AsyncStorage.getItem('offlineScanQueue');
    if (!queue) return;

    const parsed = JSON.parse(queue);
    for (const item of parsed) {
      await websocketClient.sendScanData(item);
    }
    await AsyncStorage.removeItem('offlineScanQueue');
  }
};
```

### 3.3 실시간 알림
- [ ] 웹 대시보드 접속 시 앱에 알림
- [ ] 특정 바코드 스캔 시 알림 (예: 재고 부족 알림)
- [ ] 일일 스캔 요약 알림

### 3.4 앱 내 데이터 내보내기
- [ ] 세션별 CSV/Excel 내보내기
- [ ] 이메일로 보고서 전송
- [ ] 날짜 범위 필터

### 3.5 세션 템플릿
- [ ] 자주 사용하는 설정 저장
- [ ] 템플릿으로 빠른 세션 생성
- [ ] 템플릿 공유 기능

### 3.6 멀티 디바이스 세션
- [ ] 여러 기기가 같은 세션에 스캔 데이터 전송
- [ ] 기기별 구분 (디바이스 이름 표시)
- [ ] 동시 접속 기기 수 제한 (플랜별)

### 3.7 웹 대시보드 딥링크
- [ ] 앱에서 웹 대시보드 버튼 클릭 시 브라우저 열기
- [ ] 유니버설 링크 지원 (웹 → 앱)

### 3.8 세션 통계/분석
- [ ] 시간대별 스캔 차트
- [ ] 가장 많이 스캔된 코드 TOP 10
- [ ] 일일/주간/월간 리포트

---

## 4. 구현 우선순위

### Phase 1 - 보안 기반 (1주)
1. HTTPS 적용
2. 세션 ID 보안 강화
3. 비밀번호 SecureStore 저장

### Phase 2 - UX 필수 기능 (1주)
1. 세션 URL QR 코드 생성
2. 네이티브 공유 기능
3. 세션 이름 입력 모달
4. 실시간 스캔 수 표시

### Phase 3 - 고급 기능 (2주)
1. 오프라인 큐
2. 커스텀 별칭 URL (Pro)
3. 앱 내 데이터 내보내기
4. 세션 통계

### Phase 4 - 추가 기능 (2주)
1. 멀티 디바이스 지원
2. 실시간 알림
3. 세션 템플릿
4. 딥링크 지원

---

## 5. 서버 측 필요 변경 (qr-scanner-web)

### API 추가
- `POST /api/sessions/:id/verify-pin` - PIN 검증
- `POST /api/sessions/:id/alias` - 커스텀 별칭 설정
- `GET /api/sessions/:id/stats` - 세션 통계
- `POST /api/sessions/:id/export` - 데이터 내보내기

### WebSocket 이벤트 추가
- `viewer-connected` - 웹 뷰어 접속 알림
- `offline-sync` - 오프라인 데이터 일괄 동기화

### 데이터베이스 스키마 변경
```sql
-- 세션 테이블 수정
ALTER TABLE sessions ADD COLUMN alias VARCHAR2(50) UNIQUE;
ALTER TABLE sessions ADD COLUMN pin_hash VARCHAR2(255);
ALTER TABLE sessions ADD COLUMN expires_at TIMESTAMP;

-- 오프라인 큐 테이블
CREATE TABLE offline_queue (
  id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id VARCHAR2(255) NOT NULL,
  code VARCHAR2(1000) NOT NULL,
  scan_timestamp NUMBER NOT NULL,
  device_id VARCHAR2(255),
  synced_at TIMESTAMP,
  CONSTRAINT fk_offline_session FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

---

## 6. 파일 변경 예상 목록

### 앱 (qr-scanner)
- `screens/RealtimeSyncSettingsScreen.js` - UI 개선, 새 기능 추가
- `utils/websocket.js` - 오프라인 큐, 새 이벤트 처리
- `config/config.js` - HTTPS URL
- `components/SessionQRCode.js` - (신규) QR 코드 생성 컴포넌트
- `components/SessionCard.js` - (신규) 세션 미리보기 카드
- `components/PinInput.js` - (신규) PIN 입력 컴포넌트

### 서버 (qr-scanner-web)
- `server.ts` - 새 WebSocket 이벤트
- `app/api/sessions/` - 새 API 엔드포인트
- `schema.sql` - 테이블 수정
- `lib/offline-sync.ts` - (신규) 오프라인 동기화 로직
