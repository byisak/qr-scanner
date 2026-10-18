// utils/icsDate.js - 일정 QR(VEVENT)의 날짜 입력을 iCalendar 형식으로 맞춘다
// 받는 형식: 20261018, 2026-10-18, 2026.10.18, 2026/10/18 (+ 14:30, 1430, 14:30:00)
// 돌려주는 형식: 20261018 또는 20261018T143000. 해석할 수 없으면 null
export function normalizeIcsDate(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  // 이미 iCalendar 형식이면 그대로
  if (/^\d{8}(T\d{6}Z?)?$/.test(raw)) return isValidYmd(raw.slice(0, 8)) ? raw : null;

  const m = raw.match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})(?:[ T]+(\d{1,2}):?(\d{2})(?::?(\d{2}))?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const ymd = `${y}${mo.padStart(2, '0')}${d.padStart(2, '0')}`;
  if (!isValidYmd(ymd)) return null;
  if (h === undefined) return ymd;
  const hh = Number(h);
  const mm = Number(mi);
  const ss = Number(se || 0);
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${ymd}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`;
}

function isValidYmd(ymd) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  if (m < 1 || m > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}
