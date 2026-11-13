module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets-core/plugin'],
    ],
    env: {
      // 출시 빌드에서는 console.log 등을 번들에서 뺀다 (구형 기기에서 스캔마다 찍히는 로그가 느려짐의 한 원인).
      // console.error·warn은 남긴다.
      production: {
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};
