// utils/lotteryNotification.js - 복권 알림 스케줄링

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 알림 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const LOTTO_NOTIFICATION_KEY = 'lottoNotificationId';
const PENSION_NOTIFICATION_KEY = 'pensionNotificationId';

/**
 * 알림 권한 요청
 */
export async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * 다음 토요일 알림 시간 구하기 (로또 6/45)
 */
async function getNextSaturdayNotificationTime() {
  // 저장된 알림 시간 로드 (기본값: 20시 50분 - 추첨 후)
  let hour = 20;
  let minute = 50;

  try {
    const savedHour = await AsyncStorage.getItem('lottoNotificationHour');
    const savedMinute = await AsyncStorage.getItem('lottoNotificationMinute');
    if (savedHour !== null) hour = parseInt(savedHour, 10);
    if (savedMinute !== null) minute = parseInt(savedMinute, 10);
  } catch (error) {
    console.log('[LotteryNotification] Failed to load saved lotto time, using default');
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0: 일, 1: 월, ..., 6: 토

  // 토요일까지 남은 일수 계산
  let daysUntilSaturday = 6 - dayOfWeek;
  if (daysUntilSaturday === 0) {
    // 오늘이 토요일인 경우
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const notificationTime = hour * 60 + minute;

    if (currentTime >= notificationTime) {
      // 이미 알림 시간이 지났으면 다음 주 토요일
      daysUntilSaturday = 7;
    }
  }
  if (daysUntilSaturday < 0) {
    daysUntilSaturday += 7;
  }

  const nextSaturday = new Date(now);
  nextSaturday.setDate(now.getDate() + daysUntilSaturday);
  nextSaturday.setHours(hour, minute, 0, 0);

  return nextSaturday;
}

/**
 * 다음 목요일 알림 시간 구하기 (연금복권720+)
 */
async function getNextThursdayNotificationTime() {
  // 저장된 알림 시간 로드 (기본값: 19시 10분 - 추첨 후)
  let hour = 19;
  let minute = 10;

  try {
    const savedHour = await AsyncStorage.getItem('pensionNotificationHour');
    const savedMinute = await AsyncStorage.getItem('pensionNotificationMinute');
    if (savedHour !== null) hour = parseInt(savedHour, 10);
    if (savedMinute !== null) minute = parseInt(savedMinute, 10);
  } catch (error) {
    console.log('[LotteryNotification] Failed to load saved pension time, using default');
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0: 일, 1: 월, ..., 4: 목

  // 목요일까지 남은 일수 계산
  let daysUntilThursday = 4 - dayOfWeek;
  if (daysUntilThursday === 0) {
    // 오늘이 목요일인 경우
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const notificationTime = hour * 60 + minute;

    if (currentTime >= notificationTime) {
      // 이미 알림 시간이 지났으면 다음 주 목요일
      daysUntilThursday = 7;
    }
  }
  if (daysUntilThursday < 0) {
    daysUntilThursday += 7;
  }

  const nextThursday = new Date(now);
  nextThursday.setDate(now.getDate() + daysUntilThursday);
  nextThursday.setHours(hour, minute, 0, 0);

  return nextThursday;
}

/**
 * 미확인 복권이 있는지 확인
 * @param {string} type - 'lotto', 'pension', 또는 'all'
 */
export async function hasUncheckedLotteries(type = 'all') {
  try {
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    if (!historyData) return false;

    const historyByGroup = JSON.parse(historyData);

    // 복권 타입별 그룹 확인
    let lotteryGroups;
    if (type === 'lotto') {
      lotteryGroups = ['lottery-lotto'];
    } else if (type === 'pension') {
      lotteryGroups = ['lottery-pension'];
    } else {
      lotteryGroups = ['lottery-lotto', 'lottery-pension'];
    }

    for (const groupId of lotteryGroups) {
      const history = historyByGroup[groupId] || [];
      const hasUnchecked = history.some(item =>
        item.lotteryData && !item.lotteryData.isChecked
      );
      if (hasUnchecked) return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to check unchecked lotteries:', error);
    return false;
  }
}

/**
 * 미확인 복권 개수 조회
 * @param {string} type - 'lotto', 'pension', 또는 'all'
 */
export async function getUncheckedLotteryCount(type = 'all') {
  try {
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    if (!historyData) return 0;

    const historyByGroup = JSON.parse(historyData);

    let lotteryGroups;
    if (type === 'lotto') {
      lotteryGroups = ['lottery-lotto'];
    } else if (type === 'pension') {
      lotteryGroups = ['lottery-pension'];
    } else {
      lotteryGroups = ['lottery-lotto', 'lottery-pension'];
    }

    let count = 0;
    for (const groupId of lotteryGroups) {
      const history = historyByGroup[groupId] || [];
      count += history.filter(item =>
        item.lotteryData && !item.lotteryData.isChecked
      ).length;
    }

    return count;
  } catch (error) {
    console.error('Failed to get unchecked lottery count:', error);
    return 0;
  }
}

/**
 * 로또 6/45 알림 스케줄링 (매주 토요일)
 */
export async function scheduleLottoNotification() {
  try {
    // 알림 설정 확인
    const notificationEnabled = await AsyncStorage.getItem('lotteryWinningNotificationEnabled');
    if (notificationEnabled !== 'true') {
      console.log('[LottoNotification] Notification disabled in settings');
      await cancelLottoNotification();
      return false;
    }

    // 권한 확인
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[LottoNotification] Permission not granted');
      return false;
    }

    // 기존 알림 취소
    await cancelLottoNotification();

    // 미확인 로또 복권이 없으면 알림 스케줄링하지 않음
    const hasUnchecked = await hasUncheckedLotteries('lotto');
    if (!hasUnchecked) {
      console.log('[LottoNotification] No unchecked lotto tickets');
      return false;
    }

    const count = await getUncheckedLotteryCount('lotto');
    const triggerDate = await getNextSaturdayNotificationTime();

    // 알림 스케줄
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '로또 6/45 당첨 확인하세요!',
        body: `미확인 로또가 ${count}개 있습니다. 당첨 여부를 확인해보세요!`,
        data: { type: 'lottery_check', lotteryType: 'lotto' },
        sound: true,
      },
      trigger: {
        type: 'date',
        date: triggerDate,
      },
    });

    // 알림 ID 저장
    await AsyncStorage.setItem(LOTTO_NOTIFICATION_KEY, notificationId);

    console.log('[LottoNotification] Scheduled for:', triggerDate.toLocaleString());
    return true;
  } catch (error) {
    console.error('Failed to schedule lotto notification:', error);
    return false;
  }
}

/**
 * 연금복권720+ 알림 스케줄링 (매주 목요일)
 */
export async function schedulePensionNotification() {
  try {
    // 알림 설정 확인
    const notificationEnabled = await AsyncStorage.getItem('lotteryWinningNotificationEnabled');
    if (notificationEnabled !== 'true') {
      console.log('[PensionNotification] Notification disabled in settings');
      await cancelPensionNotification();
      return false;
    }

    // 권한 확인
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[PensionNotification] Permission not granted');
      return false;
    }

    // 기존 알림 취소
    await cancelPensionNotification();

    // 미확인 연금복권이 없으면 알림 스케줄링하지 않음
    const hasUnchecked = await hasUncheckedLotteries('pension');
    if (!hasUnchecked) {
      console.log('[PensionNotification] No unchecked pension tickets');
      return false;
    }

    const count = await getUncheckedLotteryCount('pension');
    const triggerDate = await getNextThursdayNotificationTime();

    // 알림 스케줄
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '연금복권720+ 당첨 확인하세요!',
        body: `미확인 연금복권이 ${count}개 있습니다. 당첨 여부를 확인해보세요!`,
        data: { type: 'lottery_check', lotteryType: 'pension' },
        sound: true,
      },
      trigger: {
        type: 'date',
        date: triggerDate,
      },
    });

    // 알림 ID 저장
    await AsyncStorage.setItem(PENSION_NOTIFICATION_KEY, notificationId);

    console.log('[PensionNotification] Scheduled for:', triggerDate.toLocaleString());
    return true;
  } catch (error) {
    console.error('Failed to schedule pension notification:', error);
    return false;
  }
}

/**
 * 모든 복권 알림 스케줄링
 */
export async function scheduleLotteryNotification() {
  const lottoResult = await scheduleLottoNotification();
  const pensionResult = await schedulePensionNotification();
  return lottoResult || pensionResult;
}

/**
 * 로또 알림 취소
 */
export async function cancelLottoNotification() {
  try {
    const notificationId = await AsyncStorage.getItem(LOTTO_NOTIFICATION_KEY);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(LOTTO_NOTIFICATION_KEY);
      console.log('[LottoNotification] Cancelled:', notificationId);
    }
  } catch (error) {
    console.error('Failed to cancel lotto notification:', error);
  }
}

/**
 * 연금복권 알림 취소
 */
export async function cancelPensionNotification() {
  try {
    const notificationId = await AsyncStorage.getItem(PENSION_NOTIFICATION_KEY);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(PENSION_NOTIFICATION_KEY);
      console.log('[PensionNotification] Cancelled:', notificationId);
    }
  } catch (error) {
    console.error('Failed to cancel pension notification:', error);
  }
}

/**
 * 모든 복권 알림 취소
 */
export async function cancelLotteryNotification() {
  await cancelLottoNotification();
  await cancelPensionNotification();
}

/**
 * 복권 스캔 시 알림 스케줄 업데이트
 */
export async function updateLotteryNotificationOnScan() {
  // 새 복권이 스캔되면 알림 재스케줄
  return scheduleLotteryNotification();
}

/**
 * 복권 확인 시 알림 스케줄 업데이트
 */
export async function updateLotteryNotificationOnCheck() {
  // 복권 확인 후 미확인 복권이 없으면 알림 취소, 있으면 재스케줄
  const hasUnchecked = await hasUncheckedLotteries();
  if (!hasUnchecked) {
    await cancelLotteryNotification();
  } else {
    await scheduleLotteryNotification();
  }
}

/**
 * 알림 리스너 설정
 */
export function setupNotificationListeners(navigation) {
  // 알림 클릭 시 처리
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.type === 'lottery_check') {
      // 복권 히스토리로 이동
      navigation?.navigate?.('/(tabs)/history');
    }
  });

  return () => subscription.remove();
}

export default {
  requestNotificationPermission,
  hasUncheckedLotteries,
  getUncheckedLotteryCount,
  scheduleLotteryNotification,
  scheduleLottoNotification,
  schedulePensionNotification,
  cancelLotteryNotification,
  cancelLottoNotification,
  cancelPensionNotification,
  updateLotteryNotificationOnScan,
  updateLotteryNotificationOnCheck,
  setupNotificationListeners,
};
