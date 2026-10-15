// utils/adsShim.js - 광고 SDK(react-native-google-mobile-ads) 대신 쓰는 빈 구현.
// 1.3.0은 광고 없이 출시한다: SDK를 빼서 광고 ID 수집·광고 SDK 초기화·보상형 광고 미리 받기가 모두 없어진다.
// 광고를 다시 켜려면: npm i react-native-google-mobile-ads, app.json plugins에 다시 추가,
// 이 파일을 쓰는 import를 'react-native-google-mobile-ads'로 되돌리고 config/ads.js의 ADS_ENABLED=true.
const noop = () => {};
const unsubscribe = () => noop;

export const TestIds = { REWARDED: 'disabled', BANNER: 'disabled', INTERSTITIAL: 'disabled' };
export const RewardedAdEventType = { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' };
export const AdEventType = { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed', CLICKED: 'clicked' };
export const MaxAdContentRating = { G: 'G', PG: 'PG', T: 'T', MA: 'MA' };

// 광고는 절대 불러와지지 않는다: LOADED 이벤트가 오지 않으므로 보상형 광고 흐름은 시작되지 않는다
export const RewardedAd = {
  createForAdRequest: () => ({
    addAdEventListener: unsubscribe,
    removeAllListeners: noop,
    load: noop,
    show: () => Promise.reject(new Error('Ads are disabled')),
    loaded: false,
  }),
};

export default function mobileAds() {
  return {
    initialize: () => Promise.resolve([]),
    setRequestConfiguration: () => Promise.resolve(),
  };
}
