// Rulare: npx tsx --test test/level2.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spiralCells, continuousSpiralCells, sampleColors, nearestCell, buildMelody, melodyBeats, GOLDEN_ANGLE } from '../src/core/imageMelody';
import { layoutScore, PAGE_W, PAGE_H } from '../src/core/scoreLayout';
import { cellColor, type RGB } from '../src/core/golden';
import { PHI } from '../src/core/spiral';
import { DRUM_PATTERNS, renderDrums, drumPattern, goldenHitTimes } from '../src/core/drums';
import { melodyToNotes } from '../src/core/imageMelody';
import { renderLevel2Mix } from '../src/core/level2Mix';

test('unghiul de aur = 2π/φ² ≈ 137,5°', () => {
  assert.ok(Math.abs((GOLDEN_ANGLE * 180) / Math.PI - 137.5077640500378) < 1e-9);
  assert.ok(Math.abs(GOLDEN_ANGLE - 2 * Math.PI * (1 - 1 / PHI)) < 1e-12);
});

test('celulele: ~N în imagine, din centru spre exterior, acoperă colțurile (ambele trasee)', () => {
  for (const gen of [spiralCells, continuousSpiralCells]) for (const [w, h] of [[400, 300], [300, 400], [256, 256]]) {
    const cells = gen(w, h, 256);
    assert.ok(Math.abs(cells.length - 256) <= 16, `${gen.name} ${cells.length}`);
    const d = cells.map(c => Math.hypot(c.x - w / 2, c.y - h / 2));
    for (let i = 1; i < d.length; i++) assert.ok(d[i] >= d[i - 1]);
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const near = Math.min(...cells.map(c => Math.hypot(c.x - cx, c.y - cy)));
      assert.ok(near < 3 * cells[0].r, `colț ${cx},${cy}: ${near}`);
    }
  }
});

test('spirala continuă: celulele consecutive sunt vecine', () => {
  const cells = continuousSpiralCells(400, 300, 256);
  for (let i = 1; i < cells.length; i++) {
    const d = Math.hypot(cells[i].x - cells[i - 1].x, cells[i].y - cells[i - 1].y);
    // vecine pe curbă (≈ un pas) sau, la ieșirea/intrarea din imagine, pe spira următoare
    assert.ok(d <= 2 * cells[0].r * 1.15 || Math.hypot(cells[i].x - 200, cells[i].y - 150) > 140, `${i}: ${d}`);
  }
});

test('culoarea exactă a unei celule din matrice → aceeași celulă', () => {
  for (let row = -10; row <= 10; row++) for (let col = 0; col < 8; col++) assert.deepEqual(nearestCell(cellColor(col, row)), { col, row });
});

test('eșantionarea: o imagine în două culori dă culorile corecte', () => {
  const w = 40, h = 20, px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; px.set(x < 20 ? [204, 17, 0, 255] : [0, 32, 96, 255], i); }
  const cells = spiralCells(w, h, 40);
  const cols = sampleColors(px, w, h, cells);
  cells.forEach((c, i) => { if (Math.abs(c.x - 20) > c.r + 1) assert.deepEqual(cols[i], c.x < 20 ? [204, 17, 0] : [0, 32, 96]); });
});

test('ritm: repetițiile se unesc, fără a trece peste bara de măsură', () => {
  const red = cellColor(0, 0), blue = cellColor(4, 0);
  const colors: RGB[] = [red, red, red, blue, blue, blue, blue, blue, blue, red];
  const m = buildMelody(colors);
  assert.deepEqual(m.map(n => [n.startBeat, n.beats]), [[0, 3], [3, 1], [4, 4], [8, 1], [9, 1]]);
  assert.equal(melodyBeats(m), colors.length);
  for (const n of m) assert.ok(Math.floor(n.startBeat / 4) === Math.floor((n.startBeat + n.beats - 1) / 4));
});

test('partitura: toate notele apar o singură dată, totul în pagină', () => {
  const colors: RGB[] = Array.from({ length: 600 }, (_, i) => cellColor((i * 7) % 8, ((i * 3) % 21) - 10));
  const m = buildMelody(colors);
  const pages = layoutScore(m, { title: 'T', subtitle: 's', instrument: 'Pian', bpm: 96 });
  assert.ok(pages.length >= 2);
  assert.equal(pages.reduce((a, p) => a + p.notes.length, 0), m.length);
  for (const p of pages) {
    assert.equal(p.prims.filter(x => x.k === 'head').length, p.notes.length);
    for (const x of p.prims) {
      const xs = 'x' in x ? [x.x] : 'cx' in x ? [x.cx] : [x.x1, x.x2];
      const ys = 'y' in x ? [x.y] : 'cy' in x ? [x.cy] : [x.y1, x.y2];
      for (const v of xs) assert.ok(v >= 0 && v <= PAGE_W, `x ${v} (${x.k})`);
      for (const v of ys) assert.ok(v >= 0 && v <= PAGE_H, `y ${v} (${x.k})`);
    }
  }
});

test('ritmuri: tiparele au pași valizi; tresillo-ul dembow e 3+3+2', () => {
  for (const p of DRUM_PATTERNS) for (const h of p.hits) assert.ok(h.step >= 0 && h.step < 16, `${p.id} pas ${h.step}`);
  const kicks = (id: string) => drumPattern(id as any).hits.filter(h => h.piece === 'k').map(h => h.step).sort((a, b) => a - b);
  assert.deepEqual(kicks('fourfloor'), [0, 4, 8, 12]);
  assert.deepEqual(kicks('backbeat'), [0, 8]);
  const d = kicks('dembow'), gaps = d.map((x, i) => ((d[i + 1] ?? 16) - x) / 2); // în optimi
  assert.deepEqual(gaps, [3, 3, 2]);
});

test('ritmuri: tobele se aud în mix, aliniate la tempo (fără ritm → mix mai liniștit)', () => {
  const sr = 22050, n = sr * 4;
  const silent = new Float32Array(n), withDrums = new Float32Array(n);
  renderDrums(withDrums, sr, 'fourfloor', 120, 0, 4);
  const energy = (x: Float32Array) => x.reduce((a, v) => a + v * v, 0);
  assert.ok(energy(withDrums) > 10, 'ritmul produce sunet');
  // kick-ul cade pe timpi: la 120 BPM, timpul 2 = 0,5 s → energie mare în [0.5, 0.6] s
  const seg = (a: number, b: number) => energy(withDrums.slice(Math.floor(a * sr), Math.floor(b * sr)));
  assert.ok(seg(0.5, 0.6) > seg(0.6, 0.7) * 2, 'kick pe timp');
  assert.equal(energy(silent), 0);
});

test('melodie → note: timpi în secunde, monotoni, la tempo-ul ales', () => {
  const colors: RGB[] = [cellColor(0, 0), cellColor(1, 0), cellColor(2, 0), cellColor(3, 0)];
  const m = buildMelody(colors);
  const notes = melodyToNotes(m, 120, 'pian');
  assert.ok(Math.abs(notes[1].startSec - notes[0].startSec - 0.5) < 1e-9); // o pătrime la 120 BPM = 0,5 s
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i].startSec > notes[i - 1].startSec);
});

test('mix Nivelul 2: cu ritm se obține un fragment mai lung/energic decât fără', () => {
  const colors: RGB[] = Array.from({ length: 16 }, (_, i) => cellColor(i % 8, 0));
  const m = buildMelody(colors);
  const a = renderLevel2Mix(m, 105, 'pian', null, 22050);
  const b = renderLevel2Mix(m, 105, 'pian', 'backbeat', 22050);
  assert.equal(a.length, b.length);
  const e = (x: Float32Array) => x.reduce((s, v) => s + v * v, 0);
  assert.ok(e(b) > e(a));
});

test('ritmul auriu: pauze constante = φ × o pătrime, lovituri rare (nu continuu)', () => {
  const bpm = 105, beat = 60 / bpm;
  const t = goldenHitTimes(bpm, 0, 20);
  for (let i = 1; i < t.length; i++) assert.ok(Math.abs((t[i] - t[i - 1]) - beat * PHI) < 1e-9, `pauza ${i}`);
  // mai rare decât o pătrime: pasul auriu > un beat (φ ≈ 1,618)
  assert.ok(t[1] - t[0] > beat);
  // se aude în mix și aici
  const sr = 22050, buf = new Float32Array(sr * 10);
  renderDrums(buf, sr, 'golden', bpm, 0, 10);
  assert.ok(buf.reduce((a, v) => a + v * v, 0) > 10);
  assert.equal(drumPattern('golden').golden, true);
});
