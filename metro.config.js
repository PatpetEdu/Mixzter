const { withNativeWind } = require('nativewind/metro');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(
__dirname);

// Ignorera backend-kod i functions/
config.resolver.blockList = [
  /functions\/lib\/.*/,
  /functions\/node_modules\/.*/,
];

// Alias: 'react-dom' -> vår RN-shim
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'react-dom': path.resolve(__dirname, 'shims/react-dom'),
};

module.exports = withNativeWind(config, { input: './global.css' });