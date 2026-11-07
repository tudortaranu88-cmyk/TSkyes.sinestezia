// Plugin Expo: scoate din manifest permisiunile de care aplicația nu are nevoie pe Android modern.
// - WRITE/READ_EXTERNAL_STORAGE: salvarea în galerie (expo-media-library) folosește MediaStore pe
//   Android 10+ (API 29+), deci nu sunt necesare; erau adăugate automat de bibliotecă pentru API vechi.
// - DUMP: apare doar în build-urile de dezvoltare; o scoatem ca să nu ajungă în release.
const { withAndroidManifest } = require('expo/config-plugins');

const REMOVE = [
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.DUMP',
];

module.exports = function withTrimPermissions(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    for (const key of ['uses-permission', 'uses-permission-sdk-23']) {
      if (Array.isArray(manifest[key])) {
        manifest[key] = manifest[key].filter(p => !REMOVE.includes(p.$?.['android:name']));
      }
    }
    return cfg;
  });
};
