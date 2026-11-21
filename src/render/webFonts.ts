// Fonturile pentru textul desenat cu Skia pe calculator (partitura exportată ca imagine).
// Pe web, CanvasKit nu are fonturi de sistem: le încărcăm din Windows (C:\Windows\Fonts), servite
// local de învelișul Electron la app://…/__winfonts/<fișier>. Nimic nu vine de pe internet.
// Sunt înregistrate sub numele familiilor cerute în scoreImage.ts ('sans-serif', 'Noto Music').
import { Skia } from '@shopify/react-native-skia';

const FONTS: { file: string; family: string }[] = [
  { file: 'segoeui.ttf', family: 'sans-serif' },
  { file: 'segoeuib.ttf', family: 'sans-serif' },
  { file: 'seguisym.ttf', family: 'Noto Music' },   // Segoe UI Symbol: conține cheia Sol (U+1D11E)
];

let provider: any = null;

export async function loadWebFonts(): Promise<void> {
  const p = Skia.TypefaceFontProvider.Make();
  let n = 0;
  for (const f of FONTS) {
    try {
      const res = await fetch(`/__winfonts/${f.file}`);
      if (!res.ok) continue;
      const data = Skia.Data.fromBytes(new Uint8Array(await res.arrayBuffer()));
      const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (tf) { p.registerFont(tf, f.family); n++; }
    } catch { /* fontul lipsește: textul va lipsi din imagine, restul merge */ }
  }
  provider = n ? p : null;
}

/** Furnizorul de fonturi pentru ParagraphBuilder (null dacă nu s-a încărcat nimic). */
export function webFontProvider(): any {
  return provider;
}
