// NIVEL 2 – din imagine în melodie.
//
// Citirea: celule mici, din centru spre exterior, care acoperă uniform toată imaginea (și colțurile).
// Două trasee:
//  • 'spirala'  – o spirală continuă (pornește în sus, sens trigonometric, ca în Nivelul 1) cu spirele
//                 la distanță de o celulă; celulele consecutive sunt vecine → melodia urmează zonele de culoare;
//  • 'floare'   – spirala de aur a florii-soarelui (Vogel): celula n la unghiul n·α (α = 2π/φ² ≈ 137,5°)
//                 și raza R·√(n/N); celulele consecutive sunt depărtate → melodie mai variată.
// Fiecare celulă: culoarea medie → cea mai apropiată celulă din Matricea Aurie (coloană = notă,
// rând = nuanță) → nota. Celulele consecutive identice se unesc în note mai lungi (ritm), fără
// să treacă peste bara de măsură (4/4).

import { NOTES, ROW_MAX, ROW_MIN, cellColor, cellPitch, freqToMidi, noteLabel, type RGB, type Tuning } from './golden';
import { PHI } from './spiral';
import type { RenderNote } from './audioRender';
import type { NoteEvent } from './types';

export const GOLDEN_ANGLE = (2 * Math.PI) / (PHI * PHI);

export interface Cell { x: number; y: number; r: number }

export type ReadPath = 'spirala' | 'floare';

/** Celulele de citire pentru o imagine w × h: ~`count` celule în interiorul imaginii, din centru spre exterior. */
export function readingCells(w: number, h: number, count: number, path: ReadPath = 'spirala'): Cell[] {
  return path === 'floare' ? spiralCells(w, h, count) : continuousSpiralCells(w, h, count);
}

/** Spirală continuă cu pasul (între spire și între celule) egal cu latura unei celule. */
export function continuousSpiralCells(w: number, h: number, count: number): Cell[] {
  const step = Math.sqrt((w * h) / count);
  const k = step / (2 * Math.PI);            // r = k·θ → spirele sunt la `step` una de alta
  const R = Math.hypot(w, h) / 2 + step;
  const cx = w / 2, cy = h / 2;
  const out: Cell[] = [];
  let theta = Math.PI;                       // prima celulă la jumătate de pas de centru
  while (k * theta <= R) {
    const rad = k * theta;
    const ang = -Math.PI / 2 - theta;
    const x = cx + rad * Math.cos(ang), y = cy + rad * Math.sin(ang);
    if (x >= 0 && x < w && y >= 0 && y < h) out.push({ x, y, r: step / 2 });
    theta += step / Math.sqrt(rad * rad + k * k); // pas constant pe lungimea curbei
  }
  return out;
}

/** Spirala florii-soarelui (unghiul de aur). */
export function spiralCells(w: number, h: number, count: number): Cell[] {
  const R = Math.hypot(w, h) / 2;
  const total = Math.ceil((count * Math.PI * R * R) / (w * h)); // câte puncte în discul care acoperă imaginea
  const r = 0.5 * Math.sqrt((w * h) / count);                    // raza de eșantionare a unei celule
  const cx = w / 2, cy = h / 2;
  const out: Cell[] = [];
  for (let n = 0; n < total; n++) {
    const rad = R * Math.sqrt((n + 0.5) / total);
    const ang = -Math.PI / 2 - n * GOLDEN_ANGLE;                  // pornește în sus, sens trigonometric (ca spirala din Nivelul 1)
    const x = cx + rad * Math.cos(ang), y = cy + rad * Math.sin(ang);
    if (x >= 0 && x < w && y >= 0 && y < h) out.push({ x, y, r });
  }
  return out;
}

/** Culoarea medie a fiecărei celule (RGBA, 8 biți/canal). */
export function sampleColors(rgba: Uint8Array, w: number, h: number, cells: Cell[]): RGB[] {
  return cells.map(c => {
    const rr = Math.max(0.5, c.r);
    const x0 = Math.max(0, Math.floor(c.x - rr)), x1 = Math.min(w - 1, Math.ceil(c.x + rr));
    const y0 = Math.max(0, Math.floor(c.y - rr)), y1 = Math.min(h - 1, Math.ceil(c.y + rr));
    let R = 0, G = 0, B = 0, n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x - c.x) ** 2 + (y - c.y) ** 2 > rr * rr && n > 0) continue;
        const i = (y * w + x) * 4;
        R += rgba[i]; G += rgba[i + 1]; B += rgba[i + 2]; n++;
      }
    }
    if (!n) {
      const i = (Math.min(h - 1, Math.round(c.y)) * w + Math.min(w - 1, Math.round(c.x))) * 4;
      return [rgba[i], rgba[i + 1], rgba[i + 2]] as RGB;
    }
    return [Math.round(R / n), Math.round(G / n), Math.round(B / n)] as RGB;
  });
}

// Paleta Matricei Aurii (8 coloane × 21 rânduri).
const PALETTE: { col: number; row: number; color: RGB }[] = [];
for (let row = ROW_MIN; row <= ROW_MAX; row++) {
  for (let col = 0; col < NOTES.length; col++) PALETTE.push({ col, row, color: cellColor(col, row) });
}

/** Distanța „redmean” – aproximare simplă a diferenței percepute între culori. */
export function colorDistance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

export function nearestCell(c: RGB): { col: number; row: number } {
  let best = PALETTE[0], bd = Infinity;
  for (const p of PALETTE) {
    const d = colorDistance(c, p.color);
    if (d < bd) { bd = d; best = p; }
  }
  return { col: best.col, row: best.row };
}

export interface MelodyNote {
  col: number;
  row: number;
  midi: number;        // înălțimea temperată (pentru partitură)
  freq: number;        // frecvența redată
  color: RGB;          // culoarea celulei din matrice
  startBeat: number;   // de la începutul piesei (pătrimi)
  beats: number;       // 1 = pătrime, 2 = doime, 3 = doime cu punct, 4 = notă întreagă
  cells: number[];     // indicii celulelor de imagine din care provine
}

/** Transformă șirul de culori (în ordinea spiralei) în melodie, cu ritm din repetiții. */
export function buildMelody(colors: RGB[], tuning: Tuning = 'tempered', beatsPerBar = 4): MelodyNote[] {
  const cells = colors.map(nearestCell);
  const out: MelodyNote[] = [];
  let beat = 0;
  let i = 0;
  while (i < cells.length) {
    const { col, row } = cells[i];
    const roomInBar = beatsPerBar - (beat % beatsPerBar);
    let len = 1;
    while (len < roomInBar && i + len < cells.length && cells[i + len].col === col && cells[i + len].row === row) len++;
    const p = cellPitch(col, row, tuning);
    out.push({
      col, row,
      midi: p.midi ?? Math.round(freqToMidi(p.freq)),
      freq: p.freq,
      color: cellColor(col, row),
      startBeat: beat,
      beats: len,
      cells: Array.from({ length: len }, (_, k) => i + k),
    });
    beat += len;
    i += len;
  }
  return out;
}

export function melodyBeats(m: MelodyNote[]): number {
  return m.length ? m[m.length - 1].startBeat + m[m.length - 1].beats : 0;
}

/** Melodia ca evenimente (pentru vizualizare și exportul audio). */
export function melodyToEvents(m: MelodyNote[], bpm: number, instrument: string, t0 = 0): NoteEvent[] {
  const beatMs = 60000 / bpm;
  return m.map((n, k) => ({
    id: k + 1, col: n.col, row: n.row,
    label: noteLabel(n.col, n.row),
    freq: n.freq, midiFloat: freqToMidi(n.freq), color: n.color,
    startMs: t0 + n.startBeat * beatMs,
    durationMs: n.beats * beatMs * 0.92, // mică pauză de articulare între note
    instrument,
  }));
}


/** Notele melodiei pentru randare (timp în secunde, începând la 0,1 s, ca la celelalte exporturi). */
export function melodyToNotes(m: MelodyNote[], bpm: number, instrument: string): RenderNote[] {
  const beat = 60 / bpm;
  return m.map(n => ({
    startSec: 0.1 + n.startBeat * beat,
    durSec: Math.max(0.05, n.beats * beat * 0.92),
    freq: n.freq,
    instrument,
  }));
}
