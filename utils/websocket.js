// utils/websocket.js - WebSocket 클라이언트 유틸리티
import { io } from 'socket.io-client';

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.serverUrl = null;
    this.sessionId = null;
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

  // 세션 생성 요청
  createSession() {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('create-session');
    return true;
  }

  // 스캔 데이터 전송
  sendScanData(data) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return false;
    }

    if (!this.sessionId) {
      console.error('No session ID');
      return false;
    }

    const payload = {
      sessionId: this.sessionId,
      code: data.code,
      timestamp: data.timestamp || Date.now(),
    };

    this.socket.emit('scan-data', payload);
    return true;
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
}

// 싱글톤 인스턴스 생성
const websocketClient = new WebSocketClient();

export default websocketClient;
