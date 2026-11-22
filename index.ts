import React from 'react';
import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

if (Platform.OS === 'web') {
  // Pe calculator, Skia rulează prin CanvasKit (WebAssembly, fișier local canvaskit.wasm).
  // Trebuie încărcat înainte ca aplicația să atingă vreun obiect Skia.
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  const { SafeAreaProvider } = require('react-native-safe-area-context');
  // un fișier tras în afara zonelor de încărcare nu trebuie să „deschidă” fișierul în fereastră
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, e => e.preventDefault());
  LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(async () => {
    await require('./src/render/webFonts').loadWebFonts();
    const App = require('./App').default;
    registerRootComponent(() => React.createElement(SafeAreaProvider, null, React.createElement(App)));
  });
} else {
  registerRootComponent(require('./App').default);
}
