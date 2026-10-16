// utils/lotteryFeature.js - 복권 기능이 지금 동작해야 하는지 한 곳에서 판단
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOTTERY_FEATURE_ENABLED } from '../config/features';

export { LOTTERY_FEATURE_ENABLED };

/**
 * 복권 인식이 켜져 있는지. 기능 플래그가 꺼져 있으면 저장된 설정과 상관없이 false
 * (저장된 lotteryScanEnabled 값은 읽기만 하고 건드리지 않는다)
 */
export async function isLotteryActive() {
  if (!LOTTERY_FEATURE_ENABLED) return false;
  try {
    return (await AsyncStorage.getItem('lotteryScanEnabled')) === 'true';
  } catch {
    return false;
  }
}
