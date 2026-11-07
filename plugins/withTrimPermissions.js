// Plugin Expo: scoate din manifestul FINAL permisiunile de care aplicația nu are nevoie pe Android
// modern. Nu e suficient să le filtrăm din manifestul principal, fiindcă fuzionarea de la build (Gradle)
// le re-adaugă din manifestele bibliotecilor; de aceea adăugăm directive `tools:node="remove"`, pe care
// merger-ul le respectă și le elimină din rezultat.
// - WRITE/READ_EXTERNAL_STORAGE: salvarea în galerie (expo-media-library) folosește MediaStore pe
//   Android 10+ (API 29+); confirmat că salvarea merge și fără ele.
// - DUMP, SYSTEM_ALERT_WINDOW: nefolosite de aplicație (provin din dependențe/dezvoltare).
const { withAndroidManifest } = require('expo/config-plugins');

const REMOVE = [
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.DUMP',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

module.exports = function withTrimPermissions(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const list = Array.isArray(manifest['uses-permission']) ? manifest['uses-permission'] : [];
    // scoate orice declarație proprie a acestor permisiuni, apoi adaugă directiva de eliminare
    const kept = list.filter(p => !REMOVE.includes(p.$?.['android:name']));
    for (const name of REMOVE) {
      kept.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    manifest['uses-permission'] = kept;
    return cfg;
  });
};
