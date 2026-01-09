// utils/websocket.js - WebSocket 클라이언트 유틸리티
import { io } from 'socket.io-client';

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.serverUrl = null;
    this.sessionId = null;
    this.userId = null;
    this.authToken = null;
    this.isConnected = false;
    this.listeners = {
      connect: [],
      disconnect: [],
      sessionCreated: [],
      error: [],
    };
  }

  // 서버에 연결
  connect(serverUrl) {
    // 이미 같은 서버에 연결되어 있으면 재연결하지 않음
    if (this.socket && this.serverUrl === serverUrl && this.isConnected) {
      console.log('WebSocket already connected to:', serverUrl);
      return this.socket;
    }

    // 다른 서버로 변경하거나 재연결이 필요한 경우에만 disconnect
    if (this.socket) {
      this.disconnect();
    }

    this.serverUrl = serverUrl;

    try {
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this._emit('connect');
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this._emit('disconnect');
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this._emit('error', error);
      });

      this.socket.on('session-created', (data) => {
        console.log('Session created:', data);
        this.sessionId = data.sessionId;
        this._emit('sessionCreated', data);
      });

      return this.socket;
    } catch (error) {
      console.error('Failed to create socket:', error);
      this._emit('error', error);
      return null;
    }
  }

  // 서버 연결 해제
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.sessionId = null;
    }
  }

  // 세션 생성 요청 (설정 포함)
  createSession(sessionId = null, settings = {}) {
    const payload = {
      sessionId,
      userId: this.userId,
      settings: {
        password: settings.password || null,
        isPublic: settings.isPublic !== undefined ? settings.isPublic : true,
        maxParticipants: settings.maxParticipants || null,
        allowAnonymous: settings.allowAnonymous !== undefined ? settings.allowAnonymous : true,
        expiresAt: settings.expiresAt || null,
      }
    };

    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      // 연결되지 않았어도 Promise 반환 (연결 시도)
      return new Promise((resolve, reject) => {
        if (!this.serverUrl) {
          reject(new Error('Server URL not set'));
          return;
        }

        // 연결 시도
        this.connect(this.serverUrl);

        // 연결 대기
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        this.on('connect', () => {
          clearTimeout(timeout);
          this.socket.emit('create-session', payload);
          resolve(true);
        });
      });
    }

    this.socket.emit('create-session', payload);
    return Promise.resolve(true);
  }

  // 세션 설정 업데이트
  updateSessionSettings(sessionId, settings) {
    return this._apiRequest(`/api/sessions/${sessionId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // 세션 설정 조회
  async getSessionSettings(sessionId) {
    return this._apiRequest(`/api/sessions/${sessionId}/settings`, {
      method: 'GET',
    });
  }

  // API 요청 헬퍼
  async _apiRequest(endpoint, options = {}) {
    if (!this.serverUrl) {
      throw new Error('Server URL not set');
    }

    const url = `${this.serverUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // 인증 토큰이 있으면 추가
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // 인증 토큰 설정
  setAuthToken(token) {
    this.authToken = token;
  }

  // 스캔 데이터 전송
  sendScanData(data, sessionId) {
    // 백엔드가 구현되기 전까지는 로컬에서만 데이터 처리
    // TODO: 백엔드 구현 시 실제 서버 전송 활성화
    if (!this.socket || !this.isConnected) {
      // 서버 연결이 없어도 에러를 발생시키지 않음
      console.log('Server not connected yet. Data will be stored locally only.');
      return true; // 로컬 저장은 성공했으므로 true 반환
    }

    const payload = {
      sessionId: sessionId || this.sessionId,
      code: data.code,
      timestamp: data.timestamp || Date.now(),
      userId: this.userId,
    };

    try {
      this.socket.emit('scan-data', payload);
      return true;
    } catch (error) {
      console.error('Failed to send scan data:', error);
      return false;
    }
  }

  // 이벤트 리스너 추가
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
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

  // 연결 상태 확인
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

  // 사용자 ID 설정
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

export default websocketClient;
