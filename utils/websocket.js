// utils/websocket.js - 실시간 서버 전송 클라이언트 (HTTPS REST)
//
// 예전에는 Socket.IO로 세션을 만들고 스캔을 보냈지만, 웹 서버가 Vercel(상시 연결 불가)로
// 옮겨가면서 일반 HTTPS 요청으로 바꿨다. 계약: docs/REALTIME_REST_CONTRACT.md
//   - 세션 만들기/이어 쓰기: POST {serverUrl}/api/sessions
//   - 스캔 보내기:          POST {serverUrl}/api/sessions/{sessionId}/scans
//   - 모든 요청에 Authorization: Bearer <accessToken>
//
// 화면 코드가 그대로 쓸 수 있도록 예전 공개 API(connect/disconnect/createSession/joinSession/
// sendScanData/on/off/getConnectionStatus ...)의 이름과 반환 형태를 유지한다.
// "연결됨(isConnected)"은 이제 소켓이 아니라 "서버에 닿음 / 세션 요청 성공"을 뜻한다.

const REQUEST_TIMEOUT_MS = 10000;
const PROBE_TIMEOUT_MS = 5000;
// 네트워크 오류·5xx일 때 재시도 간격 (최대 3회, 지수 백오프)
const RETRY_DELAYS_MS = [500, 1000, 2000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 서버가 돌려준 오류 (HTTP 상태 코드가 있는 오류)
class RealtimeHttpError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'RealtimeHttpError';
    this.status = status;
    this.code = code || null;
  }
}

class WebSocketClient {
  constructor() {
    this.serverUrl = null;
    this.sessionId = null;
    this.userId = null;
    this.authToken = null;
    this.isConnected = false;
    // AuthContext가 등록하는 토큰 도우미 (getToken / refreshAccessToken)
    this.authHandlers = { getToken: null, refreshAccessToken: null };
    this._refreshPromise = null;
    this._probeId = 0;
    this.listeners = {
      connect: [],
      disconnect: [],
      sessionCreated: [],
      error: [],
    };
    // 테스트에서 바꿔 끼울 수 있게 둔다
    this.retryDelays = RETRY_DELAYS_MS;
  }

  // ---------------------------------------------------------------------------
  // 연결 상태 (REST라 실제 연결은 없다 — 서버 주소를 정하고 닿는지 한 번 확인한다)
  // ---------------------------------------------------------------------------

  connect(serverUrl) {
    const url = (serverUrl || '').replace(/\/+$/, '');
    if (!url) {
      this._emit('error', new Error('Server URL not set'));
      return null;
    }

    // 이미 같은 서버에 닿아 있으면 다시 확인하지 않음
    if (this.serverUrl === url && this.isConnected) {
      return this;
    }

    if (this.serverUrl && this.serverUrl !== url) {
      this.disconnect();
    }
    this.serverUrl = url;
    this._probe();
    return this;
  }

  // 서버가 응답하는지 확인 (HTTP 응답이 오기만 하면 닿은 것으로 본다)
  async _probe() {
    const probeId = ++this._probeId;
    const serverUrl = this.serverUrl;
    try {
      await this._fetchWithTimeout(serverUrl, { method: 'HEAD' }, PROBE_TIMEOUT_MS);
      if (probeId !== this._probeId || serverUrl !== this.serverUrl) return;
      this._setConnected(true);
    } catch (error) {
      if (probeId !== this._probeId || serverUrl !== this.serverUrl) return;
      console.warn('[Realtime] server unreachable:', error.message);
      this._setConnected(false);
      this._emit('error', error);
    }
  }

  _setConnected(connected) {
    if (this.isConnected === connected) return;
    this.isConnected = connected;
    this._emit(connected ? 'connect' : 'disconnect');
  }

  disconnect() {
    this._probeId++; // 진행 중인 확인 결과는 버린다
    const wasConnected = this.isConnected;
    this.isConnected = false;
    this.sessionId = null;
    if (wasConnected) this._emit('disconnect');
  }

  // ---------------------------------------------------------------------------
  // 세션
  // ---------------------------------------------------------------------------

  // 세션 생성 요청 (설정 포함) — POST /api/sessions
  async createSession(sessionId = null, settings = {}) {
    const body = {
      sessionName: settings.sessionName || null,
      settings: {
        password: settings.password || null,
        isPublic: settings.isPublic !== undefined ? settings.isPublic : true,
      },
    };
    if (sessionId) body.sessionId = sessionId;

    const data = await this._postSession(body);
    return data ? true : false;
  }

  // 기존 세션 이어 쓰기 (소유권(user_id) 갱신용) — POST /api/sessions 에 기존 sessionId를 보낸다.
  // 이름·설정은 보내지 않아 서버에 있는 값을 바꾸지 않는다.
  async joinSession(sessionId, sessionName = null) {
    if (!sessionId) throw new Error('sessionId is required');
    const body = { sessionId };
    if (sessionName) body.sessionName = sessionName;
    await this._postSession(body);
    return true;
  }

  async _postSession(body) {
    try {
      const data = await this._request('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      this._setConnected(true);
      if (data && data.sessionId) {
        this.sessionId = data.sessionId;
      }
      this._emit('sessionCreated', data);
      return data;
    } catch (error) {
      this._handleRequestError(error);
      throw error;
    }
  }

  // 세션 설정 업데이트
  updateSessionSettings(sessionId, settings) {
    return this._request(`/api/sessions/${encodeURIComponent(sessionId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // 세션 설정 조회
  async getSessionSettings(sessionId) {
    return this._request(`/api/sessions/${encodeURIComponent(sessionId)}/settings`, {
      method: 'GET',
    });
  }

  // ---------------------------------------------------------------------------
  // 스캔 전송
  // ---------------------------------------------------------------------------

  // 스캔 데이터 전송 — POST /api/sessions/{sessionId}/scans
  // 예전처럼 동기적으로 true/false를 돌려주고 실제 전송은 뒤에서 한다.
  // 전송이 실패해도 기기의 스캔 기록에는 영향을 주지 않는다(호출부가 먼저/따로 저장한다).
  sendScanData(data, sessionId) {
    const targetSessionId = sessionId || this.sessionId;
    if (!this.serverUrl || !targetSessionId) {
      console.log('Server not connected yet. Data will be stored locally only.');
      return true; // 로컬 저장은 성공했으므로 true 반환
    }
    if (!data || typeof data.code !== 'string' || data.code.length === 0) {
      return false;
    }

    const payload = {
      code: data.code,
      timestamp: data.timestamp || Date.now(),
    };

    this.uploadScan(targetSessionId, payload).catch(() => {
      // 오류는 uploadScan 안에서 'error' 이벤트로 이미 알렸다
    });
    return true;
  }

  // 실제 업로드 (Promise). 테스트·필요한 호출부에서 결과를 기다릴 때 쓴다.
  async uploadScan(sessionId, payload) {
    const endpoint = `/api/sessions/${encodeURIComponent(sessionId)}/scans`;
    const options = { method: 'POST', body: JSON.stringify(payload) };
    try {
      let data;
      try {
        data = await this._request(endpoint, options);
      } catch (error) {
        // 서버에 아직 없는 세션(오프라인에서 만든 세션 등)이면 내 세션으로 등록한 뒤 한 번만 다시 보낸다
        if (!(error instanceof RealtimeHttpError) || error.status !== 404) throw error;
        await this._request('/api/sessions', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
        });
        data = await this._request(endpoint, options);
      }
      this._setConnected(true);
      return data;
    } catch (error) {
      console.warn('[Realtime] scan upload failed:', error.message);
      this._handleRequestError(error);
      throw error;
    }
  }

  // 요청 실패를 연결 상태/오류 이벤트로 반영
  _handleRequestError(error) {
    if (!(error instanceof RealtimeHttpError)) {
      // 네트워크 오류 (재시도까지 실패) → 서버에 닿지 않음
      this._setConnected(false);
    }
    this._emit('error', error);
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------

  // 인증 + 재시도가 붙은 요청.
  //  - 네트워크 오류·타임아웃·5xx: 최대 3회 재시도 (500ms/1s/2s)
  //  - 401: 토큰 갱신 후 한 번만 다시 시도
  //  - 그 밖의 4xx: 재시도하지 않고 바로 오류
  async _request(endpoint, options = {}) {
    if (!this.serverUrl) {
      throw new Error('Server URL not set');
    }
    const url = `${this.serverUrl}${endpoint}`;
    let token = await this._getToken();
    let refreshed = false;
    let attempt = 0;

    for (;;) {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      let response;
      try {
        response = await this._fetchWithTimeout(url, { ...options, headers }, REQUEST_TIMEOUT_MS);
      } catch (networkError) {
        if (attempt < this.retryDelays.length) {
          await sleep(this.retryDelays[attempt++]);
          continue;
        }
        throw networkError;
      }

      if (response.ok) {
        return response.json().catch(() => ({}));
      }

      if (response.status === 401 && !refreshed) {
        refreshed = true;
        const newToken = await this._refreshToken();
        if (newToken) {
          token = newToken;
          continue;
        }
      }

      if (response.status >= 500 && attempt < this.retryDelays.length) {
        await sleep(this.retryDelays[attempt++]);
        continue;
      }

      const body = await response.json().catch(() => ({}));
      throw new RealtimeHttpError(
        body.error || body.message || `HTTP ${response.status}`,
        response.status,
        body.code,
      );
    }
  }

  async _fetchWithTimeout(url, options, timeoutMs) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, controller ? { ...options, signal: controller.signal } : options);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async _getToken() {
    if (this.authHandlers.getToken) {
      try {
        const token = await this.authHandlers.getToken();
        if (token) return token;
      } catch (error) {
        console.warn('[Realtime] getToken failed:', error.message);
      }
    }
    return this.authToken;
  }

  // 동시에 여러 요청이 401을 받아도 갱신은 한 번만 한다
  async _refreshToken() {
    const refresh = this.authHandlers.refreshAccessToken;
    if (!refresh) return null;
    if (!this._refreshPromise) {
      this._refreshPromise = (async () => {
        try {
          const result = await refresh();
          if (result && result.success) {
            const token = result.accessToken || (await this._getToken());
            if (token) this.authToken = token;
            return token || null;
          }
          return null;
        } catch (error) {
          console.warn('[Realtime] token refresh failed:', error.message);
          return null;
        } finally {
          this._refreshPromise = null;
        }
      })();
    }
    return this._refreshPromise;
  }

  // 인증 토큰 설정 (도우미가 없을 때의 대체값)
  setAuthToken(token) {
    this.authToken = token;
  }

  // AuthContext가 토큰 조회·갱신 함수를 등록한다
  setAuthHandlers({ getToken, refreshAccessToken } = {}) {
    this.authHandlers = {
      getToken: getToken || null,
      refreshAccessToken: refreshAccessToken || null,
    };
  }

  // ---------------------------------------------------------------------------
  // 이벤트
  // ---------------------------------------------------------------------------

  // 이벤트 리스너 추가 (중복 방지)
  on(event, callback) {
    if (this.listeners[event]) {
      if (!this.listeners[event].includes(callback)) {
        this.listeners[event].push(callback);
      }
    }
  }

  // 이벤트 리스너 제거
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  // 내부 이벤트 발생
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // 연결 상태 확인 (서버에 닿음 / 세션 요청 성공)
  getConnectionStatus() {
    return this.isConnected;
  }

  // 세션 ID 확인
  getSessionId() {
    return this.sessionId;
  }

  // 세션 ID 설정 (저장된 세션 ID로 복원할 때)
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  // 사용자 ID 설정 (서버는 토큰으로 사용자를 판단한다 — 로그·호환용으로만 보관)
  setUserId(userId) {
    this.userId = userId;
  }

  // 사용자 ID 확인
  getUserId() {
    return this.userId;
  }
}

// 싱글톤 인스턴스 생성
const websocketClient = new WebSocketClient();

export { WebSocketClient, RealtimeHttpError };
export default websocketClient;
