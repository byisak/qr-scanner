// config/features.js - 기능 단위 켜고 끄기 (config/ads.js의 ADS_ENABLED와 같은 방식)

// 복권 인식: 지금은 누구에게도 보이거나 동작하지 않게 꺼 둔다.
// 코드·화면·저장된 값(lotteryScanEnabled, 복권 그룹, 기록의 lotteryData)은 그대로 두었으니
// 다시 켤 때는 이 값만 true로 바꾸면 된다. 실제 판단은 utils/lotteryFeature.js의 isLotteryActive()
export const LOTTERY_FEATURE_ENABLED = false;
