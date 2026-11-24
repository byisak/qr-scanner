// utils/fastScan.js - 고속 스캔 모드의 화면과 무관한 로직 (같은 코드 판정, 기록 반영, 전송 대기열)

// 같은 코드를 다시 받는 규칙. 숫자는 계속 비추고 있을 때 +1 하는 간격(ms)
export const FAST_REPEAT_RULES = ['300', '500', '1000', 'once', 'trigger'];
export const DEFAULT_FAST_REPEAT = '500';
export const parseFastRepeat = (value) => (FAST_REPEAT_RULES.includes(value) ? value : DEFAULT_FAST_REPEAT);

// 'once': 화면에서 이만큼 안 보였다가 다시 보이면 새로 비춘 것으로 본다
export const FAST_GONE_MS = 400;
// 'trigger': 누른 순간 이 시간 안에 보인 코드가 있으면 그 코드를, 없으면 FAST_TRIGGER_ARM_MS 동안 기다린다
export const FAST_TRIGGER_RECENT_MS = 300;
export const FAST_TRIGGER_ARM_MS = 1500;

/**
 * 방금 보인 코드를 받을지 판정한다 (자동 규칙용. 'trigger'는 화면 쪽에서 따로 처리).
 *  - 직전에 받은 코드와 다르면 바로 받는다
 *  - 같으면: 숫자 규칙은 그 간격이 지났을 때, 'once'는 화면에서 사라졌다 다시 보였을 때만
 * prevSeenAt: 이 코드를 바로 전에 본 시각 (처음이면 0)
 */
export function shouldAcceptFastScan(rule, last, code, now, prevSeenAt) {
  if (!last || last.code !== code) return true;
  if (rule === 'once') return now - (prevSeenAt || 0) >= FAST_GONE_MS;
  const interval = Number(rule) || Number(DEFAULT_FAST_REPEAT);
  return now - last.at >= interval;
}

/**
 * 모아 둔 스캔·수량 정정을 기록에 한 번에 반영한다 (updateHistory 변경 함수 안에서 호출).
 * entries: [{ code, type, at, delta, groupId, scan }]
 *  - scan: true면 실제 스캔(스캔 시각을 남긴다), false면 수량 정정
 *  - delta: 수량 변화 (+1, -1, …). 수량이 0 이하가 되면 기록을 지운다
 */
export function applyFastEntries(historyByGroup, entries, prependCapped) {
  for (const entry of entries) {
    const groupId = entry.groupId || 'default';
    const list = [...(historyByGroup[groupId] || [])];
    const index = list.findIndex((item) => item.code === entry.code);
    const delta = entry.delta || 0;

    if (index === -1) {
      if (delta <= 0) continue;
      prependCapped(historyByGroup, groupId, {
        code: entry.code,
        quantity: delta,
        timestamp: entry.at,
        count: delta,
        scanTimes: [entry.at],
        photos: [],
        type: entry.type || 'qr',
      });
      continue;
    }

    const existing = list[index];
    const quantity = (existing.quantity || existing.count || 1) + delta;
    list.splice(index, 1);
    historyByGroup[groupId] = list;
    if (quantity <= 0) continue;

    let scanTimes = [...(existing.scanTimes || [existing.timestamp])];
    if (entry.scan && delta > 0) scanTimes.push(entry.at);
    else if (delta < 0) scanTimes = scanTimes.slice(0, Math.max(1, scanTimes.length + delta));

    prependCapped(historyByGroup, groupId, {
      ...existing,
      quantity,
      count: Math.max(1, (existing.count || 1) + delta),
      timestamp: entry.scan ? entry.at : existing.timestamp,
      scanTimes,
      ...(entry.type && entry.scan ? { type: entry.type } : {}),
    });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 순서를 지키는 전송 대기열. 스캔은 기다리지 않고 넣기만 하고, 뒤에서 하나씩 보낸다.
 *  - send(item)이 실패하면 같은 항목을 간격을 늘려 가며 다시 보낸다 (순서 유지)
 *  - isPermanent(error)가 true면(주소 오류·권한 등) 다시 보내도 소용없으니 버리고 실패로 센다
 *  - maxItems를 넘으면 가장 오래된 것부터 버리고 실패로 센다
 */
export function createSendQueue({ send, isPermanent = () => false, onChange = () => {}, maxItems = 2000, retryDelay = (n) => Math.min(10000, 500 * 2 ** n), wait = sleep }) {
  const items = [];
  let running = false;
  let failed = 0;
  let attempt = 0;

  const notify = () => onChange({ pending: items.length, failed });

  const pump = async () => {
    if (running) return;
    running = true;
    while (items.length > 0) {
      const item = items[0];
      try {
        await send(item);
        if (items[0] === item) items.shift();
        attempt = 0;
      } catch (error) {
        if (isPermanent(error)) {
          if (items[0] === item) items.shift();
          failed += 1;
          attempt = 0;
        } else {
          attempt += 1;
          notify();
          await wait(retryDelay(attempt));
          continue;
        }
      }
      notify();
    }
    running = false;
  };

  return {
    push(item) {
      items.push(item);
      while (items.length > maxItems) {
        // 보내는 중인 맨 앞 항목은 두고 그다음 오래된 것을 버린다
        items.splice(running ? 1 : 0, 1);
        failed += 1;
      }
      notify();
      pump();
    },
    stats: () => ({ pending: items.length, failed }),
    resetFailed() { failed = 0; notify(); },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 고속 모드 구성(프로필): 읽을 바코드 + 켜 둘 기능. 일반 설정과 따로 저장한다 ('fastScanProfile')
// ───────────────────────────────────────────────────────────────────────────
export const FAST_BARCODE_PRESETS = {
  logistics: ['code128', 'code93', 'datamatrix', 'qr'],
  retail: ['ean13', 'ean8', 'upca', 'upce'],
  qr: ['qr'],
};
export const FAST_PRESET_IDS = ['logistics', 'retail', 'qr', 'current', 'custom'];
export const ALL_BARCODE_TYPES = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'code93', 'upce', 'upca', 'pdf417', 'aztec', 'datamatrix', 'itf14', 'codabar'];

export const DEFAULT_FAST_PROFILE = {
  preset: 'logistics',
  custom: FAST_BARCODE_PRESETS.logistics,
  sound: true,
  haptic: true,
  saveHistory: true,
  realtime: true,
  scanUrl: true,
  pcKeyboard: true,
  strictConfirm: false, // 1D를 3프레임 확인 (오인식 방지 강화, +33ms쯤)
  sheetSeen: false, // 처음 한 번만 구성 시트를 띄운다
};

export function parseFastProfile(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch (e) { value = null; }
  }
  if (!value || typeof value !== 'object') return { ...DEFAULT_FAST_PROFILE };
  const profile = { ...DEFAULT_FAST_PROFILE };
  for (const key of Object.keys(DEFAULT_FAST_PROFILE)) {
    if (typeof value[key] === typeof DEFAULT_FAST_PROFILE[key]) profile[key] = value[key];
  }
  if (!FAST_PRESET_IDS.includes(profile.preset)) profile.preset = DEFAULT_FAST_PROFILE.preset;
  profile.custom = Array.isArray(value.custom)
    ? value.custom.filter((type) => ALL_BARCODE_TYPES.includes(type))
    : [...DEFAULT_FAST_PROFILE.custom];
  if (profile.custom.length === 0) profile.custom = ['qr'];
  return profile;
}

// 프로필이 실제로 읽을 바코드 종류. 'current'는 설정 화면에서 고른 종류
export function fastProfileBarcodes(profile, currentTypes) {
  if (profile.preset === 'current') return currentTypes && currentTypes.length ? currentTypes : ['qr'];
  if (profile.preset === 'custom') return profile.custom.length ? profile.custom : ['qr'];
  return FAST_BARCODE_PRESETS[profile.preset] || FAST_BARCODE_PRESETS.logistics;
}

// 측정값을 묶는 열쇠: 판독 시간을 바꾸는 것(바코드 종류, 1D 확인 프레임)만 넣는다
export function fastStatsKey(types, strictConfirm) {
  return `${[...types].sort().join(',')}${strictConfirm ? '|strict' : ''}`;
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * 한 번의 고속 세션 측정을 요약한다. 너무 짧으면(판독 5초 미만이면서 코드 간격 3개 미만) null
 *  samples: 1초마다 받은 [{ fps, avgMs }], gaps: 서로 다른 코드 사이 간격(ms)
 */
export function summarizeFastSession({ samples = [], gaps = [] }) {
  if (samples.length < 5 && gaps.length < 3) return null;
  const n = samples.length;
  return {
    decodeMs: n ? samples.reduce((sum, s) => sum + s.avgMs, 0) / n : null,
    fps: n ? samples.reduce((sum, s) => sum + s.fps, 0) / n : null,
    gapMs: median(gaps),
    seconds: n,
    gaps: gaps.length,
  };
}

// 열쇠별로 최근 세션 5개까지 보관한다
export function mergeFastStats(store, key, summary, at = Date.now()) {
  const next = { ...(store || {}) };
  next[key] = [{ ...summary, at }, ...(next[key] || [])].slice(0, 5);
  return next;
}

// 보관한 세션들을 합친 값 (판독은 시간 가중 평균, 간격은 세션 중앙값들의 중앙값)
export function aggregateFastStats(store, key) {
  const sessions = (store && store[key]) || [];
  if (!sessions.length) return null;
  const timed = sessions.filter((s) => s.decodeMs !== null && s.seconds > 0);
  const seconds = timed.reduce((sum, s) => sum + s.seconds, 0);
  return {
    decodeMs: seconds ? timed.reduce((sum, s) => sum + s.decodeMs * s.seconds, 0) / seconds : null,
    fps: seconds ? timed.reduce((sum, s) => sum + s.fps * s.seconds, 0) / seconds : null,
    gapMs: median(sessions.map((s) => s.gapMs).filter((v) => v !== null)),
    sessions: sessions.length,
    gaps: sessions.reduce((sum, s) => sum + (s.gaps || 0), 0),
  };
}
