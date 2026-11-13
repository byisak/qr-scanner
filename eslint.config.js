// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'modules/*/android/*', 'modules/*/ios/*', '.expo/*', 'patches/*'],
  },
  {
    // node로 직접 실행하는 스크립트
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly', process: 'readonly', module: 'writable', require: 'readonly', console: 'readonly' } },
  },
  {
    files: ['__tests__/**/*.js'],
    languageOptions: { globals: { jest: 'readonly', describe: 'readonly', test: 'readonly', expect: 'readonly', Buffer: 'readonly' } },
  },
]);
