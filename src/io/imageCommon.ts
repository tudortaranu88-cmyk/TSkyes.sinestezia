// Părți comune telefon/calculator pentru imaginile încărcate: tipul sursei, sursa din pixeli, imaginea de test.
import { Skia, ColorType, AlphaType, type SkImage } from '@shopify/react-native-skia';

export interface ImageSource { rgba: Uint8Array; width: number; height: number; image: SkImage; name: string }

/** Sursă construită direct din pixeli RGBA. */
export function sourceFromPixels(rgba: Uint8Array, width: number, height: number, name: string): ImageSource {
  const image = Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(rgba), width * 4,
  );
  if (!image) throw new Error('Imaginea nu a putut fi creată');
  return { rgba, width, height, image, name };
}

/** O imagine de test: gradient + forme (aceeași ca în previzualizarea din teste). */
export function demoPixels(w = 360, h = 270): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  const stops: [number, number, number][] = [[204, 17, 0], [247, 181, 0], [0, 32, 96]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      const [a, b, u] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
      let c = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      if ((x - w * 0.65) ** 2 + (y - h * 0.4) ** 2 < (h * 0.23) ** 2) c = [0, 66, 37];
      if (x > w * 0.1 && x < w * 0.4 && y > h * 0.63 && y < h * 0.87) c = [244, 244, 240];
      px.set([Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), 255], (y * w + x) * 4);
    }
  }
  return px;
}
