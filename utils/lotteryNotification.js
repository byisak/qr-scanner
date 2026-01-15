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

const LOTTERY_NOTIFICATION_KEY = 'lotteryNotificationId';

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
 * 다음 토요일 오후 7시 10분 구하기
 */
function getNextSaturdayNotificationTime() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0: 일, 1: 월, ..., 6: 토

  // 토요일까지 남은 일수 계산
  let daysUntilSaturday = 6 - dayOfWeek;
  if (daysUntilSaturday === 0) {
    // 오늘이 토요일인 경우
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const notificationTime = 19 * 60 + 10; // 19:10

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
  nextSaturday.setHours(19, 10, 0, 0); // 오후 7시 10분

  return nextSaturday;
}

/**
 * 미확인 복권이 있는지 확인
 */
export async function hasUncheckedLotteries() {
  try {
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    if (!historyData) return false;

    const historyByGroup = JSON.parse(historyData);

    // 로또 그룹과 연금복권 그룹 확인
    const lotteryGroups = ['lottery-lotto', 'lottery-pension'];

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
 */
export async function getUncheckedLotteryCount() {
  try {
    const historyData = await AsyncStorage.getItem('scanHistoryByGroup');
    if (!historyData) return 0;

    const historyByGroup = JSON.parse(historyData);
    const lotteryGroups = ['lottery-lotto', 'lottery-pension'];

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
 * 복권 알림 스케줄링 (매주 토요일 오후 7시 10분)
 */
export async function scheduleLotteryNotification() {
  try {
    // 권한 확인
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[LotteryNotification] Permission not granted');
      return false;
    }

    // 기존 알림 취소
    await cancelLotteryNotification();

    // 미확인 복권이 없으면 알림 스케줄링하지 않음
    const hasUnchecked = await hasUncheckedLotteries();
    if (!hasUnchecked) {
      console.log('[LotteryNotification] No unchecked lotteries');
      return false;
    }

    const count = await getUncheckedLotteryCount();
    const triggerDate = getNextSaturdayNotificationTime();

    // 알림 스케줄
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎱 복권 당첨 확인하세요!',
        body: `미확인 복권이 ${count}개 있습니다. 당첨 여부를 확인해보세요!`,
        data: { type: 'lottery_check' },
        sound: true,
      },
      trigger: {
        date: triggerDate,
      },
    });

    // 알림 ID 저장
    await AsyncStorage.setItem(LOTTERY_NOTIFICATION_KEY, notificationId);

    console.log('[LotteryNotification] Scheduled for:', triggerDate.toLocaleString());
    return true;
  } catch (error) {
    console.error('Failed to schedule lottery notification:', error);
    return false;
  }
}

/**
 * 복권 알림 취소
 */
export async function cancelLotteryNotification() {
  try {
    const notificationId = await AsyncStorage.getItem(LOTTERY_NOTIFICATION_KEY);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(LOTTERY_NOTIFICATION_KEY);
      console.log('[LotteryNotification] Cancelled:', notificationId);
    }
  } catch (error) {
    console.error('Failed to cancel lottery notification:', error);
  }
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
  cancelLotteryNotification,
  updateLotteryNotificationOnScan,
  updateLotteryNotificationOnCheck,
  setupNotificationListeners,
};
