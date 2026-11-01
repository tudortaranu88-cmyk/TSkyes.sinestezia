// Rulare: npx tsx --test test/level3.test.ts
// Dus-întors: melodie → partitură (banda de culori) → decodare → aceeași melodie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMelody } from '../src/core/imageMelody';
import { layoutScore, PAGE_W, PAGE_H, STRIP_Y, STRIP_H, type Prim } from '../src/core/scoreLayout';
import { decodeStrip, readScoreStrip, decodeScores } from '../src/core/scoreDecode';
import { cellColor, NOTES, ROW_MIN, ROW_MAX, type RGB } from '../src/core/golden';
import { STRIP_BG } from '../src/core/scoreLayout';

// Pictează dreptunghiurile benzii într-un buffer RGBA (doar rândurile benzii) – ca randarea reală.
function stripPixels(prims: Prim[]): Uint8Array {
  const px = new Uint8Array(PAGE_W * PAGE_H * 4).fill(255);
  for (const p of prims) {
    if (p.k !== 'rect') continue;
    const y0 = Math.max(0, Math.floor(p.y)), y1 = Math.min(PAGE_H, Math.ceil(p.y + p.h));
    const x0 = Math.max(0, Math.floor(p.x)), x1 = Math.min(PAGE_W, Math.ceil(p.x + p.w));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * PAGE_W + x) * 4;
      px[i] = p.color[0]; px[i + 1] = p.color[1]; px[i + 2] = p.color[2]; px[i + 3] = 255;
    }
  }
  return px;
}

const meta = { title: 'T', subtitle: 's', instrument: 'Pian', bpm: 105 };

test('fundalul benzii (magenta) nu coincide cu nicio culoare din matrice', () => {
  const isGap = (c: RGB) => c[0] > 150 && c[1] < 80 && c[2] > 110;
  assert.ok(isGap(STRIP_BG), 'fundalul trebuie detectat ca gol');
  for (let row = ROW_MIN; row <= ROW_MAX; row++) for (let col = 0; col < NOTES.length; col++)
    assert.ok(!isGap(cellColor(col, row)), `culoarea ${NOTES[col]} rând ${row} = ${cellColor(col, row)} declanșează golul`);
});

test('banda de pe o pagină: decodarea reproduce notele paginii', () => {
  const colors: RGB[] = Array.from({ length: 40 }, (_, i) => cellColor((i * 3) % 8, ((i * 2) % 11) - 5));
  const m = buildMelody(colors);
  const pages = layoutScore(m, meta);
  assert.equal(pages.length, 1);
  const samples = readScoreStrip(stripPixels(pages[0].prims), PAGE_W, PAGE_H);
  const dec = decodeStrip(samples);
  assert.deepEqual(dec.map(d => [d.col, d.row, d.beats]), pages[0].notes.map(n => [n.col, n.row, n.beats]));
});

test('dus-întors complet, multi-pagină: melodia reconstruită = originalul', () => {
  const colors: RGB[] = Array.from({ length: 500 }, (_, i) => cellColor((i * 7) % 8, ((i * 5) % 21) - 10));
  const m = buildMelody(colors);
  const pages = layoutScore(m, meta);
  assert.ok(pages.length >= 2);
  const decoded = decodeScores(pages.map(p => ({ rgba: stripPixels(p.prims), width: PAGE_W, height: PAGE_H })));
  assert.equal(decoded.length, m.length);
  assert.deepEqual(decoded.map(n => [n.col, n.row, n.beats, n.startBeat]), m.map(n => [n.col, n.row, n.beats, n.startBeat]));
});

test('Do4 (aproape alb) și culorile închise nu se confundă cu golurile gri', () => {
  const colors: RGB[] = [cellColor(7, 0), cellColor(4, 0), cellColor(7, 10), cellColor(3, -8), cellColor(7, 0)];
  const m = buildMelody(colors);
  const pages = layoutScore(m, meta);
  const dec = decodeStrip(readScoreStrip(stripPixels(pages[0].prims), PAGE_W, PAGE_H));
  assert.deepEqual(dec.map(d => [d.col, d.row]), m.map(n => [n.col, n.row]));
});

test('imagine care nu e partitură → eroare clară', () => {
  const px = new Uint8Array(PAGE_W * PAGE_H * 4).fill(255);
  assert.throws(() => decodeStrip(readScoreStrip(px, PAGE_W, PAGE_H)), /partitură|calibrare|Banda/);
});
