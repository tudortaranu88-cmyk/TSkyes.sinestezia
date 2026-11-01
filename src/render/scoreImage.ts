// Randează paginile partiturii (primitive din scoreLayout) cu Skia → PNG / JPEG (Base64).
// Textul și cheia Sol (𝄞) trec prin Paragraph, care folosește fonturile sistemului cu fallback.

import { Skia, ImageFormat, PaintStyle, StrokeCap, TextAlign, FontWeight } from '@shopify/react-native-skia';
import { rgbToCss } from '../core/golden';
import type { ScorePage } from '../core/scoreLayout';

export type ScoreKind = 'png' | 'jpeg';

const INK = '#111111';
const GRAY = '#666666';

function drawText(canvas: any, text: string, x: number, y: number, size: number, align: 'left' | 'center' | 'right', color: string, bold = false) {
  const style = {
    color: Skia.Color(color),
    fontSize: size,
    fontStyle: { weight: bold ? FontWeight.Bold : FontWeight.Normal },
    fontFamilies: ['sans-serif', 'Noto Music', 'Noto Sans Symbols 2', 'Noto Sans Symbols'],
  };
  const textAlign = align === 'center' ? TextAlign.Center : align === 'right' ? TextAlign.Right : TextAlign.Left;
  const para = Skia.ParagraphBuilder.Make({ textAlign, textStyle: style }).addText(text).build();
  const boxW = 1200;
  para.layout(boxW);
  const left = align === 'center' ? x - boxW / 2 : align === 'right' ? x - boxW : x;
  // y = linia de bază (ca în Canvas 2D)
  const ascent = para.getLineMetrics()[0]?.ascent ?? size * 0.8;
  para.paint(canvas, left, y - ascent);
}

export function renderScorePage(page: ScorePage, kind: ScoreKind): string {
  const surface = Skia.Surface.Make(page.width, page.height);
  if (!surface) throw new Error('Nu am putut crea suprafața de desen');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#ffffff'));

  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeCap(StrokeCap.Butt);
  stroke.setColor(Skia.Color(INK));
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(INK));

  for (const p of page.prims) {
    switch (p.k) {
      case 'line':
        stroke.setStrokeWidth(p.w);
        canvas.drawLine(p.x1, p.y1, p.x2, p.y2, stroke);
        break;
      case 'head': {
        canvas.save();
        canvas.translate(p.cx, p.cy);
        canvas.rotate(-20, 0, 0);
        const r = Skia.XYWHRect(-p.rx, -p.ry, 2 * p.rx, 2 * p.ry);
        if (p.filled) canvas.drawOval(r, fill);
        else { stroke.setStrokeWidth(2.2); canvas.drawOval(r, stroke); }
        canvas.restore();
        break;
      }
      case 'dot':
        canvas.drawCircle(p.cx, p.cy, p.r, fill);
        break;
      case 'rect': {
        const paint = Skia.Paint();
        paint.setColor(Skia.Color(rgbToCss(p.color)));
        canvas.drawRect(Skia.XYWHRect(p.x, p.y, p.w, p.h), paint);
        break;
      }
      case 'text':
        drawText(canvas, p.text, p.x, p.y, p.size, p.align, p.gray ? GRAY : INK, !!p.bold);
        break;
      case 'clef':
        drawText(canvas, '\u{1D11E}', p.x, p.y, p.size, 'left', INK);
        break;
    }
  }
  surface.flush();
  const img = surface.makeImageSnapshot();
  return kind === 'png' ? img.encodeToBase64(ImageFormat.PNG, 100) : img.encodeToBase64(ImageFormat.JPEG, 92);
}
