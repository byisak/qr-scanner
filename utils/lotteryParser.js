// utils/lotteryParser.js - 복권 QR 코드 파싱

/**
 * 복권 QR URL인지 확인
 */
export function isLotteryQR(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('qr.dhlottery.co.kr');
}

/**
 * 복권 QR URL 파싱
 * @param {string} url - QR 코드 URL
 * @returns {object|null} 파싱된 복권 데이터
 */
export function parseLotteryQR(url) {
  if (!isLotteryQR(url)) return null;

  try {
    const params = url.split('?v=')[1];
    if (!params) return null;

    // 연금복권 체크 (pd로 시작)
    if (params.startsWith('pd')) {
      return parsePensionLottery(params, url);
    }

    // 로또 체크 (숫자로 시작)
    if (/^\d{4}[mqn]/.test(params)) {
      return parseLotto(params, url);
    }

    return null;
  } catch (error) {
    console.error('Failed to parse lottery QR:', error);
    return null;
  }
}

/**
 * 연금복권720+ 파싱
 * 형식: pd{회차4자리}{조3자리}s{번호6자리}
 * 예: pd1203004s619968
 */
function parsePensionLottery(params, originalUrl) {
  // pd1203004s619968
  const match = params.match(/^pd(\d{4})(\d{3})s(\d{6})/);
  if (!match) return null;

  const round = parseInt(match[1]);
  const group = parseInt(match[2]);
  const number = match[3];

  return {
    type: 'pension',
    typeName: '연금복권720+',
    round,
    group,
    number,
    displayNumber: `${group}조 ${number}`,
    games: [{
      label: 'A',
      group,
      number,
      displayNumber: `${group}조 ${number}`,
    }],
    isChecked: false,
    checkedAt: null,
    result: null,
    originalUrl,
  };
}

/**
 * 로또 6/45 파싱
 * 형식: {회차4자리}{게임타입1자리}{번호12자리}x5 + {기타정보}
 * 게임타입: m(수동), q(자동), n(빈칸)
 * 예: 1207m010609101116q182531343743...
 */
function parseLotto(params, originalUrl) {
  const round = parseInt(params.substring(0, 4));
  const gamesStr = params.substring(4);

  const games = [];
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const modeMap = {
    m: { code: 'manual', name: '수동' },
    q: { code: 'auto', name: '자동' },
    n: { code: 'empty', name: '빈칸' }
  };

  // 각 게임 파싱 (1글자 타입 + 12자리 번호 = 13자리씩)
  for (let i = 0; i < 5; i++) {
    const start = i * 13;
    if (start >= gamesStr.length) break;

    const mode = gamesStr[start];
    const numbersStr = gamesStr.substring(start + 1, start + 13);

    // 빈 게임 스킵
    if (mode === 'n' || numbersStr === '000000000000' || !numbersStr) continue;

    // 6개 번호 파싱 (2자리씩)
    const numbers = [];
    for (let j = 0; j < 6; j++) {
      const numStr = numbersStr.substring(j * 2, j * 2 + 2);
      const num = parseInt(numStr);
      if (num > 0 && num <= 45) {
        numbers.push(num);
      }
    }

    // 유효한 게임만 추가 (6개 번호가 있어야 함)
    if (numbers.length === 6) {
      games.push({
        label: labels[i],
        numbers,
        mode: modeMap[mode]?.code || 'unknown',
        modeName: modeMap[mode]?.name || '알수없음',
      });
    }
  }

  // 게임이 없으면 null 반환
  if (games.length === 0) return null;

  return {
    type: 'lotto',
    typeName: '로또 6/45',
    round,
    games,
    gameCount: games.length,
    isChecked: false,
    checkedAt: null,
    result: null,
    originalUrl,
  };
}

/**
 * 로또 번호 색상 반환
 * 1-10: 노랑, 11-20: 파랑, 21-30: 빨강, 31-40: 회색, 41-45: 초록
 */
export function getLottoNumberColor(num) {
  if (num >= 1 && num <= 10) return '#FFC107';   // 노랑
  if (num >= 11 && num <= 20) return '#2196F3'; // 파랑
  if (num >= 21 && num <= 30) return '#F44336'; // 빨강
  if (num >= 31 && num <= 40) return '#9E9E9E'; // 회색
  if (num >= 41 && num <= 45) return '#4CAF50'; // 초록
  return '#9E9E9E';
}

/**
 * 복권 그룹 ID 생성
 */
export function getLotteryGroupId(type) {
  return type === 'lotto' ? 'lottery-lotto' : 'lottery-pension';
}

/**
 * 복권 그룹 정보
 */
export const LOTTERY_GROUPS = {
  lotto: {
    id: 'lottery-lotto',
    name: '🎱 로또 6/45',
    icon: 'dice-outline',
    color: '#FFC107',
  },
  pension: {
    id: 'lottery-pension',
    name: '💰 연금복권720+',
    icon: 'cash-outline',
    color: '#4CAF50',
  },
};

export default {
  isLotteryQR,
  parseLotteryQR,
  getLottoNumberColor,
  getLotteryGroupId,
  LOTTERY_GROUPS,
};
