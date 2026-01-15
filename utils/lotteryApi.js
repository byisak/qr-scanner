// utils/lotteryApi.js - 동행복권 API 연동

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOTTO_API_URL = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber';
const PENSION_RESULT_URL = 'https://dhlottery.co.kr/gameResult.do?method=win720';

// 캐시 키
const LOTTO_CACHE_KEY = 'lotteryCache_lotto';
const PENSION_CACHE_KEY = 'lotteryCache_pension';
const CACHE_DURATION = 1000 * 60 * 60; // 1시간

/**
 * 로또 당첨번호 조회
 * @param {number} round - 회차
 * @returns {object|null} 당첨번호 정보
 */
export async function getLottoWinNumbers(round) {
  try {
    // 캐시 확인
    const cached = await getCachedResult('lotto', round);
    if (cached) return cached;

    // API 호출
    const response = await fetch(`${LOTTO_API_URL}&drwNo=${round}`);
    const data = await response.json();

    if (data.returnValue !== 'success') {
      return null;
    }

    const result = {
      round: data.drwNo,
      drawDate: data.drwNoDate,
      numbers: [
        data.drwtNo1,
        data.drwtNo2,
        data.drwtNo3,
        data.drwtNo4,
        data.drwtNo5,
        data.drwtNo6,
      ],
      bonusNumber: data.bnusNo,
      totalSellAmount: data.totSellamnt,
      firstWinAmount: data.firstWinamnt,
      firstWinCount: data.firstPrzwnerCo,
      firstWinAmountPerPerson: data.firstAccumamnt,
    };

    // 캐시 저장
    await setCachedResult('lotto', round, result);

    return result;
  } catch (error) {
    console.error('Failed to fetch lotto win numbers:', error);
    return null;
  }
}

/**
 * 연금복권 당첨번호 조회 (웹 스크래핑 필요)
 * 현재는 기본 구조만 제공
 * @param {number} round - 회차
 * @returns {object|null} 당첨번호 정보
 */
export async function getPensionWinNumbers(round) {
  try {
    // 캐시 확인
    const cached = await getCachedResult('pension', round);
    if (cached) return cached;

    // TODO: 연금복권은 공식 API가 없어서 웹 스크래핑 또는 별도 서버 필요
    // 현재는 null 반환
    console.warn('연금복권 API는 아직 구현되지 않았습니다.');
    return null;
  } catch (error) {
    console.error('Failed to fetch pension win numbers:', error);
    return null;
  }
}

/**
 * 현재 회차 정보 조회
 */
export async function getCurrentRound(type = 'lotto') {
  if (type === 'lotto') {
    // 로또는 매주 토요일 추첨
    // 2002년 12월 7일이 1회차
    const firstDrawDate = new Date('2002-12-07');
    const now = new Date();
    const diffTime = now - firstDrawDate;
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks + 1;
  } else {
    // 연금복권은 매주 목요일 추첨
    // 대략적인 계산 (정확한 시작일 필요)
    return null;
  }
}

/**
 * 추첨 완료 여부 확인
 */
export function isDrawCompleted(round, type = 'lotto') {
  const now = new Date();
  const currentRound = getCurrentRoundSync(type);

  if (round < currentRound) return true;
  if (round > currentRound) return false;

  // 현재 회차인 경우 시간 확인
  if (type === 'lotto') {
    // 토요일 20:45 이후면 추첨 완료
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if (day === 6 && (hour > 20 || (hour === 20 && minute >= 45))) {
      return true;
    }
    if (day === 0 || day === 1 || day === 2 || day === 3 || day === 4 || day === 5) {
      // 일~금요일이면 이전 토요일 추첨 완료
      return true;
    }
  } else {
    // 연금복권: 목요일 19:05 이후
    const day = now.getDay();
    const hour = now.getHours();

    if (day === 4 && hour >= 19) return true;
    if (day === 5 || day === 6 || day === 0) return true;
  }

  return false;
}

/**
 * 현재 회차 (동기 버전)
 */
function getCurrentRoundSync(type = 'lotto') {
  if (type === 'lotto') {
    const firstDrawDate = new Date('2002-12-07');
    const now = new Date();
    const diffTime = now - firstDrawDate;
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks + 1;
  }
  return null;
}

/**
 * 다음 추첨 시간 반환
 */
export function getNextDrawTime(type = 'lotto') {
  const now = new Date();
  const result = new Date(now);

  if (type === 'lotto') {
    // 다음 토요일 20:45
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
    result.setDate(now.getDate() + daysUntilSaturday);
    result.setHours(20, 45, 0, 0);

    // 이미 지났으면 다음 주
    if (result <= now) {
      result.setDate(result.getDate() + 7);
    }
  } else {
    // 다음 목요일 19:05
    const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7;
    result.setDate(now.getDate() + daysUntilThursday);
    result.setHours(19, 5, 0, 0);

    if (result <= now) {
      result.setDate(result.getDate() + 7);
    }
  }

  return result;
}

/**
 * 캐시에서 결과 조회
 */
async function getCachedResult(type, round) {
  try {
    const cacheKey = type === 'lotto' ? LOTTO_CACHE_KEY : PENSION_CACHE_KEY;
    const cached = await AsyncStorage.getItem(`${cacheKey}_${round}`);

    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 결과 캐시 저장
 */
async function setCachedResult(type, round, data) {
  try {
    const cacheKey = type === 'lotto' ? LOTTO_CACHE_KEY : PENSION_CACHE_KEY;
    await AsyncStorage.setItem(
      `${cacheKey}_${round}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Failed to cache lottery result:', error);
  }
}

/**
 * 등수별 당첨금 정보
 */
export const LOTTO_PRIZE_INFO = {
  1: { name: '1등', description: '6개 번호 일치', color: '#FFD700' },
  2: { name: '2등', description: '5개 + 보너스', color: '#C0C0C0' },
  3: { name: '3등', description: '5개 번호 일치', color: '#CD7F32' },
  4: { name: '4등', description: '4개 번호 일치', prize: 50000, color: '#4CAF50' },
  5: { name: '5등', description: '3개 번호 일치', prize: 5000, color: '#2196F3' },
  0: { name: '낙첨', description: '2개 이하 일치', prize: 0, color: '#9E9E9E' },
};

export default {
  getLottoWinNumbers,
  getPensionWinNumbers,
  getCurrentRound,
  isDrawCompleted,
  getNextDrawTime,
  LOTTO_PRIZE_INFO,
};
