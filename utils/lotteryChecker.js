// utils/lotteryChecker.js - 복권 당첨 비교 로직

import { getLottoWinNumbers, getPensionWinNumbers, LOTTO_PRIZE_INFO, PENSION_PRIZE_INFO } from './lotteryApi';

/**
 * 로또 당첨 확인
 * @param {object} lotteryData - 파싱된 복권 데이터
 * @returns {object} 당첨 결과
 */
export async function checkLottoResult(lotteryData) {
  if (!lotteryData || lotteryData.type !== 'lotto') {
    throw new Error('Invalid lotto data');
  }

  // 당첨번호 조회
  const winData = await getLottoWinNumbers(lotteryData.round);
  if (!winData) {
    return {
      success: false,
      error: '당첨번호를 조회할 수 없습니다. 아직 추첨 전이거나 네트워크 오류입니다.',
    };
  }

  // 각 게임별 당첨 확인
  const gameResults = lotteryData.games.map(game => {
    const result = checkSingleGame(game.numbers, winData.numbers, winData.bonusNumber);
    return {
      ...game,
      ...result,
    };
  });

  // 총 당첨금 계산
  const totalPrize = gameResults.reduce((sum, game) => sum + (game.prize || 0), 0);

  // 최고 등수
  const bestRank = Math.min(...gameResults.map(g => g.rank || 99).filter(r => r > 0));

  return {
    success: true,
    round: lotteryData.round,
    drawDate: winData.drawDate,
    winNumbers: winData.numbers,
    bonusNumber: winData.bonusNumber,
    games: gameResults,
    totalPrize,
    bestRank: bestRank === 99 ? 0 : bestRank,
    hasWin: totalPrize > 0,
    firstWinAmount: winData.firstWinAmount,
    firstWinCount: winData.firstWinCount,
  };
}

/**
 * 단일 게임 당첨 확인
 * @param {number[]} myNumbers - 내 번호
 * @param {number[]} winNumbers - 당첨 번호
 * @param {number} bonusNumber - 보너스 번호
 * @returns {object} 등수 및 당첨금
 */
function checkSingleGame(myNumbers, winNumbers, bonusNumber) {
  // 일치하는 번호 개수
  const matchedNumbers = myNumbers.filter(num => winNumbers.includes(num));
  const matchCount = matchedNumbers.length;

  // 보너스 번호 일치 여부
  const hasBonus = myNumbers.includes(bonusNumber);

  // 등수 판정
  let rank = 0;
  let prize = 0;

  if (matchCount === 6) {
    rank = 1;
    // 1등 당첨금은 회차별로 다름 (API에서 가져옴)
  } else if (matchCount === 5 && hasBonus) {
    rank = 2;
    // 2등 당첨금도 회차별로 다름
  } else if (matchCount === 5) {
    rank = 3;
    // 3등 당첨금도 회차별로 다름
  } else if (matchCount === 4) {
    rank = 4;
    prize = 50000; // 고정
  } else if (matchCount === 3) {
    rank = 5;
    prize = 5000; // 고정
  }

  const prizeInfo = LOTTO_PRIZE_INFO[rank] || LOTTO_PRIZE_INFO[0];

  return {
    rank,
    rankName: prizeInfo.name,
    rankDescription: prizeInfo.description,
    rankColor: prizeInfo.color,
    matchCount,
    matchedNumbers,
    hasBonus: rank === 2 ? true : hasBonus && matchCount >= 3,
    prize,
  };
}

/**
 * 연금복권720+ 당첨 확인
 * @param {object} lotteryData - 파싱된 복권 데이터
 * @returns {object} 당첨 결과
 *
 * 당첨 구조:
 * 1등: 조 + 6자리 번호 모두 일치 - 월 700만원 x 20년
 * 2등: 뒤에서부터 6자리 일치 - 월 100만원 x 10년
 * 3등: 뒤에서부터 5자리 일치 - 100만원
 * 4등: 뒤에서부터 4자리 일치 - 10만원
 * 5등: 뒤에서부터 3자리 일치 - 5만원
 * 6등: 뒤에서부터 2자리 일치 - 5천원
 * 7등: 뒤에서부터 1자리 일치 - 1천원
 * 보너스: 뒤에서부터 6자리가 보너스 번호와 일치 - 월 100만원 x 10년
 */
export async function checkPensionResult(lotteryData) {
  if (!lotteryData || lotteryData.type !== 'pension') {
    throw new Error('Invalid pension data');
  }

  // 당첨번호 조회
  const winData = await getPensionWinNumbers(lotteryData.round);
  if (!winData) {
    return {
      success: false,
      error: '당첨번호를 조회할 수 없습니다. 아직 추첨 전이거나 네트워크 오류입니다.',
    };
  }

  // 각 게임별 당첨 확인 (본 추첨, 보너스 추첨)
  const gameResults = (lotteryData.games || []).map(game => {
    const isBonus = game.label === '보너스 추첨';
    const result = checkPensionGame(
      game.group,
      game.number,
      winData.winGroup,
      winData.winNumber,
      winData.bonusNumber,
      isBonus
    );
    return {
      ...game,
      ...result,
    };
  });

  // 총 당첨금 계산
  const totalPrize = gameResults.reduce((sum, game) => sum + (game.prize || 0), 0);

  // 최고 등수 (보너스는 특별 처리)
  const ranks = gameResults.map(g => {
    if (g.rank === 'bonus') return 2; // 보너스는 2등급으로 취급
    return g.rank || 99;
  }).filter(r => r > 0);
  const bestRank = ranks.length > 0 ? Math.min(...ranks) : 0;

  return {
    success: true,
    round: lotteryData.round,
    winGroup: winData.winGroup,
    winNumber: winData.winNumber,
    bonusNumber: winData.bonusNumber,
    games: gameResults,
    totalPrize,
    bestRank: bestRank === 99 ? 0 : bestRank,
    hasWin: totalPrize > 0,
  };
}

/**
 * 연금복권 단일 게임 당첨 확인
 * @param {number} myGroup - 내 조
 * @param {string} myNumber - 내 번호 (6자리)
 * @param {number} winGroup - 당첨 조
 * @param {string} winNumber - 당첨 번호 (6자리)
 * @param {string} bonusNumber - 보너스 번호 (6자리)
 * @param {boolean} isBonus - 보너스 추첨 여부
 * @returns {object} 등수 및 당첨금
 */
function checkPensionGame(myGroup, myNumber, winGroup, winNumber, bonusNumber, isBonus) {
  // 보너스 추첨인 경우 보너스 번호와 비교
  if (isBonus) {
    const bonusMatched = checkEndingMatch(myNumber, bonusNumber, 6);
    if (bonusMatched) {
      const prizeInfo = PENSION_PRIZE_INFO.bonus;
      return {
        rank: 'bonus',
        rankName: prizeInfo.name,
        rankDescription: prizeInfo.description,
        rankColor: prizeInfo.color,
        prize: prizeInfo.prize,
        prizeText: prizeInfo.prizeText,
        matchedDigits: 6,
        isBonus: true,
      };
    }
    // 보너스 미당첨
    const prizeInfo = PENSION_PRIZE_INFO[0];
    return {
      rank: 0,
      rankName: prizeInfo.name,
      rankDescription: prizeInfo.description,
      rankColor: prizeInfo.color,
      prize: 0,
      prizeText: prizeInfo.prizeText,
      matchedDigits: 0,
      isBonus: true,
    };
  }

  // 본 추첨 - 1등 확인 (조 + 6자리 모두 일치)
  if (myGroup === winGroup && myNumber === winNumber) {
    const prizeInfo = PENSION_PRIZE_INFO[1];
    return {
      rank: 1,
      rankName: prizeInfo.name,
      rankDescription: prizeInfo.description,
      rankColor: prizeInfo.color,
      prize: prizeInfo.prize,
      prizeText: prizeInfo.prizeText,
      matchedDigits: 7, // 조 + 6자리
      isBonus: false,
    };
  }

  // 2~7등 확인 (뒤에서부터 자릿수 일치)
  for (let digits = 6; digits >= 1; digits--) {
    if (checkEndingMatch(myNumber, winNumber, digits)) {
      const rank = 8 - digits; // 6자리=2등, 5자리=3등, ..., 1자리=7등
      const prizeInfo = PENSION_PRIZE_INFO[rank];
      return {
        rank,
        rankName: prizeInfo.name,
        rankDescription: prizeInfo.description,
        rankColor: prizeInfo.color,
        prize: prizeInfo.prize,
        prizeText: prizeInfo.prizeText,
        matchedDigits: digits,
        isBonus: false,
      };
    }
  }

  // 낙첨
  const prizeInfo = PENSION_PRIZE_INFO[0];
  return {
    rank: 0,
    rankName: prizeInfo.name,
    rankDescription: prizeInfo.description,
    rankColor: prizeInfo.color,
    prize: 0,
    prizeText: prizeInfo.prizeText,
    matchedDigits: 0,
    isBonus: false,
  };
}

/**
 * 뒤에서부터 자릿수 일치 확인
 * @param {string} myNumber - 내 번호
 * @param {string} winNumber - 당첨 번호
 * @param {number} digits - 확인할 자릿수
 * @returns {boolean}
 */
function checkEndingMatch(myNumber, winNumber, digits) {
  if (!myNumber || !winNumber || myNumber.length < digits || winNumber.length < digits) {
    return false;
  }
  const myEnding = myNumber.slice(-digits);
  const winEnding = winNumber.slice(-digits);
  return myEnding === winEnding;
}

/**
 * 복권 종류에 따라 당첨 확인
 */
export async function checkLotteryResult(lotteryData) {
  if (!lotteryData) return null;

  if (lotteryData.type === 'lotto') {
    return checkLottoResult(lotteryData);
  } else if (lotteryData.type === 'pension') {
    return checkPensionResult(lotteryData);
  }

  return null;
}

/**
 * 당첨금 포맷팅
 */
export function formatPrize(prize) {
  if (!prize || prize === 0) return '0원';

  if (prize >= 100000000) {
    const billions = Math.floor(prize / 100000000);
    const millions = Math.floor((prize % 100000000) / 10000);
    if (millions > 0) {
      return `${billions}억 ${millions.toLocaleString()}만원`;
    }
    return `${billions}억원`;
  }

  if (prize >= 10000) {
    return `${Math.floor(prize / 10000).toLocaleString()}만원`;
  }

  return `${prize.toLocaleString()}원`;
}

/**
 * 당첨 등수에 따른 메시지
 * @param {number|string} rank - 등수 (연금복권 보너스는 'bonus')
 * @param {number} totalPrize - 총 당첨금
 * @param {string} type - 복권 타입 ('lotto' 또는 'pension')
 */
export function getWinMessage(rank, totalPrize, type = 'lotto') {
  if (type === 'pension') {
    // 연금복권 메시지
    if (rank === 1) {
      return '1등 당첨! 월 700만원 x 20년!';
    } else if (rank === 'bonus' || rank === 2) {
      return '축하합니다! 월 100만원 x 10년!';
    } else if (rank === 3) {
      return '3등 당첨! 100만원!';
    } else if (rank === 4) {
      return '4등 당첨! 10만원!';
    } else if (rank === 5) {
      return '5등 당첨! 5만원!';
    } else if (rank === 6) {
      return '6등 당첨! 5천원!';
    } else if (rank === 7) {
      return '7등 당첨! 1천원!';
    } else if (totalPrize > 0) {
      return `축하합니다! 총 ${formatPrize(totalPrize)} 당첨!`;
    }
    return '아쉽게도 당첨되지 않았습니다.';
  }

  // 로또 메시지
  if (rank === 1) {
    return '대박! 1등 당첨입니다!';
  } else if (rank === 2) {
    return '축하합니다! 2등 당첨!';
  } else if (rank === 3) {
    return '3등 당첨! 축하합니다!';
  } else if (rank === 4) {
    return '4등 당첨! 5만원!';
  } else if (rank === 5) {
    return '5등 당첨! 5천원!';
  } else if (totalPrize > 0) {
    return `축하합니다! 총 ${formatPrize(totalPrize)} 당첨!`;
  }
  return '아쉽게도 당첨되지 않았습니다.';
}

export default {
  checkLottoResult,
  checkPensionResult,
  checkLotteryResult,
  formatPrize,
  getWinMessage,
};
