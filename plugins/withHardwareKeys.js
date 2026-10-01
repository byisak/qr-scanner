// plugins/withHardwareKeys.js - MainActivity 에 onKeyDown/onKeyUp 을 끼워 넣어 볼륨 키를 모듈로 넘긴다.
// MainActivity 는 prebuild 가 만들기 때문에 손으로 고칠 수 없어 config plugin 으로 넣는다.
const { withMainActivity } = require('expo/config-plugins');

const MARKER = 'hardware-keys';
const METHODS = `
  // @generated begin ${MARKER} - 볼륨 키를 앱이 가로채면 시스템 볼륨 처리를 막는다 (modules/hardware-keys)
  override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
    if (expo.modules.hardwarekeys.HardwareKeysModule.handleKeyEvent(keyCode, event)) return true
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: android.view.KeyEvent?): Boolean {
    if (expo.modules.hardwarekeys.HardwareKeysModule.handleKeyEvent(keyCode, event)) return true
    return super.onKeyUp(keyCode, event)
  }
  // @generated end ${MARKER}
`;

function withHardwareKeys(config) {
  return withMainActivity(config, (config) => {
    const { modResults } = config;
    if (modResults.language !== 'kt') {
      throw new Error('withHardwareKeys: MainActivity 가 Kotlin 이 아닙니다 (Java 템플릿은 지원하지 않음)');
    }
    if (!modResults.contents.includes(`@generated begin ${MARKER}`)) {
      const anchor = /(\n[ \t]*)override fun getMainComponentName\(\)/;
      if (!anchor.test(modResults.contents)) {
        throw new Error('withHardwareKeys: MainActivity 에서 getMainComponentName 을 찾지 못했습니다');
      }
      modResults.contents = modResults.contents.replace(anchor, `${METHODS}$1override fun getMainComponentName()`);
    }
    return config;
  });
}

module.exports = withHardwareKeys;
