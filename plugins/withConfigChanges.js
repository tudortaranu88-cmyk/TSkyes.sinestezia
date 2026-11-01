// Plugin Expo: activitatea principală tratează singură schimbările de configurație (tastatură,
// temă, mărimea fontului etc.) în loc să fie recreată. La recreare, selectorul de imagini rămânea
// legat de activitatea veche („Attempting to launch an unregistered ActivityResultLauncher”).
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const CHANGES = [
  'keyboard', 'keyboardHidden', 'navigation', 'touchscreen', 'orientation', 'screenSize',
  'smallestScreenSize', 'screenLayout', 'uiMode', 'density', 'fontScale', 'fontWeightAdjustment',
  'locale', 'layoutDirection', 'colorMode', 'mcc', 'mnc',
].join('|');

module.exports = function withConfigChanges(config) {
  return withAndroidManifest(config, cfg => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$['android:configChanges'] = CHANGES;
    return cfg;
  });
};
