// NIVEL 3 – citirea unei partituri generate de aplicație și reconstrucția tabloului-spirală.
// Canalul sigur de citire este banda de culori din josul fiecărei pagini (vezi scoreLayout.ts):
//   [bloc negru de calibrare = 1 unitate][notă][notă]… pe un fundal gri, cu goluri gri între blocuri.
// Citim banda, aflăm unitatea din blocul de calibrare, apoi fiecare bloc → (culoare → celulă, lățime → durate).

import { cellColor, type RGB } from './golden';
import { buildMelody, nearestCell, type MelodyNote } from './imageMelody';
import { PAGE_W, PAGE_H, STRIP_X0, STRIP_X1, STRIP_Y, STRIP_H } from './scoreLayout';
import { decodeScanPage, scanDebug } from './scanDecode';

export interface DecodedRun { col: number; row: number; beats: number }

// Golul/fundalul benzii e magenta (STRIP_BG), un hue absent din paletă: niciun gri/alb/negru
// nu ar fi sigur, fiindcă Do4 întunecat produce griuri neutre.
function isGap(c: RGB): boolean {
  return c[0] > 150 && c[1] < 80 && c[2] > 110;
}

function avg(colors: RGB[]): RGB {
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += c[0]; g += c[1]; b += c[2]; }
  const n = colors.length || 1;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Segmentează un șir de culori (eșantionate de-a lungul benzii) în blocuri non-gri. */
function runs(samples: RGB[]): { start: number; colors: RGB[] }[] {
  const out: { start: number; colors: RGB[] }[] = [];
  let cur: { start: number; colors: RGB[] } | null = null;
  for (let i = 0; i < samples.length; i++) {
    if (isGap(samples[i])) { cur = null; continue; }
    if (!cur) { cur = { start: i, colors: [] }; out.push(cur); }
    cur.colors.push(samples[i]);
  }
  return out;
}

/**
 * Decodează o bandă (șir de culori eșantionate uniform pe [STRIP_X0, STRIP_X1]) în note.
 * Primul bloc = calibrarea (negru) → dă unitatea. Următoarele = note.
 */
export function decodeStrip(samples: RGB[]): DecodedRun[] {
  const r = runs(samples);
  if (r.length < 2) throw new Error('Banda de culori nu a fost găsită (nu pare o partitură Music&Color)');
  const calib = avg(r[0].colors);
  if (Math.max(...calib) > 70) throw new Error('Blocul de calibrare lipsește (partitură nerecunoscută)');
  const starts = r.map(x => x.start);
  const unit = starts[1] - starts[0];                 // o unitate = o pătrime (fără acumulare de eroare)
  if (unit <= 0) throw new Error('Banda de culori este deteriorată');
  const notes: DecodedRun[] = [];
  for (let i = 1; i < r.length; i++) {
    const next = i + 1 < r.length ? starts[i + 1] : samples.length;
    const beats = Math.max(1, Math.round((next - starts[i]) / unit));
    const { col, row } = nearestCell(avg(r[i].colors));
    notes.push({ col, row, beats });
  }
  return notes;
}

/** Eșantionează banda de culori de pe o pagină (pixeli RGBA) – media câtorva rânduri prin centrul benzii. */
export function readScoreStrip(rgba: Uint8Array, w: number, h: number): RGB[] {
  const yC = ((STRIP_Y + STRIP_H / 2) / PAGE_H) * h;
  const x0 = Math.round((STRIP_X0 / PAGE_W) * w);
  const x1 = Math.round((STRIP_X1 / PAGE_W) * w);
  const rows = [Math.round(yC - h * 0.004), Math.round(yC), Math.round(yC + h * 0.004)].filter(y => y >= 0 && y < h);
  const out: RGB[] = [];
  for (let x = x0; x < x1; x++) {
    let r = 0, g = 0, b = 0;
    for (const y of rows) { const i = (y * w + x) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; }
    const n = rows.length;
    out.push([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
  }
  return out;
}

export interface ScorePixels { rgba: Uint8Array; width: number; height: number; name?: string }

/** Cum a fost citită ultima serie de pagini (pentru mesajul din Nivelul 3). */
export const lastDecodeInfo: { pages: number; gray: number; debug: any[] } = { pages: 0, gray: 0, debug: [] };

/**
 * Decodează una sau mai multe pagini (în ordine) în melodia completă.
 * Întâi cititorul pentru pagini scanate/fotografiate/PDF (scanDecode.ts: găsește banda oriunde în imagine,
 * corectează culorile, citește și portativul); dacă nu reușește, citirea directă a paginii exportate.
 */
export function decodeScores(pages: ScorePixels[]): MelodyNote[] {
  const perBeat: RGB[] = [];
  let found = 0, gray = 0;
  lastDecodeInfo.debug = [];
  pages.forEach((p, i) => {
    let cells: { col: number; row: number }[];
    try {
      const r = decodeScanPage(p, i === pages.length - 1);
      cells = r.cells;
      lastDecodeInfo.debug[i] = { ...scanDebug, meas: undefined, cells: r.cells.map(c => [c.col, c.row]) };
      if (r.mode === 'gray') gray++;
    } catch (scanErr: any) {
      try {
        cells = decodeStrip(readScoreStrip(p.rgba, p.width, p.height)).flatMap(n => Array.from({ length: n.beats }, () => ({ col: n.col, row: n.row })));
      } catch {
        const who = pages.length > 1 ? `Pagina ${i + 1}${p.name ? ` (${p.name})` : ''}: ` : '';
        throw new Error(who + (scanErr?.message ?? String(scanErr)));
      }
    }
    found += cells.length;
    for (const c of cells) perBeat.push(cellColor(c.col, c.row));
  });
  if (!found) throw new Error('Nicio notă citită din partitură');
  lastDecodeInfo.pages = pages.length; lastDecodeInfo.gray = gray;
  return buildMelody(perBeat);   // re-împarte pe măsuri exact ca la generare
}
