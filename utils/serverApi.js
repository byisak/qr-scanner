// utils/serverApi.js - 로그인이 필요한 scanview.app API 호출 (품목 동기화, 함께 실사)
// AuthContext 가 토큰 도우미를 등록한다. 401이면 한 번 갱신하고 다시 보낸다.
import config from '../config/config';

let handlers = null;
export function setApiAuthHandlers(h) {
  handlers = h;
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const token = handlers ? await handlers.getToken() : null;
  if (!token) throw new ApiError('not logged in', { code: 'NOT_LOGGED_IN' });
  const call = (tk) => fetch(`${config.serverUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let res = await call(token);
  if (res.status === 401 && handlers?.refreshAccessToken) {
    const r = await handlers.refreshAccessToken();
    if (r?.success && r.accessToken) res = await call(r.accessToken);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, { status: res.status, code: data?.code || '' });
  return data;
}
