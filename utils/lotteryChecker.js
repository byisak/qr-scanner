// utils/lotteryChecker.js - 복권 당첨 비교 로직

import { getLottoWinNumbers, LOTTO_PRIZE_INFO } from './lotteryApi';

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
 * 연금복권 당첨 확인
 * TODO: 연금복권 API 구현 후 작성
 */
export async function checkPensionResult(lotteryData) {
  if (!lotteryData || lotteryData.type !== 'pension') {
    throw new Error('Invalid pension data');
  }

  // 현재는 미구현
  return {
    success: false,
    error: '연금복권 당첨 확인 기능은 준비 중입니다.',
  };
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
 */
export function getWinMessage(rank, totalPrize) {
  if (rank === 1) {
    return '🎉 대박! 1등 당첨입니다!';
  } else if (rank === 2) {
    return '🎊 축하합니다! 2등 당첨!';
  } else if (rank === 3) {
    return '🎈 3등 당첨! 축하합니다!';
  } else if (rank === 4) {
    return '👏 4등 당첨! 5만원!';
  } else if (rank === 5) {
    return '✨ 5등 당첨! 5천원!';
  } else if (totalPrize > 0) {
    return `🎉 축하합니다! 총 ${formatPrize(totalPrize)} 당첨!`;
  }
  return '😢 아쉽게도 당첨되지 않았습니다.';
}

export default {
  checkLottoResult,
  checkPensionResult,
  checkLotteryResult,
  formatPrize,
  getWinMessage,
};
