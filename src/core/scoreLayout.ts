// NIVEL 2 – partitura: așezarea în pagină (A4 vertical, 150 dpi), ca listă de primitive pure.
// Aceleași primitive sunt desenate de Skia (telefon) și de Canvas 2D (previzualizare/teste).
// Convenții: cheia Sol, măsura 4/4, 4 măsuri pe portativ, numele notelor sub portativ,
// banda de culori (câte un dreptunghi pe notă, lățimea ∝ durata) în josul fiecărei pagini.

import { midiName, type RGB } from './golden';
import { midiToStaff, staffY, ledgerSteps, BOTTOM_LINE_STEP, TOP_LINE_STEP } from './staff';
import type { MelodyNote } from './imageMelody';

export const PAGE_W = 1240;
export const PAGE_H = 1754;
const MARGIN = 100;
const GAP = 14;                 // distanța dintre liniile portativului
const SYSTEM_H = 178;
const BARS_PER_SYSTEM = 4;
const BEATS_PER_BAR = 4;
const FIRST_TOP = 330;          // primul portativ de pe pagina 1 (sub titlu)
const OTHER_TOP = 150;
const FOOTER_TOP = PAGE_H - 150;
export const STRIP_Y = PAGE_H - 125;
export const STRIP_H = 22;
export const STRIP_X0 = MARGIN;
export const STRIP_X1 = PAGE_W - MARGIN;

export type Prim =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; w: number }
  | { k: 'head'; cx: number; cy: number; rx: number; ry: number; filled: boolean }
  | { k: 'dot'; cx: number; cy: number; r: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; color: RGB }
  | { k: 'text'; x: number; y: number; text: string; size: number; align: 'left' | 'center' | 'right'; bold?: boolean; gray?: boolean }
  | { k: 'clef'; x: number; y: number; size: number };

export interface ScorePage { width: number; height: number; prims: Prim[]; notes: MelodyNote[] }

export interface ScoreMeta { title: string; subtitle: string; instrument: string; bpm: number }

function systemsOnPage(page: number): number {
  const top = page === 0 ? FIRST_TOP : OTHER_TOP;
  return Math.floor((FOOTER_TOP - top) / SYSTEM_H);
}

export function layoutScore(melody: MelodyNote[], meta: ScoreMeta): ScorePage[] {
  const totalBeats = melody.length ? melody[melody.length - 1].startBeat + melody[melody.length - 1].beats : 0;
  const totalBars = Math.max(1, Math.ceil(totalBeats / BEATS_PER_BAR));
  const totalSystems = Math.ceil(totalBars / BARS_PER_SYSTEM);

  // împărțirea portativelor pe pagini
  const pageSystems: number[] = [];
  for (let left = totalSystems, p = 0; left > 0; p++) { const n = Math.min(left, systemsOnPage(p)); pageSystems.push(n); left -= n; }

  const pages: ScorePage[] = [];
  let sys = 0;
  pageSystems.forEach((nSys, p) => {
    const prims: Prim[] = [];
    const pageNotes: MelodyNote[] = [];
    if (p === 0) {
      prims.push({ k: 'text', x: PAGE_W / 2, y: 150, text: meta.title, size: 46, align: 'center', bold: true });
      prims.push({ k: 'text', x: PAGE_W / 2, y: 200, text: meta.subtitle, size: 24, align: 'center', gray: true });
      prims.push({ k: 'text', x: MARGIN, y: 270, text: `Instrument: ${meta.instrument}`, size: 20, align: 'left' });
      prims.push({ k: 'text', x: PAGE_W - MARGIN, y: 270, text: `♩ = ${meta.bpm}`, size: 22, align: 'right', bold: true });
    }
    const top = p === 0 ? FIRST_TOP : OTHER_TOP;
    for (let s = 0; s < nSys; s++, sys++) {
      const y0 = top + s * SYSTEM_H + 50;           // linia de sus
      const bottomY = y0 + 4 * GAP;
      for (let i = 0; i < 5; i++) prims.push({ k: 'line', x1: MARGIN, y1: y0 + i * GAP, x2: PAGE_W - MARGIN, y2: y0 + i * GAP, w: 1.4 });
      prims.push({ k: 'clef', x: MARGIN + 8, y: bottomY - GAP, size: GAP * 4 }); // 1 em = 4 spații; linia de bază = linia Sol
      let x = MARGIN + 62;
      if (sys === 0) {
        prims.push({ k: 'text', x: x + 14, y: y0 + 2 * GAP - 2, text: '4', size: 30, align: 'center', bold: true });
        prims.push({ k: 'text', x: x + 14, y: y0 + 4 * GAP - 2, text: '4', size: 30, align: 'center', bold: true });
        x += 36;
      }
      const barW = (PAGE_W - MARGIN - x) / BARS_PER_SYSTEM;
      for (let b = 0; b < BARS_PER_SYSTEM; b++) {
        const bar = sys * BARS_PER_SYSTEM + b;
        if (bar >= totalBars) break;
        const bx = x + b * barW;
        const last = bar === totalBars - 1;
        const ex = bx + barW;
        prims.push({ k: 'line', x1: ex, y1: y0, x2: ex, y2: bottomY, w: last ? 2 : 1.4 });
        if (last) prims.push({ k: 'line', x1: ex + 5, y1: y0, x2: ex + 5, y2: bottomY, w: 5 });
        if (b === 0) prims.push({ k: 'text', x: bx + 2, y: y0 - 12, text: String(bar + 1), size: 14, align: 'left', gray: true });
        for (const n of melody) {
          if (Math.floor(n.startBeat / BEATS_PER_BAR) !== bar) continue;
          pageNotes.push(n);
          const nx = bx + 24 + ((n.startBeat % BEATS_PER_BAR) / BEATS_PER_BAR) * (barW - 34);
          drawNote(prims, n, nx, bottomY);
        }
      }
    }
    // banda de culori a paginii: blocul negru de calibrare = 1 pătrime, apoi notele (lățime ∝ durata)
    const beatsHere = pageNotes.reduce((a, n) => a + n.beats, 0);
    const unit = (STRIP_X1 - STRIP_X0) / (beatsHere + 1);
    prims.push({ k: 'rect', x: STRIP_X0, y: STRIP_Y, w: unit - 1, h: STRIP_H, color: [0, 0, 0] });
    let sx = STRIP_X0 + unit;
    for (const n of pageNotes) {
      prims.push({ k: 'rect', x: sx, y: STRIP_Y, w: n.beats * unit - 1, h: STRIP_H, color: n.color });
      sx += n.beats * unit;
    }
    prims.push({ k: 'text', x: MARGIN, y: PAGE_H - 60, text: 'Music&Color · TSkyes', size: 16, align: 'left', gray: true });
    prims.push({ k: 'text', x: PAGE_W - MARGIN, y: PAGE_H - 60, text: `${p + 1} / ${pageSystems.length}`, size: 16, align: 'right', gray: true });
    pages.push({ width: PAGE_W, height: PAGE_H, prims, notes: pageNotes });
  });
  return pages;
}

function drawNote(prims: Prim[], n: MelodyNote, x: number, bottomY: number) {
  const pos = midiToStaff(n.midi);
  const y = staffY(pos.step, bottomY, GAP);
  const rx = GAP * 0.66, ry = GAP * 0.47;
  for (const s of ledgerSteps(pos.step)) {
    const ly = staffY(s, bottomY, GAP);
    prims.push({ k: 'line', x1: x - rx - 6, y1: ly, x2: x + rx + 6, y2: ly, w: 1.4 });
  }
  if (pos.sharp) {
    const sx = x - rx - 16;
    prims.push({ k: 'line', x1: sx - 3, y1: y - 13, x2: sx - 3, y2: y + 11, w: 1.5 });
    prims.push({ k: 'line', x1: sx + 3, y1: y - 11, x2: sx + 3, y2: y + 13, w: 1.5 });
    prims.push({ k: 'line', x1: sx - 7, y1: y - 3, x2: sx + 7, y2: y - 6, w: 3 });
    prims.push({ k: 'line', x1: sx - 7, y1: y + 6, x2: sx + 7, y2: y + 3, w: 3 });
  }
  prims.push({ k: 'head', cx: x, cy: y, rx: n.beats === 4 ? rx * 1.2 : rx, ry, filled: n.beats === 1 });
  if (n.beats < 4) {
    const middle = (BOTTOM_LINE_STEP + TOP_LINE_STEP) / 2;
    const up = pos.step < middle;
    const len = GAP * 3.5;
    if (up) prims.push({ k: 'line', x1: x + rx - 0.8, y1: y - 1, x2: x + rx - 0.8, y2: y - len, w: 1.6 });
    else prims.push({ k: 'line', x1: x - rx + 0.8, y1: y + 1, x2: x - rx + 0.8, y2: y + len, w: 1.6 });
  }
  if (n.beats === 3) {
    const onLine = (pos.step - BOTTOM_LINE_STEP) % 2 === 0;
    prims.push({ k: 'dot', cx: x + rx + 7, cy: onLine ? y - GAP / 2 : y, r: 2.6 });
  }
  prims.push({ k: 'text', x, y: bottomY + GAP * 4.2, text: midiName(n.midi), size: 13, align: 'center', gray: true });
}
