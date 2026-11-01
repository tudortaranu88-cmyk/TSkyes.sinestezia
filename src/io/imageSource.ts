// Încărcarea imaginii pentru Nivelul 2: alegere din galerie, micșorare (orientarea corectă),
// decodare în pixeli RGBA cu Skia.

import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Skia, ColorType, AlphaType, type SkImage } from '@shopify/react-native-skia';

export interface ImageSource { rgba: Uint8Array; width: number; height: number; image: SkImage; name: string }

const MAX_SIDE = 360; // suficient pentru celule mici; calculul rămâne rapid

export async function pickImage(): Promise<ImageSource | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const landscape = (a.width ?? 1) >= (a.height ?? 1);
  const small = await manipulateAsync(a.uri, [{ resize: landscape ? { width: MAX_SIDE } : { height: MAX_SIDE } }], {
    format: SaveFormat.PNG, base64: true,
  });
  if (!small.base64) throw new Error('Imaginea nu a putut fi citită');
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(small.base64));
  if (!img) throw new Error('Formatul imaginii nu este suportat');
  const w = img.width(), h = img.height();
  const px = img.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px) throw new Error('Pixelii imaginii nu au putut fi citiți');
  return { rgba: px as Uint8Array, width: w, height: h, image: img, name: a.fileName ?? 'imagine' };
}

const SCORE_SIDE = 1200; // partiturile se citesc la rezoluție mare, ca banda de culori să fie clară

/** Alege una sau mai multe partituri (Nivelul 3), în ordinea numelui (…_p1, _p2…), la rezoluție mare. */
export async function pickScoreImages(): Promise<ImageSource[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
  if (res.canceled || !res.assets?.length) return [];
  const assets = [...res.assets].sort((a, b) => (a.fileName ?? '').localeCompare(b.fileName ?? '', undefined, { numeric: true }));
  const out: ImageSource[] = [];
  for (const a of assets) {
    const landscape = (a.width ?? 1) >= (a.height ?? 1);
    const big = await manipulateAsync(a.uri, [{ resize: landscape ? { width: SCORE_SIDE } : { height: SCORE_SIDE } }], {
      format: SaveFormat.PNG, base64: true,
    });
    if (!big.base64) continue;
    const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(big.base64));
    if (!img) continue;
    const w = img.width(), h = img.height();
    const px = img.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    if (px) out.push({ rgba: px as Uint8Array, width: w, height: h, image: img, name: a.fileName ?? 'partitura' });
  }
  if (!out.length) throw new Error('Partiturile nu au putut fi citite');
  return out;
}

/** Sursă construită direct din pixeli (autotest). */
export function sourceFromPixels(rgba: Uint8Array, width: number, height: number, name: string): ImageSource {
  const image = Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(rgba), width * 4,
  );
  if (!image) throw new Error('Imaginea de test nu a putut fi creată');
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
