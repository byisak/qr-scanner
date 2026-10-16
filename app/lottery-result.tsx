// app/lottery-result.tsx
// 복권 기능을 꺼 두면 딥링크 등으로 들어와도 첫 화면으로 돌려보낸다 (config/features.js)
import { Redirect } from 'expo-router';
import LotteryResultScreen from '../screens/LotteryResultScreen';
import { LOTTERY_FEATURE_ENABLED } from '../config/features';

export default function LotteryResultRoute(props: any) {
  if (!LOTTERY_FEATURE_ENABLED) return <Redirect href="/" />;
  return <LotteryResultScreen {...props} />;
}
