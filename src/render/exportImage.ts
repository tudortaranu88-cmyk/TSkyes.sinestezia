// Tabloul final: toate notele aduse în prim-plan ca puncte de culoare, așezate după unghiul
// de aur (floarea-soarelui), pe o pagină A4 verticală. Spirala animată rămâne separat
// (vizualizatorul Nivelului 1, ca prezentare); aceasta e imaginea care se salvează.

import { Skia, ImageFormat, ColorType, AlphaType, PaintStyle } from '@shopify/react-native-skia';
import { rgbToCss } from '../core/golden';
import { sunflowerDots } from '../core/tablou';
import { encodeTiff, toBase64 } from '../core/encoders';
import type { NoteEvent } from '../core/types';

export type ImageKind = 'png' | 'jpeg' | 'tiff';

// Proporția A4 vertical (ca partitura: 1240 × 1754). `width` dat → înălțimea rezultă din proporție.
const A4_RATIO = 1754 / 1240;
const a4Height = (width: number) => Math.round(width * A4_RATIO);

function renderTablou(events: NoteEvent[], width: number, height: number) {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) throw new Error('Nu am putut crea suprafața de desen');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#0e0e12'));
  const dots = sunflowerDots(events.length, width, height);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Fill);
  for (let i = 0; i < events.length; i++) {                 // centru → exterior (noile puncte deasupra)
    const d = dots[i];
    paint.setColor(Skia.Color(rgbToCss(events[i].color)));
    canvas.drawCircle(d.x, d.y, d.r, paint);
  }
  surface.flush();
  return surface.makeImageSnapshot();
}

/** Întoarce conținutul fișierului în Base64. `width` = lățimea imaginii A4 (înălțimea rezultă din proporție). */
export function exportTablouImage(events: NoteEvent[], kind: ImageKind, width = 2048): string {
  const height = a4Height(width);
  const img = renderTablou(events, width, height);
  if (kind === 'png') return img.encodeToBase64(ImageFormat.PNG, 100);
  if (kind === 'jpeg') return img.encodeToBase64(ImageFormat.JPEG, 95);
  const px = img.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px) throw new Error('Nu am putut citi pixelii imaginii');
  return toBase64(encodeTiff(px as Uint8Array, width, height));
}
