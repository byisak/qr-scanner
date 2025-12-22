const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .txt 파일을 에셋으로 처리
config.resolver.assetExts.push('txt');

module.exports = config;
