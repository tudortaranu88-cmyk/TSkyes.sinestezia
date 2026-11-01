// Randează spirala completă (fără portativ) într-o imagine pătrată de înaltă rezoluție,
// cu aceleași primitive ca vizualizatorul live.

import { Skia, ImageFormat, ColorType, AlphaType, PaintStyle, StrokeCap } from '@shopify/react-native-skia';
import { buildScene } from '../core/scene';
import { rgbToCss } from '../core/golden';
import { encodeTiff, toBase64 } from '../core/encoders';
import type { NoteEvent } from '../core/types';

export type ImageKind = 'png' | 'jpeg' | 'tiff';

function renderSpiral(events: NoteEvent[], size: number) {
  const surface = Skia.Surface.Make(size, size);
  if (!surface) throw new Error('Nu am putut crea suprafața de desen');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#0e0e12'));
  const scene = buildScene({ width: size, height: size, events, nowMs: Date.now(), insertPhase: 1, pxPerSec: 60, fill: 0.9 });
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeCap(StrokeCap.Round);
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const pathOf = (pts: { x: number; y: number }[]) => {
    const p = Skia.Path.Make();
    pts.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
    return p;
  };
  for (const a of scene.arcs) {
    stroke.setStrokeWidth(a.strokeWidth * 1.35);
    stroke.setColor(Skia.Color(`rgba(255,255,255,${0.18 * a.alpha})`));
    canvas.drawPath(pathOf(a.points), stroke);
  }
  for (const a of scene.arcs) {
    stroke.setStrokeWidth(a.strokeWidth);
    stroke.setColor(Skia.Color(rgbToCss(a.color, a.alpha)));
    canvas.drawPath(pathOf(a.points), stroke);
  }
  for (const n of scene.nodes) {
    fill.setColor(Skia.Color(rgbToCss(n.color, n.alpha)));
    canvas.drawCircle(n.x, n.y, n.radius, fill);
  }
  surface.flush();
  return surface.makeImageSnapshot();
}

/** Întoarce conținutul fișierului în Base64. */
export function exportSpiralImage(events: NoteEvent[], kind: ImageKind, size = 2048): string {
  const img = renderSpiral(events, size);
  if (kind === 'png') return img.encodeToBase64(ImageFormat.PNG, 100);
  if (kind === 'jpeg') return img.encodeToBase64(ImageFormat.JPEG, 95);
  const px = img.readPixels(0, 0, { width: size, height: size, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px) throw new Error('Nu am putut citi pixelii imaginii');
  return toBase64(encodeTiff(px as Uint8Array, size, size));
}
