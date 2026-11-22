// Încărcarea imaginii pentru Nivelul 2: alegere din galerie, micșorare (orientarea corectă),
// decodare în pixeli RGBA cu Skia.

import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';

import type { ImageSource } from './imageCommon';
export type { ImageSource } from './imageCommon';

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

export { sourceFromPixels, demoPixels } from './imageCommon';

/** Drag and drop există doar pe calculator (imageSource.web.ts). */
export async function imageFromFiles(_files: unknown[]): Promise<ImageSource | null> { return null; }
export async function scoresFromFiles(_files: unknown[]): Promise<ImageSource[]> { return []; }
