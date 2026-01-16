const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .txt 파일을 에셋으로 처리
config.resolver.assetExts.push('txt');

// SVG 파일을 소스로 처리 (react-native-svg-transformer)
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg');

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

module.exports = config;
