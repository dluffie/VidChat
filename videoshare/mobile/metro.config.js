const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude nested mobile reference folder from Metro bundler
config.resolver.blockList = [
  new RegExp(path.resolve(__dirname, 'mobile').replace(/\\/g, '\\\\') + '.*'),
];

module.exports = config;
