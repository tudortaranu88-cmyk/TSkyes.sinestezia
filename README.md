# Sinestezia – schelet aplicație mobilă (React Native + Skia)

## Instalare (o singură dată)

```bash
npx create-expo-app@latest sinestezia --template blank-typescript
cd sinestezia
npx expo install @shopify/react-native-skia react-native-audio-api expo-asset react-native-safe-area-context expo-status-bar
# copiați peste proiect: App.tsx, src/, assets/sunete/, test/
npx expo prebuild          # react-native-audio-api are cod nativ → necesită development build (nu Expo Go)
npx expo run:android       # sau: npx expo run:ios (macOS + Xcode)
```

## Build automat (GitHub Actions)

La fiecare push pe `main`, workflow-ul `.github/workflows/android.yml` instalează dependențele,
verifică tipurile, rulează testele, face `expo prebuild` și compilează un APK release
(semnat cu cheia debug, instalabil direct). APK-ul apare ca artefact `sinestezia-apk` în pagina rulării.

## Structură

| Fișier | Rol |
|---|---|
| `App.tsx` | Ecran 50/50, legătura claviatură → audio → vizualizator |
| `src/core/spiral.ts` | Matematica spiralei de aur (φ) |
| `src/core/scene.ts` | Construiește scena (portativ + spirală) ca primitive pure |
| `src/core/staff.ts` | Poziționarea pe portativ (cheia Sol) |
| `src/core/golden.ts` | Matricea Aurie portată din DAW (frecvențe, culori, acordaje) |
| `src/components/Visualizer.tsx` | Randare Skia |
| `src/components/Keyboard.tsx` | Claviatura colorată (8 note × rând -10..+10) |
| `src/audio/AudioEngine.ts` | Sample-uri reale + sinteză de rezervă + limitator |
| `assets/sunete/manifest.ts` | Lista sample-urilor (require static) |

## Teste

```bash
npx tsx --test test/core.test.ts                       # 10 teste: raporturi φ, orientare, portativ, matrice
bun build test/preview.ts --format=iife --outfile test/preview.js   # previzualizare în browser
```
