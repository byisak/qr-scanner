// plugins/withFirebaseModularHeaders.js
// iOS: Firebase(Swift) 포드가 정적 라이브러리로 GoogleUtilities 등을 불러올 수 있게 모듈 헤더를 켠다.
// 광고 SDK(react-native-google-mobile-ads)를 뺀 뒤 pod install 이
// "FirebaseCoreInternal depends upon GoogleUtilities, which does not define modules" 로 실패해서 추가했다.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# withFirebaseModularHeaders';
const PODS = ['GoogleUtilities', 'FirebaseCore', 'FirebaseCoreInternal', 'FirebaseCoreExtension', 'FirebaseInstallations', 'GoogleDataTransport', 'nanopb', 'PromisesObjC'];

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        const lines = PODS.map((name) => `  pod '${name}', :modular_headers => true`).join('\n');
        contents = contents.replace(/(\n\s*use_expo_modules!\s*\n)/, `$1  ${MARKER}\n${lines}\n`);
        if (!contents.includes(MARKER)) {
          throw new Error('withFirebaseModularHeaders: Podfile에서 use_expo_modules! 를 찾지 못했어요');
        }
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
