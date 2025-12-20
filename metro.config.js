// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .txt to asset extensions for jsQR library bundling
config.resolver.assetExts.push('txt');

module.exports = config;
