# 실시간 전송 REST 계약 (Socket.IO → REST + Supabase Realtime)

작성일: 2026-10-16
목적: 웹 서버를 Vercel(상시 연결 불가) + Supabase로 옮기기 위해, 앱이 Socket.IO 대신 일반 HTTPS 요청으로 세션을 만들고 스캔을 보낸다.
웹 화면(세션 페이지·대시보드)은 Supabase Realtime(Broadcast)으로 새 스캔을 받는다.
옮기는 동안(Vultr 서버)에도 같은 REST 주소가 동작해야 한다 → 앱은 서버 위치와 상관없이 이 계약만 쓴다.

기본 주소: `config.serverUrl` (현재 `https://scanview.app`)
인증: 모든 요청에 `Authorization: Bearer <accessToken>` (기존 로그인 토큰). 실시간 전송은 로그인 사용자만 쓴다.
응답 형식: JSON. 실패 시 `{ "success": false, "error": "<메시지>", "code": "<ERROR_CODE>" }` + HTTP 상태 코드.

## 1. 세션 만들기 (또는 내 세션 이어 쓰기)

`POST /api/sessions`

요청 본문:
```json
{
  "sessionId": "선택. 앱이 만든 UUID. 없으면 서버가 만든다",
  "sessionName": "선택",
  "settings": { "password": "선택", "isPublic": true }
}
```

동작:
- 새 세션이면 만든다. 소유자 = 토큰 사용자.
- 이미 있는 세션이면 **소유자 또는 관리자만** 이름·설정을 바꿀 수 있고, 그 외에는 403.
  (소유자 없는 옛 세션 + 비밀번호 없음 + 공개면 토큰 사용자가 소유자가 된다 — 기존 소켓 동작과 같음)

응답 200/201:
```json
{ "success": true, "sessionId": "...", "sessionName": "...", "userId": "...", "created": true }
```

## 2. 스캔 보내기

`POST /api/sessions/{sessionId}/scans`

요청 본문:
```json
{ "code": "스캔 값 (필수, 최대 4096자)", "timestamp": 1760000000000 }
```

동작:
- 토큰 사용자가 세션 **소유자**(또는 관리자)일 때만 저장한다 → 아무 세션에나 스캔을 넣던 문제를 막는다. 아니면 403.
- 저장 후 새 스캔을 실시간으로 알린다(아래 3).
- 사용자 표시 이름: users.name이 없으면 null (이메일을 대신 내보내지 않는다).

응답 201:
```json
{ "success": true, "scan": { "id": 123, "sessionId": "...", "code": "...", "scan_timestamp": 1760000000000, "createdAt": "ISO", "userId": "...", "userName": "..." } }
```

앱은 실패해도 스캔 자체(기기 기록)는 그대로 두고, 네트워크 오류면 짧게 재시도(최대 3회, 지수 백오프)한다.

## 3. 실시간 알림 (웹 화면용)

서버는 스캔 저장 후 `new-scan` 이벤트를 보낸다. 페이로드 = 위 `scan` 객체.
- Vercel+Supabase: Supabase Realtime Broadcast, 채널 이름 `scans:{sessionId}:{realtimeKey}`, 이벤트 `new-scan`.
  `realtimeKey`는 세션마다 서버가 만든 추측 불가능한 값(session_settings.realtime_key). 열람 권한이 확인된 사람에게만
  세션 조회 API가 돌려준다 → 공개 세션은 누구나, 비밀번호 세션은 비밀번호 확인 뒤, 비공개는 소유자·관리자.
- Vultr(옮기는 동안): Socket.IO 방 `sessionId`로도 같은 `new-scan`을 보낸다 (기존 웹 화면·구버전 앱 호환).
- 웹 화면은 `NEXT_PUBLIC_SUPABASE_URL`이 설정돼 있으면 Supabase로, 아니면 Socket.IO로 받는다.

## 4. 구버전 앱

이미 설치된 iOS 앱은 Socket.IO `create-session`/`scan-data`를 쓴다.
- Vultr에 있는 동안은 계속 동작한다.
- Vercel로 옮긴 뒤에는 구버전 iOS 앱의 **실시간 전송만** 동작하지 않는다(사용자 결정, 2026-10-16). 스캔·기록 등 다른 기능은 영향 없음.
